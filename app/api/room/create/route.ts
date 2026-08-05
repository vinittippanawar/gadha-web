import { NextResponse } from "next/server";
import { createRoom } from "@/lib/room/rooms";
import { viewRoomFor } from "@/lib/room/redact";
import { DEFAULT_SEATS } from "@/lib/room/types";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.slice(0, 24) : "";
  const seatCount = Number.isInteger(body.seatCount) ? body.seatCount : DEFAULT_SEATS;

  const result = await createRoom(name, seatCount);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ token: result.token, view: viewRoomFor(result.room, result.seat) });
}
