import { describe, it } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { ComputeStack } from "../lib/compute-stack";

function template() {
  const app = new cdk.App({
    context: {
      cognitoIssuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_el6h3ZKKw",
      cognitoClientId: "5c32fqvmu4fmta044ut5udm6j1",
      // pre-seed the default-VPC lookup so fromLookup resolves without AWS
      "vpc-provider:account=123456789012:filter.isDefault=true:region=ap-south-1:returnAsymmetricSubnets=true": {
        vpcId: "vpc-12345", vpcCidrBlock: "172.31.0.0/16", ownerAccountId: "123456789012",
        availabilityZones: [],
        subnetGroups: [{ name: "Public", type: "Public", subnets: [
          { subnetId: "subnet-1", cidr: "172.31.0.0/20", availabilityZone: "ap-south-1a", routeTableId: "rtb-1" },
        ] }],
      },
    },
  });
  const stack = new ComputeStack(app, "ChatAppCompute", { env: { account: "123456789012", region: "ap-south-1" } });
  return Template.fromStack(stack);
}

describe("ComputeStack", () => {
  it("ASG is scale-to-zero capable (min 0, max 1)", () => {
    template().hasResourceProperties("AWS::AutoScaling::AutoScalingGroup", {
      MinSize: "0", MaxSize: "1",
    });
  });
  it("security group opens no inbound ports", () => {
    template().hasResourceProperties("AWS::EC2::SecurityGroup", {
      SecurityGroupIngress: Match.absent(),
    });
  });
  it("provisions the wake Lambda + HTTP API JWT authorizer", () => {
    const t = template();
    // Assert the wake Lambda exists (CDK also synthesizes a custom-resource Lambda
    // for the OIDC provider, so we can't simply count 1; assert the specific fn).
    t.hasResourceProperties("AWS::Lambda::Function", {
      Description: "chat-app wake: sets the ASG desired capacity to 1",
      Runtime: "nodejs24.x",
      Handler: "index.handler",
    });
    t.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
      AuthorizerType: "JWT",
      JwtConfiguration: { Audience: ["5c32fqvmu4fmta044ut5udm6j1"] },
    });
  });
  it("instance role can set its own ASG desired capacity", () => {
    template().hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Action: "autoscaling:SetDesiredCapacity" }),
        ]),
      }),
    });
  });
});
