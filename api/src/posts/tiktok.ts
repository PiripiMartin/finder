import type { TikTokEmbedResponse } from "./types";

/**
 * Extracts the video ID from a TikTok URL.
 * Supports various TikTok URL formats:
 * - https://www.tiktok.com/@username/video/1234567890
 * - https://www.tiktok.com/@username/photo/1234567890
 * - https://vm.tiktok.com/ABC123/
 * - https://m.tiktok.com/v/1234567890.html
 * - https://www.tiktok.com/t/ZTd123456/
 *
 * @param url - The TikTok URL
 * @returns The video ID or null if not found
 */
export function extractTikTokVideoId(url: string): string | null {
    // Try to match /video/{id} or /photo/{id} pattern first (most common)
    const videoMatch = url.match(/\/(video|photo)\/(\d+)/);
    if (videoMatch && videoMatch[2]) {
        return videoMatch[2];
    }

    // Try to match /v/{id}.html pattern (mobile format)
    const mobileMatch = url.match(/\/v\/(\d+)\.html/);
    if (mobileMatch && mobileMatch[1]) {
        return mobileMatch[1];
    }

    // Try to match /t/{id}/ pattern (short link)
    const shortMatch = url.match(/\/t\/([^\/]+)/);
    if (shortMatch) {
        // For short links, we'd need to resolve them first
        // For now, return null as we can't extract ID directly
        return null;
    }

    return null;
}

/**
 * Fetches TikTok post information from the mobile HTML page as a fallback
 * when the embed API fails.
 *
 * @param postUrl - The TikTok post URL
 * @returns A promise that resolves to TikTok embed response or null on failure
 */
export async function getTikTokInfoFromMobilePage(postUrl: string): Promise<TikTokEmbedResponse | null> {
    try {
        // Extract video ID from URL
        const videoId = extractTikTokVideoId(postUrl);
        if (!videoId) {
            console.error("Could not extract video ID from URL:", postUrl);
            return null;
        }

        // Fetch the mobile TikTok page
        const mobileUrl = `https://m.tiktok.com/v/${videoId}.html`;
        const response = await fetch(mobileUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone)",
            },
        });

        if (!response.ok) {
            console.error("Failed to fetch mobile TikTok page:", response.status, response.statusText);
            return null;
        }

        const html = await response.text();

        // Extract the JSON data from the script tag
        const scriptMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/s);
        if (!scriptMatch || !scriptMatch[1]) {
            console.error("Could not find __UNIVERSAL_DATA_FOR_REHYDRATION__ script tag");
            return null;
        }

        const jsonData = JSON.parse(scriptMatch[1]);

        // Navigate through the nested structure to get video info
        const itemStruct = jsonData?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
        if (!itemStruct) {
            console.error("Could not find itemStruct in parsed data");
            return null;
        }

        // Extract author information
        const author = itemStruct.author;
        const authorName = author?.nickname || author?.uniqueId || "Unknown";
        const authorUrl = author?.uniqueId ? `https://www.tiktok.com/@${author.uniqueId}` : "";

        // Extract video title/description
        const title = itemStruct.desc || itemStruct.textExtra?.[0]?.text || "";

        // Extract location if available
        const location = itemStruct.locationCreated || null;

        // Extract image array from imagePost
        const imageUrls: string[] = [];
        if (itemStruct.imagePost?.images) {
            for (const image of itemStruct.imagePost.images) {
                if (image?.imageURL?.urlList && image.imageURL.urlList.length > 0) {
                    imageUrls.push(image.imageURL.urlList[0]);
                }
            }
        }

        // Get thumbnail/cover image
        const thumbnailUrl = itemStruct.video?.cover || itemStruct.video?.originCover || itemStruct.imagePost?.cover?.imageURL?.urlList?.[0] || "";

        // Build the response object matching TikTokEmbedResponse interface
        const embedResponse: TikTokEmbedResponse = {
            title: title,
            authorUrl: authorUrl,
            authorName: authorName,
            html: "", // Not needed for our use case
            thumbnailUrl: thumbnailUrl,
            embedProductId: videoId,
            // Store image URLs in a local variable as requested
            // We'll add this to the type if needed, but for now we'll keep it separate
        };

        // Store image URLs in a local variable (as requested)
        const imageArray = imageUrls;

        // Log the extracted data for debugging
        console.log("Extracted TikTok info from mobile page:", {
            authorName,
            title,
            location,
            imageCount: imageArray.length,
            videoId,
        });

        return embedResponse;
    } catch (error) {
        console.error("Error fetching TikTok info from mobile page:", error);
        return null;
    }
}

