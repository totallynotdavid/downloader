import fs from 'node:fs';
import path from 'node:path';
import {DownloaderConfig} from '@/types';
import {HttpClient} from '@/utils/http-client';
import logger from '@/utils/logger';

/**
 * Downloads a file from the specified URL to the given directory with the provided file name.
 * @param url The URL of the file to download.
 * @param downloadDir The directory to save the downloaded file.
 * @param fileName The name to save the file as.
 * @param config Downloader configuration which may include proxy settings.
 * @returns A promise that resolves to the local file path.
 */
export async function downloadFile(
    url: string,
    downloadDir: string,
    fileName: string,
    config: DownloaderConfig
): Promise<string> {
    try {
        const httpClient = new HttpClient(config);
        const response = await httpClient.stream(url);

        const fullPath = path.resolve(downloadDir, fileName);

        fs.mkdirSync(downloadDir, {recursive: true});

        const writer = fs.createWriteStream(fullPath);

        response.data.pipe(writer);

        return new Promise<string>((resolve, reject) => {
            writer.on('finish', () => {
                logger.info(`Download completed: ${fullPath}`);
                resolve(fullPath);
            });
            writer.on('error', err => {
                logger.error(`Download failed: ${fullPath}`);
                reject(new Error(`Failed to download file: ${err.message}`));
            });
        });
    } catch (error) {
        logger.error(`Error downloading file from ${url}: ${error}`);
        throw error;
    }
}
