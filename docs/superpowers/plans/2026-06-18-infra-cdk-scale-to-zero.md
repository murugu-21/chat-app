# Infra: CDK + scale-to-zero + CI/CD (Sub-project 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make chat-app deployable on a scale-to-zero EC2 ASG (ap-south-1) behind a Cloudflare Tunnel, with a Cognito-gated wake endpoint, idle-stop, GitHub OIDC deploy, and a multi-arch GHCR build/rollout — mirroring eventform's pattern, trimmed for one container + external Atlas + reused Cognito.

**Architecture:** A single EC2 ASG (min 0 / max 1) runs `docker-compose.prod.yml` (server + cloudflared). The server stamps a `last-activity` file; an on-box systemd timer scales the ASG to 0 after idle. The SPA's ApiHealthGate POSTs an API-Gateway wake endpoint (Cognito JWT authorizer using chat-app's app client) → Lambda sets desired=1. CI builds a multi-arch image to GHCR; a tag/dispatch triggers an ASG instance refresh via a keyless OIDC role.

**Tech Stack:** AWS CDK v2 (TypeScript), Lambda (Node 22, plain .mjs), EC2 ASG + API Gateway HTTP + SNS, systemd, GitHub Actions, Docker Buildx.

## Global Constraints

- **Reuse, don't reinvent:** eventform's CDK/Lambda/workflow files are the source to ADAPT (read them from `/Users/murugappan/personal/eventform/...`). Copy the file, then apply only the listed chat-app deltas. Do not re-derive logic that already works there.
- **Region:** compute + wake API/Lambda in **ap-south-1**; Cognito stays **us-east-1** (cross-region JWT authorizer is fine).
- **Reused Cognito (eventform pool):** `COGNITO_ISSUER = https://cognito-idp.us-east-1.amazonaws.com/us-east-1_el6h3ZKKw`, `COGNITO_CLIENT_ID = 5c32fqvmu4fmta044ut5udm6j1`. These are the chat-app app-client values (public, not secrets) — use as CDK context defaults.
- **Instance:** t4g.small, arm64/Graviton, AL2023, 10 GB gp3, min 0 / max 1 / desired 1, default-VPC public subnet, SG no inbound, IMDSv2.
- **Image:** `ghcr.io/murugu-21/chat-app-server`, multi-arch `linux/amd64,linux/arm64`. Repo `murugu-21/chat-app`.
- **SSM params** (SecureString, ap-south-1, prefix `/chat-app/`): `database-url`, `admin-api-key`, `client-url`, `sentry-dsn`, `cognito-issuer`, `cognito-client-id`, `tunnel-token`. (`NODE_ENV`/`PORT`/`AUTH_MODE` are pinned in compose, not SSM.)
- **Wake email:** SNS notify to `murugu2001@gmail.com` (same as eventform), default-on, disable via `-c notifyEmail=`.
- **Wake domain:** branded `api-gateway-ap-south-1.murugappan.dev` base path `chat-app` (→ `/chat-app/wake`); REGIONAL ACM cert ARN passed via `-c wakeCertArn=` (operator-created, DNS-validated on Cloudflare). Falls back to the `execute-api` URL when the ARN is absent.
- **No DB migrations** anywhere (MongoDB Atlas, external).
- **Validation is local only:** `tsc`, `vitest`, `cdk synth` (with placeholder/real context), `docker compose config`. The live `cdk deploy`, SSM `put-parameter`, ACM cert, and Cloudflare Tunnel are the operator's (documented in DEPLOYMENT.md).
- ESM/NodeNext in `server/` (`.js` suffixes). All commands from repo root `/Users/murugappan/personal/chat-app` unless noted.

---

### Task 1: Server activity-stamping (scale-to-zero signal)

**Files:**
- Create: `server/src/lib/activity/activity.ts` (pure factory)
- Create: `server/src/lib/activity/index.ts` (env-wired instance)
- Create: `server/src/middleware/activity.middleware.ts`
- Create: `server/src/lib/activity/activity.test.ts`
- Modify: `server/src/config/env.ts` (add `ACTIVITY_FILE` optional)
- Modify: `server/src/index.ts` (mount activity middleware)
- Modify: `server/src/features/socket/index.ts` (stamp on connection)

**Interfaces:**
- Produces: `makeStamper(opts: { file?: string; throttleMs?: number; now?: () => number; write?: (f: string, data: string) => void }): () => void`
- Produces: `stampActivity: () => void` (env-wired) and `activityMW: RequestHandler`

