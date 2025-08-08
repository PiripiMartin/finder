import { db } from "../database";



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
    const [results, _] = await db.execute(
        "SELECT id, username, password_hash FROM users WHERE username = ?", 
        [loginRequest.username]
    ) as [any, any];


    console.log("Fetch results:");
    console.log(results);
    
    // Compare hashes
    const validCredentials = Bun.password.verify(loginRequest.password, results.password_hash, "argon2id");
    
    console.log("Hash comparison results:");
    console.log(validCredentials);


    return new Response();
}



