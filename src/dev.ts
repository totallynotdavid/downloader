import {Downloader, DownloadOptions} from '@/index';

const downloader = new Downloader({
    downloadDir: './storage',
});

const options: DownloadOptions = {
    quality: '720p',
    downloadMedia: true,
    preferAudio: false,
};

downloader
    .getMediaInfo('https://www.facebook.com/1551UNMSM/videos/2126724314377208', options)
    .then(result => console.log(result))
    .catch(error => console.error(error));
