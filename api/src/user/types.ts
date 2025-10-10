/**
 * Represents a user account.
 */
export interface User {
    /** The unique identifier for the user. */
    id: number;

    /** The username of the user. */
    username: string;

    /** The email address of the user. */
    email: string;

    /** The hashed password of the user. */
    passwordHash: string;

    /** The timestamp when the user account was created. */
    createdAt: Date;
}