- [ ] **Step 1: Add `ACTIVITY_FILE` to env** — in `server/src/config/env.ts`, inside `server: {}`:

```ts
        ACTIVITY_FILE: z.string().optional(),
```

- [ ] **Step 2: Write the failing test** — `server/src/lib/activity/activity.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { makeStamper } from './activity.js';

describe('makeStamper', () => {
    it('writes epoch seconds to the file on first call', () => {
        const write = vi.fn();
        const stamp = makeStamper({ file: '/tmp/act', throttleMs: 1000, now: () => 60_000, write });
        stamp();
        expect(write).toHaveBeenCalledWith('/tmp/act', '60');
    });

    it('throttles within the window and resumes after it', () => {
        const write = vi.fn();
        let t = 0;
        const stamp = makeStamper({ file: '/tmp/act', throttleMs: 1000, now: () => t, write });
        t = 0; stamp();          // writes
        t = 500; stamp();        // throttled
        t = 1500; stamp();       // writes
        expect(write).toHaveBeenCalledTimes(2);
    });

    it('is a no-op when no file is configured', () => {
        const write = vi.fn();
        const stamp = makeStamper({ file: undefined, throttleMs: 1000, now: () => 0, write });
        stamp();
        expect(write).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 3: Run it (RED)** — `npm test -- activity` → fails (no module).

- [ ] **Step 4: Implement** — `server/src/lib/activity/activity.ts`

```ts
import { writeFile } from 'node:fs/promises';

type Opts = {
    file?: string;
    throttleMs?: number;
    now?: () => number;
    // injectable for tests; default fire-and-forget async write that never throws
    write?: (file: string, data: string) => void;
};

const defaultWrite = (file: string, data: string): void => {
    void writeFile(file, data).catch(() => {});
};

export const makeStamper = (opts: Opts): (() => void) => {
    const throttleMs = opts.throttleMs ?? 10_000;
    const now = opts.now ?? (() => Date.now());
    const write = opts.write ?? defaultWrite;
    let last = -Infinity;
    return () => {
        if (!opts.file) return;
        const ms = now();
        if (ms - last < throttleMs) return;
        last = ms;
        write(opts.file, String(Math.floor(ms / 1000)));
    };
};
```

- [ ] **Step 5: Run it (GREEN)** — `npm test -- activity` → 3 pass.

- [ ] **Step 6: Env-wired instance + middleware**

`server/src/lib/activity/index.ts`:

```ts
import env from '../../config/env.js';
import { makeStamper } from './activity.js';

export const stampActivity = makeStamper({ file: env.ACTIVITY_FILE });
```

`server/src/middleware/activity.middleware.ts`:

```ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { stampActivity } from '../lib/activity/index.js';

// Stamp real (non-health) requests so the on-box idle-check sees the box in use.
export const activityMW: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/health')) stampActivity();
    next();
};
```

- [ ] **Step 7: Wire into `index.ts`** — add the import and mount the middleware BEFORE the feature routers (after `requestLoggerMW`):

```ts
import { activityMW } from './middleware/activity.middleware.js';
```
```ts
app.use(activityMW);
```

- [ ] **Step 8: Stamp on socket connection** — in `server/src/features/socket/index.ts`, import and call inside `io.on('connection', ...)`:

```ts
import { stampActivity } from '../../lib/auth/../activity/index.js';
```
(use the correct relative path `'../../lib/activity/index.js'`), and as the first line of the connection handler:
```ts
        stampActivity();
```

- [ ] **Step 9: Gates + commit**

Run: `cd server && npx tsc --noEmit && npm test && cd ..`
Expected: tsc clean; all tests pass (including activity).

```bash
git add server/src/lib/activity server/src/middleware/activity.middleware.ts server/src/config/env.ts server/src/index.ts server/src/features/socket/index.ts
git commit -m "feat: stamp last-activity for scale-to-zero idle detection"
```

---

### Task 2: Compose state volume + ACTIVITY_FILE

**Files:**
- Modify: `infra/compose/docker-compose.prod.yml`

- [ ] **Step 1: Add the state volume + env to the `server` service** — under `server.environment` add:

```yaml
      ACTIVITY_FILE: /state/last-activity
```
and add to the `server` service:

```yaml
    volumes:
      - ./state:/state
