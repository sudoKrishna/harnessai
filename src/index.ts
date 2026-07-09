import OpenAI from "openai";
import readline from "readline";
import { readFile, outlineFile, writeFile, updateFile, deleteFile, bash, web_fetch } from "./fileTools";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export const toolRegistry: any = {
  readFile,
  outlineFile,
  writeFile,
  updateFile,
  deleteFile,
  bash,
  web_fetch,
};

export const toolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "outlineFile",
      description: "Get the structure of a file - shows line numbers of all functions, classes, and imports. Always call this before readFile on any file you haven't seen yet.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to the workspace" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "readFile",
      description: "Read a specific line range from a file. Use outlineFile first to find the right line numbers, then read only the section you need.",
      parameters: {
        type: "object",
        properties: {
          path:      { type: "string", description: "File path relative to the workspace" },
          startLine: { type: "number", description: "First line to read (1-indexed)" },
          endLine:   { type: "number", description: "Last line to read (inclusive)" },
        },
        required: ["path", "startLine", "endLine"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "writeFile",
      description: "Write content to a file. Use this for new files or complete rewrites only. For small edits use updateFile instead.",
      parameters: {
        type: "object",
        properties: {
          path:    { type: "string", description: "File path relative to the workspace" },
          content: { type: "string", description: "Full content to write to the file" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "updateFile",
      description: "Replace a specific line range in a file with new content. Always call readFile first to get the exact line numbers before updating.",
      parameters: {
        type: "object",
        properties: {
          path:        { type: "string", description: "File path relative to the workspace" },
          start_line:  { type: "number", description: "First line to replace (1-indexed)" },
          end_line:    { type: "number", description: "Last line to replace (inclusive)" },
          new_content: { type: "string", description: "Replacement content for the line range" },
        },
        required: ["path", "start_line", "end_line", "new_content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "deleteFile",
      description: "Delete a file or directory from the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to the workspace" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "bash",
      description: "Run a shell command in the workspace directory. Use this to run scripts, install packages, list files, or execute any terminal command.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command to execute" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_fetch",
      description: "Fetch the content of a URL and return it as text. Use this to read documentation, APIs, or any web page.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
];