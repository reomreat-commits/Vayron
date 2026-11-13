# VAYRON migration status

## Visual baseline
`original/VAYRON — Streetwear Division.html` is preserved byte-for-byte. The original markup and CSS remain the visual source of truth. Do not redesign the layout, typography, colors, imagery, transitions, or mobile behavior.

## Current implementation
- React + TypeScript + Vite application shell.
- Approved page markup and CSS are mounted without visual redesign.
- React portals own catalogue cards, category filters, size selection, cart, and checkout controls.
- The old hard-coded demo catalogue script is not loaded.
- Public catalogue, product images, variants, and stock are read from the VAYRON Supabase project using the publishable key and RLS.
- Cart is stored locally; stock is checked again before messenger handoff.
- WhatsApp opens with a prepared order message; Instagram opens separately and the message is copied for the customer.
- Currency display uses Kyrgyz som (KGS).

## Remaining before launch
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the hosting environment.
- Run a clean dependency install, TypeScript check, and production build.
- Add the owner-only product/category/variant/image management interface.
- Configure verified WhatsApp and Instagram destinations.
- Add real product data and images; do not seed fictional products.
- Run desktop and mobile visual regression checks against the original HTML.

## Security
Never expose Supabase `service_role` or secret keys in `VITE_*` variables. Browser access uses only the publishable/anon key; authorization must remain enforced by database RLS policies.
