import { metadata, task, wait } from "@trigger.dev/sdk/v3";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText, UIMessage, stepCountIs } from "ai";
import { computerTool, webSearchTool, webAnswerTool } from "@/lib/e2b/tools";
import { killDesktop } from "@/lib/e2b/utils";
import { prunedMessages } from "@/lib/utils";

export const assistantUiTask = task({
  id: "assistant-ui-starter",
  description: "Assistant UI Starter",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 900, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: {
    messages: UIMessage[];
    sandboxId: string;
  }) => {
     const { messages, sandboxId } = payload;

    metadata.set("status", "processing");
    metadata.set("sandboxId", sandboxId);
    
    try {
      // Update RTest with current task run ID for persistence (disabled: model not available here)
      const currentMetadata = metadata.current();
      console.log('[gigaCuaAgentTask] Payload:', JSON.stringify(payload, null, 2));
      console.log('[gigaCuaAgentTask] Messages:', JSON.stringify(messages, null, 2));
      
      
      const result = streamText({
        model: anthropic("claude-3-7-sonnet-20250219"),
        system:
         `You are Giga, a helpful ASI assistant created by WithGiga. You can use a desktop, perform web search, read pages, and write code.
        
        
EVALUATION CRITERIA:

1. Use textOnly for: 
-General knowledge: Definitions (“What is an array?”),Concepts (“Explain postcolonial hegemony”), Math (“What is 2 + 2?”)

-Historical facts (well-established): “Who was UK's president in 1995?”, “When was World War II?”

-Explanations & tutorials: “Explain how RabbitMQ works in Node.js”, “How to build a REST API with Flask”

-Summaries, analysis, reasoning: “Summarize mimicry in postcolonial theory.”, “Analyze ‘The Motoka’ through a feminist lens.”

-Code generation & debugging: “Write a Python function to sort a dictionary.”, “Debug this Node.js error.”

-Language help: Translations, grammar correction, rewriting, paraphrasing.

2. Use webSearch for:
-Current / real-time info: Today’s news, live sports scores, stock prices, weather, election results, cryptocurrency rates.

-Location-specific info: “Best restaurants near me,” “events in London this weekend,” “local shop opening hours.”

-Niche / detailed data: “API docs for the latest version of X library,” “requirements for NYU London 2025 admissions,” “current exchange rate UK pounds to USD.”

-Archived / past articles & sources: “BBC article on Ghana elections in 2012,” “New York Times piece about Ebola in 2014,” “blog post from 2019 on React performance.”

-Verification / fact-checking: “Did Player X transfer to Club Y this season?”, “What’s the official statement from WHO on this?”


4. Use computer for: 
-file operations, coding tasks, web browsing, software installation, system administration, or tasks that specifically require desktop interaction.


!!!IMPORTANT!!!:
STREAMING STRUCTURE:
text-only: only use for text-only responses.
(events: text-delta, finish)

webSearch: give the reasoning text, then the webSearch tool call and result
(events: text-delta, tool-call, tool-result, text-delta, finish)

computer: give the reasoning text, then the computer tools call and result needed for the task and a final text-only response.(multiple computer tools calls may be needed depending on the task)
(events: text-delta, tool-call, tool-result[x1, x2, x3, ...], text-delta, finish)`,
        messages: prunedMessages(messages).map((m: any) => ({
          role: m.role,
          content: (m.parts || [])
            .map((p: any) => (p?.type === 'text' ? p.text : typeof p === 'string' ? p : JSON.stringify(p)))
            .join('\n'),
        })),
        tools: {
          computer: computerTool(sandboxId),
          webSearch: webSearchTool(),
          webAnswer: webAnswerTool(),
        },
        
        providerOptions: {
          anthropic: { 
            thinking: {
              type: "disabled",
            },
          },
        },
        stopWhen: stepCountIs(200),
        maxOutputTokens: 8000,
      });

    

   // Stream the response to metadata with console logging
   console.log('[gigaCuaAgentTask] Starting to stream response...');
   console.log('[gigaCuaAgentTask] Stream object keys:', Object.keys(result));
   console.log('[gigaCuaAgentTask] Full stream type:', typeof result.fullStream);
   
   let chunkCount = 0;
   
   // Create a readable stream that logs chunks as they come through
   const loggingStream = new ReadableStream({
     start(controller) {
       result.fullStream.pipeTo(new WritableStream({
         write(chunk) {
           chunkCount++;
           
           // Handle different types of stream chunks
           let content = 'No content';
           let toolCalls = undefined;
           let toolResults = undefined;
           let finishReason = undefined;
           let reasoning = undefined;
           
           if (chunk.type === 'text-delta') {
             content = (chunk as any).text;
           } else if (chunk.type === 'reasoning-delta') {
             reasoning = (chunk as any).text || 'No reasoning content';
           } else if (chunk.type === 'tool-call') {
             toolCalls = {
               toolCallId: (chunk as any).toolCallId,
               toolName: (chunk as any).toolName,
               args: (chunk as any).args ?? (chunk as any).input
             };
           } else if (chunk.type === 'tool-result') {
             toolResults = {
               toolCallId: (chunk as any).toolCallId,
               toolName: (chunk as any).toolName,
               result: (chunk as any).result ?? (chunk as any).output
             };
           } else if (chunk.type === 'finish') {
             finishReason = (chunk as any).finishReason;
           }
           
           console.log(`[gigaCuaAgentTask] Chunk ${chunkCount}:`, {
             type: chunk.type,
             content,
             reasoning,
             toolCalls,
             toolResults,
             finishReason,
             timestamp: new Date().toISOString()
           });
           controller.enqueue(chunk);
         },
         close() {
           console.log(`[gigaCuaAgentTask] Stream completed after ${chunkCount} chunks`);
           controller.close();
         },
         abort(reason) {
           console.error('[gigaCuaAgentTask] Stream aborted:', reason);
           controller.error(reason);
         }
       }));
     }
   });
   
   await metadata.stream("gigastream", loggingStream);
   
   // Wait for the stream to complete and get the final result
   console.log('[gigaCuaAgentTask] Waiting for stream to complete...');
   const finalResult = await result.text;
   console.log('[gigaCuaAgentTask] Final result:', finalResult);
   
   // Also check if there are any tool calls that need to be executed
   console.log('[gigaCuaAgentTask] Checking for pending tool calls...');
   try {
     const toolCalls = await result.toolCalls;
     if (toolCalls && toolCalls.length > 0) {
       console.log('[gigaCuaAgentTask] Found tool calls:', toolCalls);
     }
   } catch (error) {
     console.log('[gigaCuaAgentTask] No tool calls or error accessing them:', error);
   }
   
   // Check if the stream has any pending operations
   console.log('[gigaCuaAgentTask] Stream status - has text:', !!result.text);
   console.log('[gigaCuaAgentTask] Stream status - has tool calls:', !!result.toolCalls);
   console.log('[gigaCuaAgentTask] Stream status - has full stream:', !!result.fullStream);
   
   // Update status to completed
   metadata.set("status", "completed");

   return { success: true };
 } catch (error) {
   console.error("AI Agent error:", error);
   
   // Update status to failed
   metadata.set("status", "failed");
   metadata.set("error", error instanceof Error ? error.message : "Unknown error");
   throw error;
 } finally {
   // Always cleanup sandbox after the stream ends
   try {
     await killDesktop(sandboxId);
   } catch (cleanupError) {
     console.error("Failed to cleanup sandbox:", cleanupError);
   }
 }
},
}); 