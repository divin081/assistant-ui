import { anthropic } from "@ai-sdk/anthropic";
import { getDesktop } from "./utils";
import { Exa } from "exa-js";
import { z } from "zod";
import { tool } from "ai";

const wait = async (seconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

export const resolution = { x: 1024, y: 768 };

  // Shared Exa client (requires EXA_API_KEY)
const exa = new Exa(process.env.EXA_API_KEY || "");
export const computerTool = (sandboxId: string) =>
  anthropic.tools.computer_20250124({
    displayWidthPx: resolution.x,
    displayHeightPx: resolution.y,
    displayNumber: 1,
    execute: async ({
      action,
      coordinate,
      text,
      duration,
      scroll_amount,
      scroll_direction,
      start_coordinate,
    }) => {
      const desktop = await getDesktop(sandboxId);

      switch (action) {
        case "screenshot": {
          const image = await desktop.screenshot();
          // Convert image data to base64 immediately
          const base64Data = Buffer.from(image).toString("base64");
          return {
            type: "image" as const,
            data: base64Data,
          };
        }
        case "wait": {
          if (!duration) throw new Error("Duration required for wait action");
          const actualDuration = Math.min(duration, 2);
          await wait(actualDuration);
          return {
            type: "text" as const,
            text: `Waited for ${actualDuration} seconds`,
          };
        }
        case "left_click": {
          if (!coordinate)
            throw new Error("Coordinate required for left click action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          await desktop.leftClick();
          return { type: "text" as const, text: `Left clicked at ${x}, ${y}` };
        }
        case "double_click": {
          if (!coordinate)
            throw new Error("Coordinate required for double click action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          await desktop.doubleClick();
          return {
            type: "text" as const,
            text: `Double clicked at ${x}, ${y}`,
          };
        }
        case "right_click": {
          if (!coordinate)
            throw new Error("Coordinate required for right click action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          await desktop.rightClick();
          return { type: "text" as const, text: `Right clicked at ${x}, ${y}` };
        }
        case "triple_click": {
          if (!coordinate)
            throw new Error("Coordinate required for triple click action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          // Fallback: triple click as three left clicks if tripleClick is not available
          if (typeof (desktop as any).tripleClick === "function") {
            await (desktop as any).tripleClick();
          } else {
            await desktop.leftClick();
            await desktop.leftClick();
            await desktop.leftClick();
          }
          return { type: "text" as const, text: `Triple clicked at ${x}, ${y}` };
        }
        case "mouse_move": {
          if (!coordinate)
            throw new Error("Coordinate required for mouse move action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          return { type: "text" as const, text: `Moved mouse to ${x}, ${y}` };
        }
        case "type": {
          if (!text) throw new Error("Text required for type action");
          await desktop.write(text);
          return { type: "text" as const, text: `Typed: ${text}` };
        }
        case "key": {
          if (!text) throw new Error("Key required for key action");
          await desktop.press(text === "Return" ? "enter" : text);
          return { type: "text" as const, text: `Pressed key: ${text}` };
        }
        case "scroll": {
          if (!scroll_direction)
            throw new Error("Scroll direction required for scroll action");
          if (!scroll_amount)
            throw new Error("Scroll amount required for scroll action");

          await desktop.scroll(
            scroll_direction as "up" | "down",
            scroll_amount,
          );
          return { type: "text" as const, text: `Scrolled ${text}` };
        }
        case "left_click_drag": {
          if (!start_coordinate || !coordinate)
            throw new Error("Coordinate required for mouse move action");
          const [startX, startY] = start_coordinate;
          const [endX, endY] = coordinate;

          await desktop.drag([startX, startY], [endX, endY]);
          return {
            type: "text" as const,
            text: `Dragged mouse from ${startX}, ${startY} to ${endX}, ${endY}`,
          };
        }
        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    },
    toModelOutput(result) {
      if (typeof result === "string") {
        return { type: "text", value: result };
      }
      if (result && result.type === "image" && result.data) {
        return {
          type: "content",
          value: [
            {
              type: "media",
              data: result.data,
              mediaType: "image/png",
            },
          ],
        };
      }
      if (result && result.type === "text" && result.text) {
        return { type: "text", value: result.text };
      }
      // Fallback: stringify to text to ensure JSONValue typing is not violated
      return { type: "text", value: String(result) };
    },
  });

export const bashTool = (sandboxId?: string) =>
  anthropic.tools.bash_20250124({
    execute: async ({ command }) => {
      const desktop = await getDesktop(sandboxId);

      try {
        const result = await desktop.commands.run(command);
        return (
          result.stdout || "(Command executed successfully with no output)"
        );
      } catch (error) {
        console.error("Bash command failed:", error);
        if (error instanceof Error) {
          return `Error executing command: ${error.message}`;
        } else {
          return `Error executing command: ${String(error)}`;
        }
      }
    },
  });




export const webSearchTool = () =>
  tool({
    description:
      "Search the web using Exa and return top results with ids, titles, URLs, and snippets.",
    inputSchema: z.object({
      query: z.string().min(3, "query too short"),
      size: z.number().int().min(1).max(8).default(5).optional(),
    }),
    execute: async ({ query, size }: { query: string; size?: number }) => {
      if (!process.env.EXA_API_KEY) {
        return "Web search unavailable: missing EXA_API_KEY";
      }

      const numResults = Math.min(size ?? 5, 8);
      const res = await exa.search(query, { numResults, useAutoprompt: true });

      if (!res.results?.length) return [];

      return res.results.slice(0, numResults).map((r: any) => ({
        id: r.id,
        title: r.title || "(no title)",
        url: r.url,
        snippet: (r as any).highlight || (r as any).text || "",
      }));
    },
  });

export const webAnswerTool = () =>
  tool({
    description:
      "Fetch readable content for a specific Exa search result id and return an excerpt. Use after webSearch.",
    inputSchema: z.object({
      id: z.string().min(10, "invalid Exa result id"),
      question: z.string().min(1).optional(),
      maxChars: z.number().int().min(500).max(20000).default(6000).optional(),
    }),
    execute: async ({ id, question, maxChars }: { id: string; question?: string; maxChars?: number }) => {
      if (!process.env.EXA_API_KEY) {
        return "Web answer unavailable: missing EXA_API_KEY";
      }

      const contents = await exa.getContents([id], { text: true });
      const doc = (contents as any)?.results?.[0];
      if (!doc) return `No content found for id=${id}`;

      const text: string = doc.text || "";
      const url: string = doc.url || "";
      const title: string = doc.title || "(no title)";
      const limit = Math.min(maxChars ?? 6000, 20000);
      const excerpt = text.slice(0, limit);

      if (question) {
        return `TITLE: ${title}\nURL: ${url}\nQUESTION: ${question}\nCONTENT (truncated):\n${excerpt}`;
      }
      return `TITLE: ${title}\nURL: ${url}\nCONTENT (truncated):\n${excerpt}`;
    },
  });

