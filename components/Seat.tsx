"use client";

import { motion } from "framer-motion";
import PlayingCard from "./PlayingCard";
import { Card } from "@/lib/engine/cards";

interface Props {
  label: string;
  handCount: number;
  hand: Card[]; // only used to give face-down cards distinct layoutIds
  alive: boolean;
  isTurn: boolean;
  isLeader: boolean;
  thinking: boolean;
  /** Online rooms only: an unclaimed bot seat waiting for a human, or a
   *  human who's gone quiet. Omit for solo-vs-bots, where neither applies. */
  connection?: "empty" | "disconnected";
  style?: React.CSSProperties;
}

export default function Seat({
  label,
  handCount,
  hand,
  alive,
  isTurn,
  isLeader,
  thinking,
  connection,
  style,
}: Props) {
  return (
    <div
      style={style}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
    >
      <div className="relative flex -space-x-6">
        {hand.slice(0, 7).map((c) => (
          <PlayingCard key={c} card={c} faceDown size="sm" layoutIdPrefix="bot-hand" />
        ))}
      </div>
      <motion.div
        animate={isTurn ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ repeat: isTurn ? Infinity : 0, duration: 1.1 }}
        className={[
          "px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border",
          connection === "empty"
            ? "bg-white/5 text-zinc-400 border-dashed border-zinc-500"
            : alive
              ? isTurn
                ? "bg-amber-300 text-amber-950 border-amber-500"
                : "bg-white/90 text-zinc-800 border-zinc-300"
              : "bg-emerald-100 text-emerald-700 border-emerald-300",
        ].join(" ")}
      >
        {isLeader && <span title="Leads this trick">🎯</span>}
        <span>{label}</span>
        {connection === "empty" ? (
          <span>waiting...</span>
        ) : alive ? (
          <span className="tabular-nums">{handCount}🂠</span>
        ) : (
          <span>🛡️ safe</span>
        )}
        {connection === "disconnected" && <span title="Not responding">📶</span>}
        {isTurn && thinking && <span className="animate-pulse">…</span>}
      </motion.div>
    </div>
  );
}
