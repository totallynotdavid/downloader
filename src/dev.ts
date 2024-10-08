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
    .getMediaInfo('https://www.instagram.com/p/C-KmYkCsSr5/', options)
    .then(result => console.log(result))
    .catch(error => console.error(error));
