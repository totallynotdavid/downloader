import {HostType} from './determineSite';

export type QualityType =
    | 'highest'
    | '1080p'
    | '720p'
    | '480p'
    | '360p'
    | '240p'
    | '144p';

export function mapQualityToSite(quality: QualityType, site: HostType): string {
    switch (site) {
        case 'facebook':
            return quality === 'highest' || quality === '1080p' || quality === '720p'
                ? 'HD'
                : 'SD';
        case 'youtube':
            return quality;
        default:
            return 'highest';
    }
}
