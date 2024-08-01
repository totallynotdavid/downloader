const ImgurDownloader = require('./imgur');
const axios = require('axios');

jest.mock('axios');

describe('ImgurDownloader', () => {
    let downloader;

    beforeEach(() => {
        downloader = new ImgurDownloader();
    });

    test('parseUrl correctly parses direct image URL', () => {
        const result = downloader.parseUrl('https://i.imgur.com/7q4TxW7.png');
        expect(result).toEqual({type: 'image', id: '7q4TxW7'});
    });

    test('parseUrl correctly parses gallery URL', () => {
        const result = downloader.parseUrl('https://imgur.com/gallery/ouMQkN1');
        expect(result).toEqual({type: 'album', id: 'ouMQkN1'});
    });

    test('parseUrl correctly parses complex gallery URL', () => {
        const result = downloader.parseUrl(
            'https://imgur.com/gallery/art-gallery-ready-to-heist-free-dnd-ttrpg-maps-dTFUK1E'
        );
        expect(result).toEqual({type: 'album', id: 'dTFUK1E'});
    });

    test('getMediaInfo returns full info in dev mode', async () => {
        const mockResponse = {
            data: {
                data: {
                    id: 'testId',
                    title: 'Test Title',
                    link: 'https://i.imgur.com/testId.jpg',
                    type: 'image/jpeg',
                },
            },
        };
        axios.get.mockResolvedValue(mockResponse);

        const result = await downloader.getMediaInfo('https://i.imgur.com/testId.jpg');
        expect(result).toHaveProperty('id', 'testId');
        expect(result).toHaveProperty('title', 'Test Title');
        expect(result).toHaveProperty('link', 'https://i.imgur.com/testId.jpg');
    });

    test('getMediaInfo returns only URLs in production mode', async () => {
        const prodDownloader = new ImgurDownloader(true);
        const mockResponse = {
            data: {
                data: {
                    id: 'testId',
                    title: 'Test Title',
                    link: 'https://i.imgur.com/testId.jpg',
                    type: 'image/jpeg',
                },
            },
        };
        axios.get.mockResolvedValue(mockResponse);

        const result = await prodDownloader.getMediaInfo(
            'https://i.imgur.com/testId.jpg'
        );
        expect(result).toEqual(['https://i.imgur.com/testId.jpg']);
    });

    test('getMediaInfo handles albums correctly', async () => {
        const mockResponse = {
            data: {
                data: {
                    id: 'albumId',
                    title: 'Album Title',
                    is_album: true,
                    images: [
                        {id: 'img1', link: 'https://i.imgur.com/img1.jpg'},
                        {id: 'img2', link: 'https://i.imgur.com/img2.jpg'},
                    ],
                },
            },
        };
        axios.get.mockResolvedValue(mockResponse);

        const result = await downloader.getMediaInfo('https://imgur.com/gallery/albumId');
        expect(result).toHaveProperty('isAlbum', true);
        expect(result.images).toHaveLength(2);
        expect(result.images[0]).toHaveProperty('link', 'https://i.imgur.com/img1.jpg');
    });
});
