import { db, toCamelCase } from "../database";
import type { AuthChallenge } from "./types";

/**
 * Creates a new authentication challenge for password reset.
 * 
 * @param userId - The user ID to create the challenge for.
 * @param challengeCode - The 6-digit challenge code.
 * @param expiresAt - When the challenge expires.
 * @returns The created challenge.
 */
export async function createAuthChallenge(
    userId: number,
    challengeCode: string,
    expiresAt: Date
): Promise<AuthChallenge> {
    await db.execute(
        "INSERT INTO auth_challenges (user_id, challenge_code, expires_at) VALUES (?, ?, ?)",
        [userId, challengeCode, expiresAt]
    );

    const [rows] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const challengeId = rows[0].id;

    const [challengeRows] = await db.execute(
        "SELECT * FROM auth_challenges WHERE id = ?",
        [challengeId]
    ) as [any[], any];

    return toCamelCase(challengeRows[0]) as AuthChallenge;
}

/**
 * Finds a valid (not expired) authentication challenge for a user.
 * 
 * @param userId - The user ID.
 * @param challengeCode - The challenge code to verify.
 * @returns The challenge if found and valid, null otherwise.
 */
export async function findValidAuthChallenge(
    userId: number,
    challengeCode: string
): Promise<AuthChallenge | null> {
    const [rows] = await db.execute(
        `SELECT * FROM auth_challenges 
         WHERE user_id = ? 
           AND challenge_code = ? 
           AND expires_at > NOW() 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId, challengeCode]
    ) as [any[], any];

    if (rows.length === 0) {
        return null;
    }

    return toCamelCase(rows[0]) as AuthChallenge;
}

/**
 * Deletes an authentication challenge after it's been used.
 * 
 * @param challengeId - The challenge ID to delete.
 */
export async function deleteAuthChallenge(challengeId: number): Promise<void> {
    await db.execute(
        "DELETE FROM auth_challenges WHERE id = ?",
        [challengeId]
    );
}

