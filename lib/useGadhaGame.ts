"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createGame, legalMoves, step } from "./engine/engine";
import { chooseBotMove, Level } from "./engine/bots";
import { makeRng, Rng } from "./engine/rng";
import { GameState } from "./engine/types";

export const YOU = 0;
export const NUM_PLAYERS = 6;

export function useGadhaGame(level: Level) {
  // Next.js server-renders this client component for the first paint. If the
  // initial deal were seeded from Date.now(), the server's random deal and
  // the client's (different) random deal would produce different HTML and
  // React would throw a hydration mismatch and re-render the whole tree.
  // Fix: seed 0 deterministically for that first render (server and client
  // compute the *same* deal), then re-seed for real randomness in an effect,
  // which only ever runs client-side, after hydration has already succeeded.
  const gameRng = useRef<Rng>(makeRng(0));
  const botRngs = useRef<Rng[]>(
    Array.from({ length: NUM_PLAYERS - 1 }, () => makeRng(0))
  );
  const randomized = useRef(false);
  const scoredRef = useRef(false);

  const [state, setState] = useState<GameState>(() => createGame({}, gameRng.current));
  const [scores, setScores] = useState<number[]>(() => Array(NUM_PLAYERS).fill(0));
  const [gameNo, setGameNo] = useState(1);
  const [botThinking, setBotThinking] = useState(false);

  // Runs once, client-side only, after the seed-0 tree has already been
  // hydrated -- this is what makes the real deal actually random per visit
  // without ever risking a server/client HTML mismatch.
  useEffect(() => {
    if (randomized.current) return;
    randomized.current = true;
    gameRng.current = makeRng();
    botRngs.current = Array.from({ length: NUM_PLAYERS - 1 }, () => makeRng());
    setState(createGame({}, gameRng.current));
  }, []);

  const applyStep = useCallback((prev: GameState, card: number) => {
    setState(step(prev, card, gameRng.current).state);
  }, []);

  // Reads `state` from closure rather than a setState updater: applyStep has
  // a side effect (setState from within a callback invoked by an effect),
  // and an updater function can be invoked more than once (React Strict Mode
  // does this deliberately), which would re-run step() for the same move.
  const playCard = useCallback(
    (card: number) => {
      if (state.finished || state.turn !== YOU) return;
      if (!legalMoves(state, YOU).includes(card)) return;
      applyStep(state, card);
    },
    [state, applyStep]
  );

  // Bot auto-play: whenever it's a bot's turn, "think" for a moment, then move.
  useEffect(() => {
    if (state.finished || state.turn === null || state.turn === YOU) {
      setBotThinking(false);
      return;
    }
    setBotThinking(true);
    const bot = state.turn;
    const delay = 450 + Math.random() * 500;
    const handle = setTimeout(() => {
      const rng = botRngs.current[bot - 1];
      const { card } = chooseBotMove(state, bot, level, rng);
      setBotThinking(false);
      applyStep(state, card);
    }, delay);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, level]);

  // Tally the series score exactly once per finished game.
  useEffect(() => {
    if (state.finished && !scoredRef.current) {
      scoredRef.current = true;
      if (state.gadha !== null) {
        setScores((prev) => {
          const copy = [...prev];
          copy[state.gadha!]++;
          return copy;
        });
      }
    }
  }, [state]);

  const newGame = useCallback((carryGadha: number | null) => {
    scoredRef.current = false;
    setState(createGame({ carryGadha }, gameRng.current));
    setGameNo((g) => g + 1);
  }, []);

  const restartSeries = useCallback(() => {
    scoredRef.current = false;
    setScores(Array(NUM_PLAYERS).fill(0));
    setGameNo(1);
    setState(createGame({}, gameRng.current));
  }, []);

  return { state, scores, gameNo, botThinking, playCard, newGame, restartSeries };
}
