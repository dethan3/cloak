import { connection } from "next/server";
import { runMission } from "@/lib/swarm/run";
import { parseMissionBody } from "@/lib/swarm/validate";

export async function POST(request: Request) {
  await connection();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: "The body was not JSON.",
        hint: "Send a mission object and try again.",
      },
      { status: 400 },
    );
  }

  const parsed = parseMissionBody(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error, hint: parsed.hint }, { status: 400 });
  }

  try {
    const result = await runMission(parsed.value);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The swarm failed.";
    const nearKey = message.includes("NEAR_AI_KEY");
    return Response.json(
      {
        error: message,
        hint: nearKey
          ? "Choose Simulation, or set NEAR_AI_KEY in .env.local and restart pnpm dev."
          : "Run the mission again. Simulation does not need a key.",
      },
      { status: nearKey ? 400 : 500 },
    );
  }
}
