import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { gatewayConfigured } from "@/lib/gateway-auth";
import { z } from "zod";
import { fromWire, VisionWire, VISION_PROMPT } from "@/lib/vision-schema";

export const maxDuration = 30;
const RequestBody = z.object({ seq: z.number().int().nonnegative(), image: z.string().max(4 * 1024 * 1024) });

export async function POST(req: Request) {
  if (!gatewayConfigured()) return NextResponse.json({ error: "AI Gateway authentication not set; use NEXT_PUBLIC_EVENT_SOURCE=dom", mock: true }, { status: 503 });
  const parsed = RequestBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid vision request" }, { status: 400 });
  const body = parsed.data;
  const image = body.image.replace(/^data:image\/jpe?g;base64,/i, "");
  if (!image || image.length % 4 !== 0 || /[^A-Za-z0-9+/]/.test(image.replace(/={1,2}$/, "")))
    return NextResponse.json({ error: "invalid vision request" }, { status: 400 });
  const started = Date.now();
  const model = process.env.VISION_MODEL ?? "google/gemini-3.8-flash";
  try {
    const { output } = await generateText({
      model,
      reasoning: model === "google/gemini-3.8-flash" ? "minimal" : "provider-default",
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
