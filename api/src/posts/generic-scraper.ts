import type { GenericPostInformation, InstagramPostInformation } from "./types";
import { extractPossibleLocationName } from "./get-location";
import fs from "fs";

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
 * Uses the Gemini API to extract post information (title, description, image) from HTML.
 * 
 * @param html - The HTML content of the page
 * @param url - The URL of the page
 * @returns A promise that resolves to an object with title, description, and thumbnailUrl, or null on failure
 */
async function extractPostInfoWithGemini(html: string, url: string): Promise<{ title: string; description: string; thumbnailUrl: string | null } | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY is not set");
        return null;
    }

    // Truncate HTML to avoid token limits (keep first 50000 characters)
    const truncatedHtml = html.substring(0, 50000);

    const prompt = `
        You are a web content extraction expert. Analyze the following HTML content and extract:
        1. The title of the page/post
        2. A description of the content
        3. The main image URL (if available)

        HTML Content (truncated):
        ${truncatedHtml}

        Page URL: ${url}

        Extract the information and return it in the following JSON format:
        {
            "title": "extracted title here",
            "description": "extracted description here",
            "thumbnailUrl": "image URL or null"
        }

        CRITICAL RULES FOR TITLE:
        - If this is a business, restaurant, or location page, extract ONLY the business/restaurant/location name
        - Remove any extra words like "Menu", "Home", "About", "Welcome to", "Visit", etc.
        - Remove any descriptive text, tags, or additional information
        - The title should be JUST the name (e.g., "Joe's Pizza" not "Joe's Pizza - Best Pizza in NYC")
        - If you cannot identify a specific name, use a reasonable default based on the content
        - Keep it concise - ideally 1-5 words maximum

        CRITICAL RULES FOR DESCRIPTION:
        - The description must be EXACTLY 2-3 words maximum
        - It should briefly describe the type of content or business category
        - Examples: "Italian restaurant", "Coffee shop", "Art gallery", "News article", "Product page"
        - If you cannot find a meaningful description, use an empty string
        - Do NOT include the business name in the description

        OTHER RULES:
        - If you cannot find an image, set thumbnailUrl to null
        - Return ONLY valid JSON, no other text
    `;

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
            console.error("Gemini API request failed for post info:", await response.text());
            return null;
        }

        const result = await response.json() as GeminiResponse;
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!generatedText) {
            return null;
        }

        // Try to parse JSON from the response
        // Sometimes Gemini wraps JSON in markdown code blocks
        let jsonText = generatedText;
        const jsonMatch = generatedText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            jsonText = jsonMatch[1];
        }

        const parsed = JSON.parse(jsonText);
        
        // Clean up title - ensure it's just the name
        let title = (parsed.title || "").trim();
        // Remove common prefixes/suffixes that shouldn't be in the name
        title = title
            .replace(/^Welcome to\s+/i, "")
            .replace(/^Visit\s+/i, "")
            .replace(/\s*-\s*Menu.*$/i, "")
            .replace(/\s*-\s*Home.*$/i, "")
            .replace(/\s*-\s*About.*$/i, "")
            .replace(/\s*-\s*Best.*$/i, "")
            .replace(/\s*-\s*Official.*$/i, "")
            .replace(/\s*\|.*$/i, "")
            .trim();
        
        // Clean up description - ensure it's only 2-3 words
        let description = (parsed.description || "").trim();
        if (description) {
            const words = description.split(/\s+/).filter((w: string) => w.length > 0);
            // Limit to 3 words maximum
            description = words.slice(0, 3).join(" ");
        }
        
        return {
            title,
            description,
            thumbnailUrl: parsed.thumbnailUrl || null,
        };
    } catch (error) {
        console.error("Error extracting post info with Gemini:", error);
        return null;
    }
}

/**
 * Extracts author/site name from HTML using meta tags or domain name.
 * 
 * @param html - The HTML content of the page
 * @param url - The URL of the page
 * @returns The author/site name or a default value
 */
