export interface Headers {
    [key: string]: string;
}

export interface MediaInfo {
    results_number: number;
    url_list: string[];
}

export interface ApiResponse {
    status: string;
    p: string;
    v: string;
    data: string;
}
