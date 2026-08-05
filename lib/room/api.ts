import { NextResponse } from "next/server";
import { findSeatByToken, RoomResult } from "./rooms";
import { viewRoomFor } from "./redact";

/** Shared response shape for every token-authenticated room action: resolve
 *  the acting player's own seat (for redaction) and return their view, or a
 *  4xx with an error message. */
export function respondWithRoom(result: RoomResult, token: string): NextResponse {
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const seat = findSeatByToken(result, token);
  if (seat === null) {
    return NextResponse.json({ error: "not a player in this room" }, { status: 403 });
  }
  return NextResponse.json({ view: viewRoomFor(result, seat) });
}
