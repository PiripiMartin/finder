import { toCamelCase } from "../database";
import type { EmbedResponse, Post } from "./types";

/**
 * The endpoint for the Gemini API.
 */
const AI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

/**
 * Represents the structure of the Gemini API response.
 */
interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
}

/**
 * Represents the structure of the Google Places Text Search API response.
 */
interface PlacesTextSearchResponse {
    places: Array<{
        id: string;
    }>;
}

/**
 * Represents the structure of the Google Places Details API response.
 */
interface PlacesDetailsResponse {
    id: string;
    displayName: {
        text: string;
    };
    nationalPhoneNumber: string;
    websiteUri: string;
    location: {
        latitude: number;
        longitude: number;
    };
    formattedAddress: string;
    generativeSummary: {
        overview: string;
    };
}



/**
 * Builds the standard TikTok player embed URL for a given video ID.
 *
 * @param videoId - The ID of the TikTok video.
 * @returns The embeddable URL for the TikTok player.
 */
export function buildTikTokEmbedUrl(videoId: string): string {
    return `https://www.tiktok.com/player/v1/${videoId}?loop=1&autoplay=1&controls=1&volume_control=1&description=0&rel=0&native_context_menu=0&closed_caption=0&progress_bar=0&timestamp=0`;
}

/**
 * Fetches embed information for a TikTok video from the oEmbed endpoint.
 *
 * @param vidUrl - The URL of the TikTok video.
 * @returns A promise that resolves to the embed information or null on failure.
 */
export async function getTikTokEmbedInfo(vidUrl: string): Promise<EmbedResponse | null> {
    const ttEmbedEndpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(vidUrl)}`;

    try {
        const embedResponse = await fetch(ttEmbedEndpoint);
        if (!embedResponse.ok) {
            console.error("TikTok oEmbed API request failed:", await embedResponse.text());
            return null;
        }
        return toCamelCase(await embedResponse.json() as any) as EmbedResponse;
    } catch (error) {
        console.error("Error fetching TikTok embed info:", error);
        return null;
    }
}

/**
 * Uses the Gemini API to extract a potential location name from TikTok embed information.
 *
 * @param embedInfo - The embed information for the TikTok video.
 * @returns A promise that resolves to a search query for Google Places or null on failure.
 */
export async function extractPossibleLocationName(embedInfo: EmbedResponse): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set");
    }

    const prompt = `You are a location extraction expert. Analyze the following TikTok video information and extract the business/location name and any relevant details that would help identify the specific place.

    Video Title: ${embedInfo.title}
    Author: ${embedInfo.authorName}
    Author URL: ${embedInfo.authorUrl}

    Based on this information, create a search query that would work well with Google Places Text Search API to find this business. The query should be:
    1. Concise but descriptive
    2. Include the business type/category if apparent
    3. Include any location hints (city, neighborhood, etc.) if mentioned
    4. Be formatted as a simple text string suitable for Google Places API

    IMPORTANT: If you cannot find a good search query, return an empty string and nothing else.

    Return ONLY the search query text, nothing else.`;

    try {
        const response = await fetch(AI_ENDPOINT, {
            method: "POST",
            headers: {
                "X-goog-api-key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });

        if (!response.ok) {
            console.error("Gemini API request failed:", await response.text());
            return null;
        }

        const result = await response.json() as GeminiResponse;
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        return generatedText || null;
    } catch (error) {
        console.error("Error extracting possible location name:", error);
        return null;
    }
}

/**
 * Searches Google Places for a location based on a given search query.
 *
 * @param searchQuery - The search query to use for the Google Places API.
 * @returns A promise that resolves to the search results or null on failure.
 */
export async function searchGooglePlaces(searchQuery: string): Promise<PlacesTextSearchResponse | null> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    const placesEndpoint = `https://places.googleapis.com/v1/places:searchText`;

    try {
        const response = await fetch(placesEndpoint, {
            method: "POST",
            headers: {
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask": "places.id",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ textQuery: searchQuery }),
        });

        if (!response.ok) {
            console.error("Google Places API request failed:", await response.text());
            return null;
        }

        return await response.json() as PlacesTextSearchResponse;
    } catch (error) {
        console.error("Error searching Google Places:", error);
        return null;
    }
}

