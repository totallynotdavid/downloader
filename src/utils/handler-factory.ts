import {PlatformHandler} from '@/types';
import FacebookHandler from '@/hosts/facebook';
import ImgurHandler from '@/hosts/imgur';
import InstagramHandler from '@/hosts/instagram';
import PinterestHandler from '@/hosts/pinterest';
import RedditHandler from '@/hosts/reddit';
import TikTokHandler from '@/hosts/tiktok';
import TwitterHandler from '@/hosts/twitter';
import YouTubeHandler from '@/hosts/youtube';

export class HandlerFactory {
    private handlers: PlatformHandler[];

    constructor() {
        this.handlers = [
            new YouTubeHandler(),
            new FacebookHandler(),
            new InstagramHandler(),
            new TwitterHandler(),
            new TikTokHandler(),
            new PinterestHandler(),
            new RedditHandler(),
            new ImgurHandler(),
        ];
    }

    getHandlerForUrl(url: string): PlatformHandler | null {
        return this.handlers.find(handler => handler.isValidUrl(url)) || null;
    }
}