function extractAuthorName(html: string, url: string): string {
    // Try to extract from Open Graph site name
    const siteNameMatch = html.match(/<meta property="og:site_name" content="([^"]*)"[^>]*>/i);
    if (siteNameMatch && siteNameMatch[1]) {
        return siteNameMatch[1].trim();
    }

    // Try to extract from author meta tag
    const authorMatch = html.match(/<meta\s+name="author"\s+content="([^"]*)"[^>]*>/i);
    if (authorMatch && authorMatch[1]) {
        return authorMatch[1].trim();
    }

    // Try to extract from Twitter card site
    const twitterSiteMatch = html.match(/<meta\s+name="twitter:site"\s+content="([^"]*)"[^>]*>/i);
    if (twitterSiteMatch && twitterSiteMatch[1]) {
        return twitterSiteMatch[1].replace(/^@/, "").trim();
    }

    // Fallback to domain name
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace(/^www\./, "");
        return hostname;
    } catch {
        return "Unknown";
    }
}

export async function getGenericPostInformation(url: string): Promise<GenericPostInformation | null> {

    const pageResponse = await fetch(url);

    // We now have to extract information from the page HTML
    const html = await pageResponse.text();

    // Extract information from the HTML using Open Graph meta tags
    const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"[^>]*>/);
    const descriptionMatch = html.match(/<meta property="og:description" content="([^"]*)"[^>]*>/);
    const imageMatch = html.match(/<meta property="og:image" content="([^"]*)"[^>]*>/);
    //const urlMatch = html.match(/<meta property="og:url" content="([^"]*)"[^>]*>/);
    const urlMatch = url;

    let title: string;
    let description: string;
    let thumbnailUrl: string | null;

    // Try regex extraction first
    if (titleMatch && descriptionMatch && imageMatch && urlMatch) {
        title = titleMatch[1] || "";
        // Clean up title - ensure it's just the name
        title = title
            .replace(/^Welcome to\s+/i, "")
            .replace(/^Visit\s+/i, "")
            .replace(/\s*-\s*Menu.*$/i, "")
            .replace(/\s*-\s*Home.*$/i, "")
            .replace(/\s*-\s*About.*$/i, "")
            .replace(/\s*-\s*Best.*$/i, "")
            .replace(/\s*-\s*Official.*$/i, "")
            .replace(/\s*\|.*$/i, "")
            .trim();
        
        description = descriptionMatch[1] || "";
        // Shorten description to 2-3 words maximum
        if (description) {
            const words = description.split(/\s+/).filter((w: string) => w.length > 0);
            description = words.slice(0, 3).join(" ");
        }
        thumbnailUrl = imageMatch[1] || null;
    } else {
        // Fall back to Gemini API for extraction
        console.log("Failed to extract generic post information from HTML with regex, falling back to Gemini API");

        // DEBUGGING: Save HTML to file
        //try {
        //    fs.writeFileSync("scraper/debug/generic-scraper-html.html", html);
        //} catch (error) {
        //    // Ignore file write errors
        //}

        const geminiResult = await extractPostInfoWithGemini(html, url);
        if (!geminiResult) {
            console.error("Failed to extract post information with Gemini API");
            return null;
        }

        title = geminiResult.title;
        description = geminiResult.description;
        thumbnailUrl = geminiResult.thumbnailUrl;
    }

    // Extract location information using the shared function from get-location.ts
    // Create a compatible object that matches InstagramPostInformation interface
    const authorName = extractAuthorName(html, url);
    const postInfo: InstagramPostInformation = {
        authorName,
        title,
        description,
        location: "", // Will be populated by extractPossibleLocationName
    };

    // Use the shared location extraction function
    const locationQuery = await extractPossibleLocationName(postInfo);
    const location = locationQuery || "";

    console.log("Generic post information:", {
        title,
        description,
        location: location || null,
        thumbnailUrl,
        authorName,
    });

    return {
        title,
        description,
        location: location || null,
        thumbnailUrl,
        authorName,
    };
}