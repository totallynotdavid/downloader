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
    .getMediaInfo(
        'https://www.tiktok.com/@stayc_official/video/7136124191849417985',
        options
    )
    .then(result => console.log(result))
    .catch(error => console.error(error));
