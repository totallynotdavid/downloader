export interface MediaInfo {
    status: string;
    p: string;
    urlHD: string;
    title: string;
    duration: string;
    thumbnail: string;
    links: {
        hd: string | string[];
        sd: string | string[];
    };
}

export interface ApiResponse {
    status: string;
    p: string;
    links: {
        hd: string;
        sd: string;
    };
    duration: string;
    title: string;
    thumbnail: string;
    urlHD: string;
}
