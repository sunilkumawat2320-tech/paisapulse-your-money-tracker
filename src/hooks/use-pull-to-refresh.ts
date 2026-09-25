import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70;

/** Touch pull-to-refresh on the window scroll. Returns current pull distance and refreshing flag. */
export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      startY.current = window.scrollY <= 0 ? (e.touches[0]?.clientY ?? null) : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const d = (e.touches[0]?.clientY ?? 0) - startY.current;
      pullRef.current = d > 0 ? Math.min(d * 0.5, 110) : 0;
      setPull(pullRef.current);
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          await cb.current();
        } finally {
          setRefreshing(false);
        }
      }
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  return { pull, refreshing, ready: pull >= THRESHOLD };
}
