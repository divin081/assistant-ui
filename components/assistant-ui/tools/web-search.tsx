import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { CheckIcon, Loader2 } from "lucide-react";

type WebSource = {
  id?: string;
  title?: string;
  url?: string;
  snippet?: string;
};

export const WebSearchTool: ToolCallMessagePartComponent = ({ argsText, result, status }) => {
  let sources: WebSource[] = [];
  if (Array.isArray(result)) {
    sources = result as WebSource[];
  } else if (result && typeof result === "object" && Array.isArray((result as any).sources)) {
    sources = (result as any).sources as WebSource[];
  }

  let query: string | undefined;
  try {
    const parsed = JSON.parse(argsText || "{}");
    query = parsed?.query as string | undefined;
  } catch {}

  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        {status?.type === "running" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckIcon className="size-4 text-green-600" />
        )}
        <div className="text-sm font-medium">Web search{query ? `: "${query}"` : ""}</div>
      </div>

      {status?.type === "running" && (
        <div className="text-xs text-muted-foreground">Searching…</div>
      )}

      {status?.type === "complete" && (
        <div className="space-y-2">
          {sources.length === 0 ? (
            <div className="text-xs text-muted-foreground">No results.</div>
          ) : (
            sources.map((s, i) => (
              <div key={s.id ?? i} className="rounded-md border bg-background p-2">
                <div className="truncate text-sm font-medium">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                      {s.title || s.url}
                    </a>
                  ) : (
                    s.title || "(no title)"
                  )}
                </div>
                {s.url && (
                  <div className="truncate text-xs text-muted-foreground">{s.url}</div>
                )}
                {s.snippet && (
                  <div className="mt-1 text-sm leading-5">{s.snippet}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};


