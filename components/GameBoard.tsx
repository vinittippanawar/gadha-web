"use client";

import { useMemo } from "react";
import { legalMoves } from "@/lib/engine/engine";
import { GameState } from "@/lib/engine/types";
import { seatName } from "@/lib/seatName";
import { TrickEvent } from "@/lib/trickEvent";
import Seat from "./Seat";
import HandRow from "./HandRow";
import TableCenter from "./TableCenter";
import StatusBar from "./StatusBar";
import EndScreen from "./EndScreen";
import TrickBanner from "./TrickBanner";
import ScaleToFit from "./ScaleToFit";

// Hand-tuned positions around the top of the oval for every possible "other
// seats" count (games range 2-8 players, so 1-7 seats besides your own).
// Filled in turn order starting from whoever is one seat after "you" -- so
// the player to your left always renders at the first slot, matching how
// you'd sit at a real table.
const SEAT_POS_BY_COUNT: Record<number, { left: string; top: string }[]> = {
  1: [{ left: "50%", top: "2%" }],
  2: [
    { left: "18%", top: "22%" },
    { left: "82%", top: "22%" },
  ],
  3: [
    { left: "12%", top: "26%" },
    { left: "50%", top: "0%" },
    { left: "88%", top: "26%" },
  ],
  4: [
    { left: "10%", top: "28%" },
    { left: "36%", top: "4%" },
    { left: "64%", top: "4%" },
    { left: "90%", top: "28%" },
  ],
  5: [
    { left: "10%", top: "28%" },
    { left: "28%", top: "8%" },
    { left: "50%", top: "2%" },
    { left: "72%", top: "8%" },
    { left: "90%", top: "28%" },
  ],
  6: [
    { left: "6%", top: "30%" },
    { left: "20%", top: "10%" },
    { left: "38%", top: "0%" },
    { left: "62%", top: "0%" },
    { left: "80%", top: "10%" },
    { left: "94%", top: "30%" },
  ],
  7: [
    { left: "4%", top: "32%" },
    { left: "16%", top: "12%" },
    { left: "32%", top: "1%" },
    { left: "50%", top: "0%" },
    { left: "68%", top: "1%" },
    { left: "84%", top: "12%" },
    { left: "96%", top: "32%" },
  ],
};

export interface SeatStatus {
  connection?: "empty" | "disconnected";
}

interface Props {
  state: GameState;
  mySeat: number;
  onPlay: (card: number) => void;
  gameNo: number;
  scores: number[];
  busy: boolean;
  lastTrick: TrickEvent | null;
  /** Online rooms only. */
  names?: string[];
  roomCode?: string;
  seatStatus?: Record<number, SeatStatus>;
  onNextGame: () => void;
  onRestartSeries?: () => void;
  canControl?: boolean;
  /** Rendered above the difficulty picker / board -- lobby controls, etc. */
  toolbar?: React.ReactNode;
}

export default function GameBoard({
  state,
  mySeat,
  onPlay,
  gameNo,
  scores,
  busy,
  lastTrick,
  names,
  roomCode,
  seatStatus,
  onNextGame,
  onRestartSeries,
  canControl = true,
  toolbar,
}: Props) {
  const myHand = state.hands[mySeat];
  const myLegal = useMemo(() => legalMoves(state, mySeat), [state, mySeat]);
  const isMyTurn = state.turn === mySeat && !state.finished;

  const otherSeats = useMemo(() => {
    const rest = [];
    for (let k = 1; k < state.n; k++) rest.push((mySeat + k) % state.n);
    return rest;
  }, [mySeat, state.n]);
  const seatPositions = SEAT_POS_BY_COUNT[otherSeats.length] ?? SEAT_POS_BY_COUNT[5];

return (
    <div className="flex flex-col items-center gap-4 w-full min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 py-4 px-2">
      <StatusBar
        state={state}
        mySeat={mySeat}
        names={names}
        gameNo={gameNo}
        scores={scores}
        botThinking={busy}
        roomCode={roomCode}
      />

      {toolbar}

      {/* Fixed-height slot: reserved whether or not a banner is currently
          showing, so (a) the oval never shifts position when a cut happens
          and the layout doesn't jump, and (b) there's always clearance for
          seat badges, which sit above the oval's own top edge by design. */}
      <div className="h-20 flex items-center justify-center">
        <TrickBanner trick={lastTrick} mySeat={mySeat} names={names} />
      </div>

      {/* Scale the whole board to fit narrow screens (phones) while keeping
          the tuned desktop layout intact. */}
      <ScaleToFit>
        <div className="flex flex-col items-center gap-6 w-full max-w-3xl flex-1">
          <div className="relative mt-10 w-full aspect-[16/8] rounded-[50%] bg-emerald-800/60 border-4 border-emerald-950 shadow-2xl flex items-center justify-center">
            {otherSeats.map((seat, i) => (
              <Seat
                key={seat}
                label={seatName(seat, mySeat, names)}
                handCount={state.hands[seat].length}
                hand={state.hands[seat]}
                alive={state.alive[seat]}
                isTurn={state.turn === seat}
                isLeader={state.phase === 2 && state.leader === seat}
                thinking={busy && state.turn === seat}
                connection={seatStatus?.[seat]?.connection}
                style={{ left: seatPositions[i].left, top: seatPositions[i].top }}
              />
            ))}
            <TableCenter state={state} mySeat={mySeat} names={names} />
          </div>

          <div className="w-full flex flex-col items-center gap-2 bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="text-xs text-zinc-300 font-semibold flex items-center gap-2">
              YOUR HAND
              {state.phase === 2 && state.leader === mySeat && <span title="You lead this trick">🎯 you lead</span>}
            </div>
            <HandRow state={state} hand={myHand} legal={myLegal} onPlay={onPlay} isMyTurn={isMyTurn} />
          </div>
        </div>
      </ScaleToFit>

      {state.finished && (
        <EndScreen
          state={state}
          mySeat={mySeat}
          names={names}
          onNextGame={onNextGame}
          onRestartSeries={onRestartSeries}
          canControl={canControl}
        />
      )}
    </div>
  );
}
