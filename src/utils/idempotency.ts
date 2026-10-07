/**
 * A client-generated key that identifies one logical write submission.
 *
 * Mint it once when the user starts a submission (e.g. reaches the wizard's
 * confirmation step), keep it in component state, and reuse it across retries —
 * a lost response, a TanStack Query retry, an impatient second click. The inspecta-api
 * collapses same-key requests into a single operation (see
 * `specs/tasks/T6.18-idempotency-key.md`). Regenerate it only when the user
 * starts a genuinely new submission (form reset).
 */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Environments without Web Crypto randomUUID (older test runners): good enough
  // for uniqueness within a session — the server still enforces real semantics.
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
