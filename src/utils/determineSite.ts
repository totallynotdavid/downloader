export type HostType =
    | 'imgur'
    | 'reddit'
    | 'instagram'
    | 'facebook'
    | 'twitter'
    | 'pinterest'
    | 'tiktok'
    | 'youtube';

const allowedHosts: Record<HostType, string[]> = {
    imgur: ['imgur.com', 'i.imgur.com'],
    reddit: ['reddit.com', 'www.reddit.com'],
    instagram: ['instagram.com', 'www.instagram.com'],
    facebook: ['facebook.com', 'www.facebook.com', 'fb.watch'],
    twitter: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
    pinterest: ['pinterest.com', 'www.pinterest.com', 'pin.it'],
    tiktok: ['tiktok.com', 'www.tiktok.com'],
    youtube: ['youtube.com', 'www.youtube.com', 'youtu.be'],
};

function isAllowedHost(hostname: string, service: HostType): boolean {
    return allowedHosts[service].some(
        domain =>
            hostname === domain ||
            (hostname.endsWith(`.${domain}`) &&
                hostname.lastIndexOf('.', hostname.length - domain.length - 2) === -1)
    );
}

export function determineSite(url: string): HostType | null {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    for (const host of Object.keys(allowedHosts) as HostType[]) {
        if (isAllowedHost(hostname, host)) {
            return host;
        }
    }

    return null;
}
