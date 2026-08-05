import { NextResponse } from "next/server";
import { playCard } from "@/lib/room/rooms";
import { respondWithRoom } from "@/lib/room/api";

export async function POST(req: Request, ctx: RouteContext<"/api/room/[code]/play">) {
  const { code } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const card = typeof body.card === "number" ? body.card : NaN;
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });
  if (!Number.isInteger(card) || card < 0 || card > 51) {
    return NextResponse.json({ error: "invalid card" }, { status: 400 });
  }

  const result = await playCard(code, token, card);
  return respondWithRoom(result, token);
}
