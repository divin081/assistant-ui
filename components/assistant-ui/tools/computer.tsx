import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { Camera, Keyboard, MousePointer, MousePointerClick, KeyRound, Clock, ScrollText, Loader2, CheckCircle } from "lucide-react";

export const ComputerTool: ToolCallMessagePartComponent = ({ argsText, result, status }) => {
  let args: any = {};
  try { args = JSON.parse(argsText || "{}"); } catch {}

  const action: string | undefined = args?.action;
  const coordinate: [number, number] | undefined = Array.isArray(args?.coordinate) ? args.coordinate : undefined;
  const text: string | undefined = typeof args?.text === "string" ? args.text : undefined;
  const duration: number | undefined = typeof args?.duration === "number" ? args.duration : undefined;
  const scroll_amount: number | undefined = typeof args?.scroll_amount === "number" ? args.scroll_amount : undefined;
  const scroll_direction: string | undefined = typeof args?.scroll_direction === "string" ? args.scroll_direction : undefined;

  const renderIcon = () => {
    switch (action) {
      case "screenshot": return <Camera className="size-4" />;
      case "left_click": return <MousePointer className="size-4" />;
      case "right_click": return <MousePointerClick className="size-4" />;
      case "double_click": return <MousePointerClick className="size-4" />;
      case "mouse_move": return <MousePointer className="size-4" />;
      case "type": return <Keyboard className="size-4" />;
      case "key": return <KeyRound className="size-4" />;
      case "wait": return <Clock className="size-4" />;
      case "scroll": return <ScrollText className="size-4" />;
      default: return <MousePointer className="size-4" />;
    }
  };

  const detail = () => {
    switch (action) {
      case "left_click":
      case "right_click":
      case "double_click":
      case "mouse_move":
        return coordinate ? `(${coordinate[0]}, ${coordinate[1]})` : undefined;
      case "type":
      case "key":
        return text;
      case "wait":
        return duration ? `${duration}s` : undefined;
      case "scroll":
        return scroll_direction && scroll_amount ? `${scroll_direction} by ${scroll_amount}` : undefined;
      default:
        return undefined;
    }
  };

  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        {status?.type === "running" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCircle className="size-4 text-green-600" />
        )}
        <div className="flex items-center gap-2 text-sm font-medium">
          {renderIcon()}
          <span>{action}</span>
          {detail() && <span className="text-xs text-muted-foreground">{detail()}</span>}
        </div>
      </div>

      {status?.type === "complete" && result && typeof result === "object" && (result as any).type === "image" && (
        <img
          alt="screenshot"
          className="aspect-[1024/768] w-full rounded-md border"
          src={`data:image/png;base64,${(result as any).data}`}
        />
      )}
    </div>
  );
};


