import OpenAI from "openai";
import readline from "readline";
import { calculater, getCurrentTime } from "./tools";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});
export const toolRegistry: any = {
  calculater:     calculater,
  getCurrentTime: getCurrentTime,
};
export const toolDefinitions = [
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
