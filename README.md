# VAYRON Storefront

React + TypeScript + Vite migration of the approved VAYRON storefront.

The original HTML is preserved byte-for-byte in `original/VAYRON — Streetwear Division.html` and remains the visual source of truth. The storefront's layout, typography, colors, imagery, animations, and mobile composition are not redesigned.

## Features

- Public catalogue backed by Supabase.
- Size variants and live stock checks.
- Local cart with quantity limits.
- Separate WhatsApp and Instagram order handoff.
- Owner-only administration at `/admin`: sign-in, categories, products, variants/stock, product photos, and store contacts.
- No customer registration or online payment flow.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`. Never expose a Supabase service-role key in browser code.

## Validation

```bash
npm run typecheck
npm run build
```

All owner operations are still subject to Supabase RLS. The browser-side admin check only controls the interface; it is not the security boundary.
