const axios = require('axios');
const qs = require('qs');
const cheerio = require('cheerio');

class InstagramDownloader {
    constructor() {
        this.BASE_URL = 'https://v3.saveig.app/api/ajaxSearch';
        this.headers = {
            Accept: '*/*',
            Origin: 'https://saveig.app',
            Referer: 'https://saveig.app/',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Sec-Ch-Ua':
                '"Not/A)Brand";v="99", "Microsoft Edge";v="115", "Chromium";v="115"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.183',
            'X-Requested-With': 'XMLHttpRequest',
        };
    }

    async getDirectUrlsAndCount(url) {
        try {
            const result = await this.getMediaInfo(url);
            return {
                urls: result.url_list,
                count: result.results_number,
            };
        } catch (error) {
            throw new Error(`Failed to process Instagram URL: ${error.message}`);
        }
    }

    async getMediaInfo(url) {
        try {
            const params = {
                q: url,
                t: 'media',
                lang: 'en',
            };

            const response = await axios.post(this.BASE_URL, qs.stringify(params), {
                headers: this.headers,
            });
            const responseData = response.data.data;

            if (!responseData) {
                return {results_number: 0, url_list: []};
            }

            const $ = cheerio.load(responseData);
            const downloadItems = $('.download-items');
            const result = [];

            downloadItems.each((index, element) => {
                const downloadLink = $(element)
                    .find('.download-items__btn > a')
                    .attr('href');
                result.push(downloadLink);
            });

            return {
                results_number: result.length,
                url_list: result,
            };
        } catch (error) {
            throw new Error(`Error fetching Instagram data: ${error.message}`);
        }
    }
}

module.exports = InstagramDownloader;
