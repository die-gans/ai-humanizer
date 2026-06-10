import { NextRequest, NextResponse } from "next/server";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Market-validation waitlist capture.
 *
 * Local-only store: appends to eval/waitlist.jsonl so we can run the demand
 * test on a dev/preview deploy and read raw signups without standing up a DB.
 * Swap this for a real store (Supabase, per the PRD) before any production use.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, segment, source } = await req.json();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const record = {
      email: String(email).toLowerCase().trim(),
      segment: segment || "unknown",
      source: source || "waitlist",
      ts: new Date().toISOString(),
    };

    const dir = join(process.cwd(), "eval");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "waitlist.jsonl"), JSON.stringify(record) + "\n");

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Waitlist error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to join waitlist" },
      { status: 500 }
    );
  }
}
