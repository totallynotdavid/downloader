const axios = require('axios');
const querystring = require('querystring');
const https = require('node:https');

const agent = new https.Agent();

/*
 * FacebookDownloader class for retrieving direct video URLs from Facebook videos
 *
 * Example URLs:
 * - https://www.facebook.com/1551UNMSM/videos/2126724314377208 (standard video URL)
 * - https://www.facebook.com/share/v/Hr3BZV9JjaKPy28P/ (short share link for the same video)
 */
class FacebookDownloader {
    constructor() {
        // Base URL for the x2download API
        // Note: Using IP address to avoid ENOTFOUND errors
        // TODO: Implement DNS lookup to get the current IP for x2download.app
        this.BASE_URL = 'https://172.67.222.44/api/ajaxSearch/facebook';
    }

    async getDirectUrlsAndCount(url, quality = 'sd') {
        try {
            const mediaInfo = await this.getMediaInfo(url);
            const selectedUrls =
                quality === 'hd' ? mediaInfo.links.hd : mediaInfo.links.sd;
            const urlArray = Array.isArray(selectedUrls) ? selectedUrls : [selectedUrls];

            return {
                urls: urlArray,
                count: urlArray.length,
            };
        } catch (error) {
            console.error('Error in getDirectUrlsAndCount:', error);
            throw new Error(`Failed to process Facebook URL: ${error.message}`);
        }
    }

    async getMediaInfo(url) {
        try {
            const encodedUrl = querystring.escape(url);
            const response = await this.makeRequest(encodedUrl);
            return this.parseResponse(response.data);
        } catch (error) {
            console.error('Error in getMediaInfo:', error);
            throw new Error(`Error fetching Facebook data: ${error.message}`);
        }
    }

    async makeRequest(encodedUrl, retries = 3) {
        try {
            return await axios({
                method: 'post',
                url: this.BASE_URL,
                headers: {
                    Host: 'x2download.app',
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
                data: `q=${encodedUrl}`,
                httpsAgent: agent,
                timeout: 10000,
            });
        } catch (error) {
            if (retries > 0) {
                console.warn(`Request failed, retrying... (${retries} attempts left)`);
                return this.makeRequest(encodedUrl, retries - 1);
            }
            throw error;
        }
    }

    parseResponse(data) {
        if (!data || !data.links || (!data.links.hd && !data.links.sd)) {
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
    }
}

module.exports = FacebookDownloader;
