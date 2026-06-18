#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ComputeStack } from "../lib/compute-stack.js";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "ap-south-1",
};

// chat-app reuses eventform's Cognito pool (us-east-1). The wake endpoint's JWT
// authorizer is gated on these; defaults are the chat-app app client.
new ComputeStack(app, "ChatAppCompute", {
  env,
  description: "chat-app EC2 ASG (scale-to-zero) running the Docker Compose stack",
});
