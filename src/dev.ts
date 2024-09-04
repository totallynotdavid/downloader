import MediaDownloader from './index';
import {DownloaderResult} from '@/types';

const url: string = 'https://www.facebook.com/share/v/Hr3BZV9JjaKPy28P/';

MediaDownloader(url)
    .then((result: DownloaderResult) => console.log(result))
    .catch((error: Error) => console.error(error));
