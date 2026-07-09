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
  {
    name : "outlineFile",
    decsription : "Get the structure of a file - shows line number of all function , classes , and imports . Always call this before readFile on any file you haven't seen yet.",
    input_schema : {
      type : "object",
      properties : {
        path : {type : "string", description : "File path relative to the workspace"}
      },
      required : ["path"]
    }
  },
  {
    name : "readFile",
    decsription : "Read a specific line range from the file use outline file first to find the right line number , then read only the section you need.",
    input_schema : {
    type : "object",
    properties : {
      path : {type : "string"},
      startLine : {type : "number" , decsription : "first line to read (1-index)"},
      endLine : {type : "number" , decsription : "Last line to read (inclusive)"},
    },
    required : ["path" , "startLine" , "endLine"]
    }
  }
];
