"use client";

import { motion } from "framer-motion";
import { Card, cardName, rankOf, suitOf, SUIT_GLYPH } from "@/lib/engine/cards";

const RED_SUITS = new Set([1, 2]); // hearts, diamonds

/** Cards outside 0-51 are hidden-opponent-card placeholders (see
 *  lib/room/redact.ts) -- they carry no real rank/suit on purpose, since the
 *  server never sends an opponent's actual card to any other client. Callers
 *  only need this to render a face-down back for them, so return a safe
 *  placeholder rather than letting suit/rank math run on a fake ID. */
export function faceLabel(card: Card): { rank: string; glyph: string; red: boolean } {
  if (card < 0 || card > 51) return { rank: "?", glyph: "", red: false };
  const name = cardName(card);
  const rank = name.slice(0, name.length - 1);
  const displayRank = rank === "T" ? "10" : rank;
  return { rank: displayRank, glyph: SUIT_GLYPH[suitOf(card)], red: RED_SUITS.has(suitOf(card)) };
}

interface Props {
  card: Card;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  highlight?: "safe" | "danger" | "picked" | "cut" | null;
  onClick?: () => void;
  title?: string;
  layoutIdPrefix?: string;
  style?: React.CSSProperties;
  className?: string;
}

const SIZES = {
  sm: "w-8 h-11 text-[10px]",
  md: "w-12 h-16 text-sm",
  lg: "w-16 h-24 text-lg",
};

const RING = {
  safe: "ring-2 ring-emerald-400",
  danger: "ring-2 ring-rose-400",
  picked: "ring-4 ring-amber-300",
  cut: "ring-4 ring-red-500",
};

export default function PlayingCard({
  card,
  faceDown = false,
  size = "md",
  disabled = false,
  highlight = null,
  onClick,
  title,
  layoutIdPrefix = "card",
  style,
  className = "",
}: Props) {
  const { rank, glyph, red } = faceLabel(card);

  return (
    <motion.button
      layout
      layoutId={`${layoutIdPrefix}-${card}`}
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      title={title}
      style={style}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      whileHover={onClick && !disabled ? { y: -8, scale: 1.06 } : undefined}
      whileTap={onClick && !disabled ? { scale: 0.95 } : undefined}
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      className={[
        SIZES[size],
        "relative rounded-md border shadow-md select-none flex flex-col items-center justify-center font-bold",
        faceDown
          ? "bg-gradient-to-br from-indigo-700 to-indigo-900 border-indigo-950"
          : "bg-white border-zinc-300",
        !faceDown && (red ? "text-red-600" : "text-zinc-900"),
        onClick && !disabled ? "cursor-pointer" : "cursor-default",
        disabled ? "opacity-40" : "",
        highlight ? RING[highlight] : "",
        className,
      ].join(" ")}
    >
      {faceDown ? (
        <div className="w-full h-full rounded-md bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_4px,transparent_4px,transparent_8px)]" />
      ) : (
        <>
          <span className="absolute top-0.5 left-1 leading-none">{rank}</span>
          <span className="text-2xl leading-none">{glyph}</span>
          <span className="absolute bottom-0.5 right-1 leading-none rotate-180">{rank}</span>
        </>
      )}
    </motion.button>
  );
}
