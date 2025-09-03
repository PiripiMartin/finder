import { toCamelCase } from "../database";

const AI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";


// Contains everything 'interesting' from the TikTok embed API
interface EmbedResponse {
    title: string,
    authorUrl: string,
    authorName: string,
    html: string,
    thumbnailUrl: string,
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
    place: {
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
    };
}


export async function getTikTokEmbedInfo(vidUrl: string): Promise<EmbedResponse | null> {

    const ttEmbedEndpoint = `https://www.tiktok.com/oembed?url=${vidUrl}`;

    const embedResponse = await fetch(ttEmbedEndpoint);
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
                "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri",
            },
        });
        if (!response.ok) {
            throw new Error(`Google Places API request failed: ${response.status}`);
        }
        
        const result = await response.json() as PlacesDetailsResponse;
        return result;
    } catch (error) {
        //console.error("Failed to fetch from Google Places API:", error);
    }
    return null;
}

export async function generateLocationDetails(placeDetails: PlacesDetailsResponse): Promise<{ description: string, emoji: string } | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set");
    }

    const prompt = `You are a location expert. Based on the following place information, generate a brief description (2-4 words) and a relevant emoji for this location.
        Place Name: ${placeDetails.place.displayName.text}
        Address: ${placeDetails.place.formattedAddress}
        Overview: ${placeDetails.place.generativeSummary?.overview || 'No overview available'}
        
        Requirements:
        1. Description should be 2-4 words that capture the essence of the place (e.g., "Cake and strawberry matcha", "Japanese-inspired cafe", "Cozy coffee shop")
        2. Choose ONE emoji that best represents the place type or vibe (e.g., 🍰 for bakery, 🍵 for tea/cafe, ☕ for coffee, 🍕 for pizza, etc.)
        3. Be concise and accurate
        
        Respond in this exact JSON format:
        {
          "description": "your brief description here",
          "emoji": "your emoji here"
        }`;

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

        // Parse the JSON response
        try {
            const parsed = JSON.parse(generatedText.trim());
            if (parsed.description && parsed.emoji) {
                return {
                    description: parsed.description,
                    emoji: parsed.emoji
                };
            }
        } catch (parseError) {
            console.error("Failed to parse Gemini API JSON response:", parseError);
        }

        return null;
    } catch (error) {
        console.error("Failed to generate location details:", error);
        return null;
    }
}
