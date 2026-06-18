# Chat-App Deployment Guide

Step-by-step runbook to deploy chat-app at `chat.murugappan.dev` /
`chat-api.murugappan.dev`.

**Architecture at a glance:**

| Layer | Where it runs |
|---|---|
| Frontend (SPA) | **Cloudflare Pages** (global CDN; always up, independent of the backend) |
| Ingress | **Cloudflare Tunnel** → `server:3000` (outbound-only, zero inbound ports) |
| Compute (API + WebSocket) | **AWS EC2 Auto Scaling Group** (Graviton `t4g.small`), Docker Compose, `ap-south-1` |
| Database | **MongoDB Atlas** cluster in `ap-south-1` (Mumbai) |
| Auth | **AWS Cognito** (already deployed, `us-east-1`) — shared hosted-UI `https://auth.murugappan.dev` |
| Secrets at boot | **AWS SSM Parameter Store** (`/chat-app/*`, SecureString, `ap-south-1`) |

The EC2 box is **stateless** — MongoDB is on Atlas and the only on-box state
(the idle-activity stamp) is disposable, so the ASG can recycle/scale it freely.
No credentials are committed anywhere.

> **Regions:** EC2 ASG in **`ap-south-1`** (Mumbai); Atlas cluster co-located in
> `ap-south-1` for in-region DB latency. Cognito stays in **`us-east-1`** — its
> JWKS is fetched cross-region and cached, which is fine.

---

## Step 1 — Prerequisites (one-time accounts)

