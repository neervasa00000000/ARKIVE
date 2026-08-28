export const config = { runtime: 'edge' }

export default function handler() {
  const fromEnv = process.env.DEPLOYER_PRIVATE_KEY?.trim()
  const configured = Boolean(fromEnv && fromEnv !== 'your_private_key_here')
  return Response.json({ ok: true, sponsorConfigured: configured })
}
