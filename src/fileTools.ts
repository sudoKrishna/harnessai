import fs from "fs";
import path from "path";

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

export function readFile(args : {path : string}) : string {
try {
    ensureWorkspace();
    const full = safePath(args.path)
    if(!fs.existsSync(full)) return `Error : file "${args.path}" dose not exist.`
    const lines = fs.readFileSync(full, "utf-8").split("\n")
    return lines.map((line, i) => `${i + 1}: ${line}`).join("\n")
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


