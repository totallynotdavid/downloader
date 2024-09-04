export interface ClassifiedImgurLink {
    type: 'image' | 'album';
    id: string;
}

export interface ImgurApiResponse {
    data: ImgurApiData;
    success: boolean;
    status: number;
}

export interface ImgurApiData {
    link?: string;
    images?: {link: string}[];
    is_album?: boolean;
    title?: string;
    description?: string;
    datetime?: number;
    views?: number;
}
