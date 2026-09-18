# Cloudflare deployment targets

This repository contains two intentionally separate runtimes.

| Label | Entry point | Runtime | Deploy status |
|---|---|---|---|
| **FAILED — do not deploy** | `dist/index.js` | Node/Express with MySQL, OAuth, and tRPC | **Failed to deploy as a Cloudflare Worker.** Retained only as a historical reference; do not select this config. |
| **Sentinel Atlas Superagent** | `cloudflare/sentinel-atlas-superagent.js` | Cloudflare Worker | Deploy this target with Wrangler or the Cloudflare dashboard. |

The root `wrangler.jsonc` points to the Worker target. The old Node-shaped configuration is retained only as `wrangler.FAILED-node-build-do-not-deploy.jsonc` and is explicitly marked as failed. Do not select or deploy it.

From the repository root, deploy the Worker with:

```bash
export CLOUDFLARE_ACCOUNT_ID="YOUR_ACCOUNT_ID"
export CLOUDFLARE_API_TOKEN="YOUR_WORKERS_EDIT_TOKEN"
npx wrangler deploy
```

The expected public URL is `https://sentinel-atlas-superagent.<your-workers-subdomain>.workers.dev`. The Worker exposes `/`, `/health`, `/tools`, and `POST /agent/run`. It is bounded, read-only, synthetic-evidence-only, and fail-closed. It does not replace Aadi’s Digital Lab or Corpora AI.
