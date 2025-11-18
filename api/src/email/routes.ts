import type { BunRequest } from "bun";
import { db, toCamelCase } from "../database";
import { checkedExtractBody } from "../utils";
import { findValidAuthChallenge, deleteAuthChallenge } from "./queries";
import type { User } from "../user/types";

/**
 * Represents the request body for completing a password reset.
 */
interface CompletePasswordResetRequest {
    username?: string;
    email?: string;
    challengeCode: string;
    newPassword: string;
}

/**
 * Handles password reset completion.
 * Validates the challenge code and updates the user's password.
 *
 * @param req - The Bun request, containing the reset credentials.
 * @returns A response indicating success or failure.
 */
export async function completePasswordReset(req: BunRequest): Promise<Response> {
    const data = await checkedExtractBody(req, ["challengeCode", "newPassword"]);
    if (!data) {
        return new Response("Malformed request body", { status: 400 });
    }

    const { username, email, challengeCode, newPassword } = data as CompletePasswordResetRequest;

    // Must provide either username or email
    if (!username && !email) {
        return new Response("Must provide either username or email", { status: 400 });
    }

    // Find the user by username or email
    let user: User | null = null;
    if (username) {
        const [rows] = await db.execute("SELECT * FROM users WHERE username = ?", [username]) as [any[], any];
        if (rows.length > 0) {
            user = toCamelCase(rows[0]) as User;
        }
    } else if (email) {
        const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [email]) as [any[], any];
        if (rows.length > 0) {
            user = toCamelCase(rows[0]) as User;
        }
    }

    if (!user) {
        return new Response("Invalid username or email", { status: 404 });
    }

    // Find and validate the challenge
    const challenge = await findValidAuthChallenge(user.id, challengeCode);
    if (!challenge) {
        return new Response("Invalid or expired challenge code", { status: 401 });
    }

    // Hash the new password
    const passwordHash = await Bun.password.hash(newPassword, "argon2id");

    // Update the user's password
    await db.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, user.id]);

    // Delete the challenge after use
    await deleteAuthChallenge(challenge.id);

    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}

