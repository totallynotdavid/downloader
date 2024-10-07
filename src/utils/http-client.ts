import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from 'axios';
import {DownloaderConfig} from '@/types';
import logger from '@/utils/logger';

/**
 * HttpClient is a utility class for making HTTP requests using Axios.
 * It supports GET, POST, and streaming requests with optional proxy configurations.
 */
export class HttpClient {
    private axiosInstance: AxiosInstance;

    /**
     * Constructs a new HttpClient instance with the provided downloader configuration.
     * @param config Downloader configuration which may include proxy settings.
     */
    constructor(config: DownloaderConfig) {
        const axiosConfig: AxiosRequestConfig = {
            timeout: 10000, // 10 seconds timeout
        };

        if (config.proxy) {
            const proxyConfig = this.parseProxy(config.proxy);
            axiosConfig.proxy = proxyConfig;
            logger(`Using proxy: ${config.proxy}`);
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
            logger(`Invalid proxy URL: ${proxy}`);
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
        logger(`HTTP GET: ${url}`);
        try {
            const response = await this.axiosInstance.get<T>(url, options);
            return response;
        } catch (error: any) {
            logger(`GET request failed for ${url}: ${error.message}`);
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
        logger(`HTTP POST: ${url}`);
        try {
            const response = await this.axiosInstance.post<T>(url, data, options);
            return response;
        } catch (error: any) {
            logger(`POST request failed for ${url}: ${error.message}`);
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
        logger(`HTTP STREAM: ${url}`);
        try {
            const response = await this.axiosInstance.get(url, {
                ...options,
                responseType: 'stream',
            });
            return response;
        } catch (error: any) {
            logger(`STREAM request failed for ${url}: ${error.message}`);
            throw error;
        }
    }
}
