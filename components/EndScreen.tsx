"use client";

import { motion } from "framer-motion";
import { sortHand } from "@/lib/engine/cards";
import { GameState } from "@/lib/engine/types";
import { seatName } from "@/lib/seatName";
import PlayingCard from "./PlayingCard";

interface Props {
  state: GameState;
  mySeat: number;
  names?: string[];
  onNextGame: () => void;
  onRestartSeries?: () => void;
  /** Whether this viewer is allowed to click the action buttons. In online
   *  rooms only the host can advance the series; solo mode is always true. */
  canControl?: boolean;
}

export default function EndScreen({
  state,
  mySeat,
  names,
  onNextGame,
  onRestartSeries,
  canControl = true,
}: Props) {
  const gadha = state.gadha;
  const youLost = gadha === mySeat;
  const gadhaName = gadha !== null ? seatName(gadha, mySeat, names) : null;
  const gadhaHand = gadha !== null ? sortHand(state.hands[gadha]) : [];
  const gadhaHandRedacted = gadhaHand.some((c) => c < 0 || c > 51);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full text-center flex flex-col gap-4"
      >
        <div className="text-5xl">🫏</div>
        {gadha === null ? (
          <h2 className="text-xl font-bold text-amber-300">Nobody is left holding cards!</h2>
        ) : (
          <h2 className={`text-xl font-bold ${youLost ? "text-rose-400" : "text-emerald-400"}`}>
            {youLost ? "You are the GADHA" : `${gadhaName} is the GADHA`}
          </h2>
        )}
        {gadha !== null && (
          <div className="flex gap-1 flex-wrap justify-center">
            {/* In online mode an opponent's hand is redacted (placeholder
                IDs -- the server never sends anyone else's real cards), so
                only reveal it face-up when the IDs are real. Solo mode's
                bot hands are always real, so this doesn't change that. */}
            {gadhaHand.map((c) => (
              <PlayingCard key={c} card={c} size="sm" layoutIdPrefix="end" faceDown={gadhaHandRedacted} />
            ))}
          </div>
        )}
        {state.timedOut && (
          <p className="text-xs text-amber-300/80">
            Turn cap reached - biggest hand loses as a last-resort fallback. This should be
            very rare: cycles are normally caught and reshuffled long before this.
          </p>
        )}
        {state.reshuffles > 0 && (
          <p className="text-xs text-sky-300/80">
            Deck reshuffled {state.reshuffles} time{state.reshuffles > 1 ? "s" : ""} this game
            to break a repeating cycle.
          </p>
        )}
        <p className="text-xs text-zinc-400">
          Next game: {gadha === null ? "leftovers split equally again" : `${youLost ? "you" : gadhaName} will pick up every leftover table card`}.
        </p>
        {canControl ? (
          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={onNextGame}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold text-sm"
            >
              Next game in series →
            </button>
            {onRestartSeries && (
              <button
                onClick={onRestartSeries}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 font-semibold text-sm"
              >
                Restart series
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 pt-2">Waiting for the host to start the next game...</p>
        )}
      </motion.div>
    </motion.div>
  );
}
