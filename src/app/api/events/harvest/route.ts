import { NextResponse } from "next/server";
import { orchestrateEventHarvest } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const result = await orchestrateEventHarvest();
  return NextResponse.json(result);
}
