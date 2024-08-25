import MediaDownloader from './index';

const url: string = 'https://www.youtube.com/watch?v=PEECtnSQ6CY';

MediaDownloader(url)
    .then((result: any) => console.log(result))
    .catch((error: Error) => console.error(error));
