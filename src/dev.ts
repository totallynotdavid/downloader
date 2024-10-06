import MediaDownloader from './index';
import {DownloaderResult, DownloaderOptions} from '@/types';

const url: string = 'https://www.instagram.com/p/C-4D2GJo9Cd/';

const options: DownloaderOptions = {
    includeMetadata: true,
    quality: 'highest',
    preferAudio: true,
    maxSize: 16,
};

MediaDownloader(url, options)
    .then((result: DownloaderResult) => {
        console.log('Result:');
        console.log(JSON.stringify(result, null, 2));
    })
    .catch((error: Error) => {
        console.error('Error:', error.message);
    });
