import ImgurDownloader from './hosts/imgur';
import RedditDownloader from './hosts/reddit';
import InstagramDownloader from './hosts/instagram';
import FacebookDownloader from './hosts/facebook';
import TwitterDownloader from './hosts/twitter';
import PinterestDownloader from './hosts/pinterest';
import TikTokDownloader from './hosts/tiktok';

interface DownloaderResult {
  urls: string[];
  count: number;
}

type HostType = 'imgur' | 'reddit' | 'instagram' | 'facebook' | 'twitter' | 'pinterest' | 'tiktok';

const downloaders: Record<HostType, InstanceType<typeof ImgurDownloader | typeof RedditDownloader | typeof InstagramDownloader | typeof FacebookDownloader | typeof TwitterDownloader | typeof PinterestDownloader | typeof TikTokDownloader>> = {
  imgur: new ImgurDownloader(),
  reddit: new RedditDownloader(),
  instagram: new InstagramDownloader(),
  facebook: new FacebookDownloader(),
  twitter: new TwitterDownloader(),
  pinterest: new PinterestDownloader(),
  tiktok: new TikTokDownloader(),
};

const allowedHosts: Record<HostType, string[]> = {
  imgur: ['imgur.com', 'i.imgur.com'],
  reddit: ['reddit.com', 'www.reddit.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'fb.watch'],
  twitter: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
  pinterest: ['pinterest.com', 'www.pinterest.com', 'pin.it'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
};

function isAllowedHost(hostname: string, service: HostType): boolean {
  return allowedHosts[service].includes(hostname);
}

async function MediaDownloader(url: string, specificHost?: HostType | null): Promise<DownloaderResult> {
  try {
    if (specificHost) {
      return await processSpecificHost(url, specificHost);
    }

    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    for (const [host, domains] of Object.entries(allowedHosts)) {
      if (domains.includes(hostname)) {
        return await downloaders[host as HostType].getDirectUrlsAndCount(url);
      }
    }

    throw new Error(
      'Unsupported URL. Please use Imgur, Reddit, Instagram, Facebook, Twitter, Pinterest, or TikTok URLs.'
    );
  } catch (error) {
    console.error(`Failed to process URL: ${(error as Error).message}`);
    return { urls: [], count: 0 };
  }
}

async function processSpecificHost(url: string, host: HostType): Promise<DownloaderResult> {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.toLowerCase();

  if (isAllowedHost(hostname, host)) {
    return await downloaders[host].getDirectUrlsAndCount(url);
  }

  throw new Error(
    'Unsupported host or URL. Please use a valid URL for the specified host.'
  );
}

export default MediaDownloader;
