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

## Remaining before launch
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the hosting environment.
- Configure verified WhatsApp and Instagram destinations.
- Add real product data and images; no fictional products are seeded.
- Run desktop and mobile visual regression checks against `original/vayron.html`.
- Test admin upload and stock workflows against the live Supabase project.
- Choose hosting and publish the production build.

## Security
Never expose Supabase `service_role` or secret keys in `VITE_*` variables. Browser access uses only the publishable/anon key. Database RLS policies are the actual authorization boundary; the frontend role check is only a UX gate.
