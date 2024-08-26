import MediaDownloader from './index';

interface DownloaderResult {
    urls: string[];
    count: number;
}

const url: string = 'https://www.facebook.com/share/v/Hr3BZV9JjaKPy28P/';

MediaDownloader(url)
    .then((result: DownloaderResult) => console.log(result))
    .catch((error: Error) => console.error(error));
