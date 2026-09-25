# Fix the published PaisaPulse reload loop

## Confirmed problem
The published `/auth` page fails before the sign-in screen renders because its browser bundle contains no Lovable Cloud URL or public key. The current custom publish configuration replaces the platform-provided browser values with empty strings when those server values are unavailable during bundling.

## Plan
1. Remove the conflicting environment-value override and use the platform's built-in browser configuration injection.
2. Keep the existing Lovable Cloud client and authentication flow unchanged.
3. Update the service-worker cache version/behavior if needed so previously installed copies cannot continue serving the broken bundle.
4. Confirm the preview still opens the PaisaPulse sign-in screen and reports no runtime errors.
5. Publish the corrected version, then open the public `/auth` page in a clean browser and verify the real sign-in screen appears without the reload error.

## Technical details
- Scope changes to the Vite/PWA publishing configuration only unless verification reveals a second independent error.
- Do not change the database, user data, authentication methods, or dashboard.
- Verify both desktop and mobile-sized browser views and inspect console/network failures before declaring the issue resolved.
