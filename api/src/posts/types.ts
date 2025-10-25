
export enum PostPlatform {
    TIKTOK = "tiktok",
    INSTAGRAM = "instagram",
}


/**
 * Represents a post made by a user.
 */
export interface Post {
    /** The unique identifier for the post. */
    id: number;

    /** The URL of the post, typically a TikTok video. */
    url: string;

    /** The ID of the user who created the post. */
    postedBy: number;

    /** The ID of the map point the post is associated with. */
    mapPointId: number;

    /** The timestamp when the post was created. */
    postedAt: Date;
}

/**
 * Represents the essential data from the TikTok embed API response.
 */
export interface TikTokEmbedResponse {
    title: string;
    authorUrl: string;
    authorName: string;
    html: string;
    thumbnailUrl: string;
    embedProductId: string;
}

export interface InstagramPostInformation {
    authorName: string;
    title: string;
    description: string;
    location: string;
}