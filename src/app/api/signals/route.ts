import { NextResponse } from "next/server";
import { orchestrateNews } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await orchestrateNews(body?.limit ?? 25);
  return NextResponse.json(result);
}
