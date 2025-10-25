export enum PostPlatform {
    TIKTOK = "tiktok",
    INSTAGRAM = "instagram",
}

export function getPostPlatform(url: string): PostPlatform | null {

    if (url.includes("tiktok.com")) {
        return PostPlatform.TIKTOK;
    } else if (url.includes("instagram.com")) {
        return PostPlatform.INSTAGRAM;
    } 

    return null;
}

