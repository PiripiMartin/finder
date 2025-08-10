import type { BunRequest } from "bun";

/**
 * Checks if the request body contains all required fields.
 * @param req BunRequest - The incoming request
 * @param requiredFields string[] - List of required field names
 * @returns Promise<any> - The parsed body, or null if the body is missing or malformed
 */
export async function checkedExtractBody(
    req: Request | BunRequest,
    requiredFields: string[]
): Promise<any> {
    if (!req.body) return null;
    let data: any;
    try {
        data = await req.body.json();
    } catch {
        return null;
    }
    if (typeof data !== "object" || data === null) return null;

    // Check if all required fields are present
    for (const field of requiredFields) {
        if (!(field in data)) return null;
    }

    return data;
}


