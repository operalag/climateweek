import { NextResponse } from "next/server";
import { orchestrateDiscovery } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await orchestrateDiscovery({ skipSearch: body?.skipSearch });
  return NextResponse.json(result);
}
