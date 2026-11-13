# VAYRON migration status

## Visual baseline
`original/vayron.html` is the sole selected source of truth and is preserved byte-for-byte. The active page markup and CSS are extracted from this file. Do not replace it with the later `VAYRON — Streetwear Division.html` variant or redesign its layout, typography, colors, SVG artwork, splash screen, WebGL particle animation, theme behavior, or mobile behavior.

## Current implementation
- React + TypeScript + Vite application shell.
- Selected `vayron.html` markup and CSS mounted without visual redesign.
- Original splash WebGL particle effect, marquee, reveal transitions, and light/dark theme are retained.
- React portals own catalogue cards, category filters, size selection, cart, and checkout controls.
- The old hard-coded demo catalogue script is not loaded.
- Public catalogue, product images, variants, and stock are read from the VAYRON Supabase project using the publishable key and RLS.
- Cart is stored locally; checkout rechecks stock and product publication status before messenger handoff.
- WhatsApp opens with a prepared order message; Instagram opens separately and the message is copied for the customer.
- Currency display uses Kyrgyz som (KGS).
- Separate `/admin` route uses Supabase password sign-in and verifies the user's database profile role.
- Admin interface supports categories, product creation, size-level stock, product image upload, publication status, and store contacts.
- The selected source's fake WhatsApp and Instagram destinations are removed from the active storefront markup.
- `package-lock.json` is committed; CI uses `npm ci`.
- GitHub Actions runs dependency audit, TypeScript check, and Vite production build.

## Hosting
- Cloudflare Workers Builds is connected to `reomreat-commits/Vayron`, production branch `main`.
- Production build command: `npm run build`; deploy command: `npx wrangler deploy`; output: `dist`.
- Preview deployments are enabled.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured as public build-time variables for production and previews. No service-role or secret key is used in the browser.
- Production Worker: https://vayron.9mmm77v2jj.workers.dev
- The legacy Pages-style `public/_redirects` catch-all was removed because Workers Static Assets already uses SPA fallback routing and the old rule caused an infinite redirect validation error.

## Remaining before public launch
- Configure verified WhatsApp and Instagram destinations in store settings.
- Add real product data and images; no fictional products are seeded.
- Run desktop and mobile visual regression checks against `original/vayron.html`.
- Test admin sign-in, product creation/edit/delete, image upload, publication, and size-level stock workflows against the live Supabase project.
- Verify the deployed storefront and Supabase-backed catalogue in a real browser on desktop and iPhone.

## Latest verification
- GitHub Actions run #33 (PR #3, based on the latest application code) passed dependency installation, high-severity npm audit, TypeScript validation, and the production Vite build.
- Cloudflare Workers Build completed the Vite production build and deployed Worker version `4d90468c-6010-4c9b-a5d6-49e9a34ee78a`; deployment log reported success.
- Supabase sanity check: one admin profile, KGS settings row present, and no categories, products, variants, or product images seeded.
- Supabase Security Advisor currently warns that leaked-password protection is disabled. This Auth setting has not been changed from the code repository.

## Security
Never expose Supabase `service_role` or secret keys in `VITE_*` variables. Browser access uses only the publishable key. Database RLS policies are the actual authorization boundary; the frontend role check is only a UX gate.
