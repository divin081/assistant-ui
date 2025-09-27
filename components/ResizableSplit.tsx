"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftPercent?: number; // 0-100
  minLeftPercent?: number; // 0-100
  maxLeftPercent?: number; // 0-100
};

export function ResizableSplit({
  left,
  right,
  initialLeftPercent = 45,
  minLeftPercent = 20,
  maxLeftPercent = 80,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftPercent, setLeftPercent] = useState(initialLeftPercent);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false); // becomes true only after threshold
  const dragStartX = useRef<number | null>(null);
  const dragStartPct = useRef<number>(initialLeftPercent);
  const DRAG_THRESHOLD_PX = 3; // require a small move before resizing

  const onPointerMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.min(
        maxLeftPercent,
        Math.max(minLeftPercent, (x / rect.width) * 100),
      );
      if (!resizing) {
        const start = dragStartX.current;
        if (start === null) return;
        if (Math.abs(e.clientX - start) >= DRAG_THRESHOLD_PX) {
          setResizing(true);
        } else {
          return; // do not change size until threshold exceeded
        }
      }
      setLeftPercent(pct);
    },
    [dragging, resizing, minLeftPercent, maxLeftPercent],
  );

  const stop = useCallback(() => {
    setDragging(false);
    setResizing(false);
    dragStartX.current = null;
  }, []);

  useEffect(() => {
    if (!resizing) return;
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", stop, { once: true });
    return () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", stop);
    };
  }, [dragging, onPointerMove, stop]);

  // Touch interactions disabled per request; only mouse hold/drag is supported

  return (
    <div ref={containerRef} className="hidden xl:flex h-dvh w-full select-none">
      <div
        className="h-full overflow-hidden border-r"
        style={{ width: `${leftPercent}%` }}
      >
        {left}
      </div>
      <div className="relative h-full w-1 bg-border">
        {/* Visible handle */}
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 h-full bg-border"
        />
        {/* Large hit area for easy grabbing: clicking the edge starts resize and you can move left/right */}
        <div
          className="absolute -left-2 top-0 h-full w-5 cursor-col-resize"
          onMouseDown={(e) => {
            // begin drag; resizing will activate after threshold
            setDragging(true);
            setResizing(false);
            dragStartX.current = e.clientX;
            dragStartPct.current = leftPercent;
          }}
          aria-label="Resize"
          role="separator"
          title="Drag to resize"
        />
      </div>
      <div className="h-full min-w-0 flex-1 overflow-hidden">{right}</div>
    </div>
  );
}


