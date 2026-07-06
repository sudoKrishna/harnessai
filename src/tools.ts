 
export function calculater(args: { a: number; b: number; operation: string }): string {
    const { a, b, operation } = args;   
 
    switch (operation) {
        case "add":
            return `Result: ${a + b}`;
        case "sub":
            return `Result: ${a - b}`;
        case "multiply":
            return `Result: ${a * b}`;
        case "division":
            if (b === 0) return "Error: cannot divide by zero";
            return `Result: ${a / b}`;
        default:
            return `Error: unknown operation "${operation}"`;
    }
}
 
export function getCurrentTime(args: any): string {
    const now = new Date();
    return now.toLocaleTimeString("en-IN", {
        hour:   "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
}
 
