import {PlatformHandler, DownloaderConfig} from '@/types';
import {HttpClient} from '@/utils/http-client';
import {FileDownloader} from '@/utils/file-downloader';
import FacebookHandler from '@/hosts/facebook';
import ImgurHandler from '@/hosts/imgur';
import InstagramHandler from '@/hosts/instagram';
import PinterestHandler from '@/hosts/pinterest';
import RedditHandler from '@/hosts/reddit';
import TikTokHandler from '@/hosts/tiktok';
import TwitterHandler from '@/hosts/twitter';
import YouTubeHandler from '@/hosts/youtube';

export class HandlerFactory {
    private handlers: Map<string, PlatformHandler>;
    private httpClient: HttpClient;
    private fileDownloader: FileDownloader;

    constructor(config: DownloaderConfig) {
        this.httpClient = new HttpClient(config);
        this.fileDownloader = new FileDownloader(config);

        this.handlers = new Map<string, PlatformHandler>([
            ['youtube', new YouTubeHandler(this.httpClient, this.fileDownloader)],
            ['facebook', new FacebookHandler()],
            ['instagram', new InstagramHandler()],
            ['twitter', new TwitterHandler()],
            ['tiktok', new TikTokHandler()],
            ['pinterest', new PinterestHandler()],
            ['reddit', new RedditHandler()],
            ['imgur', new ImgurHandler()],
        ]);
    }

    getHandlerForUrl(url: string): PlatformHandler | null {
        const hostname = new URL(url).hostname.toLowerCase();
        for (const [key, handler] of this.handlers.entries()) {
            if (hostname.includes(key) && handler.isValidUrl(url)) {
                return handler;
            }
        }
        return null;
    }
}
