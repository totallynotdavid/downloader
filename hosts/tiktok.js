const axios = require('axios');
const cheerio = require('cheerio');

/*
 * TikTok Downloader
 * @class
 * @param {String} url
 * @returns {Object}
 *
 * @test cases
 * - https://www.tiktok.com/@stayc_official/video/7136124191849417985 - video
 * - looking for this - gallery of images
 */
class TiktokDownloader {
    constructor() {
        this.BASE_URL = 'https://musicaldown.com';
        this.API_URL = `${this.BASE_URL}/download`;
        this.MUSIC_API_URL = `${this.BASE_URL}/mp3/download`;
    }

    async getDirectUrlsAndCount(url, options = {}) {
        try {
            const mediaInfo = await this.getMediaInfo(url);
            const media = mediaInfo.media;

            const urlArray = media.map(item => item.url);

            const result = {
                urls: urlArray,
                count: urlArray.length,
            };

            if (options.buffer) {
                result.buffers = await Promise.all(
                    media.map(async item => {
                        try {
                            const response = await axios.get(item.url, {
                                responseType: 'arraybuffer',
                            });
                            return Buffer.from(response.data, 'binary');
                        } catch (error) {
                            console.warn('Error getting buffer:', error);
                            return undefined;
                        }
                    })
                );
            }

            if (options.text) {
                result.text = mediaInfo.text;
            }

            return result;
        } catch (error) {
            console.error('Error in getDirectUrlsAndCount:', error);
            throw new Error(`Failed to process TikTok URL: ${error.message}`);
        }
    }

    async getMediaInfo(url) {
        try {
            const tiktokRegex =
                /https:\/\/(?:m|www|vm|vt|lite)?\.?tiktok\.com\/((?:.*\b(?:(?:usr|v|embed|user|video|photo)\/|\?shareId=|\&item_id=)(\d+))|\w+)/; // eslint-disable-line no-useless-escape
            if (!tiktokRegex.test(url)) {
                throw new Error('Invalid TikTok URL');
            }

            const request = await this.getRequest(url);
            if (request.status !== 'success') {
                throw new Error(request.message);
            }

            const response = await axios.post(
                this.API_URL,
                new URLSearchParams(Object.entries(request.request)),
                {
                    headers: {
                        cookie: request.cookie,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Origin: 'https://musicaldown.com',
                        Referer: 'https://musicaldown.com/en',
                        'Upgrade-Insecure-Requests': '1',
                        'User-Agent':
                            'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
                    },
                }
            );

            const $ = cheerio.load(response.data);

            const images = [];
            $("div.row > div[class='col s12 m3']").each((_, el) => {
                images.push($(el).find('img').attr('src'));
            });

            let videos = {};
            $("div[class='col s12 l8'] > a").each((i, el) => {
                if ($(el).attr('href') !== '#modal2') {
                    let text = $(el)
                        .text()
                        .trim()
                        .replace(/\s/, ' ')
                        .replace('arrow_downward', '')
                        .toLowerCase();
                    let key = text.includes('hd')
                        ? 'videoHD'
                        : text.includes('watermark')
                          ? 'videoWatermark'
                          : `video${i + 1}`;
                    videos[key] = $(el).attr('href');
                }
            });

            const music = await this.getMusic(request.cookie);

            return {
                text: $('div.row > div > div > h2').eq(1).text(),
                media:
                    images.length > 0
                        ? images.map(url => ({url, type: 'image'}))
                        : Object.values(videos).map(url => ({url, type: 'video'})),
                author: {
                    avatar: $('div.img-area > img').attr('src'),
                    nickname: $('div.row > div > div > h2').eq(0).text(),
                },
                music: music.result,
            };
        } catch (error) {
            console.error('Error in getMediaInfo:', error);
            throw new Error(`Error fetching TikTok data: ${error.message}`);
        }
    }

    async getRequest(url) {
        try {
            const response = await axios.get(this.BASE_URL, {
                headers: {
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Update-Insecure-Requests': '1',
                    'User-Agent':
                        'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
                },
            });

            const cookie = response.headers['set-cookie'][0].split(';')[0];
            const $ = cheerio.load(response.data);
            const input = $('div > input');

            const request = {
                [input.eq(0).attr('name')]: url,
                [input.eq(1).attr('name')]: input.eq(1).attr('value'),
                [input.eq(2).attr('name')]: input.eq(2).attr('value'),
            };

            return {status: 'success', request, cookie};
        } catch (error) {
            console.error('Error in getRequest:', error);
            return {status: 'error', message: 'Failed to get the request form!'};
        }
    }

    async getMusic(cookie) {
        try {
            const response = await axios.get(this.MUSIC_API_URL, {
                headers: {
                    cookie: cookie,
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent':
                        'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
                },
            });

            const $ = cheerio.load(response.data);
            const music = $('audio > source').attr('src');
            return {status: 'success', result: music};
        } catch (error) {
            console.error('Error in getMusic:', error);
            return {status: 'error'};
        }
    }
}

module.exports = TiktokDownloader;
