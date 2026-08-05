"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Natural (desktop) width of the game board. The board was designed as a
 * fixed desktop layout (an oval table with absolutely-positioned seats and
 * hand-tuned card positions), so on phones we shrink the whole thing rather
 * than trying to reflow it -- that keeps every sprite exactly where the
 * layout expects it, just scaled down to fit the screen.
 */
const NATURAL_WIDTH = 768;

/**
 * Scales its children down to fit the available container width while
 * preserving the desktop layout. On wide screens `scale` stays 1 and the
 * board renders at full size; on small (phone) screens it scales the whole
 * board down proportionally and reserves the matching vertical space so the
 * page doesn't scroll awkwardly.
 */
export default function ScaleToFit({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: NATURAL_WIDTH });

  useEffect(() => {
    function update() {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const available = outer.clientWidth;
      const scale = Math.min(1, available / NATURAL_WIDTH);
      setFit({ scale, height: inner.scrollHeight * scale });
    }

    update();

    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    if (outerRef.current) ro.observe(outerRef.current);
    return () => {
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={outerRef} className="w-full overflow-hidden">
      <div style={{ height: fit.height }} className="w-full">
        <div
          ref={innerRef}
          style={{ transform: `scale(${fit.scale})`, transformOrigin: "top left" }}
        >
          <div className="mx-auto flex flex-col items-center" style={{ width: NATURAL_WIDTH }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
