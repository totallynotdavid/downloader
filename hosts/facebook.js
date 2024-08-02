const axios = require('axios');
const https = require('https');

class FacebookDownloader {
    constructor() {
        this.BASE_URL = 'https://104.21.70.90/api/ajaxSearch/facebook';
    }

    async getDirectUrlsAndCount(url, quality = 'sd') {
        try {
            const mediaInfo = await this.getMediaInfo(url);
            const selectedUrl =
                quality === 'hd' ? mediaInfo.links.hd : mediaInfo.links.sd;

            return {
                results_number: 1,
                url_list: selectedUrl,
            };
        } catch (error) {
            console.error('Error in getDirectUrlsAndCount:', error);
            throw new Error(`Failed to process Facebook URL: ${error.message}`);
        }
    }

    async getMediaInfo(url) {
        try {
            const agent = new https.Agent({
                rejectUnauthorized: false,
            });

            const response = await axios.post(
                this.BASE_URL,
                `q=${encodeURIComponent(url)}`,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
                        Origin: 'https://x2download.app',
                        Referer: 'https://x2download.app/es17/download-video-facebook',
                        Host: 'x2download.app',
                    },
                    httpsAgent: agent,
                    timeout: 10000,
                    validateStatus: function (status) {
                        return status >= 200 && status < 300;
                    },
                }
            );

            const data = response.data;
            console.log('Data:', data);

            if (!data || !data.links) {
                throw new Error('Invalid response from server');
            }

            return {
                title: data.title,
                duration: data.duration,
                thumbnail: data.thumbnail,
                links: {
                    hd: data.links.hd,
                    sd: data.links.sd,
                },
            };
        } catch (error) {
            console.error('Error in getMediaInfo:', error);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            throw new Error(`Error fetching Facebook data: ${error.message}`);
        }
    }
}

module.exports = FacebookDownloader;
