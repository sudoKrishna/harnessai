import fs from "fs"

const MEMORY_FILE = "memory.json";

function loadStore(): Record<string , string> {
if(!fs.existsSync(MEMORY_FILE)) {
    return {}
}
const raw = fs.readFileSync(MEMORY_FILE , "utf-8");
return JSON.parse(raw);
}
function saveStore(store : Record<string, string>) : void {
    fs.writeFileSync(MEMORY_FILE , JSON.stringify(store, null, 2), "utf-8")
} 
export function remember(args : {key : string , value : string}) {
    const store = loadStore();
    store[args.key] = args.value ;
    saveStore(store);
    return `Remember : ${args.key} = ${args.value}`
}
export async function recall(args : {key : string}) {
const store = loadStore();
return store[args.key] ?? null
}
export async function forget(args : {key : string}) {
    const store = loadStore();
    delete store[args.key];
    saveStore(store)
    return `Forget : ${args.key
        
    }`
}
export function getMemoryContext(): string {
const store = loadStore()
return Object.keys(store).length > 0 
? `Here is what you know:\n${Object.entries(store)
    .map(([k , v]) =>  `- ${k}: ${v}`).join("\n")}`
: "";

}
