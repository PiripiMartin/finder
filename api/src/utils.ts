import type { BunRequest } from "bun";
import { db, toCamelCase } from "./database";
import { verifySessionToken } from "./user/session";

/**
 * The hardcoded UUID for the refresh toggle endpoint.
 */
const REFRESH_TOGGLE_UUID = "f2d2a8f0-5c5b-4e9e-9f0b-1234567890ab";

/**
 * Admin email addresses that are allowed to access the internal dashboard.
 */
export const ADMIN_EMAILS: string[] = [
    "boollewis04@gmail.com",
    "piripi@gmail.com"
];

/**
 * In-memory toggle for the refresh endpoint status.
 */
let shouldReturnUnauthorizedForRefresh = false;

const DASHBOARD_FILE = "./dashboard/dashboard.html";
const LOGIN_FILE = "./dashboard/login.html";

/**
 * Parses and validates the request body to ensure it contains all required fields.
 *
 * @param req - The incoming Bun request.
 * @param requiredFields - An array of strings representing the required field names.
 * @returns A promise that resolves to the parsed request body if valid, otherwise null.
 */
export async function checkedExtractBody(
    req: Request | BunRequest,
    requiredFields: string[]
): Promise<any> {
    if (!req.body) {
        return null;
    }

    let data: any;
    try {
        data = await req.json();
    } catch {
        return null;
    }

    if (typeof data !== "object" || data === null) {
        return null;
    }

    for (const field of requiredFields) {
        if (!(field in data)) {
            return null;
        }
    }

    return data;
}

/**
 * An endpoint that returns a 200 or 401 status code based on the current toggle state.
 * This is used for testing purposes.
 *
 * @param _req - The incoming Bun request (unused).
 * @returns A response with a 200 or 401 status code.
 */
export function refresh(_req: BunRequest): Response {
    return new Response(null, { status: shouldReturnUnauthorizedForRefresh ? 401 : 200 });
}

/**
 * A protected endpoint to toggle the refresh status between 200 and 401.
 * Requires a matching UUID via a query parameter or header for authorization.
 *
 * @param req - The incoming Bun request.
 * @returns A response indicating the new refresh status or an unauthorized error.
 */
export function toggleRefreshStatus(req: BunRequest): Response {
    const url = new URL(req.url);
    const keyFromQuery = url.searchParams.get("key");
    const keyFromHeader = req.headers.get("X-Toggle-Key") || req.headers.get("x-toggle-key");
    const providedKey = keyFromQuery || keyFromHeader;

    if (providedKey !== REFRESH_TOGGLE_UUID) {
        return new Response("Unauthorized", { status: 401 });
    }

    shouldReturnUnauthorizedForRefresh = !shouldReturnUnauthorizedForRefresh;

    return new Response(
        JSON.stringify({
            refreshStatus: shouldReturnUnauthorizedForRefresh ? 401 : 200,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
}


export async function getDashboard(_req: BunRequest): Promise<Response> {
    return new Response(
        await Bun.file(DASHBOARD_FILE).text(),
        {
            headers: {"Content-Type": "text/html"}
        }
    );
}

export async function getLogin(_req: BunRequest): Promise<Response> {
    return new Response(
        await Bun.file(LOGIN_FILE).text(),
        {
            headers: {"Content-Type": "text/html"}
        }
    );
}

/**
 * Checks if the authenticated user is an admin.
 * Validates the session token and checks if the user's email is in the admin list.
 *
 * @param req - The Bun request, containing the session token.
 * @returns A response indicating whether the user is an admin or an error message.
 */
export async function checkAdminAccess(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    
    if (!sessionToken) {
        return new Response(JSON.stringify({ isAdmin: false, error: "Missing session token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response(JSON.stringify({ isAdmin: false, error: "Invalid or expired session token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    // Get user's email
    const [rows] = await db.execute("SELECT email FROM users WHERE id = ?", [userId]) as [any[], any];
    if (rows.length === 0) {
        return new Response(JSON.stringify({ isAdmin: false, error: "User not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
        });
    }

    const userEmail = rows[0].email;
    const isAdmin = ADMIN_EMAILS.includes(userEmail);

    return new Response(JSON.stringify({ isAdmin }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}




