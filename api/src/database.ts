import { env } from "bun";
import mysql from "mysql2/promise";

// Generate connection from environment variables
// TODO: Change to a connection pool when scaling out
export const db = await mysql.createConnection({
    host: env.DBHOST,
    user: env.DBUSERNAME,
    password: env.DBPASSWORD,
    database: env.DATABASE,
});

