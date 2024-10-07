import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from 'axios';
import {defaultConfig} from '@/config';
import {DownloaderConfig} from '@/types';
import logger from '@/utils/logger';

/**
 * HttpClient is a utility class for making HTTP requests using Axios.
 * It supports GET, POST, and streaming requests with optional proxy configurations.
 */
export class HttpClient {
    private axiosInstance: AxiosInstance;
    private defaultUserAgent: string =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';

    /**
     * Constructs a new HttpClient instance with the provided downloader configuration.
     * @param configOverrides Partial downloader configuration which may include proxy settings.
     */
    constructor(configOverrides: Partial<DownloaderConfig> = {}) {
        const config: DownloaderConfig = {...defaultConfig, ...configOverrides};

        const axiosConfig: AxiosRequestConfig = {
            timeout: 10000, // 10 seconds timeout
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

    /**
     * Parses a proxy URL string into Axios-compatible proxy configuration.
     * @param proxy The proxy URL string.
     * @returns An object representing proxy configuration for Axios.
     */
    private parseProxy(proxy: string): AxiosRequestConfig['proxy'] {
        try {
            const url = new URL(proxy);
            return {
                host: url.hostname,
                port: parseInt(url.port, 10) || 80, // Default to port 80 if not specified
                protocol: url.protocol.replace(':', '') as 'http' | 'https', // Ensures protocol is 'http' or 'https'
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

    /**
     * Sends an HTTP GET request to the specified URL with optional configuration.
     * @param url The URL to send the GET request to.
     * @param options Optional Axios request configuration.
     * @returns A promise that resolves to the Axios response.
     */
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
            logger.info(`GET request failed for ${url}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Sends an HTTP POST request to the specified URL with the provided data and optional configuration.
     * @param url The URL to send the POST request to.
     * @param data The data to include in the POST request body.
     * @param options Optional Axios request configuration.
     * @returns A promise that resolves to the Axios response.
     */
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

    /**
     * Initiates a streaming HTTP GET request to the specified URL with optional configuration.
     * The response will have a 'stream' type.
     * @param url The URL to stream data from.
     * @param options Optional Axios request configuration.
     * @returns A promise that resolves to the Axios response with stream data.
     */
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

    /**
     * Merges the provided options with the default options, ensuring the User-Agent is set.
     * @param options Optional Axios request configuration.
     * @returns Merged Axios request configuration.
     */
    private mergeOptions(options?: AxiosRequestConfig): AxiosRequestConfig {
        return {
            ...options,
            headers: {
                ...options?.headers,
                'User-Agent':
                    (options?.headers?.['User-Agent'] as string) || this.defaultUserAgent,
            },
        };
    }
}
