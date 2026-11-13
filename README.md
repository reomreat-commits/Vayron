# VAYRON Storefront

React + TypeScript + Vite migration of the approved VAYRON storefront.

The original HTML is preserved in `original/VAYRON — Streetwear Division.html` and remains the visual source of truth. Do not redesign the existing layout, typography, colors, animations, imagery, or mobile behavior.

The storefront uses Supabase for the public catalogue and stock, with a local cart and WhatsApp/Instagram order handoff. Only a Supabase publishable key may be used in browser environment variables; never expose a service-role key.

See `docs/MIGRATION.md` for implementation status and launch requirements.