const https = require('node:https');
const querystring = require('querystring');

const servers = ['en', 'id', 'es'];

async function youtubedl(url, server = servers[0]) {
    try {
        if (!isValidYoutubeUrl(url)) {
            throw new Error('Invalid YouTube URL');
        }

        if (!servers.includes(server)) server = servers[0];
        const cookies = await getCookies();

        const postData = querystring.stringify({
            k_query: url,
            k_page: 'home',
            hl: server,
            q_auto: 0,
        });

        const json = await makeHttpRequest(
            'www.y2mate.com',
            '/mates/analyzeV2/ajax',
            'POST',
            postData,
            cookies
        );
        const vid = json.vid;
        const urls = [];

        // Process video formats
        for (const videoKey in json.links['mp4']) {
            const _video = json.links['mp4'][videoKey];
            if (_video.f === 'mp4') {
                const downloadLink = await convert(vid, _video.k, cookies);
                urls.push({
                    quality: _video.q,
                    type: 'video',
                    mimeType: 'video/mp4',
                    url: downloadLink,
                });
            }
        }

        // Process audio formats
        for (const audioKey in json.links['mp3']) {
            const _audio = json.links['mp3'][audioKey];
            if (_audio.f === 'mp3') {
                const downloadLink = await convert(vid, _audio.k, cookies);
                urls.push({
                    quality: _audio.q,
                    type: 'audio',
                    mimeType: 'audio/mp3',
                    url: downloadLink,
                });
            }
        }

        return {
            urls: urls,
            count: urls.length,
        };
    } catch (error) {
        console.error('Error:', error.message);
        return {
            urls: [],
            count: 0,
        };
    }
}

async function convert(vid, k, cookies) {
    const postData = querystring.stringify({
        vid,
        k,
    });

    const json = await makeHttpRequest(
        'www.y2mate.com',
        '/mates/convertV2/index',
        'POST',
        postData,
        cookies
    );
    return json.dlink;
}

function getCookies() {
    return new Promise((resolve, reject) => {
        https
            .get('https://www.y2mate.com/en872', res => {
                const cookiesArray = res.headers['set-cookie'];
                resolve(
                    cookiesArray || [
                        '_gid=GA1.2.2055666962.1683248123',
                        '_ga=GA1.1.1570308475.1683248122',
                        '_ga_K8CD7CY0TZ=GS1.1.1683248122.1.1.1683248164.0.0.0',
                        'prefetchAd_3381349=true',
                    ]
                );
            })
            .on('error', e => {
                console.error(e);
                reject(e);
            });
    });
}

function isValidYoutubeUrl(url) {
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return ytRegex.test(url);
}

function makeHttpRequest(hostname, path, method, postData, cookies) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: hostname,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Cookie: cookies.join('; '),
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
            },
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(JSON.parse(data));
            });
        });

        req.on('error', e => {
            reject(e);
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

module.exports = youtubedl;
