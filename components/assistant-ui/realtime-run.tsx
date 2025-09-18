"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRealtimeRunWithStreams } from "@trigger.dev/react-hooks";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : undefined;
}

type RunEntry = { id: string; token: string; ts: number; idx: number };

export function RealtimeRunTap() {
  const [runId, setRunId] = useState<string | undefined>(undefined);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [runs, setRuns] = useState<RunEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.sessionStorage.getItem("td_runs");
      return raw ? (JSON.parse(raw) as RunEntry[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const read = () => {
      setRunId(getCookie("td_run"));
      setToken(getCookie("td_token"));
    };
    read();
    const id = setInterval(read, 1000);
    return () => clearInterval(id);
  }, []);

  // When a new run/token pair appears, append to sessionStorage list
  useEffect(() => {
    if (!runId || !token) return;
    setRuns((prev) => {
      if (prev.some((e) => e.id === runId)) return prev; // already tracked
      const idx = (() => {
        const nodes = document.querySelectorAll('[data-role="user"]');
        return Math.max(0, nodes.length - 1);
      })();
      const next = [...prev, { id: runId, token, ts: Date.now(), idx }];
      try { window.sessionStorage.setItem("td_runs", JSON.stringify(next)); } catch {}
      return next;
    });
  }, [runId, token]);

  if (runs.length === 0) {
    return (
      <div className="mt-2 rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
        Waiting for run… send a message to start a run.
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {runs.map((r) => (
        <RunStreamItem key={r.id} runId={r.id} token={r.token} idx={r.idx} />
      ))}
    </div>
  );
}

function RunStreamItem({ runId, token, idx }: { runId: string; token: string; idx: number }) {
  const { run, streams, error } = useRealtimeRunWithStreams(runId, {
    accessToken: token,
    enabled: true,
  });

  const text = useMemo(() => {
    const parts = (streams?.gigastream as unknown[] | undefined) ?? [];
    let acc = "";
    for (const raw of parts) {
      let p: any = raw;
      if (typeof raw === "string") {
        try { p = JSON.parse(raw); } catch { acc += raw; continue; }
      }
      if (p && typeof p === "object" && "type" in p) {
        const t = p.type as string;
        if (t === "text-delta") {
          const delta: string = p.delta ?? p.textDelta ?? p.text ?? "";
          if (delta) acc += delta;
        } else if (t === "text") {
          if (typeof p.text === "string" && p.text.length) acc = p.text;
        }
        // ignore other chunk types
      }
    }
    return acc.trim();
  }, [streams?.gigastream]);

  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<Element | null>(null);

  useEffect(() => {
    const users = document.querySelectorAll('[data-role="user"]');
    const target = users[idx] as HTMLElement | undefined;
    if (!target) return;
    let mount = document.createElement('div');
    mount.className = 'mt-1';
    target.insertAdjacentElement('afterend', mount);
    setContainer(mount);
    return () => { mount.remove(); };
  }, [idx]);

  if (!container) return null;

  return createPortal(
    <div className="aui-assistant-message-root relative mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-2 duration-200 fade-in slide-in-from-bottom-1">
      <div className="aui-assistant-message-content mx-2 leading-7 break-words text-foreground rounded-3xl bg-muted px-5 py-2.5">
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap m-0">{text}</pre>
      </div>
    </div>,
    container
  );
}


