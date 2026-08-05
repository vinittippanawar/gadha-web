import { NextResponse } from "next/server";
import { clearSeat } from "@/lib/room/rooms";
import { respondWithRoom } from "@/lib/room/api";

export async function POST(req: Request, ctx: RouteContext<"/api/room/[code]/clear-seat">) {
  const { code } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const seat = typeof body.seat === "number" ? body.seat : NaN;
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });
  if (!Number.isInteger(seat)) return NextResponse.json({ error: "invalid seat" }, { status: 400 });

  const result = await clearSeat(code, token, seat);
  return respondWithRoom(result, token);
}
