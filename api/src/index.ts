

function testRoute(req: Request): Response {


    console.log(req);

    return new Response("Hello!");
}



Bun.serve({
    port: 8000,
    routes: {
        "/": testRoute
    }
});



