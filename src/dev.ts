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
    .getMediaInfo('https://www.instagram.com/reels/DApZT9wpHeR/', options)
    .then(result => console.log(result))
    .catch(error => console.error(error));
