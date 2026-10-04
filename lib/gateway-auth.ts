import { getVercelOidcTokenSync } from "@vercel/oidc";

export function gatewayConfigured(): boolean {
  if (process.env.AI_GATEWAY_API_KEY) return true;
  try { return Boolean(getVercelOidcTokenSync()); }
  catch { return false; }
}
