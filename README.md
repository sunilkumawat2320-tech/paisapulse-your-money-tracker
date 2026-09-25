# PaisaPulse: Your Money Tracker

Build "PaisaPulse", a mobile-first Progressive Web App (installable to the home screen) for personal finance tracking for Indian users. 

Stack: React + Vite + TypeScript + Tailwind CSS + Recharts + Supabase JS client. 

Currency: INR (₹), Indian number format (1,25,000), timezone Asia/Kolkata.

PWA Setup: manifest.json (name/short_name: PaisaPulse, theme: #0F766E, display: standalone, 192/512 icons), service worker for caching, an "Install app" banner, and share_target setup.

Design system: Clean modern fintech style, white cards, rounded-2xl corners, teal (#0F766E) accent, red/amber/green status indicators, Inter font, large tap targets, dark mode support, and skeleton loaders.

Set up bottom navigation with 5 tabs[cite: 1]:

1. Home

2. Capture (prominent central '+' button)

3. Budgets

4. Subscriptions

5. Owed to Me

Include placeholder screens and routes for each tab[cite: 1].

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6ab182de-7601-4f88-8cee-1e30cfd7a901).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
