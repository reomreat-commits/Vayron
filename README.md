# VAYRON Storefront

React + TypeScript + Vite migration of the explicitly selected `vayron.html` storefront.

The original file is preserved byte-for-byte in `original/vayron.html`. Its layout, typography, colors, SVG artwork, splash screen, WebGL particle animation, theme behavior, and responsive composition are the visual source of truth.

## Features

- Public catalogue backed by Supabase.
- Size variants and stock checks.
- Local cart with quantity limits.
- Separate WhatsApp and Instagram order handoff.
- Owner-only administration at `/admin`: sign-in, categories, products, variants/stock, product photos, and store contacts.
- No customer registration or online payment flow.

## Local development

```bash
npm ci
cp .env.example .env
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`. Never expose a Supabase service-role key in browser code.

## Validation

The GitHub Actions workflow runs dependency audit, TypeScript validation, and a production Vite build on pushes and pull requests to `main`.


```bash
npm run typecheck
npm run build
npm audit --audit-level=high
```

All owner operations remain subject to Supabase RLS. The browser-side admin check is not the security boundary.
