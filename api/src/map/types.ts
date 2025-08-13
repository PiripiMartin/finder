


export interface MapPoint {
    id: number,
    title: string,
    description: string,
    emoji: string,
    latitude: number,
    longitude: number,
    isValidLocation: boolean,
    recommendable: boolean,


    // Extra business information
    websiteUrl: string,
    phoneNumber: string,
    address: string,

    createdAt: Date,
};



