import { NextResponse } from "next/server";
import { findSeatByToken, getRoom, touchSeat } from "@/lib/room/rooms";
import { viewRoomFor } from "@/lib/room/redact";

// Polling doubles as the presence heartbeat: any client actively fetching
// state is, by definition, still around. No separate "I'm still here" call
// needed for the common case.
export async function GET(req: Request, ctx: RouteContext<"/api/room/[code]/state">) {
  const { code } = await ctx.params;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "room not found" }, { status: 404 });
  const seat = findSeatByToken(room, token);
  if (seat === null) return NextResponse.json({ error: "not a player in this room" }, { status: 403 });

  const view = viewRoomFor(room, seat); // compute before touchSeat mutates lastSeen for THIS seat's own display
  await touchSeat(room, seat);
  return NextResponse.json({ view });
}
