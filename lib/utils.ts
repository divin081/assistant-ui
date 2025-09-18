import { UIMessage } from "ai";

type UIMessageWithContent = UIMessage & { content?: string };
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ABORTED = "User aborted";

export const prunedMessages = (messages: UIMessageWithContent[]): UIMessage[] => {
  console.log('[prunedMessages] Incoming messages:', JSON.stringify(messages, null, 2));
  if (messages.at(-1)?.role === "assistant") {
    return messages;
  }

  return messages.map((message, idx) => {
    console.log(`[prunedMessages] Message[${idx}]:`, JSON.stringify(message, null, 2));
    
    // Handle messages that don't have parts but have content
    if (!message.parts && message.content) {
      message.parts = [
        {
          type: "text",
          text: message.content
        }
      ];
    }
    
    if (!message.parts) {
      console.warn(`[prunedMessages] Message[${idx}] is missing parts!`, message);
      return message;
    }
    message.parts = message.parts.map((part, partIdx) => {
      console.log(`[prunedMessages] Message[${idx}].parts[${partIdx}]:`, JSON.stringify(part, null, 2));
      const p: any = part;
      if (p?.type === "tool-invocation") {
        if (
          p?.toolInvocation?.toolName === "computer" &&
          p?.toolInvocation?.args?.action === "screenshot"
        ) {
          return {
            ...p,
            toolInvocation: {
              ...p.toolInvocation,
              result: {
                type: "text",
                text: "Image redacted to save input tokens",
              },
            },
          } as any;
        }
        return part;
      }
      return part;
    });
    return message;
  });
};
