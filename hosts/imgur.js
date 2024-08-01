const axios = require('axios');

/*
 * Class to download media from Imgur URLs
 * @param {boolean} isProduction - Whether to return direct URLs in production
 * @returns {object} - ImgurDownloader instance
 * @test cases:
 * 1. https://i.imgur.com/7q4TxW7.png - single image
 * 2. https://imgur.com/gallery/ouMQkN1 - album
 * 3. https://imgur.com/gallery/mouth-movements-hxXHU13 - video album
 * 4. https://imgur.com/gallery/art-gallery-ready-to-heist-free-dnd-ttrpg-maps-dTFUK1E - album with multiple images
 */
class ImgurDownloader {
    constructor(isProduction = false) {
        this.clientId = '546c25a59c58ad7';
        this.isProduction = isProduction;
    }

    async getMediaInfo(url) {
        const {type, id} = this.parseUrl(url);
        try {
            const response = await this.fetchMediaInfo(type, id);
            const parsedData = this.parseMediaInfo(response.data, url);
            return this.isProduction ? this.getDirectUrls(parsedData) : parsedData;
        } catch (error) {
            const errorMessage = this.handleError(error, url);
            throw new Error(errorMessage);
        }
    }

    parseUrl(url) {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);

        if (urlObj.hostname === 'i.imgur.com') {
            return {type: 'image', id: pathParts[0].split('.')[0]};
        } else if (pathParts.includes('gallery') || pathParts.includes('a')) {
            const id = pathParts[pathParts.length - 1].split('.')[0];
            const finalId = id.includes('-') ? id.split('-').pop() : id;
            return {type: 'album', id: finalId};
        } else {
            return {type: 'image', id: pathParts[pathParts.length - 1]};
        }
    }

    async fetchMediaInfo(type, id) {
        const endpoint = `https://api.imgur.com/3/${type}/${id}?client_id=${this.clientId}&include=media`;
        const response = await axios.get(endpoint);
        return response;
    }

    parseMediaInfo(data, url) {
        if (data.data.is_album) {
            return this.parseAlbumInfo(data.data);
        } else {
            return this.parseSingleMediaInfo(data.data);
        }
    }

    parseAlbumInfo(albumData) {
        return {
            id: albumData.id,
            title: albumData.title || null,
            description: albumData.description || null,
            datetime: albumData.datetime,
            cover: albumData.cover
                ? `https://i.imgur.com/${albumData.cover}.${albumData.cover_ext}`
                : null,
            images: albumData.images.map(img => this.parseImageInfo(img)),
            imageCount: albumData.images_count,
            isAlbum: true,
        };
    }

    parseSingleMediaInfo(mediaData) {
        return this.parseImageInfo(mediaData);
    }

    parseImageInfo(imageData) {
        return {
            id: imageData.id,
            title: imageData.title || null,
            description: imageData.description || null,
            datetime: imageData.datetime,
            type: imageData.type,
            animated: imageData.animated,
            width: imageData.width,
            height: imageData.height,
            size: imageData.size,
            views: imageData.views,
            link: imageData.link,
            mp4: imageData.mp4,
            gifv: imageData.gifv,
        };
    }

    getDirectUrls(parsedData) {
        if (parsedData.isAlbum) {
            return parsedData.images.map(img => img.link);
        } else {
            return [parsedData.link];
        }
    }

    handleError(error, url) {
        let errorMessage = `Failed to fetch media info for ${url}: `;
        if (error.response) {
            errorMessage += `Status ${error.response.status}`;
            if (
                error.response.data &&
                error.response.data.data &&
                error.response.data.data.error
            ) {
                errorMessage += ` - ${error.response.data.data.error}`;
            }
        } else if (error.request) {
            errorMessage += 'No response received from server';
        } else {
            errorMessage += error.message;
        }
        return errorMessage;
    }

    async getDirectUrlsAndCount(url) {
        try {
            const result = await this.getMediaInfo(url);
            let urls;
            if (Array.isArray(result)) {
                urls = result;
            } else if (result.isAlbum) {
                urls = result.images.map(img => img.link);
            } else {
                urls = [result.link];
            }
            return {
                urls: urls,
                count: urls.length,
            };
        } catch (error) {
            throw new Error(`Failed to process URL: ${error.message}`);
        }
    }
}

module.exports = ImgurDownloader;
