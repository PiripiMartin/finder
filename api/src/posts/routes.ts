import type { BunRequest } from "bun";
import { verifySessionToken } from "../user/session";
import { checkedExtractBody } from "../utils";
import { extractPossibleLocationName, generateLocationDetails, getGooglePlaceDetails, getTikTokEmbedInfo, searchGooglePlaces } from "./get-location";
import { db } from "../database";
import { type CreateLocationRequest, type CreatePostRequest, createLocation, createPost as createPostRecord } from "./queries";


interface NewPostRequest {
    url: string
};


export async function createPost(req: BunRequest): Promise<Response> {
    
    // First, check user has a valid session
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", {status: 401});
    }
    const userId = await verifySessionToken(sessionToken);
    if (userId == null) {
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
        // Location could not be automatically identified - prompt user to manually select location
        return new Response(
            JSON.stringify({
                error: "LOCATION_NOT_FOUND",
                message: "Location could not be automatically identified. Please manually select the location on the map.",
                requiresManualLocation: true,
                embedInfo: {
                    title: embedInfo.title,
                    authorName: embedInfo.authorName,
                    thumbnailUrl: embedInfo.thumbnailUrl
                }
            }),
            {status: 422, headers: {'Content-Type': 'application/json'}}
        );
    }

    // Check if a location with this Google Place ID already exists
    const [rows, _] = await db.execute("SELECT id FROM map_points WHERE google_place_id = ?", [placeId]) as [any[], any];
    if (rows.length > 0) {
        const existingLocationId = rows[0].id;

        // Save post to existing location
        const postData: CreatePostRequest = {
            url: data.url,
            postedBy: userId,
            mapPointId: existingLocationId
        };

        const newPost = await createPostRecord(postData);
        if (!newPost) {
            return new Response("Error creating post for existing location.", {status: 500});
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Post created successfully for existing location",
                post: newPost,
                locationId: existingLocationId
            }),
            {status: 201, headers: {'Content-Type': 'application/json'}}
        );
    }

    // If the location doesn't exist, we need to create it - first get the details
    const placeDetails = await getGooglePlaceDetails(placeId);
    if (!placeDetails) {
        return new Response("Error fetching Google Place details.", {status: 500});
    }

    // Generate description and emoji using Gemini API
    const locationDetails = await generateLocationDetails(placeDetails);
    if (!locationDetails) {
        return new Response("Error generating location description and emoji.", {status: 500});
    }

    // Create new location
    const location: CreateLocationRequest = {
        googlePlaceId: placeId,
        title: placeDetails.place.displayName.text,
        description: locationDetails.description,
        emoji: locationDetails.emoji,
        latitude: placeDetails.place.location.latitude,
        longitude: placeDetails.place.location.longitude,
        recommendable: false, // Always starts as false
        websiteUrl: placeDetails.place.websiteUri,
        phoneNumber: placeDetails.place.nationalPhoneNumber,
        address: placeDetails.place.formattedAddress,
    };

    const newLocation = await createLocation(location);
    if (!newLocation) {
        return new Response("Error creating new location.", {status: 500});
    }

    // Create the post for the new location
    const postData: CreatePostRequest = {
        url: data.url,
        postedBy: userId,
        mapPointId: newLocation.id
    };

    const newPost = await createPostRecord(postData);
    if (!newPost) {
        return new Response("Error creating post for new location.", {status: 500});
    }

    return new Response(
        JSON.stringify({
            success: true,
            message: "Post and location created successfully",
            post: newPost,
            location: newLocation
        }),
        {status: 201, headers: {'Content-Type': 'application/json'}}
    );
}


