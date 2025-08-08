
interface LoginRequest {
    username: string,
    password: string,
};


export async function login(req: Request): Promise<Response> {

    if (!req.body) {
        return new Response("Missing request body", {status: 400});
    }
    const data = await req.body.json();
    
    
    

    return new Response();
}

