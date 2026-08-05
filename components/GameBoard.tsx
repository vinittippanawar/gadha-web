"use client";

import { useMemo } from "react";
import { costs, legalMoves } from "@/lib/engine/engine";
import { GameState } from "@/lib/engine/types";
import { LogEntry } from "@/lib/useGadhaGame";
import { seatName } from "@/lib/seatName";
import Seat from "./Seat";
import HandRow from "./HandRow";
import TableCenter from "./TableCenter";
import StatusBar from "./StatusBar";
import EndScreen from "./EndScreen";

// Five fixed positions around the oval, filled in turn order starting from
// whoever is one seat after "you" -- so the player to your left always
// renders at the first slot, matching how you'd sit at a real table.
const SEAT_POS = [
  { left: "10%", top: "28%" },
  { left: "28%", top: "8%" },
  { left: "50%", top: "2%" },
  { left: "72%", top: "8%" },
  { left: "90%", top: "28%" },
];

export interface SeatStatus {
  connection?: "empty" | "disconnected";
}

interface Props {
  state: GameState;
  mySeat: number;
  onPlay: (card: number) => void;
  gameNo: number;
  scores: number[];
  log: LogEntry[];
  busy: boolean;
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
  log,
  busy,
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
  const myCosts = useMemo(() => costs(state, mySeat), [state, mySeat]);
  const isMyTurn = state.turn === mySeat && !state.finished;

  const otherSeats = useMemo(() => {
    const rest = [];
    for (let k = 1; k <= 5; k++) rest.push((mySeat + k) % 6);
    return rest;
  }, [mySeat]);

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

      <div className="flex gap-4 w-full max-w-6xl flex-1">
        <div className="flex-1 flex flex-col items-center gap-6">
          <div className="relative w-full max-w-3xl aspect-[16/8] rounded-[50%] bg-emerald-800/60 border-4 border-emerald-950 shadow-2xl flex items-center justify-center">
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
                style={{ left: SEAT_POS[i].left, top: SEAT_POS[i].top }}
              />
            ))}
            <TableCenter state={state} mySeat={mySeat} names={names} />
          </div>

          <div className="w-full flex flex-col items-center gap-2 bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="text-xs text-zinc-300 font-semibold flex items-center gap-2">
              YOUR HAND
              {state.phase === 2 && state.leader === mySeat && <span title="You lead this trick">🎯 you lead</span>}
            </div>
            <HandRow state={state} hand={myHand} legal={myLegal} costMap={myCosts} onPlay={onPlay} isMyTurn={isMyTurn} />
          </div>
        </div>

        <div className="hidden lg:flex flex-col w-72 bg-white/5 border border-white/10 rounded-2xl p-3 gap-1 h-[36rem] overflow-y-auto text-xs">
          <div className="font-semibold text-zinc-300 mb-1 sticky top-0">Log</div>
          {log.map((entry) => (
            <div
              key={entry.id}
              className={
                entry.kind === "pickup"
                  ? "text-rose-300"
                  : entry.kind === "cut"
                    ? "text-sky-300"
                    : entry.kind === "safe"
                      ? "text-emerald-300"
                      : entry.kind === "gadha"
                        ? "text-amber-300 font-semibold"
                        : "text-zinc-400"
              }
            >
              {entry.text}
            </div>
          ))}
        </div>
      </div>

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
