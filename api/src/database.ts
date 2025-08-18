import { env } from "bun";
import mysql from "mysql2/promise";

// Generate connection from environment variables
// TODO: Change to a connection pool when scaling out
export const db = mysql.createPool({
    host: env.DBHOST,
    user: env.DBUSERNAME,
    password: env.DBPASSWORD,
    database: env.DATABASE,
});


// Utility function for mapping names between DB and API server
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






