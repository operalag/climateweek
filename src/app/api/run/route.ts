import { NextResponse } from "next/server";
import { orchestrateFull } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await orchestrateFull({
    enrichLimit: body?.enrichLimit,
    newsLimit: body?.newsLimit,
    scoreLimit: body?.scoreLimit,
  });
  return NextResponse.json(result);
}
