import { handlers } from "@/lib/auth"

// Auth.js sine egne endepunkter (callback, csrf, session, signout).
// Proxy-laget hopper over /api/auth via matcher-regelen i src/proxy.ts.
export const { GET, POST } = handlers
