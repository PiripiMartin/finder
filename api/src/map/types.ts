


export interface MapPoint {
    id: number,
    googlePlaceId: string,
    title: string,
    description: string,
    emoji: string,
    latitude: number | null,
    longitude: number | null,
    isValidLocation: boolean,
    recommendable: boolean,


    // Extra business information
    websiteUrl: string | null,
    phoneNumber: string | null,
    address: string | null,

    createdAt: Date,
};
