import { db, toCamelCase } from "../database";
import type { MapPoint } from "../map/types";
import type { Post } from "./types";


export interface CreateLocationRequest {
    googlePlaceId: string | null,
    title: string,
    description: string | null,
    emoji: string,
    latitude: number,
    longitude: number,
    recommendable: boolean,

    websiteUrl: string | null,
    phoneNumber: string | null,
    address: string | null,
}

export async function createLocation(location: CreateLocationRequest): Promise<MapPoint | null> {

    const query = `
        INSERT INTO map_points (google_place_id, title, description, emoji, location, recommendable, website_url, phone_number, address)
        VALUES (?, ?, ?, ?, POINT(?, ?), ?, ?, ?, ?)
    `;
    await db.execute(query, [location.googlePlaceId, location.title, location.description, location.emoji, location.latitude, location.longitude, location.recommendable, location.websiteUrl, location.phoneNumber, location.address]);

    // Get the inserted ID
    const [idRows, _] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const locationId = idRows[0].id;

    // Fetch the created location to return it
    const [locations, __] = await db.execute("SELECT * FROM map_points WHERE id = ?", [locationId]) as [any[], any];
    if (locations.length === 0) {
        return null;
    }

    return toCamelCase(locations[0]) as MapPoint;
}

export interface CreatePostRequest {
    url: string,
    postedBy: number,
    mapPointId: number
}

export async function createPost(post: CreatePostRequest): Promise<Post | null> {
    const query = `
        INSERT INTO posts (url, posted_by, map_point_id)
        VALUES (?, ?, ?)
    `;
    await db.execute(query, [post.url, post.postedBy, post.mapPointId]);

    // Get the inserted ID
    const [idRows, _] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const postId = idRows[0].id;

    // Fetch the created post to return it
    const [posts, __] = await db.execute("SELECT * FROM posts WHERE id = ?", [postId]) as [any[], any];
    if (posts.length === 0) {
        return null;
    }

    return toCamelCase(posts[0]) as Post;
}

