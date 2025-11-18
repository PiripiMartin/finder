/**
 * Represents an authentication challenge (e.g., password reset code).
 */
export interface AuthChallenge {
    /** The unique identifier for the challenge. */
    id: number;

    /** The user ID associated with this challenge. */
    userId: number;

    /** The 6-digit challenge code. */
    challengeCode: string;

    /** When the challenge expires. */
    expiresAt: Date;

    /** Whether the challenge has been used. */
    used: boolean;

    /** When the challenge was created. */
    createdAt: Date;
}

