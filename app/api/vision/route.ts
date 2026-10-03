import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { fromWire, VisionWire, VISION_PROMPT } from "@/lib/vision-schema";

export const maxDuration = 30;
const RequestBody = z.object({ seq: z.number().int().nonnegative(), image: z.string() });

export async function POST(req: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) return NextResponse.json({ error: "AI_GATEWAY_API_KEY not set; use NEXT_PUBLIC_EVENT_SOURCE=dom", mock: true }, { status: 503 });
  const parsed = RequestBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid vision request" }, { status: 400 });
  const body = parsed.data;
  const image = body.image.replace(/^data:image\/jpe?g;base64,/i, "");
  if (!image || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image))
    return NextResponse.json({ error: "invalid vision request" }, { status: 400 });
  const started = Date.now();
  const model = process.env.VISION_MODEL ?? "anthropic/claude-haiku-4.5";
  try {
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
