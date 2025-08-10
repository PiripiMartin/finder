import type { BunRequest } from "bun";
import { db } from "../database";

const SESSION_LENGTH = 7; // Days
const DAYS_TO_MS = 86400000;

export async function generateSessionToken(accountId: number): Promise<string> {

    const token = crypto.randomUUID();

    // Get expiration datetime
    const expiresAt = new Date(new Date().getTime() + (SESSION_LENGTH * DAYS_TO_MS));

    // Now store it in the DB
    await db.execute(
        "INSERT INTO user_sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)", 
        [token, accountId, expiresAt]
    );

    return token;
}


export async function verifySessionToken(token: string): Promise<number | null> {
    
    const [results, _] = await db.execute(
        "SELECT user_id FROM user_sessions WHERE session_token = ? AND expires_at > NOW()",
        [token]
    ) as [any[], any];

    if (results.length == 0) {
        return null;
    }

    if (!("user_id" in results[0])) {
        return null;
    }

    return results[0].user_id as number;
}

