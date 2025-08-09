import { db } from "../database";

const SESSION_LENGTH = 7; // Days
const DAYS_TO_MS = 86400000;

export async function generateSessionToken(accountId: number): Promise<string> {

    const token = crypto.randomUUID();

    console.log(`Inserting token: ${token}`);

    // Get expiration datetime
    const expiresAt = new Date(new Date().getTime() + (7 * DAYS_TO_MS));

    // Now store it in the DB
    await db.execute(
        "INSERT INTO user_sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)", 
        [token, accountId, expiresAt]
    );


    return token;
}


