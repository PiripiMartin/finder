/**
 * Represents a point on the map, typically a business or location.
 */
export interface MapPoint {
    /** The unique identifier for the map point. */
    id: number;

    /** The Google Place ID for the location. */
    googlePlaceId: string;

    /** The name or title of the location. */
    title: string;

    /** A short description of the location. */
    description: string;

    /** An emoji representing the location. */
    emoji: string;

    /** The latitude of the location. */
    latitude: number | null;

    /** The longitude of the location. */
    longitude: number | null;

    /** Whether the location has been validated. */
    isValidLocation: boolean;

    /** Whether the location can be recommended to users. */
    recommendable: boolean;

    /** The URL of the location's website. */
    websiteUrl: string | null;

    /** The phone number of the location. */
    phoneNumber: string | null;

    /** The address of the location. */
    address: string | null;

    /** The timestamp when the location was created. */
    createdAt: Date;
}