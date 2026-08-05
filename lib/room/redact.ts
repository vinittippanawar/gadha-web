import { GameState } from "../engine/types";
import { Room, SeatInfo } from "./types";

/**
 * A card ID that never collides with a real card (0-51) or with another
 * hidden card in the same state, so React keys and Framer Motion layoutIds
 * stay unique even though the actual card is secret.
 */
function hiddenCardId(seat: number, index: number): number {
  return -1 - seat * 100 - index;
}

/**
 * Everyone's own hand is real; every other seat's hand is replaced with
 * placeholder IDs of the same length, so counts and layout stay correct
 * without ever revealing what the cards actually are. `known[]` (used only
 * by the server's own bot AI) is stripped entirely for other seats too.
 */
export function redactState(state: GameState, viewerSeat: number): GameState {
  return {
    ...state,
    hands: state.hands.map((hand, seat) =>
      seat === viewerSeat ? hand : hand.map((_, i) => hiddenCardId(seat, i))
    ),
    known: state.known.map((k, seat) => (seat === viewerSeat ? k : [])),
  };
}

export interface PublicSeatInfo {
  kind: "human" | "bot" | "empty";
  name: string;
  connected: boolean;
}

function publicSeat(seat: SeatInfo): PublicSeatInfo {
  return {
    kind: seat.token === null && seat.kind === "human" ? "empty" : seat.kind,
    name: seat.name,
    connected: seat.kind === "bot" || Date.now() - seat.lastSeen < 30_000,
  };
}

export interface RoomView {
  code: string;
  status: Room["status"];
  version: number;
  mySeat: number;
  seats: PublicSeatInfo[];
  gadhaSeries: number[];
  gamesPlayed: number;
  state: GameState | null;
}

/** The only thing ever sent over the wire to a given client. */
export function viewRoomFor(room: Room, viewerSeat: number): RoomView {
  return {
    code: room.code,
    status: room.status,
    version: room.version,
    mySeat: viewerSeat,
    seats: room.seats.map(publicSeat),
    gadhaSeries: room.gadhaSeries,
    gamesPlayed: room.gamesPlayed,
    state: room.state ? redactState(room.state, viewerSeat) : null,
  };
}
