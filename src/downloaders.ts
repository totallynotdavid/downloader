import {HostType} from '@/utils/determineSite';
import {Downloader} from '@/types';

const importDownloader = (host: HostType): Promise<Downloader> =>
    import(`@/hosts/${host}`).then(module => new module.default());

export const getDownloader = async (host: HostType): Promise<Downloader> => {
    const downloader = await importDownloader(host);
    return downloader;
};
