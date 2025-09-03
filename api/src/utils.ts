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


// In-memory toggle for the refresh endpoint status
const REFRESH_TOGGLE_UUID = "f2d2a8f0-5c5b-4e9e-9f0b-1234567890ab"; // Hardcoded protection UUID
let shouldReturnUnauthorizedForRefresh = false;

export function refresh(_req: BunRequest): Response {
    return new Response("", {status: shouldReturnUnauthorizedForRefresh ? 401 : 200});
}

/**
 * Protected endpoint to toggle the refresh status between 200 and 401.
 * Protection: requires matching UUID via query param `key` or header `X-Toggle-Key`.
 */
export function toggleRefreshStatus(req: BunRequest): Response {
    const url = new URL(req.url);
    const keyFromQuery = url.searchParams.get("key");
    const keyFromHeader = req.headers.get("X-Toggle-Key") || req.headers.get("x-toggle-key");
    const providedKey = keyFromQuery || keyFromHeader;

    if (providedKey !== REFRESH_TOGGLE_UUID) {
        return new Response("Unauthorized", {status: 401});
    }

    shouldReturnUnauthorizedForRefresh = !shouldReturnUnauthorizedForRefresh;

    return new Response(
        JSON.stringify({
            refreshStatus: shouldReturnUnauthorizedForRefresh ? 401 : 200
        }),
        {status: 200, headers: {"Content-Type": "application/json"}}
    );
}
