import type { BunRequest } from "bun";
import { db, toCamelCase } from "../database";
import type { User } from "./types";
import { generateSessionToken, verifySessionToken } from "./session";



interface LoginRequest {
    username: string,
    password: string,
};

export interface TokenValidation {
    userId: string,
    sessionToken: string
};



export async function login(req: BunRequest): Promise<Response> {

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

    if (results.length == 0) {
        return new Response("Couldn't find an account with that name.", {status: 404});
    }

    // Can safely make this typecast now
    const account = results[0] as User;
    

    // Compare hashes
    const validCredentials = await Bun.password.verify(loginRequest.password, account.passwordHash || "", "argon2id");
    if (!validCredentials) {
        return new Response("Invalid credentials", {status: 401});
    }

    // Generate session token and send back to user
    const sessionToken = await generateSessionToken(account.id);
    return new Response(sessionToken, {status: validCredentials ? 200 : 401});
}


export async function validateSessionToken(req: BunRequest): Promise<Response> {
    
    if (!req.body) {
        return new Response("Missing request body", {status: 400});
    }
    const data = await req.body.json();

    if (!("sessionToken" in data) || !("userId" in data)) {
        return new Response("Malformed body", {status: 400});
    }

    const isValidSession = await verifySessionToken(data as TokenValidation);

    return new Response(null, {status: isValidSession ? 200 : 401});
}


