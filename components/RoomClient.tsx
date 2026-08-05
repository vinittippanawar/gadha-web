"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEVELS, Level } from "@/lib/engine/bots";
import { useOnlineGadha } from "@/lib/useOnlineGadha";
import GameBoard, { SeatStatus } from "./GameBoard";

function tokenKey(code: string): string {
  return `gadha:token:${code}`;
}

function storedToken(code: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(tokenKey(code));
}

async function joinRoom(code: string, name: string) {
  const res = await fetch(`/api/room/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export default function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    setToken(storedToken(code));
    setCheckedStorage(true);
  }, [code]);

  const { view, error, busy, playCard, startGame, nextGame, setBotLevel } = useOnlineGadha(
    code,
    token
  );

  async function handleJoin() {
    setJoining(true);
    setJoinError(null);
    const data = await joinRoom(code, joinName.trim());
    setJoining(false);
    if (data.error) {
      setJoinError(data.error);
      return;
    }
    window.localStorage.setItem(tokenKey(code), data.token);
    setToken(data.token);
  }

  if (!checkedStorage) return null;

  if (!token) {
    return (
      <JoinScreen
        code={code}
        name={joinName}
        onName={setJoinName}
        onJoin={handleJoin}
        joining={joining}
        error={joinError}
      />
    );
  }

  if (error === "room not found") {
    return (
      <Centered>
        <p className="text-rose-400 font-semibold">This room doesn&apos;t exist any more.</p>
        <p className="text-zinc-400 text-sm">Rooms expire after 6 hours of inactivity.</p>
        <button
          onClick={() => router.push("/room")}
          className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold text-sm"
        >
          Create a new room
        </button>
      </Centered>
    );
  }

  if (error === "not a player in this room") {
    // A stale/foreign token for this code -- fall back to the join screen.
    window.localStorage.removeItem(tokenKey(code));
    return (
      <JoinScreen
        code={code}
        name={joinName}
        onName={setJoinName}
        onJoin={handleJoin}
        joining={joining}
        error="Your seat here expired -- rejoin below."
      />
    );
  }

  if (!view) {
    return (
      <Centered>
        <p className="text-zinc-400">Connecting to room {code}...</p>
      </Centered>
    );
  }

  if (view.status === "lobby") {
    return (
      <LobbyScreen
        code={code}
        view={view}
        onStart={startGame}
        onSetBotLevel={setBotLevel}
        busy={busy}
      />
    );
  }

  if (!view.state) return null; // playing but no state yet -- shouldn't happen, defensive

  const names = view.seats.map((s) => s.name);
  const seatStatus: Record<number, SeatStatus> = {};
  view.seats.forEach((s, i) => {
    if (s.kind === "empty") seatStatus[i] = { connection: "empty" };
    else if (!s.connected) seatStatus[i] = { connection: "disconnected" };
  });

  return (
    <GameBoard
      state={view.state}
      mySeat={view.mySeat}
      onPlay={playCard}
      gameNo={view.gamesPlayed}
      scores={view.gadhaSeries}
      log={[]}
      busy={busy}
      names={names}
      roomCode={view.code}
      seatStatus={seatStatus}
      onNextGame={nextGame}
      canControl={view.mySeat === 0}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-950 to-zinc-900 text-center px-4">
      {children}
    </div>
  );
}

function JoinScreen({
  code,
  name,
  onName,
  onJoin,
  joining,
  error,
}: {
  code: string;
  name: string;
  onName: (v: string) => void;
  onJoin: () => void;
  joining: boolean;
  error: string | null;
}) {
  return (
    <Centered>
      <div className="text-4xl mb-2">🫏</div>
      <h1 className="text-xl font-bold text-zinc-100">Join room {code}</h1>
      <input
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="Your name"
        maxLength={24}
        onKeyDown={(e) => e.key === "Enter" && !joining && onJoin()}
        className="mt-3 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-zinc-100 text-sm w-64 text-center"
      />
      <button
        onClick={onJoin}
        disabled={joining}
        className="mt-3 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-semibold text-sm"
      >
        {joining ? "Joining..." : "Join room"}
      </button>
      {error && <p className="text-rose-400 text-sm mt-2">{error}</p>}
    </Centered>
  );
}

function LobbyScreen({
  code,
  view,
  onStart,
  onSetBotLevel,
  busy,
}: {
  code: string;
  view: NonNullable<ReturnType<typeof useOnlineGadha>["view"]>;
  onStart: () => void;
  onSetBotLevel: (seat: number, level: Level) => void;
  busy: boolean;
}) {
  const isHost = view.mySeat === 0;
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${code}` : "";

  return (
    <Centered>
      <div className="text-4xl mb-2">🫏</div>
      <h1 className="text-xl font-bold text-zinc-100">Room {code}</h1>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="text-xs text-sky-300 underline mt-1"
      >
        {copied ? "link copied!" : "copy invite link"}
      </button>

      <div className="mt-6 flex flex-col gap-2 w-72">
        {view.seats.map((s, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
              i === view.mySeat ? "bg-sky-500/20 border border-sky-400/40" : "bg-white/5 border border-white/10"
            }`}
          >
            <span className="text-zinc-200">
              {i === view.mySeat ? "You" : s.name}
              {i === 0 && <span className="text-zinc-500 text-xs"> (host)</span>}
            </span>
            {s.kind === "bot" ? (
              isHost ? (
                <select
                  defaultValue="medium"
                  onChange={(e) => onSetBotLevel(i, e.target.value as Level)}
                  className="bg-zinc-800 text-zinc-200 text-xs rounded px-1 py-0.5"
                >
                  {Object.keys(LEVELS).map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-zinc-500 text-xs">bot</span>
              )
            ) : (
              <span className="text-emerald-400 text-xs">joined</span>
            )}
          </div>
        ))}
      </div>

      {isHost ? (
        <button
          onClick={onStart}
          disabled={busy}
          className="mt-6 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-bold"
        >
          Start game
        </button>
      ) : (
        <p className="mt-6 text-zinc-400 text-sm">Waiting for the host to start the game...</p>
      )}
      <p className="text-zinc-500 text-xs mt-4 max-w-xs">
        Open bot seats will be filled with bots at the chosen difficulty. Share the link above to
        let friends claim them instead.
      </p>
    </Centered>
  );
}
