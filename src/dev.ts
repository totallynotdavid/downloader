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
    .getMediaInfo('https://es.pinterest.com/pin/805651820858880488/', options)
    .then(result => console.log(result))
    .catch(error => console.error(error));
