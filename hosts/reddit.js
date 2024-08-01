const axios = require('axios');

/*
 * Class to get the direct URLs from Reddit URLs
 * @param {boolean} isProduction - Whether to return direct URLs in production
 * @returns {object} - RedditDownloader instance
 * @test cases:
 * - https://www.reddit.com/r/neverchangejapan/comments/12spx82/ningen_isu_ringo_no_namida_a_metal_song_about_an/ - YouTube video
 * - https://www.reddit.com/r/unixporn/comments/12ruaq1/xperia_10_iii_w_sailfish_w_arch_my_mobile_office/ - single image
 * - https://www.reddit.com/r/blackmagicfuckery/comments/12sex2d/pool_black_magic/ - video
 * - https://www.reddit.com/r/cats/comments/1dsdwbc/_/ - gallery of 2 images
 * - https://www.reddit.com/r/interestingasfuck/comments/1drzauu/the_chinese_tianlong3_rocket_accidentally/ - video
 */
class RedditDownloader {
    constructor(isProduction = false) {
        this.isProduction = isProduction;
    }

    async getDirectUrlsAndCount(redditUrl) {
        try {
            const urls = await this.getMediaInfo(redditUrl);
            return {
                urls: urls,
                count: urls.length,
            };
        } catch (error) {
            throw new Error(`Failed to process URL: ${error.message}`);
        }
    }

    async getMediaInfo(redditUrl) {
        let url = redditUrl;
        if (!url.endsWith('.json')) {
            url += '.json';
        }

        try {
            const response = await axios.get(url);
            if (
                response.data &&
                response.data[0] &&
                response.data[0].data &&
                response.data[0].data.children
            ) {
                const posts = response.data[0].data.children;
                const mediaUrls = [];

                for (const post of posts) {
                    const urls = await this.processRedditPost(post.data);
                    mediaUrls.push(...urls);
                }

                return mediaUrls;
            } else {
                throw new Error('Unexpected response structure');
            }
        } catch (error) {
            throw new Error(`Error fetching Reddit data: ${error.message}`);
        }
    }

    async processRedditPost(postData) {
        const mediaUrls = [];

        if (postData.is_gallery) {
            if (postData.gallery_data && postData.gallery_data.items) {
                for (const item of postData.gallery_data.items) {
                    const imageUrl = `https://i.redd.it/${item.media_id}.jpg`;
                    mediaUrls.push(imageUrl);
                }
            }
        } else if (postData.is_video) {
            if (
                postData.media &&
                postData.media.reddit_video &&
                postData.media.reddit_video.fallback_url
            ) {
                mediaUrls.push(postData.media.reddit_video.fallback_url);
            }
        } else if (postData.secure_media && postData.secure_media.oembed) {
            if (postData.secure_media.oembed.thumbnail_url) {
                mediaUrls.push(postData.secure_media.oembed.thumbnail_url);
            }
        } else if (postData.url) {
            mediaUrls.push(postData.url);
        }

        return mediaUrls;
    }
}

module.exports = RedditDownloader;
