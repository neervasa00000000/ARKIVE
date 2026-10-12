export const config = { runtime: 'edge' }

export default function handler() {
  // Public sponsorship is disabled by server/sponsorPolicy.mjs.
  return Response.json({ ok: true, sponsorConfigured: false, uploadMode: 'wallet', chainId: 84532 })
}
