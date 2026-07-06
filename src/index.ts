import OpenAI from "openai";
import readline from "readline";
import { calculater, getCurrentTime } from "./tools";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});
const toolRegistry: any = {
  calculater:     calculater,
  getCurrentTime: getCurrentTime,
};
const toolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "calculater",
      description: "Do an arithmetic operation.",
      parameters: {
        type: "object",
        properties: {
          a:         { type: "number", description: "First number"  },
          b:         { type: "number", description: "Second number" },
          operation: {
            type: "string",
            enum: ["add", "sub", "multiply", "division"],
            description: "The arithmetic operation to perform",
          },
        },
        required: ["a", "b", "operation"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getCurrentTime",
      description: "Get the current local time in HH:MM:SS format.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];
async function runAgent(userMessage: string) {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are a helpful assistant.
Always call getCurrentTime when asked for the time.
Always call calculater when asked for math.`,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];
  const MAX_ITERATION = 5;
  let iteration = 0;

  while (iteration < MAX_ITERATION) {
    iteration = iteration + 1;
    console.log(`\n[Round ${iteration}]`);

    let response;
    try {
      response = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",   
        messages,
        tools: toolDefinitions,
      });
    } catch (err: any) {
      console.error("API ERROR:", err.message);
      return "Error: api is not connect— " + err.message;
    }

    const choice = response.choices[0];
    const message :any = choice?.message;
    const finishReason = choice?.finish_reason;

    console.log("finish_reason:", finishReason);

   
    if (finishReason !== "tool_calls") {
      return message.content;
    }
    messages.push(message);

    const toolCalls = message.tool_calls;
   
    console.log(`Tools maange: ${toolCalls?.length}`);

    for (const tc of toolCalls!) {
      const tcAny = tc as any;   
      console.log(`${tcAny.function.name}(${tcAny.function.arguments})`);
      let args;
      try {
        args = JSON.parse(tcAny.function.arguments);
      } catch (error) {
        args = {};
        console.log("arguments was not pass:", tcAny.function.arguments);
      }

      const fn = toolRegistry[tcAny.function.name];
      let result;
      try {
        result = fn
          ? fn(args)
          : `Error: "${tcAny.function.name}" tool was not found`;
      } catch (err: any) {
        result = "Error:" + err.message;
      }

      console.log(`Result: ${result}`);
      messages.push({
        role:         "tool",
        tool_call_id: tc.id,
        content:      result,
      });
    }
  }
  return "Max intration was happen";
}
const r1 = readline.createInterface({
  input:  process.stdin,
  output: process.stdout,
});
function askQuestion() {
  r1.question("User: ", async (input: string) => {
    const userInput = input.trim();

    if (!userInput) {
      askQuestion();
      return;
    }

    if (userInput.toLowerCase() === "exit") {
      console.log("exit");
      r1.close();
      return;
    }

    const answer = await runAgent(userInput);
    console.log("\nAgent:", answer, "\n");

    askQuestion();
  });
}
console.log("agent is ready");
console.log("write the exit to exit\n");

askQuestion();