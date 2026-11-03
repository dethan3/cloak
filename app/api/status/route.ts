import { connection } from "next/server";
import { DEFAULT_PARENT, NEAR_AI_BASE } from "@/lib/swarm/types";

export async function GET() {
  await connection();
  const parent = (process.env.CLOAK_PARENT_ACCOUNT || DEFAULT_PARENT).trim().toLowerCase();
  return Response.json({
    nearAiConfigured: Boolean(process.env.NEAR_AI_KEY),
    parentAccount: parent,
    baseUrl: process.env.NEAR_AI_BASE_URL || NEAR_AI_BASE,
  });
}
