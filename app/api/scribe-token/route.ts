import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/** Single-use Scribe token so the API key never ships to the browser. Expires after 15 minutes. */
export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ token: null, reason: "ELEVENLABS_API_KEY not set; the browser recognizer is used instead" });
  const client = new ElevenLabsClient({ apiKey });
  const { token } = await client.tokens.singleUse.create("realtime_scribe");
  return NextResponse.json({ token });
}