- **AWS account** with the CLI configured (`aws configure`).
- **MongoDB Atlas account** (https://cloud.mongodb.com) — create a **shared or
  dedicated cluster in `ap-south-1` (Mumbai)**. Whitelist `0.0.0.0/0` (the EC2
  IP changes on each scale-up) or use Atlas VPC peering.
- Grab the Atlas connection string (MongoDB URI with credentials embedded) —
  this becomes `DATABASE_URL` in SSM.
- **Cloudflare account** with `murugappan.dev` on Cloudflare DNS.
- **Cognito values** (already deployed via the cross-repo AuthStack — nothing to
  deploy here):
  - `COGNITO_ISSUER` = `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_el6h3ZKKw`
  - `COGNITO_CLIENT_ID` = `5c32fqvmu4fmta044ut5udm6j1`
  - Hosted-UI domain = `https://auth.murugappan.dev`
- Node 22 + npm locally (for CDK).

---

## Step 2 — CDK bootstrap

From `infra/cdk`, install deps once, then bootstrap:

```bash
cd infra/cdk && npm install
cdk bootstrap aws://<ACCOUNT_ID>/ap-south-1
```

Replace `<ACCOUNT_ID>` with your 12-digit AWS account ID.

---

## Step 3 — SSM SecureStrings (ap-south-1)

The EC2 instance reads these at boot. Create each as a **SecureString** in
**`ap-south-1`**. The key names must be exactly as shown — they are hard-coded in
the userdata.

```bash
R=ap-south-1
put() { aws ssm put-parameter --region $R --type SecureString --overwrite --name "$1" --value "$2"; }

put /chat-app/admin-api-key    '<strong-random-secret>'
put /chat-app/database-url     'mongodb+srv://<user>:<pw>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority'
put /chat-app/client-url       'https://chat.murugappan.dev'
put /chat-app/sentry-dsn       '<sentry-dsn-or-empty-string>'
put /chat-app/cognito-issuer   'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_el6h3ZKKw'
put /chat-app/cognito-client-id '5c32fqvmu4fmta044ut5udm6j1'
put /chat-app/tunnel-token     '<cloudflare-tunnel-token>'   # from Step 6
```

Notes:
- `client-url` is the SPA origin — used by the server for CORS.
- `sentry-dsn` may be an empty string `''` if you are not using Sentry.
- `tunnel-token` is obtained in Step 6 — come back and set it after creating
  the tunnel; you can deploy the CDK stack before setting it (the box will fail
  to start cloudflared, but the SSM params can be updated and the instance
  restarted at any time).

---

## Step 4 — Optional: branded wake-endpoint domain

The wake endpoint (`POST /wake`) starts the box from scale-zero. Without a custom
domain it falls back to an `execute-api.amazonaws.com` URL (fully functional).
To get `https://api-gateway-ap-south-1.murugappan.dev/chat-app/wake`:

1. **Create a REGIONAL ACM certificate** for `api-gateway-ap-south-1.murugappan.dev`
   in **`ap-south-1`** (regional — NOT us-east-1):
   ```bash
   aws acm request-certificate \
     --region ap-south-1 \
     --domain-name api-gateway-ap-south-1.murugappan.dev \
     --validation-method DNS
   ```
2. ACM shows a CNAME record for DNS validation — add it in **Cloudflare** (DNS-only,
   not proxied). Wait for certificate status to become `ISSUED`.
3. Note the certificate ARN — pass it as `-c wakeCertArn=<arn>` in Step 5.

Without the cert, omit `-c wakeCertArn=` entirely.

---

## Step 5 — Deploy the compute stack

```bash
cd infra/cdk
CDK_DEFAULT_REGION=ap-south-1 npx cdk deploy ChatAppCompute \
  -c wakeCertArn=<arn-from-step-4>
```

Omit `-c wakeCertArn=…` if you skipped Step 4.

**Save the stack outputs** — you will need them in the following steps:

| Output | Used for |
|---|---|
| `AsgName` | Manual scale override; GitHub Actions rollout |
| `GithubDeployRoleArn` | GitHub repo variable `AWS_ROLE_ARN` (Step 7) |
| `WakeUrl` | SPA env var `VITE_WAKE_URL` (Step 8) |
| `WakeDomainTarget` | DNS CNAME target (Step 6, only if cert was passed) |

The stack provisions: launch template (`t4g.small`, AL2023 ARM, 10 GB gp3,
IMDSv2), ASG (min 0 / max 1 / desired 1), instance role (SSM Session Manager +
read `/chat-app/*`), security group (no inbound), GitHub OIDC provider +
`chat-app-github-deploy` role, API Gateway wake endpoint (Cognito-authorized),
wake Lambda, and SNS email notification on cold-start.

**Shell access** (no SSH, no inbound): `aws ssm start-session --target <instance-id>`.

---

## Step 6 — DNS and Cloudflare Tunnel

### DNS (wake domain — only if you passed a cert in Step 4)

In Cloudflare DNS, add:

```
CNAME  api-gateway-ap-south-1  →  <WakeDomainTarget>
```

Set the record to **DNS-only (grey cloud, not proxied)** — API Gateway terminates
TLS with the ACM cert, and Cloudflare proxying would break SNI.

### Cloudflare Tunnel (API ingress)

1. Cloudflare dashboard → **Networks → Tunnels → Create a tunnel** (Cloudflared).
   Name it `chat-app`. Copy the **tunnel token**.
2. Store the token in SSM (go back to Step 3 and run the `put /chat-app/tunnel-token`
   line with the real value).
3. In the tunnel's **Public Hostnames**, add:
   - Hostname: `chat-api.murugappan.dev`
   - Service: `HTTP://server:3000`
   (cloudflared shares the compose network with the `server` container.)
4. Do **not** add a hostname for `chat.murugappan.dev` — Cloudflare Pages owns it.

After updating the SSM token, restart the instance (scale to 0 then 1) so the new
token is picked up at boot:

```bash
ASG=<AsgName-output>
aws autoscaling set-desired-capacity --region ap-south-1 --auto-scaling-group-name "$ASG" --desired-capacity 0
aws autoscaling set-desired-capacity --region ap-south-1 --auto-scaling-group-name "$ASG" --desired-capacity 1
```

---

## Step 7 — GitHub Actions (keyless ASG rollout)

In the GitHub repo (**Settings → Secrets and variables → Actions**), set the
following **repository variable**:

| Variable | Value |
|---|---|
| `AWS_ROLE_ARN` | `GithubDeployRoleArn` stack output from Step 5 |

The `deploy.yml` workflow assumes this role via GitHub OIDC (no AWS access keys
stored). Pushing a `v*` tag builds multi-arch images (linux/amd64 + linux/arm64)
and rolls the ASG via an instance refresh:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

**Note on scaled-to-zero rollouts:** When the box is scaled to zero (the normal idle state), the instance refresh is a no-op since there is no running instance — the new `:latest` image is picked up on the next wake (the userdata pulls it on boot). To force the new image immediately, wake the box first with `aws autoscaling set-desired-capacity ... --desired-capacity 1`, or it will roll naturally on the next cold start.

Ensure GHCR packages are **public** (package → visibility) so the EC2 box can pull
images without authentication.

---

## Step 8 — SPA on Cloudflare Pages

Deploy the `app/` directory to **Cloudflare Pages** (finalized in SP2 — frontend
sprint). Configure the following environment variables on the Pages project:

| Variable | Value |
|---|---|
| `VITE_COGNITO_ISSUER` | `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_el6h3ZKKw` |
| `VITE_COGNITO_CLIENT_ID` | `5c32fqvmu4fmta044ut5udm6j1` |
| `VITE_COGNITO_DOMAIN` | `https://auth.murugappan.dev` |
| `VITE_API_BASE_URL` | `https://chat-api.murugappan.dev` |
| `VITE_WS_BASE_URL` | `wss://chat-api.murugappan.dev` |
| `VITE_WAKE_URL` | `WakeUrl` stack output from Step 5 |

Add the custom domain `chat.murugappan.dev` in Cloudflare Pages → **Custom domains**.

---

## Step 9 — Scale-to-zero, cost, and teardown

### Scale-to-zero behavior

- **Scale-down (idle):** An on-box `systemd` timer (`chat-app-idle.timer`, every
  5 min) runs `idle-check.sh`. After 30 min of no real (non-`/health`) requests,
  the box sets its own ASG desired capacity to 0 and terminates. Free — no
  CloudWatch metrics.
- **Scale-up (wake):** The SPA's `ApiHealthGate` `POST`s the `WakeUrl` when it
  detects the API is down; the Lambda sets desired capacity to 1 and a fresh
  instance boots (~3–4 min cold start, including Docker image pull and compose up).
  Wake is Cognito-gated — anonymous visitors do not trigger it.
- Atlas data is unaffected by scale events — the box is stateless.

### Manual override

```bash
ASG=<AsgName-output>
# Stop (scale to zero):
aws autoscaling set-desired-capacity --region ap-south-1 --auto-scaling-group-name "$ASG" --desired-capacity 0
# Start (scale to one, ~3–4 min cold start):
aws autoscaling set-desired-capacity --region ap-south-1 --auto-scaling-group-name "$ASG" --desired-capacity 1
```

### Ongoing cost (always-on baseline)

| Resource | ~Monthly |
|---|---|
| EC2 `t4g.small` (ap-south-1) + 10 GB gp3 + public IPv4 | ~$15 |
| MongoDB Atlas (M0 free tier) | $0 |
| Cognito (50k MAU free) | $0 |
| Cloudflare Pages + Tunnel | $0 |
| **Total** | **~$15/mo** |

Scale-to-zero drops the EC2 + IPv4 line toward $0 when idle, so the real bill
tracks uptime, not the always-on figure.

### Teardown

```bash
# Destroy the compute stack (ASG, Lambda, API Gateway, OIDC role):
CDK_DEFAULT_REGION=ap-south-1 npx cdk destroy ChatAppCompute

# Remove SSM params:
aws ssm delete-parameters --region ap-south-1 \
  --names $(aws ssm get-parameters-by-path --region ap-south-1 --path /chat-app \
            --query 'Parameters[].Name' --output text)

# Atlas: delete the cluster from the Atlas console.
# Cloudflare Tunnel: delete from the Cloudflare dashboard.
# Cognito: the AuthStack is shared — do not destroy it unless all dependents are gone.
```
