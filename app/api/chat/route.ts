import {NextRequest, NextResponse} from "next/server";
import { UIMessage } from "ai";
import { assistantUiTask } from "@/src/trigger/assistant-ui";
import { auth } from "@trigger.dev/sdk/v3";
import { getDesktopURL } from "@/lib/e2b/utils";

async function createSandbox(): Promise<{ sandboxID: string; streamURL: string }> {
  const { streamUrl, id } = await getDesktopURL();
  return {
    sandboxID: id,
    streamURL: streamUrl,
  };
}
export async function POST(request: NextRequest) {
  const body = await request.json();
  const prompt: string | undefined = typeof body?.prompt === "string" ? body.prompt : undefined;
  const incomingMessages: UIMessage[] | undefined = Array.isArray(body?.messages) ? body.messages : undefined;

  // Hoisted sandbox info so it's accessible later when setting cookies
  let sandboxID: string | undefined;
  let streamURL: string | undefined;

  let messages: UIMessage[];
  if (incomingMessages && incomingMessages.length > 0) {
    // Only forward the latest user message to the task
    const lastUser = [...incomingMessages].reverse().find((m: any) => m?.role === "user");
    const textFromParts = Array.isArray((lastUser as any)?.parts)
      ? (lastUser as any).parts
          .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
          .map((p: any) => p.text as string)
          .join("\n")
      : undefined;
    const lastUserText: string | undefined =
      (typeof (lastUser as any)?.content === "string" ? (lastUser as any).content : undefined) || textFromParts;

    if (!lastUserText || lastUserText.trim().length === 0) {
      return NextResponse.json({ error: "Latest user message is empty" }, { status: 400 });
    }
// Create sandbox and get IDs
    ({ sandboxID, streamURL } = await createSandbox());

    messages = [
      {
        role: "user",
        parts: [
          {
            type: "text",
            text: lastUserText.trim(),
          },
        ],
      } as any,
    ];
  } else if (prompt && prompt.trim().length > 0) {
    messages = [
      {
        role: "user",
        parts: [
          {
            type: "text",
            text: prompt.trim(),
          },
        ],
      } as any,
    ];
  } else {
    return NextResponse.json({ error: "Provide either non-empty prompt or messages" }, { status: 400 });
  }

  // Ensure a sandbox exists for this request and capture its id/stream
  if (!sandboxID || !streamURL) {
    try {
      ({ sandboxID, streamURL } = await createSandbox());
    } catch (e) {
      console.error("Failed to create sandbox:", e);
    }
  }

  // Trigger a fresh task run per request (per user message)
  const payload = {
    messages,
    sandboxId: sandboxID || "desktop",
  };

  console.log("Triggering task with payload:", JSON.stringify(payload, null, 2));
  try {
    const result = await assistantUiTask.trigger(payload);
    
    console.log("Task triggered with result:", JSON.stringify(result, null, 2));

    // Safely derive run id from trigger result
    const runId = (result as any)?.id || (result as any)?.run?.id || (result as any)?.data?.id;

    // Create a read token limited to this run for realtime subscriptions
    const publicAccessToken = runId
      ? await auth.createPublicToken({
          scopes: { read: { runs: runId } },
          expirationTime: "15m",
        })
      : undefined;

    const res = NextResponse.json({ runId, publicAccessToken });
    if (runId && publicAccessToken) {
      // set short-lived cookies so the client can subscribe without changing existing UI wiring
      res.cookies.set("td_run", runId, { path: "/", maxAge: 60 * 15 });
      res.cookies.set("td_token", publicAccessToken, { path: "/", maxAge: 60 * 15 });
    }
    // If a sandbox was created earlier in this request, persist its details for the iframe
    try {
      if (typeof sandboxID === "string" && typeof streamURL === "string") {
        res.cookies.set("desktop_id", sandboxID, { path: "/", maxAge: 60 * 15 });
        res.cookies.set("desktop_stream", streamURL, { path: "/", maxAge: 60 * 15 });
      }
    } catch {}
    return res;
  } catch (error) {
    console.error("Failed to trigger task or create token:", error);
    return NextResponse.json(
      { error: "Failed to start run", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
  

  
 

}
