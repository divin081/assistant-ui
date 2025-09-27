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

  const { text, webSources, computerBlocks } = useMemo(() => {
    const parts = (streams?.gigastream as unknown[] | undefined) ?? [];
    let acc = "";
    let sources: Array<{ title?: string; url?: string; snippet?: string }> = [];
    type CompBlock = { action?: string; detail?: string; image?: string; state: 'call'|'result' };
    const compBlocks: CompBlock[] = [];
    const pending: Record<string, number> = {};
    for (const raw of parts) {
      let p: any = raw;
      if (typeof raw === "string") {
        try { p = JSON.parse(raw); } catch { acc += raw; continue; }
      }
      if (!p || typeof p !== "object" || !("type" in p)) continue;
      const t = p.type as string;
      if (t === "text-delta") {
        const delta: string = p.delta ?? p.textDelta ?? p.text ?? "";
        if (delta) acc += delta;
      } else if (t === "text") {
        if (typeof p.text === "string" && p.text.length) acc = p.text;
      } else if (t === "tool-result") {
        const toolName: string | undefined = (p as any).toolName;
        const out = (p as any).result ?? (p as any).output;
        if (toolName === "webSearch") {
          if (Array.isArray(out)) sources = out as any[];
          else if (out && typeof out === "object" && Array.isArray(out.sources)) sources = out.sources as any[];
        } else if (toolName === "computer") {
          const img = out && typeof out === "object" && out.type === "image" && typeof out.data === "string" ? out.data as string : undefined;
          const id = (p as any).toolCallId as string | undefined;
          const idx = id && pending[id] !== undefined ? pending[id] : undefined;
          if (idx !== undefined) {
            compBlocks[idx] = { ...compBlocks[idx], image: img, state: 'result' };
            delete pending[id!];
          } else {
            compBlocks.push({ image: img, state: 'result' });
          }
        }
      } else if (t === "tool-call") {
        const toolName: string | undefined = (p as any).toolName;
        if (toolName === "computer") {
          const input = (p as any).args ?? (p as any).input;
          let action: string | undefined;
          let detail: string | undefined;
          try {
            const a = typeof input === 'string' ? JSON.parse(input) : input;
            action = a?.action;
            const c = Array.isArray(a?.coordinate) ? a.coordinate as [number,number] : undefined;
            const textArg = typeof a?.text === 'string' ? a.text : undefined;
            const dur = typeof a?.duration === 'number' ? a.duration : undefined;
            const amt = typeof a?.scroll_amount === 'number' ? a.scroll_amount : undefined;
            const dir = typeof a?.scroll_direction === 'string' ? a.scroll_direction : undefined;
            switch (action) {
              case 'left_click':
              case 'right_click':
              case 'double_click':
              case 'mouse_move':
                detail = c ? `(${c[0]}, ${c[1]})` : undefined; break;
              case 'type':
              case 'key':
                detail = textArg; break;
              case 'wait':
                detail = dur ? `${dur}s` : undefined; break;
              case 'scroll':
                detail = dir && amt ? `${dir} by ${amt}` : undefined; break;
            }
          } catch {}
          const idx = compBlocks.push({ action, detail, state: 'call' }) - 1;
          const id = (p as any).toolCallId as string | undefined;
          if (id) pending[id] = idx;
        }
      }
    }
    return { text: acc.trim(), webSources: sources, computerBlocks: compBlocks };
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
    <div className="aui-assistant-message-root relative mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-2 duration-200 fade-in slide-in-from-bottom-1 overflow-y-auto max-h-[400px]">
      <div className="aui-assistant-message-content mx-2 leading-7 break-words text-foreground rounded-3xl bg-muted px-5 py-2.5">
        {text && <pre className="max-h-64 overflow-auto whitespace-pre-wrap m-0">{text}</pre>}
        {webSources && webSources.length > 0 && (
          <div className="mt-2 space-y-2">
            {webSources.map((s, i) => (
              <div key={i} className="rounded-md border bg-background p-2">
                <div className="truncate text-sm font-medium">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                      {s.title || s.url}
                    </a>
                  ) : (
                    s.title || "(no title)"
                  )}
                </div>
                {s.url && <div className="truncate text-xs text-muted-foreground">{s.url}</div>}
                {s.snippet && <div className="mt-1 text-sm leading-5">{s.snippet}</div>}
              </div>
            ))}
          </div>
        )}
        {computerBlocks && computerBlocks.length > 0 && (
          <div className="mt-2 space-y-2">
            {computerBlocks.map((b, i) => (
              <div key={i} className="rounded-md border bg-background p-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  <span>{b.action || 'computer'}</span>
                  {b.detail && <span className="text-xs text-muted-foreground">{b.detail}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{b.state}</span>
                </div>
                {b.image && (
                  <img alt="screenshot" className="mt-2 aspect-[1024/768] w-full rounded-md border" src={`data:image/png;base64,${b.image}`} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    container
  );
}


