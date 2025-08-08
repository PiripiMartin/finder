import { db, toCamelCase } from "../database";
import type { User } from "./types";



interface LoginRequest {
    username: string,
    password: string,
};



export async function login(req: Request): Promise<Response> {

    if (!req.body) {
        return new Response("Missing request body", {status: 400});
    }
    const data = await req.body.json();

    if (!("username" in data) || !("password" in data)) {
        return new Response("Malformed body", {status: 400});
    }
    const loginRequest = data as LoginRequest;

    // Fetch the corresponding account
    const [rows, _] = await db.execute(
        "SELECT * FROM users WHERE username = ?", 
        [loginRequest.username]
    ) as [any[], any];

    const results: User[] = toCamelCase(rows);


    // Compare hashes
    const validCredentials = await Bun.password.verify(loginRequest.password, results[0]?.passwordHash || "", "argon2id");



    // TODO: Generate this to initiate session
    const sessionToken = "";

    return new Response(sessionToken, {status: validCredentials ? 200 : 401});
}


