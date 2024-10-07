import fs from 'node:fs';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {DownloaderConfig} from '@/types';
import {HttpClient} from '@/utils/http-client';
import logger from '@/utils/logger';

export class FileDownloader {
    private httpClient: HttpClient;

    constructor(private config: DownloaderConfig) {
        this.httpClient = new HttpClient(config);
    }

    private async createDirectory(dir: string): Promise<void> {
        await fs.promises.mkdir(dir, {recursive: true});
    }

    public async downloadFile(
        url: string,
        downloadDir: string,
        fileName: string
    ): Promise<string> {
        try {
            const response = await this.httpClient.stream(url);

            const fullPath = path.resolve(downloadDir, fileName);
            await this.createDirectory(downloadDir);

            const writer = fs.createWriteStream(fullPath);

            await pipeline(response.data, writer);

            logger.info(`Download completed: ${fullPath}`);
            return fullPath;
        } catch (error) {
            logger.error(`Error downloading file from ${url}: ${error}`);
            throw error;
        }
    }
}
