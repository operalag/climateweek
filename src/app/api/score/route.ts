import { NextResponse } from "next/server";
import { orchestrateScore } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await orchestrateScore(body?.limit ?? 50);
  return NextResponse.json(result);
}
