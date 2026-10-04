import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CLAIMS_VISION_PROMPT, ClaimsVisionWire, fromClaimsWire, fromWire, VisionWire, VISION_PROMPT } from "@/lib/vision-schema";

export const maxDuration = 30;
const RequestBody = z.object({
  seq: z.number().int().nonnegative(),
  image: z.string().max(4 * 1024 * 1024),
  /** which sandbox the frame shows; absent or unknown means the invoice ERP (unchanged behaviour) */
  app: z.enum(["erp", "claims"]).optional().catch(undefined),
});

export async function POST(req: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) return NextResponse.json({ error: "AI_GATEWAY_API_KEY not set; use NEXT_PUBLIC_EVENT_SOURCE=dom", mock: true }, { status: 503 });
  const parsed = RequestBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid vision request" }, { status: 400 });
  const body = parsed.data;
  const image = body.image.replace(/^data:image\/jpe?g;base64,/i, "");
  if (!image || image.length % 4 !== 0 || /[^A-Za-z0-9+/]/.test(image.replace(/={1,2}$/, "")))
    return NextResponse.json({ error: "invalid vision request" }, { status: 400 });
  const started = Date.now();
  const model = process.env.VISION_MODEL ?? "anthropic/claude-haiku-4.5";
  try {
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "Report the current state of this frame." },
          { type: "file" as const, data: image, mediaType: "image/jpeg" },
        ],
      },
    ];
    if (body.app === "claims") {
      const { output } = await generateText({
        model,
        instructions: CLAIMS_VISION_PROMPT,
        output: Output.object({ schema: ClaimsVisionWire }),
        timeout: { totalMs: 8000 },
        maxRetries: 0,
        maxOutputTokens: 500,
        messages,
      });
      return NextResponse.json({ seq: body.seq, ...fromClaimsWire(output), model, latencyMs: Date.now() - started });
    }
    const { output } = await generateText({
      model,
      instructions: VISION_PROMPT,
      output: Output.object({ schema: VisionWire }),
      timeout: { totalMs: 8000 },
      maxRetries: 0,
      maxOutputTokens: 500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Report the current state of this frame." },
            { type: "file", data: image, mediaType: "image/jpeg" },
          ],
        },
      ],
    });
    return NextResponse.json({ seq: body.seq, ...fromWire(output), model, latencyMs: Date.now() - started });
  } catch (err) {
    const timeout = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json({ error: timeout ? "vision timeout" : "vision unavailable", seq: body.seq }, { status: timeout ? 504 : 502 });
  }
}
