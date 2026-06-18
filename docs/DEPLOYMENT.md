# Deployment Guide

## Frontend — Cloudflare Pages

### Setup
1. **Connect GitHub Repository**
   - Go to [Cloudflare Pages](https://pages.cloudflare.com/)
   - Create a new project and connect the GitHub repository
   - Select the repository and branch to deploy from

2. **Build Configuration**
   - **Root Directory:** `app`
   - **Build Command:** `npm run build`
   - **Build Output Directory:** `dist` (relative to root `app`, resolves to `app/dist`)

3. **Environment Variables**
   Add the following environment variables in the Cloudflare Pages dashboard:

   ```
   VITE_BACKEND_URL=https://chat-api.murugappan.dev
   VITE_COGNITO_DOMAIN=https://auth.murugappan.dev
   VITE_COGNITO_CLIENT_ID=5c32fqvmu4fmta044ut5udm6j1
   VITE_REDIRECT_URI=https://chat.murugappan.dev/auth/callback
   VITE_WAKE_URL=<ComputeStack WakeUrl output from SP4 deploy>
   ```

4. **SPA Fallback**
   The `_redirects` file in `app/public/_redirects` ensures that all deep routes (e.g., `/auth/callback`, `/chat/:id`) serve `index.html` for client-side routing:
   ```
   /*    /index.html   200
   ```
   This file is automatically included in the build output (`app/dist/_redirects`).

### Production Domain
- The production SPA domain is `chat.murugappan.dev`
- This domain must be added to your Cloudflare Pages project
- The Cognito app client is already configured with:
  - Callback URL: `https://chat.murugappan.dev/auth/callback`
  - Logout URL: `https://chat.murugappan.dev`
- This domain must match the CORS origin configured in the backend (SP1)

### Deployment
Deployments are triggered automatically via Cloudflare Pages' Git integration when commits are pushed to the configured branch.