```

- [ ] **Step 2: Validate** (from repo root):

```bash
ADMIN_API_KEY=x DATABASE_URL=x CLIENT_URL=https://chat.murugappan.dev SENTRY_DSN=https://a@b.ingest.sentry.io/1 COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/p COGNITO_CLIENT_ID=c TUNNEL_TOKEN=t docker compose -f infra/compose/docker-compose.prod.yml config >/dev/null && echo OK
```
Expected: `OK`; merged config shows `server` with the `ACTIVITY_FILE` env and `./state:/state` volume.

- [ ] **Step 3: Commit**

```bash
git add infra/compose/docker-compose.prod.yml
git commit -m "feat: mount state volume + ACTIVITY_FILE for idle-check"
```

---

### Task 3: CDK scaffold + ComputeStack (compute only, no wake yet)

**Files:**
- Create: `infra/cdk/package.json`, `infra/cdk/tsconfig.json`, `infra/cdk/cdk.json`, `infra/cdk/.gitignore`
- Create: `infra/cdk/bin/chat-app.ts`
- Create: `infra/cdk/lib/compute-stack.ts`

**Reference to adapt:** `/Users/murugappan/personal/eventform/infra/cdk/` (`package.json`, `tsconfig.json`, `cdk.json`, `.gitignore`, `bin/eventform.ts`, `lib/compute-stack.ts`).

- [ ] **Step 1: Copy the cdk project scaffolding from eventform and rename**
  - Copy eventform's `infra/cdk/package.json` → set `"name": "chat-app-cdk"`. Keep the same deps/scripts (`build`/`test`/`synth`/`deploy`, `aws-cdk-lib`, `constructs`, `aws-cdk`, `aws-cdk-local`, `typescript`, `vitest`, `@types/node`).
  - Copy eventform's `infra/cdk/tsconfig.json`, `cdk.json`, `.gitignore` verbatim.
  - `cd infra/cdk && npm install` (pre-approved).

- [ ] **Step 2: Write `infra/cdk/bin/chat-app.ts`** — a single ComputeStack (no Auth/Cert; chat-app reuses eventform's):

```ts
#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ComputeStack } from "../lib/compute-stack";

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
```

- [ ] **Step 3: Create `infra/cdk/lib/compute-stack.ts` by adapting eventform's `compute-stack.ts`.** Copy it, then apply these deltas (keep everything else — the ASG, SG, IAM role + SetDesiredCapacity self-scope, launch template, IMDSv2, block device, OIDC deploy role, wake Lambda + API GW + SNS structure):

  - `repoUrl` default → `"https://github.com/murugu-21/chat-app"`.
  - SSM param ARN + reads: `/eventform/*` → `/chat-app/*`. The userdata `get`/`.env` block writes exactly these keys:
    ```
    ADMIN_API_KEY=$(get /chat-app/admin-api-key)
    DATABASE_URL=$(get /chat-app/database-url)
    CLIENT_URL=$(get /chat-app/client-url)
    SENTRY_DSN=$(get /chat-app/sentry-dsn)
    COGNITO_ISSUER=$(get /chat-app/cognito-issuer)
    COGNITO_CLIENT_ID=$(get /chat-app/cognito-client-id)
    TUNNEL_TOKEN=$(get /chat-app/tunnel-token)
    ```
  - Clone path `/opt/eventform` → `/opt/chat-app`; `cd .../infra/compose`; log file `chat-app-userdata.log`; all "eventform" log/echo strings → "chat-app".
  - The compose `docker-compose.aarch64` plugin install stays. `docker compose -f docker-compose.prod.yml up -d` (NO `pull`-then-`up` change needed; keep pull+up). Remove any eventform-specific `migrate`/Debezium notes.
  - State dir: `mkdir -p /opt/chat-app/infra/compose/state && chown 1000:1000 /opt/chat-app/infra/compose/state` (the `node:22-alpine` `node` user is uid 1000).
  - systemd: copy `chat-app-idle.service`/`.timer` (Task 6) from `/opt/chat-app/infra/systemd/`; `systemctl enable --now chat-app-idle.timer`; `chmod +x /opt/chat-app/infra/prod/idle-check.sh`.
  - OIDC deploy role: `githubRepo` default `"murugu-21/chat-app"`; role name `"chat-app-github-deploy"`; descriptions "chat-app".
  - Wake section (keep the structure): `webOrigin` default `"https://chat.murugappan.dev"`; `cognitoIssuer` context default `"https://cognito-idp.us-east-1.amazonaws.com/us-east-1_el6h3ZKKw"`; `cognitoClientId` context default `"5c32fqvmu4fmta044ut5udm6j1"`; `wakeDomainName` default `"api-gateway-ap-south-1.murugappan.dev"`; `wakeBasePath` default `"chat-app"`; `notifyEmail` default `"murugu2001@gmail.com"`; Lambda `description`/SNS `displayName` → "chat-app". Lambda code asset path stays `path.join(__dirname, "..", "lambda", "wake")`.
  - Drop eventform's "Neon/Redpanda is the only on-box state" comments; chat-app's box is stateless (Mongo is Atlas; the only on-box state is the disposable `state/last-activity`).

  > NOTE: The wake Lambda asset dir (`lambda/wake`) is created in Task 4, and the idle systemd units in Task 6. Until then `cdk synth` will fail on the missing Lambda asset — that's expected; Step 4's synth gate runs AFTER Task 4. For THIS task, the gate is `tsc` only.

- [ ] **Step 4: Gate (tsc only — synth needs Task 4's Lambda)**

Run: `cd infra/cdk && npx tsc --noEmit && cd ../..`
Expected: tsc clean.

- [ ] **Step 5: Commit**

```bash
git add infra/cdk/package.json infra/cdk/package-lock.json infra/cdk/tsconfig.json infra/cdk/cdk.json infra/cdk/.gitignore infra/cdk/bin/chat-app.ts infra/cdk/lib/compute-stack.ts
git commit -m "feat: add CDK ComputeStack (EC2 ASG scale-to-zero) for chat-app"
```

---

### Task 4: Wake Lambda

**Files:**
- Create: `infra/cdk/lambda/wake/decide.mjs`, `infra/cdk/lambda/wake/index.mjs`
- Create: `infra/cdk/test/wake-decide.test.ts`

**Reference to adapt:** `/Users/murugappan/personal/eventform/infra/cdk/lambda/wake/{decide.mjs,index.mjs}` and `test/wake-decide.test.ts`.

- [ ] **Step 1: Copy `decide.mjs` verbatim** (pure decision logic, no changes needed).

- [ ] **Step 2: Copy `index.mjs` and adapt strings only** — replace user-facing "EventForm"/"eventform" text in the SNS `Subject`/`Message` and comments with "chat-app". Logic (DescribeASG → decideWake → SetDesiredCapacity=1 → notify) is unchanged. Keep `ASG_NAME`/`TOPIC_ARN` env contract.

- [ ] **Step 3: Copy `test/wake-decide.test.ts` verbatim** (tests the pure `decide.mjs`; import path is `../lambda/wake/decide.mjs`).

- [ ] **Step 4: Gate — synth now works (Lambda asset exists)**

Run:
```bash
cd infra/cdk && npm test 2>&1 | tail -8 && \
  CDK_DEFAULT_REGION=ap-south-1 npx cdk synth ChatAppCompute \
    -c cognitoIssuer=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_el6h3ZKKw \
    -c cognitoClientId=5c32fqvmu4fmta044ut5udm6j1 >/dev/null && echo "SYNTH OK" ; cd ../..
```
Expected: wake-decide tests pass; `SYNTH OK`. (Synth uses a placeholder account → the default-VPC lookup may require `-c` cached context or a real account; if synth errors ONLY on the VPC `fromLookup` needing account/region, that's the same pre-existing limitation eventform has — note it and rely on the template tests in Task 5. If it errors on anything else, fix it.)

- [ ] **Step 5: Commit**

```bash
git add infra/cdk/lambda infra/cdk/test/wake-decide.test.ts
git commit -m "feat: add wake Lambda (ASG 0->1) + decide unit test"
```

---

### Task 5: CDK assertion tests (ComputeStack template)

**Files:**
- Create: `infra/cdk/test/compute-stack.test.ts`

- [ ] **Step 1: Write template-assertion tests** — instantiate `ComputeStack` with a concrete `env` (account `"123456789012"`, region `"ap-south-1"`) and the cognito context, then assert via `Template.fromStack`:

```ts
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
    t.resourceCountIs("AWS::Lambda::Function", 1);
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
```

> Adjust the assertions to the actual synthesized shape if any differ (e.g. `MinSize` may synth as `"0"` string — match what `cdk synth` emits). Use the Task-4 synth output as the reference for exact property names.

- [ ] **Step 2: Run** — `cd infra/cdk && npm test 2>&1 | tail -12 && cd ../..` → all pass.

- [ ] **Step 3: Commit**

```bash
git add infra/cdk/test/compute-stack.test.ts
git commit -m "test: add ComputeStack template assertions"
```

---

### Task 6: idle-check + systemd units

**Files:**
- Create: `infra/prod/idle-check.sh`
- Create: `infra/systemd/chat-app-idle.service`, `infra/systemd/chat-app-idle.timer`

**Reference to adapt:** `/Users/murugappan/personal/eventform/infra/prod/idle-check.sh` and `infra/systemd/eventform-idle.{service,timer}`.

- [ ] **Step 1: Copy `idle-check.sh` and adapt** — identical logic; change defaults: `ACTIVITY_FILE` default `/opt/chat-app/infra/compose/state/last-activity`, `REGION` default `ap-south-1`. Update the header comment (Mongo Atlas holds the data; the box is disposable). Keep all conservative "never scale down on error" paths and the IMDSv2 ASG resolution.

- [ ] **Step 2: Copy the systemd units and adapt** — `chat-app-idle.service`: `Description` chat-app; `Environment=ACTIVITY_FILE=/opt/chat-app/infra/compose/state/last-activity`, `Environment=IDLE_MINUTES=30`, `Environment=AWS_REGION=ap-south-1`, `ExecStart=/opt/chat-app/infra/prod/idle-check.sh`. `chat-app-idle.timer`: same `OnBootSec=10min` / `OnUnitActiveSec=5min`, `Unit=chat-app-idle.service`.

- [ ] **Step 3: Lint the shell script**

Run: `sh -n infra/prod/idle-check.sh && echo "shell syntax OK"`
Expected: `shell syntax OK`.

- [ ] **Step 4: Commit**

```bash
git add infra/prod/idle-check.sh infra/systemd/chat-app-idle.service infra/systemd/chat-app-idle.timer
git commit -m "feat: add idle-check + systemd timer for ASG scale-to-zero"
```

---

### Task 7: CI/CD workflows

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

**Reference to adapt:** `/Users/murugappan/personal/eventform/.github/workflows/{ci.yml,deploy.yml}`.

- [ ] **Step 1: Write `.github/workflows/ci.yml`** — on push/PR to `main` + `feat/**`/`fix/**`: checkout, setup Node 22 (npm cache, `server/package-lock.json`), `cd server && npm ci && npm run build && npm test`. (No pnpm, no DB services — chat-app server tests use mongodb-memory-server in-process.)

```yaml
name: CI
on:
  push: { branches: [main, "feat/**", "fix/**"] }
  pull_request: { branches: [main] }
jobs:
  test:
    name: Build & Test (server)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: server/package-lock.json
      - name: Install
        working-directory: server
        run: npm ci
      - name: Build
        working-directory: server
        run: npm run build
      - name: Test
        working-directory: server
        run: npm test
```

- [ ] **Step 2: Write `.github/workflows/deploy.yml`** — adapt eventform's: drop the Worker/Migrate image builds and the Neon `migrate` job (Atlas, no migrations); build ONE image `ghcr.io/${{ github.repository_owner }}/chat-app-server` from `server/Dockerfile`, multi-arch `linux/amd64,linux/arm64`; keep the `rollout` job (OIDC `role-to-assume: ${{ vars.AWS_ROLE_ARN }}`, `aws-region: ap-south-1`, `aws autoscaling start-instance-refresh` on the ASG). On `workflow_dispatch` + tags `v*`.

```yaml
name: Deploy
on:
  workflow_dispatch:
  push: { tags: ["v*"] }
env:
  REGISTRY: ghcr.io
  IMAGE: ghcr.io/${{ github.repository_owner }}/chat-app-server
jobs:
  build-push:
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGE }}
          tags: |
            type=ref,event=tag
            type=sha,prefix=sha-,format=short
            type=raw,value=latest,enable={{is_default_branch}}
      - uses: docker/build-push-action@v6
        with:
          context: ./server
          file: ./server/Dockerfile
          push: true
          platforms: linux/amd64,linux/arm64
          tags: |
            ${{ env.IMAGE }}:latest
            ${{ env.IMAGE }}:${{ steps.meta.outputs.version }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
  rollout:
    needs: build-push
    runs-on: ubuntu-latest
    environment: production
    permissions: { id-token: write, contents: read }
    env:
      ROLE_CONFIGURED: ${{ vars.AWS_ROLE_ARN != '' && 'yes' || '' }}
    steps:
      - name: Gate on AWS_ROLE_ARN
        id: gate
        run: |
          if [ -z "$ROLE_CONFIGURED" ]; then
            echo "::notice title=Rollout skipped::Set repo variable AWS_ROLE_ARN (the chat-app-github-deploy role) to enable."
            echo "skip=true" >> "$GITHUB_OUTPUT"
          else
            echo "skip=false" >> "$GITHUB_OUTPUT"
          fi
      - name: Configure AWS credentials (OIDC)
        if: steps.gate.outputs.skip == 'false'
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: ap-south-1
      - name: Start ASG instance refresh
        if: steps.gate.outputs.skip == 'false'
        run: |
          ASG=$(aws autoscaling describe-auto-scaling-groups \
            --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'ChatAppCompute')].AutoScalingGroupName | [0]" \
            --output text)
          [ -n "$ASG" ] && [ "$ASG" != "None" ] || { echo "No ChatAppCompute ASG found"; exit 1; }
          aws autoscaling start-instance-refresh --auto-scaling-group-name "$ASG"
```

- [ ] **Step 3: Lint the workflow YAML**

Run: `for f in .github/workflows/ci.yml .github/workflows/deploy.yml; do python3 -c "import yaml,sys; yaml.safe_load(open('$f')); print('$f OK')"; done`
Expected: both `OK`. (If pyyaml is missing, `pip install pyyaml` or skip with a note.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy.yml
git commit -m "ci: add server CI + multi-arch GHCR build & ASG rollout"
```

---

### Task 8: DEPLOYMENT.md (operator handoff)

**Files:**
- Create: `docs/DEPLOYMENT.md`

- [ ] **Step 1: Write the handoff checklist** — adapt eventform's `docs/DEPLOYMENT.md` structure, chat-app specifics. Cover, in order: (1) prereqs (Atlas cluster in ap-south-1 → connection string; the chat-app Cognito values already deployed: issuer `us-east-1_el6h3ZKKw`, client `5c32fqvmu4fmta044ut5udm6j1`); (2) `cdk bootstrap aws://<acct>/ap-south-1`; (3) put SSM SecureStrings under `/chat-app/*` in ap-south-1 (the 7 keys with a `put()` helper); (4) optional REGIONAL ACM cert for `api-gateway-ap-south-1.murugappan.dev` (DNS-validate on Cloudflare) → `-c wakeCertArn=`; (5) `CDK_DEFAULT_REGION=ap-south-1 cdk deploy ChatAppCompute -c wakeCertArn=…` → note `AsgName`, `GithubDeployRoleArn`, `WakeUrl`, `WakeDomainTarget`; (6) DNS: CNAME `api-gateway-ap-south-1` → WakeDomainTarget (DNS-only); Cloudflare Tunnel public hostname `chat-api.murugappan.dev` → `http://server:3000`; (7) GitHub repo variable `AWS_ROLE_ARN` = GithubDeployRoleArn; (8) SPA (`app/`) on Cloudflare Pages with `VITE_*` env (SP2); (9) cost + scale-to-zero note + teardown. Use the real values from the ledger; mark anything operator-specific as `<...>`.

- [ ] **Step 2: Self-check** — no `TODO`/`TBD`; the SSM keys match the CDK userdata (`admin-api-key`, `database-url`, `client-url`, `sentry-dsn`, `cognito-issuer`, `cognito-client-id`, `tunnel-token`); region ap-south-1 throughout.

- [ ] **Step 3: Commit**

```bash
git add docs/DEPLOYMENT.md
git commit -m "docs: add chat-app deployment handoff checklist"
```

---

## Self-Review

- Activity-stamping (decision #1) → Task 1 (+ compose Task 2). ✓
- Wake email to murugu2001@gmail.com (decision #2) → Task 3 ComputeStack `notifyEmail` default. ✓
- Branded wake domain (decision #3) → Task 3 `wakeDomainName`/`wakeBasePath` + `-c wakeCertArn=` fallback. ✓
- ASG scale-to-zero, SSM `/chat-app/*`, OIDC role, region ap-south-1, reused Cognito → Tasks 3/5. ✓
- Wake Lambda → Task 4. idle-check/systemd → Task 6. CI/CD multi-arch + rollout, no migrate → Task 7. Handoff → Task 8. ✓
- Validation is local (tsc/vitest/synth/compose config/yaml lint); live deploy is operator's. ✓
- Reuse strategy (adapt eventform files) is explicit per task with concrete deltas. ✓

## Not in this plan
- SP2 (frontend PKCE + ApiHealthGate + Cloudflare Pages) — separate.
- The live `cdk deploy`, SSM params, ACM cert, Cloudflare Tunnel/Pages setup (operator, per DEPLOYMENT.md).
