import fs from 'node:fs';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {DownloaderConfig} from '@/types';
import {HttpClient} from '@/utils/http-client';
import logger from '@/utils/logger';

async function createDirectory(dir: string): Promise<void> {
    await fs.promises.mkdir(dir, {recursive: true});
}

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
        await createDirectory(downloadDir);

        const writer = fs.createWriteStream(fullPath);

        await pipeline(response.data, writer);

        logger.info(`Download completed: ${fullPath}`);
        return fullPath;
    } catch (error) {
        logger.error(`Error downloading file from ${url}: ${error}`);
        throw error;
    }
}
