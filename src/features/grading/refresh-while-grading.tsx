"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the summary every few seconds until the server-side grading run lands. */
export function RefreshWhileGrading() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
