import type { BunRequest } from "bun";
import { verifySessionToken } from "../user/session";
import { checkedExtractBody } from "../utils";
import { extractPossibleLocationName, getGooglePlaceDetails, getTikTokEmbedInfo, searchGooglePlaces } from "./get-location";
import { db } from "../database";


interface NewPostRequest {
    url: string
};


export async function createPost(req: BunRequest): Promise<Response> {
    
    // First, check user has a valid session
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", {status: 401});
    }
    if ((await verifySessionToken(sessionToken)) == null) {
        return new Response("Invalid session token", {status: 401});
    }

    // Extract post link from request body
    const data: NewPostRequest = await checkedExtractBody(req, ["url"]);
    if (!data) {
        return new Response("Malformed body", {status: 400});
    }

    // Get TikTok embed info
    const embedInfo = await getTikTokEmbedInfo(data.url);
    if (!embedInfo) {
        return new Response("Error fetching TikTok embed information", {status: 500});
    }

    // Extract possible location name using LLM API
    const possiblePlaceName = await extractPossibleLocationName(embedInfo);
    if (!possiblePlaceName) {
        return new Response("Error extracing location name from TikTok.", {status: 500});
    }

    // Text search Google Places with LLM output
    const placesResult = await searchGooglePlaces(possiblePlaceName);
    if (!placesResult) {
        return new Response("Error searching Google Places.", {status: 500});
    }

    const placeId = placesResult.places[0]?.id;
    if (!placeId) {
        // NOTE: here is where we'll send a different response (maybe a special code?) to initiate the manual
        //       post definition system.
        return new Response("Error finding place ID.", {status: 500});
    }

    // Check if a location with this Google Place ID already exists
    const [rows, _] = await db.execute("SELECT id FROM map_points WHERE google_place_id = ?", [placeId]) as [any[], any];
    if (rows.length > 0) {

        // Save post to existing location

        // TODO: Update returned response
        return new Response();
    }

    // If the location doesn't exist, we need to create it - first get the details
    const placeDetails = await getGooglePlaceDetails(placeId);
    if (!placeDetails) {
        return new Response("Error fetching Google Place details.", {status: 500});
    }

    // TODO: Update returned response
    return new Response()
}


