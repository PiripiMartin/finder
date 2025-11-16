import type { TikTokEmbedResponse } from "./types";

/**
 * Resolves a short TikTok link by following redirects.
 * 
 * @param url - The short TikTok URL (e.g., https://vt.tiktok.com/ABC123/)
 * @returns The final URL after following redirects, or null on failure
 */
async function resolveShortLink(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, {
            method: "HEAD",
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone)",
            },
        });
        
        // Get the final URL after redirects
        const finalUrl = response.url;
        return finalUrl;
    } catch (error) {
        //console.error("Error resolving short link:", error);
        return null;
    }
}

/**
 * Extracts the video ID from a TikTok URL.
 * Supports various TikTok URL formats:
 * - https://www.tiktok.com/@username/video/1234567890
 * - https://www.tiktok.com/@username/photo/1234567890
 * - https://vm.tiktok.com/ABC123/ (will follow redirect)
 * - https://vt.tiktok.com/ABC123/ (will follow redirect)
 * - https://m.tiktok.com/v/1234567890.html
 * - https://www.tiktok.com/t/ZTd123456/
 *
 * @param url - The TikTok URL
 * @param depth - Internal parameter to prevent infinite recursion (max 5 redirects)
 * @returns A promise that resolves to the video ID or null if not found
 */
export async function extractTikTokVideoId(url: string, depth: number = 0): Promise<string | null> {
    // Prevent infinite recursion
    if (depth > 5) {
        //console.error("Max redirect depth reached while extracting video ID");
        return null;
    }

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

    // Check if it's a short link (vt.tiktok.com, vm.tiktok.com, or /t/ pattern)
    const isShortLink = url.includes("vt.tiktok.com/") || 
                       url.includes("vm.tiktok.com/") || 
                       url.match(/\/t\/([^\/]+)/);
    
    if (isShortLink) {
        // Follow redirect to get the actual video URL
        const resolvedUrl = await resolveShortLink(url);
        if (resolvedUrl) {
            // Recursively try to extract from the resolved URL
            return await extractTikTokVideoId(resolvedUrl, depth + 1);
        }
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
        // Extract video ID from URL (now async to handle short links)
        const videoId = await extractTikTokVideoId(postUrl);
        if (!videoId) {
            //console.error("Could not extract video ID from URL:", postUrl);
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
            //console.error("Failed to fetch mobile TikTok page:", response.status, response.statusText);
            return null;
        }

        const html = await response.text();

        // Save HTML to file for debugging purposes
        try {
            const timestamp = Date.now();
            const debugDir = "./scraper/debug";
            const filename = `${debugDir}/tiktok-${videoId}-${timestamp}.html`;
            // Bun.write will create the directory if it doesn't exist
            await Bun.write(filename, html);
            //console.log(`Saved HTML to ${filename}`);
        } catch (fileError) {
            // Don't fail the whole operation if file saving fails
            //console.warn("Failed to save HTML to file:", fileError);
        }

        // Extract the JSON data from the script tag
        const scriptMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/s);
        if (!scriptMatch || !scriptMatch[1]) {
            //console.error("Could not find __UNIVERSAL_DATA_FOR_REHYDRATION__ script tag");
            return null;
        }

        const jsonData = JSON.parse(scriptMatch[1]);

        // Navigate through the nested structure to get video info
        // Mobile page uses "webapp.reflow.video.detail", desktop uses "webapp.video-detail"
        let itemStruct = jsonData?.__DEFAULT_SCOPE__?.["webapp.reflow.video.detail"]?.itemInfo?.itemStruct;
        if (!itemStruct) {
            // Fallback to desktop path
            itemStruct = jsonData?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
        }
        if (!itemStruct) {
            //console.error("Could not find itemStruct in parsed data");
            //console.error("Available keys in __DEFAULT_SCOPE__:", Object.keys(jsonData?.__DEFAULT_SCOPE__ || {}));
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
        //console.log("Extracted TikTok info from mobile page:", {
        //    authorName,
        //    title,
        //    location,
        //    imageCount: imageArray.length,
        //    videoId,
        //});

        return embedResponse;
    } catch (error) {
        //console.error("Error fetching TikTok info from mobile page:", error);
        return null;
    }
}

