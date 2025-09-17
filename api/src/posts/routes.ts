import type { BunRequest } from "bun";
import { verifySessionToken } from "../user/session";
import { checkedExtractBody } from "../utils";
import { extractPossibleLocationName, generateLocationDetails, getGooglePlaceDetails, getTikTokEmbedInfo, searchGooglePlaces, createManualLocationResponse } from "./get-location";
import { db } from "../database";
import { type CreateLocationRequest, type CreatePostRequest, createLocation, createPost as createPostRecord, createPostSaveAttempt, getOrCreateFallbackLocationId, fallbackPoint } from "./queries";


interface NewPostRequest {
    url: string
};


export async function createPost(req: BunRequest): Promise<Response> {
    // Extract basic info ASAP
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1] || null;
    const data: NewPostRequest | null = await checkedExtractBody(req, ["url"]);

    // Create an early attempt record (before auth and location resolution)
    await createPostSaveAttempt({
        requestId: crypto.randomUUID(),
        url: data?.url ?? null,
        sessionToken,
    });

    // Now check user has a valid session
    if (!sessionToken) {
        return new Response("Missing session token", {status: 401});
    }
    const userId = await verifySessionToken(sessionToken);
    if (userId == null) {
        return new Response("Invalid session token", {status: 401});
    }
    // We can optionally record userId in the initial log if desired in future

    if (!data) {
        return new Response("Malformed body", {status: 400});
    }

    // Get TikTok embed info (best-effort; fallback if it fails)
    const embedInfo = await getTikTokEmbedInfo(data.url);
    const createFallback = async (urlForPost: string) => {
        const fallbackLocationId = await getOrCreateFallbackLocationId();
        const postData: CreatePostRequest = {
            url: urlForPost,
            postedBy: userId,
            mapPointId: fallbackLocationId,
        };
        const newPost = await createPostRecord(postData);
        if (!newPost) {
            return new Response("Error creating post for fallback location.", {status: 500});
        }
        return new Response(
            JSON.stringify({
                success: true,
                message: `Post created and attributed to fallback location: ${fallbackPoint}`,
                post: newPost,
                locationId: fallbackLocationId,
                isFallbackLocation: true,
            }),
            // NOTE: We return a 422 because we need a unique code to indicate a valid location was not found/created
            //       Eventually this will be used to signal the frontend to manually create a pin on the map.
            { status: 422, headers: { 'Content-Type': 'application/json' } }

        );
    };
    if (!embedInfo) {
        return await createFallback(data.url);
    }

    //console.log("Embed info:");
    //console.log(embedInfo);

    // Extract possible location name using LLM API
    const possiblePlaceName = await extractPossibleLocationName(embedInfo);
    if (!possiblePlaceName) {
        return createManualLocationResponse(embedInfo);
    }

    //console.log("Possible place name:");
    //console.log(possiblePlaceName);

    // Text search Google Places with LLM output
    const placesResult = await searchGooglePlaces(possiblePlaceName);
    if (!placesResult) {
        return await createFallback(data.url);
    }

    //console.log("Places result:");
    //console.log(placesResult);

    // Check if places array exists and has at least one result
    if (!placesResult?.places || placesResult.places.length === 0) {
        return await createFallback(data.url);
    }

    const placeId = placesResult.places[0]!.id;

    // Create embeddable TikTok URL
    const embedUrl = `https://www.tiktok.com/player/v1/${embedInfo.embedProductId}?loop=1&autoplay=1&controls=0&volume_control=1&description=0&rel=0&native_context_menu=0&closed_caption=0&progress_bar=0&timestamp=0`;

    // Check if a location with this Google Place ID already exists
    const [rows, _] = await db.execute("SELECT id FROM map_points WHERE google_place_id = ?", [placeId]) as [any[], any];
    if (rows.length > 0) {
        //console.log("Location already exists.");
        const existingLocationId = rows[0].id;

        // Save post to existing location
        const postData: CreatePostRequest = {
            url: embedUrl,
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
        return await createFallback(embedUrl);
    }

    //console.log("Place details:");
    //console.log(placeDetails);

    // Generate description and emoji using Gemini API
    const locationDetails = await generateLocationDetails(placeDetails, embedInfo);
    if (!locationDetails) {
        return await createFallback(embedUrl);
    }

    //console.log("Location details:");
    //console.log(locationDetails);

    // Create new location
    const location: CreateLocationRequest = {
        googlePlaceId: placeId,
        title: placeDetails.displayName.text,
        description: locationDetails.description,
        emoji: locationDetails.emoji,
        latitude: placeDetails.location.latitude,
        longitude: placeDetails.location.longitude,
        isValidLocation: true, 
        recommendable: false, // Always starts as false
        websiteUrl: placeDetails.websiteUri,
        phoneNumber: placeDetails.nationalPhoneNumber,
        address: placeDetails.formattedAddress,
    };

    const newLocation = await createLocation(location);
    if (!newLocation) {
        return new Response("Error creating new location.", {status: 500});
    }


    // Create the post for the new location
    const postData: CreatePostRequest = {
        url: embedUrl,
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


