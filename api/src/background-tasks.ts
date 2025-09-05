import { cleanupExpiredSessions } from "./user/session";

/**
 * Background task that runs periodically to clean up expired user sessions.
 * Runs every 24 hours to remove expired sessions from the database.
 */
export function startSessionCleanupTask(): void {
    //console.log("Starting session cleanup background task...");
    
    // Run cleanup immediately on startup
    runSessionCleanup();
    
    // Set up interval to run cleanup every 24 hours
    setInterval(async () => {
        await runSessionCleanup();
    }, 60 * 60 * 1000); // 1 hour in milliseconds
}

/**
 * Executes the session cleanup and logs the results.
 */
async function runSessionCleanup(): Promise<void> {
    try {
        const deletedCount = await cleanupExpiredSessions();
        //console.log(`Session cleanup completed: ${deletedCount} expired sessions removed`);
    } catch (error) {
        console.error("Error during session cleanup:", error);
    }
}
