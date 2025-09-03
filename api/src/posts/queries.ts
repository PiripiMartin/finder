import { db, toCamelCase } from "../database";
import type { MapPoint } from "../map/types";


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
    const [result, _] = await db.execute(query, [location.googlePlaceId, location.title, location.description, location.emoji, location.latitude, location.longitude, location.recommendable, location.websiteUrl, location.phoneNumber, location.address]) as [any[], any];

    if (result.length === 0) {
        return null;
    }

    return toCamelCase(result[0]) as MapPoint;
}

