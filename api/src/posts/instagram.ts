import type { InstagramPostInformation } from "./types";

export async function getInstagramPostInformation(url: string): Promise<InstagramPostInformation | null> {

    const pageResponse = await fetch(url);

    // We now have to extract information from the page HTML
    const html = await pageResponse.text();

    // Extract information from the HTML using Open Graph meta tags
    const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"[^>]*>/);
    const descriptionMatch = html.match(/<meta property="og:description" content="([^"]*)"[^>]*>/);
    const imageMatch = html.match(/<meta property="og:image" content="([^"]*)"[^>]*>/);
    const urlMatch = html.match(/<meta property="og:url" content="([^"]*)"[^>]*>/);

    if (!titleMatch || !descriptionMatch) {
        return null;
    }

    // Extract author name from title (format: "AUTHOR NAME on Instagram: ...")
    const authorMatch = titleMatch[1]?.match(/^([^:]+) on Instagram:/);
    const authorName = authorMatch ? authorMatch[1]?.trim() || "Unknown" : "Unknown";

    // Extract title from the description or use the og:title
    const title = titleMatch[1]?.replace(/^[^:]+ on Instagram: /, "").trim() || "";

    // Extract description from og:description
    const description = descriptionMatch[1]?.trim() || "";

    // Extract location from description if available (look for location patterns)
    let location = "";
    const locationMatch = description.match(/(?:at|in|from)\s+([A-Za-z\s,]+?)(?:\s*[,\-]|\s*$)/);
    if (locationMatch) {
        location = locationMatch[1]?.trim() || "";
    }

    return {
        authorName,
        title,
        description,
        location
    };
}


