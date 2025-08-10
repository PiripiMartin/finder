import type { BunRequest } from "bun";
import { verifySessionToken } from "../user/session";


export async function getLocationPosts(req: BunRequest): Promise<Response> {

    // First, check user has a valid session
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", {status: 401});
    }
    if ((await verifySessionToken(sessionToken)) == null) {
        return new Response("Invalid session token", {status: 401});
    }

    // Then, get the map point id
    const id: number = parseInt((req.params as any).id);
    if (!id) {
        return new Response("Missing map point id", {status: 400});
    }

    


    //TODO: Implement
    return new Response();
}

