import {NextRequest, NextResponse} from "next/server";
import { UIMessage } from "ai";
import { assistantUiTask } from "@/src/trigger/assistant-ui";
import { auth } from "@trigger.dev/sdk/v3";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const prompt: string | undefined = typeof body?.prompt === "string" ? body.prompt : undefined;
  const incomingMessages: UIMessage[] | undefined = Array.isArray(body?.messages) ? body.messages : undefined;

  let messages: UIMessage[];
  if (incomingMessages && incomingMessages.length > 0) {
    messages = incomingMessages.map((m: any) => {
      // Ensure any text parts have non-empty text
      if (Array.isArray(m.parts)) {
        m.parts = m.parts.map((p: any) =>
          p?.type === "text" && typeof p?.text === "string" && p.text.trim().length > 0
            ? p
            : p?.type === "text"
              ? { ...p, text: "" }
              : p,
        );
      }
      return m as UIMessage;
    });
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

  // Trigger a fresh task run per request (per user message)
  const payload = {
    messages,
    sandboxId: "desktop",
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
    return res;
  } catch (error) {
    console.error("Failed to trigger task or create token:", error);
    return NextResponse.json(
      { error: "Failed to start run", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
  

  
 

}
