import { cleanupExpiredSessions } from "./user/session";

/**
 * The interval for cleaning up expired sessions, in milliseconds. (24 hours)
 */
const SESSION_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

/**
 * Starts a periodic background task to clean up expired user sessions from the database.
 * This task runs once immediately upon startup and then every 24 hours.
 */
export function startSessionCleanupTask(): void {
    console.log("Starting session cleanup background task...");

    // Run cleanup immediately on startup
    runSessionCleanup();

    // Set up interval to run cleanup periodically
    setInterval(runSessionCleanup, SESSION_CLEANUP_INTERVAL);
}

/**
 * Executes the session cleanup process and logs the outcome.
 * If the cleanup is successful, it logs the number of sessions removed.
 * If an error occurs, it logs the error to the console.
 */
async function runSessionCleanup(): Promise<void> {
    try {
        const deletedCount = await cleanupExpiredSessions();
        if (deletedCount > 0) {
            console.log(`Session cleanup completed: ${deletedCount} expired sessions removed.`);
        }
    } catch (error) {
        console.error("Error during session cleanup:", error);
    }
}