"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import type { Pose, Voice } from "./vrm-avatar";

// Separate chunk: three + three-vrm are fetched only where an avatar is actually shown.
const VrmAvatar = dynamic(() => import("./vrm-avatar"), { ssr: false });

const noSubscribe = () => () => {};
let webgl: boolean | undefined;
function hasWebGL() {
  webgl ??= (() => {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
    } catch {
      return false;
    }
  })();
  return webgl;
}

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const m = window.matchMedia(reducedQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/**
 * The character's VRM (ADR-005), or `portrait` when there is no file, no WebGL, or loading fails.
 * The portrait also stands in while the model loads, so the stage never shows an empty spot.
 */
export function Avatar({ url, portrait, voice, pose }: { url: string | null; portrait: ReactNode; voice?: Voice; pose?: Pose }) {
  const canRender = useSyncExternalStore(noSubscribe, hasWebGL, () => false);
  const still = useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  if (!url || !canRender || state === "failed") return portrait;
  return (
    <div className="relative size-full">
      {state === "loading" && <div className="absolute inset-0 grid place-items-center">{portrait}</div>}
      <div className={`size-full transition-opacity duration-300 ${state === "ready" ? "opacity-100" : "opacity-0"}`}>
        <VrmAvatar url={url} voice={voice} pose={pose} still={still} onReady={() => setState("ready")} onError={() => setState("failed")} />
      </div>
    </div>
  );
}
