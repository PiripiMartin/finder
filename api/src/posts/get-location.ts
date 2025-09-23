import { toCamelCase } from "../database";

const AI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";


// Contains everything 'interesting' from the TikTok embed API
interface EmbedResponse {
    title: string,
    authorUrl: string,
    authorName: string,
    html: string,
    thumbnailUrl: string,
    embedProductId: string,
};

// Gemini API response structure
interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
}

// Google Places Search API response structure (Essentials only SKU)
// Completely free: no quota
interface PlacesTextSearchResponse {
    places: Array<{
        id: string;
    }>;
}

// Google Places Details API response structure (Enterprise SKU)
// 1000 free calls per month, only called for *new* locations
interface PlacesDetailsResponse {
    id: string,
    displayName: {
        text: string
    },
    nationalPhoneNumber: string,
    websiteUri: string,
    location: {
        latitude: number,
        longitude: number
    },
    formattedAddress: string,
    generativeSummary: {
        overview: string
    }
}

// Extracts TikTok video ID from common URL formats
export function extractTikTokVideoId(inputUrl: string): string | null {
    try {
        // Examples: https://www.tiktok.com/@user/video/1234567890
        //           https://www.tiktok.com/video/1234567890
        //           https://m.tiktok.com/v/1234567890.html
        //           https://vm.tiktok.com/xxxxxx (may require redirect resolution; not handled here)
        const patterns: RegExp[] = [
            /\/video\/(\d+)/,
            /\/v\/(\d+)\.html/
        ];
        for (const pattern of patterns) {
            const match = inputUrl.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        // Some share links include item_id or share_item_id
        const urlObj = new URL(inputUrl);
        const itemId = urlObj.searchParams.get("item_id") || urlObj.searchParams.get("share_item_id");
        if (itemId && /^\d+$/.test(itemId)) {
            return itemId;
        }
    } catch {
        // ignore
    }
    return null;
}

// Builds the standard TikTok player embed URL for a video id
export function buildTikTokEmbedUrl(videoId: string): string {
    return `https://www.tiktok.com/player/v1/${videoId}?loop=1&autoplay=1&controls=0&volume_control=1&description=0&rel=0&native_context_menu=0&closed_caption=0&progress_bar=0&timestamp=0`;
}

export async function getTikTokEmbedInfo(vidUrl: string): Promise<EmbedResponse | null> {

    const ttEmbedEndpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(vidUrl)}`;

    const doFetch = async (): Promise<Response> => {
        return await fetch(ttEmbedEndpoint, {
            headers: {
                // Some endpoints are stricter without a browser-like UA
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
                "Accept": "application/json"
            }
        });
    };

    let embedResponse = await doFetch();

    // Simple retry on transient errors
    if (embedResponse.status === 429 || (embedResponse.status >= 500 && embedResponse.status <= 599)) {
        await new Promise((r) => setTimeout(r, 200));
        embedResponse = await doFetch();
    }

    if (embedResponse.status !== 200) {
        return null;
    }

    try {
        const embedContent: EmbedResponse = toCamelCase(await embedResponse.json() as any) as EmbedResponse;
        return embedContent;
    } catch {
        return null;
    }
}


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

    const response = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: {
            "X-goog-api-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ]
        })
    });

    if (!response.ok) {
        return null;
    }

    try {
        const result = await response.json() as GeminiResponse;
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        // When the LLM is unsure about the result, return null
        if (generatedText === "") {
            return null;
        }
        
        if (generatedText) {
            return generatedText.trim();
        }

        
        return null;
    } catch (error) {
        console.error("Failed to parse Gemini API response:", error);
        return null;
    }
}

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
                "X-Goog-FieldMask": "places.id", // NOTE: We're making sure we only trigger the Essentials only SKU
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                textQuery: searchQuery
            })
        });
        if (!response.ok) {
            //console.log("Error text:");
            //console.log(await response.text());
            throw new Error(`Google Places API request failed: ${response.status}`);
        }
        
        const result = await response.json() as PlacesTextSearchResponse;
        return result;
    } catch (error) {
        console.error("Failed to fetch from Google Places API:", error);
        return null;
    }
}

/**
 * Fetches the details for a given Google Place ID, should only be called for *new* locations.
 * @param placeId 
 * @returns a PlacesDetailsResponse, or null if the request fails
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
            //console.log("Error text:");
            //console.log(await response.text());

            throw new Error(`Google Places API request failed: ${response.status}`);
        }
        
        const result = await response.json() as PlacesDetailsResponse;
        return result;
    } catch (error) {
        console.error("Failed to fetch from Google Places API:", error);
    }
    return null;
}

/**
 * Creates a standardized response for when manual location definition is required.
 * This is used when the LLM can't extract a location name or when Google Places search returns no results.
 */
export function createManualLocationResponse(embedInfo: EmbedResponse): Response {
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

export async function generateLocationDetails(placeDetails: PlacesDetailsResponse, embedInfo: EmbedResponse): Promise<{ description: string, emoji: string } | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set");
    }

    //console.log("Generating location details with TikTok context:");
    //console.log("Video title:", embedInfo.title);
    //console.log("Video author:", embedInfo.authorName);

    const prompt = `You are a location expert. Based on the following place information and TikTok video context, generate a brief description and a relevant emoji for this location.

Place Name: ${placeDetails.displayName.text}
Address: ${placeDetails.formattedAddress}
Overview: ${placeDetails.generativeSummary?.overview || 'No overview available'}

TikTok Video Context:
Title: ${embedInfo.title}
Author: ${embedInfo.authorName}

Requirements:
1. Description should be 2-4 words that capture what makes this place special based on the TikTok video
2. Focus on the specific food, drink, or experience featured in the video
3. Description must NOT contain any punctuation (no commas, periods, apostrophes, hyphens, etc.)
4. Choose ONE emoji that best represents the featured item or experience
5. Be concise and accurate to what was shown in the video

Examples of good responses are:
- "Cake and strawberry matcha, 🍰" (if video shows these specific items)
- "Authentic matcha, 🍵" (if video shows the matcha)
- "Japanese inspired cafe, ☕️" (if video shows the cafe atmosphere)
- "Cozy coffee shop, ☕️" (if video emphasizes the cozy vibe)
- "Fresh seafood restaurant, 🦞" (if video shows fresh seafood)
- "Vintage clothing store, 🎩" (if video shows vintage items)

CRITICAL: Respond with ONLY the description and emoji separated by a comma and space. No other text, no quotes, no punctuation in the description.

Format: description, emoji`;

    try {
        const response = await fetch(AI_ENDPOINT, {
            method: "POST",
            headers: {
                "X-goog-api-key": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "contents": [
                    {
                        "parts": [
                            {
                                "text": prompt
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            console.error(`Gemini API request failed: ${response.status}`);
            return null;
        }

        const result = await response.json() as GeminiResponse;
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            return null;
        }

        // Parse the comma-separated response
        const trimmedText = generatedText.trim();
        //console.log("Gemini response text:", trimmedText);
        
        const commaIndex = trimmedText.lastIndexOf(', ');
        
        if (commaIndex === -1) {
            console.error("Failed to parse Gemini API response: no comma found");
            return null;
        }
        
        const description = trimmedText.substring(0, commaIndex).trim();
        const emoji = trimmedText.substring(commaIndex + 2).trim();
        
        //console.log("Parsed description:", description);
        //console.log("Parsed emoji:", emoji);
        
        if (!description || !emoji) {
            console.error("Failed to parse Gemini API response: missing description or emoji");
            return null;
        }
        
        return {
            description: description,
            emoji: emoji
        };
    } catch (error) {
        console.error("Failed to generate location details:", error);
        return null;
    }
}
