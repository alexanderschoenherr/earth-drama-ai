# The President Is Available — Free On-Page Chat

This is an optional live-chat replacement staged alongside the existing Earth Drama companion. The original the-president-is-available-ai.html is intentionally unchanged.

## Already prepared in GitHub

- the-president-is-available-live-preview.html: mobile-friendly chat, no reader login.
- president-worker/src/index.js: Workers AI backend, presidential persona, origin checks, short-output and input limits, abuse limits.
- president-worker/wrangler.json: Cloudflare AI and rate-limiter bindings.
- companion-config/president-live.json: the preview stays disconnected until the real Worker URL is known.

No paid API key is embedded in the public page. Messages remain in browser tab memory, and are sent to Cloudflare AI for inference; do not enter sensitive data. No custom database is used.

## Cloudflare dashboard setup (owner account required)

1. Sign up or log in at https://dash.cloudflare.com/ and keep the account on the Workers Free plan. Do not upgrade to a paid plan.
2. Go to Workers & Pages, then Create application, then choose GitHub (sometimes called Import repository). Authorize GitHub and select alexanderschoenherr/earth-drama-ai.
3. Select branch main; importantly, choose Root directory: president-worker.
4. Set the Worker name to earth-drama-president, matching the wrangler configuration. No build command is needed. Deploy command: npx wrangler deploy. Select Save and Deploy.
5. Copy the actual deployed workers.dev URL shown by Cloudflare; it will resemble https://earth-drama-president.YOUR-SUBDOMAIN.workers.dev.
6. Open YOUR-ACTUAL-URL/health. It should return a JSON response with status configured and version 1. This does not yet verify model inference.
7. In GitHub, edit companion-config/president-live.json with the actual URL and change status from not_deployed to active. Commit it. Do not use the sample URL.
8. Open https://alexanderschoenherr.github.io/earth-drama-ai/the-president-is-available-live-preview.html. Test an ordinary question, "u pick", and "How can we replace you?" on mobile before putting the link in Substack.

Alternate terminal path: clone the repository, navigate into earth-drama-ai/president-worker, run npx wrangler login, then npx wrangler deploy. After deployment complete steps 5–8.

## Free tier and safeguards

Cloudflare Workers AI currently includes 10,000 neurons per day at no charge on Workers Free, resetting at 00:00 UTC. Exceeding it causes operations to fail until reset; Workers Free does not automatically bill excess AI consumption. Do not switch to Workers Paid.

https://developers.cloudflare.com/workers-ai/platform/pricing/
https://developers.cloudflare.com/workers/platform/limits/

Approximate per-Cloudflare-location limits are four requests per minute per visitor IP and 16 requests per minute for the chat as a whole. Rate limits are eventually consistent and are not strict global caps; IPs may be shared. Inputs are capped at 700 characters per user turn, eight recent messages, and 220 model output tokens. Free plan quotas are the actual zero-billing backstop. If quota is used, the page shows a friendly temporary-unavailability message.

## Preserve the working existing page

Do not overwrite the existing the-president-is-available-ai.html until the free live preview has been tested. Then either link the new preview directly from Substack or replace the original page in a separate deliberate change.

## Remaining unverified until owner Cloudflare deployment

- Cloudflare account access and deployment.
- Actual AI model response with Workers Free.
- Cross-origin browser request to deployed Worker from GitHub Pages.
- Mobile and quota-exhaustion behavior.

The configured model is @cf/google/gemma-4-26b-a4b-it. Its quality may differ from a larger commercial chatbot. Reassess quality after a real reader test rather than moving to paid services without permission.

GitHub Pages itself cannot execute a secure AI backend. The Cloudflare Worker handles model inference without exposing a secret key to the visitor. The fictional president cannot access real government systems.