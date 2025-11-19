import type { BunRequest } from "bun";
import { db, toCamelCase } from "../database";
import { verifySessionToken } from "../user/session";
import { ADMIN_EMAILS } from "../utils";
import { getErrorMetrics } from "../error-tracker";

/**
 * Verifies that the request is from an admin user.
 * 
 * @param req - The Bun request containing the session token.
 * @returns The user ID if admin, null otherwise.
 */
async function verifyAdmin(req: BunRequest): Promise<number | null> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    
    if (!sessionToken) {
        return null;
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return null;
    }

    // Get user's email
    const [rows] = await db.execute("SELECT email FROM users WHERE id = ?", [userId]) as [any[], any];
    if (rows.length === 0) {
        return null;
    }

    const userEmail = rows[0].email;
    if (!ADMIN_EMAILS.includes(userEmail)) {
        return null;
    }

    return userId;
}

/**
 * Gets signups per day for the past 7 days.
 * 
 * @param req - The Bun request.
 * @returns A response with signup data grouped by day.
 */
export async function getSignupsPerDay(req: BunRequest): Promise<Response> {
    const userId = await verifyAdmin(req);
    if (userId === null) {
        return new Response("Unauthorized", { status: 401 });
    }

    const query = `
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as count
        FROM users
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    `;

    const [results] = await db.execute(query) as [any[], any];
    const data = toCamelCase(results);

    // Fill in missing days with 0
    const last7Days: { date: string; count: number }[] = [];
    const today = new Date();
    
    // Normalize dates from database to strings
    const normalizedData = (data as any[]).map((item: any) => {
        let dateStr: string;
        if (item.date instanceof Date) {
            dateStr = item.date.toISOString().split('T')[0];
        } else {
            const dateValue = String(item.date || '');
            dateStr = dateValue.split('T')[0] || dateValue;
        }
        return { date: dateStr, count: Number(item.count) };
    });
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0] || date.toISOString();
        
        const existing = normalizedData.find((item: any) => item.date === dateStr);
        last7Days.push({
            date: dateStr,
            count: existing ? existing.count : 0
        });
    }

    return new Response(JSON.stringify(last7Days), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}

/**
 * Gets posts per day for the past 7 days.
 * 
 * @param req - The Bun request.
 * @returns A response with post data grouped by day.
 */
export async function getPostsPerDay(req: BunRequest): Promise<Response> {
    const userId = await verifyAdmin(req);
    if (userId === null) {
        return new Response("Unauthorized", { status: 401 });
    }

    const query = `
        SELECT 
            DATE(posted_at) as date,
            COUNT(*) as count
        FROM posts
        WHERE posted_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(posted_at)
        ORDER BY date ASC
    `;

    const [results] = await db.execute(query) as [any[], any];
    const data = toCamelCase(results);

    // Fill in missing days with 0
    const last7Days: { date: string; count: number }[] = [];
    const today = new Date();
    
    // Normalize dates from database to strings
    const normalizedData = (data as any[]).map((item: any) => {
        let dateStr: string;
        if (item.date instanceof Date) {
            dateStr = item.date.toISOString().split('T')[0];
        } else {
            const dateValue = String(item.date || '');
            dateStr = dateValue.split('T')[0] || dateValue;
        }
        return { date: dateStr, count: Number(item.count) };
    });
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0] || date.toISOString();
        
        const existing = normalizedData.find((item: any) => item.date === dateStr);
        last7Days.push({
            date: dateStr,
            count: existing ? existing.count : 0
        });
    }

    return new Response(JSON.stringify(last7Days), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}

/**
 * Gets the most popular locations ranked by post count.
 * 
 * @param req - The Bun request.
 * @returns A response with locations and their post counts.
 */
export async function getPopularLocations(req: BunRequest): Promise<Response> {
    const userId = await verifyAdmin(req);
    if (userId === null) {
        return new Response("Unauthorized", { status: 401 });
    }

    const query = `
        SELECT 
            mp.id,
            mp.title,
            mp.emoji,
            mp.address,
            COUNT(p.id) as post_count
        FROM map_points mp
        LEFT JOIN posts p ON mp.id = p.map_point_id
        GROUP BY mp.id, mp.title, mp.emoji, mp.address
        HAVING post_count > 0
        ORDER BY post_count DESC
        LIMIT 50
    `;

    const [results] = await db.execute(query) as [any[], any];
    const data = toCamelCase(results);

    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}

export async function getErrorStats(req: BunRequest): Promise<Response> {
    const userId = await verifyAdmin(req);
    if (userId === null) {
        return new Response("Unauthorized", { status: 401 });
    }

    const metrics = getErrorMetrics();
    return new Response(JSON.stringify(metrics), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}

