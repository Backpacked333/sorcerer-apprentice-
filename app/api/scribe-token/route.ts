import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/** Single-use Scribe token so the API key never ships to the browser. Expires after 15 minutes. */
export async function GET() {
  const responseInit = { headers: { "cache-control": "no-store" } };
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { token: null, reason: "ELEVENLABS_API_KEY not set; the browser recognizer is used instead" },
      responseInit,
    );
  }
  try {
    const client = new ElevenLabsClient({ apiKey, maxRetries: 0 });
    const { token } = await client.tokens.singleUse.create("realtime_scribe");
    return NextResponse.json({ token }, responseInit);
  } catch (error) {
    const value = error as { statusCode?: unknown; status?: unknown };
    const status = typeof value.statusCode === "number" ? value.statusCode : typeof value.status === "number" ? value.status : undefined;
    const reason = status === 401
      ? "ElevenLabs rejected the configured API key (401); the browser recognizer is used instead"
      : `ElevenLabs Scribe token request failed${status ? ` (${status})` : ""}; the browser recognizer is used instead`;
    return NextResponse.json({ token: null, reason }, responseInit);
  }
}
