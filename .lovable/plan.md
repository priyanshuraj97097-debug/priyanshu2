# Cloudflare Workers Production Readiness

1. Replace the existing deployment adapter with Cloudflare's official Vite plugin and Wrangler setup, retaining TanStack Start SSR, the custom error-safe server entrypoint, and existing application routes.
2. Add Worker configuration, deploy/preview scripts, Workers AI binding, Cloudflare types, and safeguards against committing or deploying local environment files.
3. Move remaining module-scope provider configuration reads to request-time server execution and correct deployment-specific assets, including the favicon and round logo.
4. Run TypeScript checks, production build, Cloudflare preview, and public-route/static-asset checks; report which authenticated/provider flows still require production credentials or a signed-in account.

## Technical details
- Use `@cloudflare/vite-plugin` before `tanstackStart()` and React, with Wrangler `main` pointing at the retained custom server entry.
- Store private provider credentials only as Cloudflare Worker secrets; configure the existing Workers AI binding without inventing a generic API-key flow.
- Keep the existing Lovable Cloud database/auth and chat architecture unchanged.
