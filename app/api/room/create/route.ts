import { NextResponse } from "next/server";
import { createRoom } from "@/lib/room/rooms";
import { viewRoomFor } from "@/lib/room/redact";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.slice(0, 24) : "";
  const { room, token, seat } = await createRoom(name);
  return NextResponse.json({ token, view: viewRoomFor(room, seat) });
}
