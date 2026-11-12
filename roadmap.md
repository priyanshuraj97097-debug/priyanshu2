- [ ] Open directly to chat using private browser-scoped anonymous sessions; remove all sign-up/sign-in gates and controls.
- [ ] Fix confirmed individual conversation deletion across persistent and browser-local guest storage.
- [ ] Diagnose and fix image generation using a supported provider, actionable errors, and verified image display/download.

# Deployment readiness

- [x] Add high-quality image generation with a secure model fallback, chat preview/download, and confirmed optimistic conversation deletion.

- [x] Configure TanStack Start, Cloudflare Vite plugin, and Wrangler Worker output.
- [x] Protect local env files and bind Workers AI for image generation.
- [x] Fix verified server typing, runtime date, legacy redirect, and favicon issues.
- [x] Verify production build, TypeScript, Wrangler dry-run, and local Worker preview routes/assets.
- [ ] Deploy and verify live Google sign-in, Gemini chat, and image generation (blocked: Cloudflare account authorization and deployed auth/provider configuration are unavailable in this session).
- [ ] Validate Groq, Mistral, OpenRouter, Cohere, Hugging Face, and Workers AI chat fallback (blocked: these chat providers/fallback are not implemented in the existing code; Workers AI is currently image-generation only).
