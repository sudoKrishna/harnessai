import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);



const WORKSPACE = path.resolve(process.env.WORKSPACE_DIR ?? "./workspace");

function safePath(filePath : string) : string {
    const resolved = path.resolve(WORKSPACE , filePath)
    if(!resolved.startsWith(WORKSPACE)) {
        throw new Error(`Path "${filePath}" is outside the workspace`)
    }
    return resolved;
}

function ensureWorkspace() {
    if(!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, {recursive : true})
}
const CHAR_LIMIT = 3000;
export function outlineFile(args : {path : string}) : any {
    try {
        ensureWorkspace()
        const full = safePath(args.path)
        if(!fs.existsSync(full)) return `Error : file "${args.path}" does not exists`;

        const lines = fs.readFileSync(full , "utf-8").split("\n");

        const outline = lines.map((line , i) =>  ({num : i +1, text:  line}))
        .filter(({text}) => 
        text.match(/^\s*(export|function|class|const|async|def |public |private |interface|type |import)/)
        )
        .map(({num , text}) => `${num} : ${text.trim()}`)
        .join("\n")

        if(!outline) {
          `[Outline of "${args.path}" - ${lines.length} total lines]\n\n` + outline +
          `\n\n[Use readfile with startLine and endLine to read any section.]`
        }
    } catch (error) {
        
    }
}

export function readFile(args : {path : string, startLine: number, endLine: number}) : string {
try {
    ensureWorkspace();
    const full = safePath(args.path)
    if(!fs.existsSync(full)) return `Error : file "${args.path}" dose not exist.`
    const lines = fs.readFileSync(full, "utf-8").split("\n")
    const totalLines = lines.length;

   const start = Math.max(1, args.startLine);
   const end = Math.min(totalLines , args.endLine);

   if(start > totalLines) {
    return `Error startLine ${start} is beyond file lenght (${totalLines} lines).`
   }
    
   const selectedLines = lines.slice(start -1 , end);

   const numbered = selectedLines.map((lines , i) => `${start + i}: ${lines}`).join("\n")

   if(numbered.length <= CHAR_LIMIT) {
    return (
      `[showing lines ${start}-${end} of ${totalLines}]\n\n` + numbered
    )
   }
    const truncated = numbered.slice(0, CHAR_LIMIT)
    const shownLines = truncated.split("\n").length;
    const shownEnd = start + shownLines - 1;

    return (
     `[Showing lines ${start}–${shownEnd} of ${totalLines} (truncated — range too large)]\n\n` +
      truncated +
      `\n\n[TRUNCATED: try a smaller range, e.g. lines ${start}–${start + 50}.]`
    );
} catch (err : any) {
    return `Error : ${err.message}`
 }
}

export function writeFile(args : {path : string; content : string}) : string {
try {
    ensureWorkspace();
    const full = safePath(args.path)
    fs.mkdirSync(path.dirname(full) , {recursive : true})
    fs.writeFileSync(full , args.content , "utf-8")
    const lines = args.content.split("\n").length;
    return `Written "${lines}" lines to "${args.path}"`
} catch (err : any) {
    return `Error: ${err.message}`;
}
}

export function updateFile(args : {
    path : string;
     start_line : number;
      end_line : number ;
       new_content : string
}) : string{
  try {
    ensureWorkspace();
    const full = safePath(args.path);
    if(!fs.existsSync(full)) return `Error: file "${args.path}" does not exists`;

    const lines = fs.readFileSync(full , "utf-8").split("\n");
    const total = lines.length;
    const start = args.start_line - 1;
    const end = args.end_line;

    if(start < 0 || end > total || start >= end) {
      return `Error: invalid line range ${args.start_line}–${args.end_line} (file has ${total} lines).`;
    }

    const replacement = args.new_content.split("\n");
    lines.splice(start, end - start ,...replacement);
    fs.writeFileSync(full , lines.join("\n") , "utf-8");

    return `Updated lines ${args.start_line}–${args.end_line} in "${args.path}". File now has ${lines.length} lines.`;
  } catch (err : any) {
    return `Error : ${err.message}`;
  }
}

export function deleteFile(args : {path : string}) :string {
    try {
        ensureWorkspace();
        const full = safePath(args.path)
        if(!fs.existsSync(full)) return  `Error : file "${args.path}" does not exist.`;
        fs.rmSync(full ,{recursive : true})
        return `Delete "${args.path}".`;
    } catch (err : any) {
        return `Error : ${err.message}`
    }
}

async function bash(args : {command  : string}) : Promise<string> {
    try {
        ensureWorkspace();
        const {stdout , stderr} = await execAsync(args.command, {cwd : WORKSPACE})
        return [stdout ,stderr].filter(Boolean).join("\n stderr \n")
    } catch (err : any) {
        const out = err.stdout ?? "";
        const error = err.stderr ?? err.message;
        return `Error ${[out, error].filter(Boolean).join("\n")}`
    }
}  

async function web_fetch(args : {}) {
    
}