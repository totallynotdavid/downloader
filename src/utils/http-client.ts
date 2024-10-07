import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from 'axios';
import {defaultConfig} from '@/config';
import {DownloaderConfig} from '@/types';
import logger from '@/utils/logger';

export class HttpClient {
    private axiosInstance: AxiosInstance;
    private defaultUserAgent: string =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';

    constructor(configOverrides: Partial<DownloaderConfig> = {}) {
        const config: DownloaderConfig = {...defaultConfig, ...configOverrides};

        const axiosConfig: AxiosRequestConfig = {
            timeout: 10000,
            headers: {
                'User-Agent': this.defaultUserAgent,
            },
        };

        if (config.proxy) {
            const proxyConfig = this.parseProxy(config.proxy);
            axiosConfig.proxy = proxyConfig;
            logger.info(`Using proxy: ${config.proxy}`);
        }

        this.axiosInstance = axios.create(axiosConfig);
    }

    private parseProxy(proxy: string): AxiosRequestConfig['proxy'] {
        try {
            const url = new URL(proxy);
            return {
                host: url.hostname,
                port: parseInt(url.port, 10) || 80,
                protocol: url.protocol.replace(':', '') as 'http' | 'https',
                auth: url.username
                    ? {
                          username: decodeURIComponent(url.username),
                          password: decodeURIComponent(url.password),
                      }
                    : undefined,
            };
        } catch (error) {
            logger.error(`Invalid proxy URL: ${proxy}`);
            throw new Error('Invalid proxy URL.');
        }
    }

    public async get<T = any>(
        url: string,
        options?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>> {
        logger.info(`HTTP GET: ${url}`);
        try {
            const response = await this.axiosInstance.get<T>(
                url,
                this.mergeOptions(options)
            );
            return response;
        } catch (error: any) {
            logger.error(`GET request failed for ${url}: ${error.message}`);
            throw error;
        }
    }

    public async post<T = any>(
        url: string,
        data?: any,
        options?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>> {
        logger.info(`HTTP POST: ${url}`);
        try {
            const response = await this.axiosInstance.post<T>(
                url,
                data,
                this.mergeOptions(options)
            );
            return response;
        } catch (error: any) {
            logger.error(`POST request failed for ${url}: ${error.message}`);
            throw error;
        }
    }

    public async stream(
        url: string,
        options?: AxiosRequestConfig
    ): Promise<AxiosResponse<any>> {
        logger.info(`HTTP STREAM: ${url}`);
        try {
            const response = await this.axiosInstance.get(
                url,
                this.mergeOptions({
                    ...options,
                    responseType: 'stream',
                })
            );
            return response;
        } catch (error: any) {
            logger.error(`STREAM request failed for ${url}: ${error.message}`);
            throw error;
        }
    }

    private mergeOptions(options?: AxiosRequestConfig): AxiosRequestConfig {
        const merged = {...options};
        merged.headers = {
            ...options?.headers,
            'User-Agent':
                (options?.headers?.['User-Agent'] as string) || this.defaultUserAgent,
        };
        return merged;
    }
}
