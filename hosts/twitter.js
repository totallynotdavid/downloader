const axios = require('axios');

class TwitterDownloader {
    constructor() {
        this.BASE_URL = 'https://api.vxtwitter.com';
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
            throw new Error(`Failed to process Twitter URL: ${error.message}`);
        }
    }

    async getMediaInfo(url) {
        try {
            if (!/twitter\.com|x\.com/.test(url)) {
                throw new Error('Invalid Twitter URL');
            }

            const apiURL = url.replace(/twitter\.com|x\.com/g, 'api.vxtwitter.com');
            const response = await axios.get(apiURL);

            const data = response.data;

            if (!data || !data.media_extended) {
                throw new Error('No media found');
            }

            return {
                text: data.text,
                media: data.media_extended.map(mediaItem => ({
                    url: mediaItem.url,
                    type: mediaItem.type,
                })),
            };
        } catch (error) {
            console.error('Error in getMediaInfo:', error);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            throw new Error(`Error fetching Twitter data: ${error.message}`);
        }
    }
}

module.exports = TwitterDownloader;
