import { db } from "../database";

/**
 * The duration of a user session in days.
 */
const SESSION_LENGTH_DAYS = 30;

/**
 * The number of milliseconds in a day.
 */
const DAYS_TO_MS = 86400000;

/**
 * Generates a new session token for a user and stores it in the database.
 *
 * @param accountId - The ID of the user account.
 * @returns A promise that resolves to the newly generated session token.
 */
export async function generateSessionToken(accountId: number): Promise<string> {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_LENGTH_DAYS * DAYS_TO_MS);

    await db.execute(
        "INSERT INTO user_sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)",
        [token, accountId, expiresAt]
    );

    return token;
}

/**
 * Verifies a session token and returns the associated user ID if valid.
 *
 * @param token - The session token to verify.
 * @returns A promise that resolves to the user ID if the token is valid, otherwise null.
 */
export async function verifySessionToken(token: string): Promise<number | null> {
    const [results] = await db.execute(
        "SELECT user_id FROM user_sessions WHERE session_token = ? AND expires_at > NOW()",
        [token]
    ) as [any[], any];

    if (results.length === 0) {
        return null;
    }

    return results[0].user_id as number;
}

/**
 * Deletes all expired user sessions from the database.
 *
 * @returns A promise that resolves to the number of deleted sessions.
 */
export async function cleanupExpiredSessions(): Promise<number> {
    const [result] = await db.execute("DELETE FROM user_sessions WHERE expires_at < NOW()") as [any, any];
    return result.affectedRows || 0;
}