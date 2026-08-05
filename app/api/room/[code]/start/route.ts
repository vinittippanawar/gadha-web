import { NextResponse } from "next/server";
import { startRoom } from "@/lib/room/rooms";
import { respondWithRoom } from "@/lib/room/api";

export async function POST(req: Request, ctx: RouteContext<"/api/room/[code]/start">) {
  const { code } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const result = await startRoom(code, token);
  return respondWithRoom(result, token);
}
