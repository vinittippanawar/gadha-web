import { NextResponse } from "next/server";
import { setBotLevel } from "@/lib/room/rooms";
import { respondWithRoom } from "@/lib/room/api";
import { LEVELS } from "@/lib/engine/bots";

export async function POST(req: Request, ctx: RouteContext<"/api/room/[code]/bot-level">) {
  const { code } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const seat = typeof body.seat === "number" ? body.seat : NaN;
  const level = body.level;
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });
  if (!Number.isInteger(seat)) return NextResponse.json({ error: "invalid seat" }, { status: 400 });
  if (typeof level !== "string" || !(level in LEVELS)) {
    return NextResponse.json({ error: "invalid level" }, { status: 400 });
  }

  const result = await setBotLevel(code, token, seat, level as keyof typeof LEVELS);
  return respondWithRoom(result, token);
}