/**
 * Fetches detailed information for a given Google Place ID.
 *
 * @param placeId - The ID of the place to fetch details for.
 * @returns A promise that resolves to the place details or null on failure.
 */
export async function getGooglePlaceDetails(placeId: string): Promise<PlacesDetailsResponse | null> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    const placesEndpoint = `https://places.googleapis.com/v1/places/${placeId}`;

    try {
        const response = await fetch(placesEndpoint, {
            method: "GET",
            headers: {
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask": "id,displayName,formattedAddress,location,nationalPhoneNumber,websiteUri,generativeSummary",
            },
        });

        if (!response.ok) {
            console.error("Google Places Details API request failed:", await response.text());
            return null;
        }

        return await response.json() as PlacesDetailsResponse;
    } catch (error) {
        console.error("Error fetching Google Place details:", error);
        return null;
    }
}



/**
 * Generates a title, description and emoji for a location, based on its details and the context of a TikTok video.
 *
 * @param embedInfo - The embed information for the TikTok video.
 * @param placeDetails - Optional: The Google Place details for the location.
 * @returns A promise that resolves to the generated description and emoji, or null on failure.
 */
export async function generateLocationDetails(
    embedInfo: EmbedResponse,
    placeDetails?: PlacesDetailsResponse
): Promise<{ title: string; description: string; emoji: string } | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set");
    }

    const prompt = `You are a location expert. Based on the following TikTok video context${placeDetails ? " and Google Place information" : ""}, generate a brief title, description and a relevant emoji for this location.

    TikTok Video Context:
    Title: ${embedInfo.title}
    Author: ${embedInfo.authorName}
    ${placeDetails ? `
    Google Place Information:
    Name: ${placeDetails.displayName.text}
    Address: ${placeDetails.formattedAddress}
    Summary: ${placeDetails.generativeSummary?.overview || "N/A"}
    ` : ""}

    Requirements:
    1. Title should be 2-5 words and accurately represent the contents of the video${placeDetails ? " and the location" : ""}.
    2. Description should be 2-4 words that capture what makes this place special based on the TikTok video
    3. Focus on the specific food, drink, or experience featured in the video
    4. Description must NOT contain any punctuation (no commas, periods, apostrophes, hyphens, etc.)
    5. Choose ONE emoji that best represents the featured item or experience
    6. Be concise and accurate to what was shown in the video

    Examples of good responses are:
    - "Homemade pasta recipe, Homemade pasta, 🍝"
    - "Strawberry matcha latte, Japanese inspired cafe, 🍵"
    - "OOTD video, Fashion inspiration, 👗"

    CRITICAL: Respond with ONLY the title, description and emoji separated by a comma and space. No other text, no quotes, no punctuation in the description.

    Format: title, description, emoji`;

    try {
        const response = await fetch(AI_ENDPOINT, {
            method: "POST",
            headers: {
                "X-goog-api-key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });

        if (!response.ok) {
            console.error("Gemini API request failed for location details:", await response.text());
            return null;
        }

        const result = await response.json() as GeminiResponse;
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!generatedText) {
            return null;
        }

        const parts = generatedText.split(", ");
        if (parts.length !== 3) {
            console.error("Failed to parse Gemini API response for location details: incorrect number of parts");
            return null;
        }

        const [title, description, emoji] = parts;

        if (!title || !description || !emoji) {
            console.error("Failed to parse Gemini API response for location details: missing title, description or emoji");
            return null;
        }

        return { title, description, emoji };
    } catch (error) {
        console.error("Error generating location details:", error);
        return null;
    }
}
