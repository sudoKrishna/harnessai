import OpenAI from "openai";
import readline from "readline";
import fs from "fs";
import path from "path"
import { toolDefinitions,toolRegistry } from ".";
import { getMemoryContext, recall } from "./memory";
import z from "zod";

const MAX_TOOL_RESULT = 10000

const toolResultSchema = z.string().max(
MAX_TOOL_RESULT,
`tool result exceed ${MAX_TOOL_RESULT} chareceters`
)

const client  = new OpenAI({
    apiKey : process.env.GROQ_API_KEY,
    baseURL : "https://api.groq.com/openai/v1",
});

const SYSTEM_PROMPT = `You are a coding assistant with access to the local workspace on disk.

## File Workflow Rules
1. Before editing, ALWAYS call outlineFile first to see the structure and line numbers.
2. Then call readFile with the exact line range you need.
3. For small edits, use updateFile with the exact line range.
4. For new files or complete rewrites, use writeFile.
5. Never guess line numbers — always read first.

## Memory Rules
- If the user shares personal info (name, preferences, etc), call remember to save it.
- Only use recall if you need a specific fact not already in your context.
- Use forget only when the user explicitly asks to forget something.

## General Rules
- Break complex tasks into steps: outline → read → edit → verify.
- For simple math or general questions, answer directly without calling any tool.
- If a file operation returns an error, report it and stop.
- Keep responses concise. Show what you changed and why.
- To run terminal commands, always use the bash tool.`;

const TOKEN_LIMIT = 128_000;
const TOKEN_WARNING = TOKEN_LIMIT * 0.8;
const TOKEN_COMPACTION = TOKEN_LIMIT * 0.6;
 
function estimateTokens(messages: OpenAI.Chat.ChatCompletionMessageParam[]): number {
    let totalChars = 0;
 
    for (const message of messages) {
        if (typeof message.content === "string") {
            totalChars += message.content.length;
        } else if (Array.isArray(message.content)) {
            for (const part of message.content) {
                if ("text" in part) {
                    totalChars += part.text.length;
                }
            }
        }
    }
 
    return Math.floor(totalChars / 4);
}

