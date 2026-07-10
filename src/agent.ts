import OpenAI from "openai";
import readline from "readline";
import { toolDefinitions,toolRegistry } from ".";
import { getMemoryContext, recall } from "./memory";

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
- Keep responses concise. Show what you changed and why.`;

const TOKEN_LIMIT = 128_000;
const TOKEN_WARNING = TOKEN_LIMIT * 0.8; 
 
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


        const tokenCount = estimateTokens(messages);
        const pct = Math.floor((tokenCount / TOKEN_LIMIT) * 100)
        console.log(`[Token : ${tokenCount.toLocaleString()} / ${TOKEN_LIMIT.toLocaleString()} (${pct}%)]`)
        if(tokenCount > TOKEN_WARNING){
            console.log("approching the context limit")
        }

        
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
                  const raw = await fn ? fn(args) : `Error: "${tc.function.name}" tool was not found`;
                  result = String(raw ?? "done");
            } catch (err : any) {
                result = "Error:" + err.message;
            }

            console.log(`Result : ${result}`);
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
