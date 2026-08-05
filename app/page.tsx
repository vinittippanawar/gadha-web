"use client";

import { useState } from "react";
import Link from "next/link";
import GadhaApp from "@/components/GadhaApp";

export default function Home() {
  const [mode, setMode] = useState<"choose" | "solo">("choose");

  if (mode === "solo") return <GadhaApp />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-zinc-950 to-zinc-900 px-4">
      <div className="text-center">
        <div className="text-5xl mb-2">🫏</div>
        <h1 className="text-2xl font-bold text-zinc-100">Gadha</h1>
        <p className="text-zinc-400 text-sm mt-1">Two phases: catch pairs, then dodge the last hand.</p>
      </div>

      <div className="flex flex-col gap-3 w-72">
        <button
          onClick={() => setMode("solo")}
          className="px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-sm"
        >
          Solo vs 5 bots
        </button>
        <Link
          href="/room"
          className="px-4 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-indigo-950 font-bold text-sm text-center"
        >
          Play online with friends
        </Link>
      </div>
    </div>
  );
}
