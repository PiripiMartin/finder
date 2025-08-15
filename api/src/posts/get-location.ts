import { toCamelCase } from "../database";

// Contains everything 'interesting' from the TikTok embed API
interface EmbedResponse {
    title: string,
    authorUrl: string,
    authorName: string,
    html: string,
    thumbnailUrl: string,
};


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
    
    
    return "";
}

