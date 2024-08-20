const MediaDownloader = require('./index');

const url = 'https://www.facebook.com/1551UNMSM/videos/2126724314377208';
MediaDownloader(url).then(console.log).catch(console.error);
