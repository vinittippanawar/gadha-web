import { NextResponse } from "next/server";
import { joinRoom } from "@/lib/room/rooms";
import { viewRoomFor } from "@/lib/room/redact";

export async function POST(req: Request, ctx: RouteContext<"/api/room/[code]/join">) {
  const { code } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.slice(0, 24) : "";

  const result = await joinRoom(code, name);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ token: result.token, view: viewRoomFor(result.room, result.seat) });
}
