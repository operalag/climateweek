import { NextResponse } from "next/server";
import { orchestrateEnrich } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await orchestrateEnrich(body?.limit ?? 20);
  return NextResponse.json(result);
}
