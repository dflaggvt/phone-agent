# Call Held Website

Static marketing and legal site for Call Held.

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production output is:

```text
web/dist
```

## Vercel Deployment

Create a Vercel project from this repository and set:

- Root Directory: `web`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

The site is static and does not load analytics by default. The waitlist signup form calls the Phone Agent backend.

Set this environment variable in production:

```text
VITE_API_BASE_URL=https://<backend-domain>
```

Local Vite development defaults beta signup submissions to `http://127.0.0.1:3000`.

## URLs For Google Play

After deployment, use the deployed Vercel domain or custom domain for:

- Marketing site: `/`
- Privacy policy: `/privacy`
- Terms of service: `/terms`
- Account deletion request page: `/account-deletion`

The account deletion page is intentionally not linked from the landing page and is marked `noindex`.
Before public launch, review legal copy with counsel.
