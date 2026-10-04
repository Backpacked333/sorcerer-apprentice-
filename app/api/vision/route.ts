import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CLAIMS_VISION_PROMPT, ClaimsVisionWire, fromClaimsWire, fromWire, VisionWire, VISION_PROMPT } from "@/lib/vision-schema";
import { gatewayConfigured } from "@/lib/model-contracts";

export const maxDuration = 30;
const VISION_TIMEOUT_MS = 8000;
const VISION_MAX_RETRIES = 0;
const VISION_MAX_OUTPUT_TOKENS = 500;
const VISION_FRAME_PROMPT = "Report the current state of this frame.";
const RequestBody = z.object({
  seq: z.number().int().nonnegative(),
  image: z.string().max(4 * 1024 * 1024),
  /** which sandbox the frame shows; absent or unknown means the invoice ERP (unchanged behaviour) */
  app: z.enum(["erp", "claims"]).optional().catch(undefined),
});

export async function POST(req: Request) {
  if (!gatewayConfigured()) return NextResponse.json({ error: "AI Gateway is not configured; vision is unavailable", mock: true, degraded: true }, { status: 503 });
  const parsed = RequestBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid vision request" }, { status: 400 });
  const body = parsed.data;
  const image = body.image.replace(/^data:image\/jpe?g;base64,/i, "");
  if (!image || image.length % 4 !== 0 || /[^A-Za-z0-9+/]/.test(image.replace(/={1,2}$/, "")))
    return NextResponse.json({ error: "invalid vision request" }, { status: 400 });
  const started = Date.now();
  const model = process.env.VISION_MODEL ?? "anthropic/claude-haiku-4.5";
  try {
    const generation = {
      model,
      timeout: { totalMs: VISION_TIMEOUT_MS },
      maxRetries: VISION_MAX_RETRIES,
      maxOutputTokens: VISION_MAX_OUTPUT_TOKENS,
      messages: [{
        role: "user" as const,
        content: [
          { type: "text" as const, text: VISION_FRAME_PROMPT },
          { type: "file" as const, data: image, mediaType: "image/jpeg" },
        ],
      }],
    };
    if (body.app === "claims") {
      const { output } = await generateText({
        ...generation,
        instructions: CLAIMS_VISION_PROMPT,
        output: Output.object({ schema: ClaimsVisionWire }),
      });
      return NextResponse.json({ seq: body.seq, ...fromClaimsWire(output), model, latencyMs: Date.now() - started });
    }
    const { output } = await generateText({
      ...generation,
      instructions: VISION_PROMPT,
      output: Output.object({ schema: VisionWire }),
    });
    return NextResponse.json({ seq: body.seq, ...fromWire(output), model, latencyMs: Date.now() - started });
  } catch (err) {
    const timeout = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json({ error: timeout ? "vision timeout" : "vision unavailable", seq: body.seq }, { status: timeout ? 504 : 502 });
  }
}