async function runAgent(userMessage : string, history : OpenAI.Chat.ChatCompletionMessageParam[]) {

    const memoryContext = getMemoryContext();
    const systemPromptWithMemory = memoryContext 
    ? `${SYSTEM_PROMPT}\n\n${memoryContext}`
    : SYSTEM_PROMPT;

     const agentContextDir = path.join("/tmp" , "agent-context");
    fs.mkdirSync(agentContextDir , {recursive : true});

    const archivePath = path.join(agentContextDir, "archive.json");
    if(!fs.existsSync(archivePath)) {
        fs.writeFileSync(archivePath , "[]", "utf-8")
    }

       let offloadCounter = 1;

    async function offloadToDisk(toolResult : string, toolCallId : string , toolName: string ) : Promise<string> {
        if(toolResult.length <= 2000) {
            return toolResult
        }

        const fileName = `tool-result-${offloadCounter++}.txt`;
        const filePath = path.join(agentContextDir, fileName)
        fs.writeFileSync(filePath, toolResult, "utf-8");

        const archive  = JSON.parse(fs.readFileSync(archivePath, "utf-8"))

        archive.push({
            tool_call_id : toolCallId,
            tool_name : toolName,
            original_result : toolResult,
            timestamp : new Date().toISOString(),
        })

        fs.writeFileSync(
            archivePath, 
            JSON.stringify(archive, null , 2),
            "utf-8"
        )
        console.log(`[offloaded ${toolName} result to ${filePath} (${toolResult.length} chars)]`)

        return filePath
    }
    

    async function compactToolMessages(messages : OpenAI.Chat.ChatCompletionMessageParam[]) {

        for(const message of messages) {
            if(message.role !== "tool") continue;
            if(typeof message.content !== "string") continue;

            if(
               message.content.startsWith("/tmp/agent-context/") || 
               message.content.startsWith("[Tool result offloaded]")
            ) {
                continue
            }

            if (message.content.length > 2000) {
                const toolMsg = message as OpenAI.Chat.ChatCompletionToolMessageParam;
                message.content = await offloadToDisk(
                    message.content,
                    toolMsg.tool_call_id,
                    "unknown",  
                );
            }
        }
    }

async function summarizeContext(
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): Promise<void> {
  const archive = JSON.parse(
    fs.readFileSync(archivePath, "utf-8")
  ) as Array<{
    tool_call_id: string;
    tool_name: string;
    original_result: string;
    timestamp: string;
  }>;

  if (archive.length === 0) return;

  const toSummarize = archive.slice(0, -3);
  if (toSummarize.length === 0) return;

  const digest = toSummarize
    .map(
      (e) =>
        `[${e.tool_name}]\n${e.original_result.slice(0, 1000)}`
    )
    .join("\n\n---\n\n");

  const summaryResponse = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Summarize the following tool results as a compact factual digest. Keep only information that would help an agent continue the current task. Be terse.

${digest}`,
      },
    ],
  });

  const summary = summaryResponse.choices[0]?.message?.content ?? "";

  const summarizedIds = new Set(
    toSummarize.map((e) => e.tool_call_id)
  );

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];

    if (
      msg.role === "tool" &&
      summarizedIds.has((msg as any).tool_call_id)
    ) {
      messages.splice(i, 1);
    }
  }

  // Also remove orphaned assistant tool_call messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as any;

    if (msg.role === "assistant" && msg.tool_calls) {
      const allSummarized = msg.tool_calls.every((tc: any) =>
        summarizedIds.has(tc.id)
      );

      if (allSummarized) {
        messages.splice(i, 1);
      }
    }
  }


  messages.splice(1, 0, {
    role: "assistant",
    content: `[CONTEXT SUMMARY — generated at 80% token usage]

${summary}`,
  });

  console.log(
    `[Summarized ${toSummarize.length} tool results into context]`
  );
}

    const messages : OpenAI.ChatCompletionMessageParam[] = [
        {
            role : "system",
            content : systemPromptWithMemory
        },
        ...history,
        {
            role : "user",
            content : userMessage
        }
    ]

    const MAX_ITERATION = 5;
    let iteration = 0

    while(iteration < MAX_ITERATION) {
        iteration++;
        console.log(`\n[Round ${iteration}]`);

        const tokenCount = estimateTokens(messages);
        const pct = Math.floor((tokenCount / TOKEN_LIMIT) * 100);
         console.log(`[Tokens: ${tokenCount.toLocaleString()} / ${TOKEN_LIMIT.toLocaleString()} (${pct}%)]`);

        if (tokenCount >= TOKEN_WARNING) {
        } else if (tokenCount >= TOKEN_COMPACTION) {
            console.log("[Context > 50%] Compacting tool messages...");
            await compactToolMessages(messages);
        }

        let response : OpenAI.Chat.ChatCompletion;
        try {
            response = await client.chat.completions.create({
                 model: "llama-3.3-70b-versatile",
                 messages,
                 tools : toolDefinitions,
            })
        } catch (err : any) {
            console.log("API error :", err.message)
            console.log("Agent :API call falied -", err.message)
            return messages
        }

        const choice = response.choices[0];
        const message : any = choice?.message;
        const finishReason = choice?.finish_reason;

        console.log("finishReason:" , finishReason)
        
        if(finishReason !== "tool_calls") {
        console.log("\nAgent:" , message.content , "\n")
        messages.push({role : "assistant", content : message.content});



        return messages.slice(1);
        }



        messages.push(message);
        const toolCalls = message.tool_calls;
        console.log(`Tools : ${toolCalls.length}`);

        for(const tc of toolCalls!) {
            console.log(` -> ${tc.function.name}(${tc.function.arguments})`)
            let args : Record<string, any>;
            try {
                args =  JSON.parse(tc.function.arguments);
            } catch (err :any) {
                args = {};
                console.log("arguments was not pass:", tc.function.arguments);
            }

            const fn = toolRegistry[tc.function.name];
            let result : string;
            try {
                  const raw = fn ? await fn(args) : `Error: "${tc.function.name}" tool was not found`;
                  result = await offloadToDisk(
                    String(raw ?? "done"),
                    tc.id,
                    tc.function.name,
                  )
            } catch (err : any) {
                result = "Error:" + err.message;
            }

            console.log(`Result : ${result}`);
            const validattion = toolResultSchema.safeParse(result);

            if(!validattion.success) {
                console.log("Tool result validation failed:" , validattion.error.issues)
            } else {
                result = validattion.data;
            }

            messages.push({
                role : "tool",
                tool_call_id : tc.id,
                content : result,
            });
        }
    }
    console.log("\nAgent : Hit max itration task may be incompleted. \n")
    return messages.slice(1);
}

const r1 = readline.createInterface({
    input : process.stdin,
    output : process.stdout,
});

let conversationHistory : OpenAI.Chat.ChatCompletionMessageParam[] = [];


function prompt() {
    r1.question("User: ", async (input : string) => {
        const userInput = input.trim();

        if(!userInput) {
            prompt();
            return;
        }

        if(userInput.toLowerCase() === "exit") {
            conversationHistory = [];
            console.log("exit");
            prompt();
            return;
        }
conversationHistory = await runAgent(userInput, conversationHistory);    prompt();
    })
}
console.log("agent is ready");
console.log("write the exit to exit\n");
prompt();
