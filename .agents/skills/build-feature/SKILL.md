---
name: build-feature
description: Plans, implements, wires to Supabase, and browser-verifies a full-stack PaisaPulse feature end-to-end like Lovable.
---
# Build Full-Stack Feature
1. Inspect existing components in `src/` and check the live database schema via Supabase MCP (`list_tables`).
2. Implement or update the React/TypeScript UI using Tailwind CSS, shadcn/ui, and TanStack Query, wiring live Supabase queries instead of mock data.
3. Open the active localhost URL in the browser subagent, test the updated UI flow end-to-end, verify zero console or network errors, and fix any bugs automatically.
