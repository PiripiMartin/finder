import type { BunRequest } from "bun";
import { verifySessionToken } from "../user/session";
import { checkedExtractBody } from "../utils";
import { extractPossibleLocationName, getTikTokEmbedInfo, searchGooglePlaces } from "./get-location";


interface NewPostRequest {
    url: string
};


export async function createPost(req: BunRequest): Promise<Response> {
    
    // First, check user has a valid session
    //const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    //if (!sessionToken) {
    //    return new Response("Missing session token", {status: 401});
    //}
    //if ((await verifySessionToken(sessionToken)) == null) {
    //    return new Response("Invalid session token", {status: 401});
    //}

    // Extract post link from request body
    const data: NewPostRequest = await checkedExtractBody(req, ["url"]);
    if (!data) {
        return new Response("Malformed body", {status: 400});
    }

    const embedInfo = await getTikTokEmbedInfo(data.url);
    if (!embedInfo) {
        return new Response("Error fetching TikTok embed information", {status: 500});
    }

    const possiblePlaceName = await extractPossibleLocationName(embedInfo);
    if (!possiblePlaceName) {
        return new Response("Error extracing location name from TikTok.", {status: 500});
    }

    const placesResult = await searchGooglePlaces(possiblePlaceName);
    if (!placesResult) {
        return new Response("Error searching Google Places.", {status: 500});
    }

    const placeId = placesResult.results[0].place_id;
    if (!placeId) {
        return new Response("Error finding place ID.", {status: 500});
    }



    return new Response()
}


