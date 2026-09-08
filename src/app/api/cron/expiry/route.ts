import { NextResponse, type NextRequest } from "next/server";
import { runExpirySweep } from "@/server/services/expiry-service";

// Redundant EXTERNAL trigger for the same sweep instrumentation.ts already
// runs hourly in-process. Point an external cron (Namecheap's cron feature,
// a free service like cron-job.org, etc.) at this if you want a second,
// independent guarantee that the sweep runs even if the app process were
// ever restarted right before its hourly tick. Not required for correctness
// — the in-process timer alone already satisfies "reliable even if no user
// visits the website" — this is defense in depth.
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runExpirySweep();
  return NextResponse.json(result);
}
