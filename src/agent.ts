import OpenAI from "openai";
import readline from "readline";
import { toolDefinitions,toolRegistry } from ".";

const client  = new OpenAI({
    apiKey : process.env.GROQ_API_KEY,
    baseURL : "https://api.groq.com/openai/v1",
});

const  SYSTEM_PROMPT =  `You  are coding assistant with the access to the local workspace on disk.

## File Workflow rules
1 . Before editing , ALWAYS call readFile first - you need the exact line numbers.
2 . For small edits (changing a function , fixing a bug) , use updateFile with the exact line range.
3 . For new files or complere rewrites , use writeFile.
4 . Before exploring an unknown project, call listFiles to see the structure.
5 . To find where a function or variable id defined , use searchInFile.
6 . Never guess line numbers = always read first.

## General rules
- Break complex tasks into steps: explore -> read -> edit -> verify.
- If a file operation returns an error , report it to the user and stop.
- Keep responses concise. Show the user what you changed and why.`;

async function runAgent(userMessage : string, history : OpenAI.Chat.ChatCompletionMessageParam[]) {
    const messages : OpenAI.ChatCompletionMessageParam[] = [
        {
            role : "system",
            content : SYSTEM_PROMPT
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
        
        messages.push({role : "user" , content : userMessage});
        messages.push({role : "assistant", content : message.content});
        return message.slice(1);
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
                result = fn ? fn(args) : `Error: "${tc.function.name}" tool was not found`;
            } catch (err : any) {
                result = "Error:" + err.message;
            }

            console.log(`Result : $(result)`);
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
