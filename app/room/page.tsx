"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_SEATS, MIN_SEATS, DEFAULT_SEATS } from "@/lib/room/types";

const SEAT_CHOICES = Array.from(
  { length: MAX_SEATS - MIN_SEATS + 1 },
  (_, i) => MIN_SEATS + i
);

export default function RoomLanding() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [seatCount, setSeatCount] = useState(DEFAULT_SEATS);
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), seatCount }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      window.localStorage.setItem(`gadha:token:${data.view.code}`, data.token);
      router.push(`/room/${data.view.code}`);
    } finally {
      setCreating(false);
    }
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    router.push(`/room/${code}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-zinc-950 to-zinc-900 px-4">
      <div className="text-center">
        <div className="text-5xl mb-2">🫏</div>
        <h1 className="text-2xl font-bold text-zinc-100">Play Gadha Online</h1>
        <p className="text-zinc-400 text-sm mt-1">Create a room and share the code with friends.</p>
      </div>

      <div className="flex flex-col gap-3 w-72">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-zinc-100 text-sm text-center"
        />

        <div className="flex flex-col gap-1.5 items-center">
          <span className="text-xs text-zinc-400">Players</span>
          <div className="flex gap-1 flex-wrap justify-center">
            {SEAT_CHOICES.map((n) => (
              <button
                key={n}
                onClick={() => setSeatCount(n)}
                className={`w-9 h-9 rounded-lg text-sm font-semibold ${
                  seatCount === n
                    ? "bg-amber-400 text-amber-950"
                    : "bg-white/10 text-zinc-300 hover:bg-white/20"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-zinc-500">
            empty seats stay open for friends to join, or add bots yourself in the lobby
          </span>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-bold text-sm"
        >
          {creating ? "Creating..." : "Create a room"}
        </button>
      </div>

      <div className="flex items-center gap-3 w-72 text-zinc-500 text-xs">
        <div className="flex-1 h-px bg-white/10" />
        or
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <div className="flex gap-2 w-72">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Room code"
          maxLength={5}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-zinc-100 text-sm text-center font-mono tracking-widest"
        />
        <button
          onClick={handleJoin}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 font-semibold text-sm"
        >
          Join
        </button>
      </div>

      {error && <p className="text-rose-400 text-sm">{error}</p>}
    </div>
  );
}
