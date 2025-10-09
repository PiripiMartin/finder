import { env } from "bun";
import mysql from "mysql2/promise";

/**
 * The database connection pool.
 * Uses environment variables for configuration.
 * 
 * @see mysql2/promise
 */
export const db = mysql.createPool({
    host: env.DB_HOST,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    //connectionLimit: 10, // Default is 10, adjust as needed
});

/**
 * Recursively converts all keys in an object or an array of objects from snake_case to camelCase.
 *
 * @param data - The input object or array of objects with snake_case keys.
 * @returns The transformed object or array of objects with camelCase keys.
 */
export function toCamelCase<T extends Record<string, any>>(data: T | T[]): T | T[] {
  
    const camelize = (obj: Record<string, any>) => {
        const newObj: Record<string, any> = {};
        for (const key in obj) {
            const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            newObj[camelKey] = obj[key];
        }
        return newObj as T;
    };

    if (Array.isArray(data)) {
        return data.map(camelize) as T[];
    }
    return camelize(data);
}
