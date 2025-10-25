import type { BunRequest } from "bun";
import type { TikTokEmbedResponse, InstagramPostInformation } from "./types";
import { verifySessionToken } from "../user/session";
import { checkedExtractBody } from "../utils";
import { extractPossibleLocationName, generateLocationDetails, getGooglePlaceDetails, getTikTokEmbedInfo, searchGooglePlaces, buildTikTokEmbedUrl } from "./get-location";
import { db } from "../database";
import { type CreateLocationRequest, type CreatePostRequest, createLocation, createPost as createPostRecord, createPostSaveAttempt, createInvalidLocation, saveLocationForUser, removeSavedLocationForUser } from "./queries";
import { PostPlatform } from "./types";
import { getPostPlatform } from "./utils";
import { getInstagramPostInformation } from "./instagram";


interface NewPostRequest {
    url: string
};


export async function createPost(req: BunRequest): Promise<Response> {
    // Extract basic info ASAP
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1] || null;
    const data: NewPostRequest | null = await checkedExtractBody(req, ["url"]);

    // Create an early attempt record (before auth and location resolution)
    //await createPostSaveAttempt({
    //    requestId: crypto.randomUUID(),
    //    url: data?.url ?? null,
    //    sessionToken,
    //});

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

    // Now, we check if the post is for TikTok or Instagram
    const postPlatform = getPostPlatform(data.url);
    if (!postPlatform) {
        return new Response("Invalid post platform", {status: 400});
    }

    let postInformation: TikTokEmbedResponse | InstagramPostInformation | null = null;
    let embedUrl: string | null = null;

    if (postPlatform === PostPlatform.TIKTOK) {

        // Get TikTok embed info
        postInformation = await getTikTokEmbedInfo(data.url) as TikTokEmbedResponse | null;


        if (!postInformation || !postInformation.embedProductId) {
            return new Response("Couldn't get TikTok video ID from link.", {status: 500});
        }

        // Compute embed URL
        if (postInformation?.embedProductId) {
            embedUrl = buildTikTokEmbedUrl(postInformation.embedProductId);
        } 
    } else if (postPlatform === PostPlatform.INSTAGRAM) {
        postInformation = await getInstagramPostInformation(data.url) as InstagramPostInformation | null;

        if (!postInformation) {
            return new Response("Couldn't get Instagram post information", {status: 500});
        }
    }

    if (!postInformation) {
        return new Response("Couldn't get post information", {status: 500});
    }

    // Extract possible location name using LLM API
    const possiblePlaceName = postInformation ? await extractPossibleLocationName(postInformation) : null;
    if (!possiblePlaceName) {
        console.error("Couldn't create a good location name");
        const invalidLocation = await createInvalidLocation(postInformation);
        if (!invalidLocation) {
            return new Response("Failed to create invalid location.", { status: 500 });
        }
        const post = await createPostRecord({ url: postInformation.url!, postedBy: userId, mapPointId: invalidLocation.id });
        
        // Add to user's saved locations
        await saveLocationForUser(userId, invalidLocation.id);
        
        return new Response(
            JSON.stringify({
                success: true,
                message: "Post created with invalid location",
                post: post,
                location: invalidLocation,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
        );
    }


    // Text search Google Places with LLM output
    const placesResult = await searchGooglePlaces(possiblePlaceName);
    if (!placesResult) {
        console.error("Couldn't resolve actual location.");
        const invalidLocation = await createInvalidLocation(postInformation);
        if (!invalidLocation) {
            return new Response("Failed to create invalid location.", { status: 500 });
        }
        const post = await createPostRecord({ url: embedUrl!, postedBy: userId, mapPointId: invalidLocation.id });
        
        // Add to user's saved locations
        await saveLocationForUser(userId, invalidLocation.id);
        
        return new Response(
            JSON.stringify({
                success: true,
                message: "Post created with invalid location",
                post: post,
                location: invalidLocation,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
        );
    }


    if (!placesResult.places || placesResult.places.length === 0) {
        console.error("Couldn't resolve actual location.");
        const invalidLocation = await createInvalidLocation(embedInfo);
        if (!invalidLocation) {
            return new Response("Failed to create invalid location.", { status: 500 });
        }
        const post = await createPostRecord({ url: embedUrl!, postedBy: userId, mapPointId: invalidLocation.id });
        
        // Add to user's saved locations
        await saveLocationForUser(userId, invalidLocation.id);
        
        return new Response(
            JSON.stringify({
                success: true,
                message: "Post created with invalid location",
                post: post,
                location: invalidLocation,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
        );
    }

    const placeId = placesResult.places[0]!.id;

    // TODO: This is likely redundant in all cases
    // Create embeddable TikTok URL
    //embedUrl = embedUrl ?? buildTikTokEmbedUrl(embedInfo!.embedProductId);

    // Check if a location with this Google Place ID already exists
    const [rows, _] = await db.execute("SELECT id FROM map_points WHERE google_place_id = ?", [placeId]) as [any[], any];
    if (rows.length > 0) {
        //console.log("Location already exists.");
        const existingLocationId = rows[0].id;

        // Save post to existing location
        const postData: CreatePostRequest = {
            url: embedUrl!,
            postedBy: userId,
            mapPointId: existingLocationId
        };

        const newPost = await createPostRecord(postData);
        if (!newPost) {
            return new Response("Error creating post for existing location.", {status: 500});
        }

        // Add to user's saved locations
        await saveLocationForUser(userId, existingLocationId);

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


    const placeDetails = await getGooglePlaceDetails(placeId);
    if (!placeDetails) {
        console.error("Failed to resolve place details");
        const invalidLocation = await createInvalidLocation(embedInfo);
        if (!invalidLocation) {
            return new Response("Failed to create invalid location.", { status: 500 });
        }
        const post = await createPostRecord({ url: embedUrl!, postedBy: userId, mapPointId: invalidLocation.id });
        
        // Add to user's saved locations
        await saveLocationForUser(userId, invalidLocation.id);
        
        return new Response(
            JSON.stringify({
                success: true,
                message: "Post created with invalid location",
                post: post,
                location: invalidLocation,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
        );
    }

    //console.log("Place details:");
    //console.log(placeDetails);

    const locationDetails = await generateLocationDetails(embedInfo!, placeDetails);
    if (!locationDetails) {
        console.error("Failed to generate tagline and emoji");
        const invalidLocation = await createInvalidLocation(embedInfo);
        if (!invalidLocation) {
            return new Response("Failed to create invalid location.", { status: 500 });
        }
        const post = await createPostRecord({ url: embedUrl!, postedBy: userId, mapPointId: invalidLocation.id });
        
        // Add to user's saved locations
        await saveLocationForUser(userId, invalidLocation.id);
        
        return new Response(
            JSON.stringify({
                success: true,
                message: "Post created with invalid location",
                post: post,
                location: invalidLocation,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
        );
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
        websiteUrl: placeDetails.websiteUri ?? null,
        phoneNumber: placeDetails.nationalPhoneNumber ?? null,
        address: placeDetails.formattedAddress,
    };

    const newLocation = await createLocation(location);
    if (!newLocation) {
        return new Response("Error creating new location.", {status: 500});
    }


    // Create the post for the new location
    const postData: CreatePostRequest = {
        url: embedUrl!,
        postedBy: userId,
        mapPointId: newLocation.id
    };

    const newPost = await createPostRecord(postData);
    if (!newPost) {
        return new Response("Error creating post for new location.", {status: 500});
    }

    // Add to user's saved locations
    await saveLocationForUser(userId, newLocation.id);

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



export async function deletePost(req: BunRequest): Promise<Response> {

    // Verify authentication
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", {status: 401});
    }
    const userId = await verifySessionToken(sessionToken);
    if (userId == null) {
        return new Response("Invalid session token", {status: 401});
    }

    // Validate post id from path params
    const postId: number = parseInt((req.params as any).id);
    if (!postId || Number.isNaN(postId)) {
        return new Response("Missing post id", {status: 400});
    }

    // Fetch the post to check ownership
    const [rows, _] = await db.execute(
        "SELECT posted_by FROM posts WHERE id = ?",
        [postId]
    ) as [any[], any];

    if (rows.length === 0) {
        return new Response("Post not found", {status: 404});
    }

    const ownerId = rows[0].posted_by as number | null;
    if (ownerId == null || ownerId !== userId) {
        return new Response("Forbidden", {status: 403});
    }

    // Get the map_point_id before deleting the post
    const [postRows] = await db.execute(
        "SELECT map_point_id FROM posts WHERE id = ?",
        [postId]
    ) as [any[], any];
    
    if (postRows.length === 0) {
        return new Response("Post not found", {status: 404});
    }
    
    const mapPointId = postRows[0].map_point_id;

    // Delete the post
    await db.execute("DELETE FROM posts WHERE id = ?", [postId]);

    return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
}
