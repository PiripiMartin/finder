
import { db } from "../database";
import type { LocationEdit } from "../map/types";

function camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export async function updateUserLocationEdit(userId: number, mapPointId: number, edits: Partial<LocationEdit>): Promise<void> {
    const { latitude, longitude, ...otherEdits } = edits;

    const fields = Object.keys(otherEdits).map(key => `${camelToSnakeCase(key)} = ?`);
    const values = Object.values(otherEdits);

    if (latitude && longitude) {
        fields.push("location = POINT(?, ?)");
        values.push(longitude, latitude);
    }

    const setClause = fields.join(", ");

    const query = `
        UPDATE user_location_edits
        SET ${setClause}
        WHERE user_id = ? AND map_point_id = ?;
    `;

    await db.execute(query, [...values, userId, mapPointId]);
}

export async function createUserLocationEdit(userId: number, mapPointId: number, edits: Partial<LocationEdit>): Promise<void> {
    const { latitude, longitude, ...otherEdits } = edits;

    const fields = Object.keys(otherEdits).map(camelToSnakeCase);
    const values = Object.values(otherEdits);
    const placeholders = values.map(() => "?");

    const allValues: any[] = [...values];

    if (latitude && longitude) {
        fields.push("location");
        placeholders.push("POINT(?, ?)");
        allValues.push(longitude, latitude);
    }

    const query = `
        INSERT INTO user_location_edits (user_id, map_point_id, ${fields.join(", ")})
        VALUES (?, ?, ${placeholders.join(", ")});
    `;

    await db.execute(query, [userId, mapPointId, ...allValues]);
}
