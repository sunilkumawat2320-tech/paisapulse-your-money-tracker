---
trigger: always_on
---
# PaisaPulse Autonomous Development & Verification Rules
- Always check that the local dev server is running on `http://localhost:8080` or `http://localhost:8081` before browser testing (start `npm run dev` if needed).
- Whenever opening pages or verifying UI via the browser subagent, STRICTLY use Chrome **Profile 14** ("Dev / Antigravity"). Never touch, switch to, or inspect tabs in any other Chrome profile.
- After every UI, component, or database change, open the active localhost URL in the browser subagent, verify the page renders with zero console errors, and fix any issues automatically before finishing.
- Before writing or modifying database queries, inspect the live Supabase schema and Row-Level Security policies via the Supabase MCP tools (`list_tables`, `execute_sql`).
