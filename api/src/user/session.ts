import type { BunRequest } from "bun";
import { db } from "../database";
import type { TokenValidation } from "./routes";

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


export async function verifySessionToken(tokenInfo: TokenValidation): Promise<boolean> {
    
    const [results, _] = await db.execute(
        "SELECT COUNT(*) AS count FROM user_sessions WHERE user_id = ? AND session_token = ? AND expires_at > NOW()",
        [tokenInfo.userId, tokenInfo.sessionToken]
    ) as [any[], any];

    if (results.length == 0) {
        return false;
    }

    if (results[0].count != 1) {
        return false;
    }

    return true;
}

