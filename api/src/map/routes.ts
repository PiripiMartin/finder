import type { BunRequest } from "bun";


export async function getPosts(req: BunRequest): Promise<Response> {

    const id: number = parseInt((req.params as any).id);


    if (!id) {
        return new Response("Missing map point id", {status: 400});
    }


    //TODO: Implement
    return new Response();
}

