import { NextResponse } from "next/server";
import { toAgentPrompt, toPolicy, toSopMarkdown } from "@/lib/export";
import { getMap } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId") ?? "";
  const format = url.searchParams.get("format") ?? "policy";
  const map = await getMap(sessionId);
  if (!map) return NextResponse.json({ error: "no map" }, { status: 404 });
  if (!map.confirmedAt) return NextResponse.json({ error: "Confirm the Work Map before exporting" }, { status: 409 });
  if (format === "sop") return new Response(toSopMarkdown(map), { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="workmap-${sessionId}.md"` } });
  if (format === "prompt") return new Response(toAgentPrompt(map), { headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="agent-prompt-${sessionId}.txt"` } });
  return new Response(JSON.stringify(toPolicy(map), null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="policy-${sessionId}.json"` } });
}
