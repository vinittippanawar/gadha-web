import { createGame, legalMoves, step } from "../engine/engine";
import { chooseBotMove, Level } from "../engine/bots";
import { makeRng, Rng } from "../engine/rng";
import { getStore } from "./store";
import { Room, ROOM_TTL_SECONDS, SEAT_COUNT, SeatInfo } from "./types";

// Excludes 0/O/1/I so codes are easy to read aloud and type back in.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomString(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function roomKey(code: string): string {
  return `gadha:room:${code.toUpperCase()}`;
}

export type RoomResult = Room | { error: string };

function isError(r: RoomResult): r is { error: string } {
  return "error" in r;
}

async function saveRoom(room: Room): Promise<void> {
  room.version += 1;
  await getStore().set(roomKey(room.code), room, ROOM_TTL_SECONDS);
}

/** Persists without bumping `version` -- presence tracking isn't a change
 *  polling clients need to react to. */
export async function touchSeat(room: Room, seat: number): Promise<void> {
  room.seats[seat].lastSeen = Date.now();
  await getStore().set(roomKey(room.code), room, ROOM_TTL_SECONDS);
}

export async function getRoom(code: string): Promise<Room | null> {
  return getStore().get<Room>(roomKey(code));
}

export function findSeatByToken(room: Room, token: string): number | null {
  const idx = room.seats.findIndex((s) => s.token === token);
  return idx === -1 ? null : idx;
}

/** Runs bots' turns to completion (or until they hand back to a human / the
 *  game ends). A fresh RNG per bot decision is fine here -- unlike the local
 *  solo hook, nothing needs to resume a specific pseudo-random *stream*
 *  across requests, since each server call is a one-shot unit of work. */
async function resolveBotTurns(room: Room, gameRng: Rng, cap = 30): Promise<void> {
  if (!room.state) return;
  let steps = 0;
  while (
    !room.state.finished &&
    room.state.turn !== null &&
    room.seats[room.state.turn].kind === "bot" &&
    steps < cap
  ) {
    const seat = room.state.turn;
    const botRng = makeRng();
    const { card } = chooseBotMove(room.state, seat, room.seats[seat].botLevel, botRng);
    room.state = step(room.state, card, gameRng).state;
    steps++;
  }
}

function recordGadhaIfFinished(room: Room): void {
  if (room.state?.finished) {
    if (room.state.gadha !== null) room.gadhaSeries[room.state.gadha]++;
    room.carryGadha = room.state.gadha;
  }
}

export async function createRoom(
  hostName: string
): Promise<{ room: Room; token: string; seat: number }> {
  const store = getStore();
  let code = randomString(5);
  for (let i = 0; i < 5 && (await store.get(roomKey(code))); i++) code = randomString(5);

  const token = randomString(24);
  const seats: SeatInfo[] = Array.from({ length: SEAT_COUNT }, (_, i) => ({
    kind: i === 0 ? "human" : "bot",
    token: i === 0 ? token : null,
    name: i === 0 ? hostName || "Player 1" : `Bot ${i}`,
    botLevel: "medium",
    lastSeen: Date.now(),
  }));

  const room: Room = {
    code,
    status: "lobby",
    seats,
    state: null,
    gadhaSeries: Array(SEAT_COUNT).fill(0),
    carryGadha: null,
    gamesPlayed: 0,
    createdAt: Date.now(),
    version: 1,
  };
  await store.set(roomKey(code), room, ROOM_TTL_SECONDS);
  return { room, token, seat: 0 };
}

export async function joinRoom(
  code: string,
  name: string
): Promise<{ room: Room; token: string; seat: number } | { error: string }> {
  const room = await getRoom(code);
  if (!room) return { error: "room not found" };
  if (room.status !== "lobby") return { error: "game already started" };
  const seatIdx = room.seats.findIndex((s) => s.kind === "bot");
  if (seatIdx === -1) return { error: "room is full" };

  const token = randomString(24);
  room.seats[seatIdx] = {
    kind: "human",
    token,
    name: name || `Player ${seatIdx + 1}`,
    botLevel: "medium",
    lastSeen: Date.now(),
  };
  await saveRoom(room);
  return { room, token, seat: seatIdx };
}

export async function setBotLevel(
  code: string,
  hostToken: string,
  seat: number,
  level: Level
): Promise<RoomResult> {
  const room = await getRoom(code);
  if (!room) return { error: "room not found" };
  if (room.status !== "lobby") return { error: "game already started" };
  if (findSeatByToken(room, hostToken) !== 0) return { error: "only the host can do that" };
  if (room.seats[seat]?.kind !== "bot") return { error: "that seat is not a bot" };
  room.seats[seat].botLevel = level;
  await saveRoom(room);
  return room;
}

export async function startRoom(code: string, token: string): Promise<RoomResult> {
  const room = await getRoom(code);
  if (!room) return { error: "room not found" };
  if (room.status !== "lobby") return { error: "already started" };
  if (findSeatByToken(room, token) !== 0) return { error: "only the host can start the game" };

  const rng = makeRng();
  room.state = createGame({ carryGadha: room.carryGadha }, rng);
  room.status = "playing";
  room.gamesPlayed += 1;
  await resolveBotTurns(room, rng);
  recordGadhaIfFinished(room);
  await saveRoom(room);
  return room;
}

export async function playCard(code: string, token: string, card: number): Promise<RoomResult> {
  const room = await getRoom(code);
  if (!room) return { error: "room not found" };
  if (room.status !== "playing" || !room.state) return { error: "game not in progress" };
  if (room.state.finished) return { error: "this game is over -- start the next one" };
  const seat = findSeatByToken(room, token);
  if (seat === null) return { error: "not a player in this room" };
  if (room.state.turn !== seat) return { error: "not your turn" };
  if (!legalMoves(room.state, seat).includes(card)) return { error: "illegal move" };

  room.seats[seat].lastSeen = Date.now();
  const rng = makeRng();
  room.state = step(room.state, card, rng).state;
  await resolveBotTurns(room, rng);
  recordGadhaIfFinished(room);
  await saveRoom(room);
  return room;
}

export async function nextGame(code: string, token: string): Promise<RoomResult> {
  const room = await getRoom(code);
  if (!room) return { error: "room not found" };
  if (findSeatByToken(room, token) !== 0) return { error: "only the host can start the next game" };
  if (!room.state?.finished) return { error: "the current game isn't finished yet" };

  const rng = makeRng();
  room.state = createGame({ carryGadha: room.carryGadha }, rng);
  room.gamesPlayed += 1;
  await resolveBotTurns(room, rng);
  recordGadhaIfFinished(room);
  await saveRoom(room);
  return room;
}

/** Marks a seat as recently active, without bumping `version` -- a pure
 *  heartbeat isn't a change clients need to react to. */
export async function heartbeat(code: string, token: string): Promise<RoomResult> {
  const room = await getRoom(code);
  if (!room) return { error: "room not found" };
  const seat = findSeatByToken(room, token);
  if (seat === null) return { error: "not a player in this room" };
  await touchSeat(room, seat);
  return room;
}

export { isError };
