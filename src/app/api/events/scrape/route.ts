import { NextResponse } from "next/server";
import { orchestrateEventDetails } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 540;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await orchestrateEventDetails(body?.limit ?? 10);
  return NextResponse.json(result);
}
