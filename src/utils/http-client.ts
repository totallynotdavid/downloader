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
            ...(config.proxy && {proxy: this.parseProxy(config.proxy)}),
        };

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
            logger.error(`Invalid proxy URL: ${proxy}`, error);
            throw new Error('Invalid proxy URL.');
        }
    }

    private async request<T = any>(
        method: 'get' | 'post' | 'stream',
        url: string,
        options?: AxiosRequestConfig,
        data?: any
    ): Promise<AxiosResponse<T>> {
        logger.info(`HTTP ${method.toUpperCase()}: ${url}`);
        try {
            const mergedOptions = this.mergeOptions(options);
            if (method === 'stream') {
                mergedOptions.responseType = 'stream';
            }
            const response = await (method === 'post'
                ? this.axiosInstance.post<T>(url, data, mergedOptions)
                : this.axiosInstance.get<T>(url, mergedOptions));
            return response;
        } catch (error) {
            logger.error(`${method.toUpperCase()} request failed for ${url}: ${error}`);
            throw error;
        }
    }

    public async get<T = any>(
        url: string,
        options?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>> {
        return this.request<T>('get', url, options);
    }

    public async post<T = any>(
        url: string,
        data?: any,
        options?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>> {
        return this.request<T>('post', url, options, data);
    }

    public async stream(
        url: string,
        options?: AxiosRequestConfig
    ): Promise<AxiosResponse<any>> {
        return this.request('stream', url, options);
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
