import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadModules } from './core/module-loader';
import type { SDKModule } from './core/types';
import { parseApiError } from './core/errors';
import { DEFAULT_API_VERSION, buildVersionedPath } from './core/versioning';
import type { ApiVersion, VersionedSupaSDKOptions } from './core/versioning';
import { withRateLimit, extractRateLimitInfo } from './core/rate-limiting';
import type { RateLimitConfig } from './core/rate-limiting';
import { getObservability, LogLevel, SDKEventType } from './core/observability';
import type { ObservabilityConfig } from './core/observability';

// Base configuration options for the SDK
export interface SupaSDKOptions {
    // Supabase configuration
    supabaseUrl: string;
    supabaseAnonKey: string;

    // Backend API configuration
    apiUrl: string;

    // Optional authentication token (if already authenticated)
    authToken?: string;

    // Optional: Rate limiting configuration
    rateLimit?: RateLimitConfig;

    // Optional: Specific modules to load (loads all by default)
    modules?: string[];

    // Optional: Observability configuration
    observability?: ObservabilityConfig;
}

/**
 * Main SDK client that provides access to all operations
 * Dynamically loads modules to enable easy extensibility
 */
export class SupaSDKClient {
    private supabaseClient: SupabaseClient;
    private modules: Record<string, SDKModule> = {};
    private authToken?: string;
    private apiVersion: ApiVersion;
    private rateLimitConfig: RateLimitConfig;

    constructor(private options: VersionedSupaSDKOptions) {
        // Initialize API version
        this.apiVersion = options.apiVersion || DEFAULT_API_VERSION;

        // Initialize rate limit config
        this.rateLimitConfig = options.rateLimit || {};

        // Configure observability
        if (options.observability) {
            getObservability().configure(options.observability);
        }

        getObservability().log(LogLevel.INFO, 'Initializing SDK client', {
            apiVersion: this.apiVersion,
            apiUrl: options.apiUrl,
            modules: options.modules || 'all',
        });

        // Initialize Supabase client
        this.supabaseClient = createSupabaseClient(
            options.supabaseUrl,
            options.supabaseAnonKey
        );

        // Set auth token if provided
        this.authToken = options.authToken;

        // Load all modules
        this.modules = loadModules(this);

        getObservability().log(LogLevel.DEBUG, 'SDK client initialized', {
            moduleCount: Object.keys(this.modules).length,
            moduleNames: Object.keys(this.modules),
        });
    }

    /**
     * Set the authentication token for API requests
     * This should be called after user authentication
     * 
     * @param token JWT auth token from Supabase auth
     */
    public setAuthToken(token: string): void {
        this.authToken = token;
        getObservability().log(LogLevel.DEBUG, 'Auth token updated');
    }

    /**
     * Get the current authentication token
     */
    public getAuthToken(): string | undefined {
        return this.authToken;
    }

    /**
     * Get the current API version
     */
    public getApiVersion(): ApiVersion {
        return this.apiVersion;
    }

    /**
     * Set the API version to use for requests
     * 
     * @param version API version
     */
    public setApiVersion(version: ApiVersion): void {
        const oldVersion = this.apiVersion;
        this.apiVersion = version;

        getObservability().log(LogLevel.INFO, 'API version changed', {
            oldVersion,
            newVersion: version,
        });
    }

    /**
     * Get the Supabase client for direct subscription operations
     * This is provided primarily for real-time subscriptions and
     * should be avoided for other operations
     */
    public getSupabaseClient(): SupabaseClient {
        return this.supabaseClient;
    }

    /**
     * Get the configured API URL
     */
    public getApiUrl(): string {
        return this.options.apiUrl;
    }

    /**
     * Make an authenticated request to the backend API
     * Includes rate limiting, versioning, error handling, and observability
     * 
     * @param path API endpoint path
     * @param method HTTP method
     * @param data Request payload
     * @returns Promise resolving to the API response
     */
    public async apiRequest<T = any>(
        path: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        data?: any
    ): Promise<T> {
        const operationId = getObservability().generateOperationId();
        const versionedPath = buildVersionedPath(path, this.apiVersion);
        const url = `${this.options.apiUrl}${versionedPath}`;

        // Log request start
        getObservability().emitEvent({
            type: SDKEventType.REQUEST_START,
            timestamp: Date.now(),
            method,
            path: versionedPath,
            operationId,
            apiVersion: this.apiVersion,
        });

        const makeRequest = async (): Promise<T> => {
            const startTime = Date.now();

            try {
                const headers: HeadersInit = {
                    'Content-Type': 'application/json',
                    'X-API-Version': this.apiVersion,
                    'X-SDK-Operation-ID': operationId,
                };

                // Add auth token if available
                if (this.authToken) {
                    headers['Authorization'] = `Bearer ${this.authToken}`;
                }

                const options: RequestInit = {
                    method,
                    headers,
                    credentials: 'include',
                };

                // Add body for non-GET requests
                if (method !== 'GET' && data) {
                    options.body = JSON.stringify(data);
                }

                getObservability().log(LogLevel.DEBUG, `API Request: ${method} ${versionedPath}`, data);

                const response = await fetch(url, options);
                const duration = Date.now() - startTime;

                // Extract rate limit info
                const rateLimitInfo = extractRateLimitInfo(response.headers);

                if (!response.ok) {
                    // Handle error response
                    const errorData = await parseApiError(response);

                    // Log request error
                    getObservability().emitEvent({
                        type: SDKEventType.REQUEST_ERROR,
                        timestamp: Date.now(),
                        method,
                        path: versionedPath,
                        status: response.status,
                        duration,
                        error: errorData,
                        operationId,
                        apiVersion: this.apiVersion,
                    });

                    throw errorData;
                }

                // Log successful request
                getObservability().emitEvent({
                    type: SDKEventType.REQUEST_END,
                    timestamp: Date.now(),
                    method,
                    path: versionedPath,
                    status: response.status,
                    duration,
                    operationId,
                    apiVersion: this.apiVersion,
                });

                // Parse JSON response
                const result = await response.json();
                return result;
            } catch (error) {
                getObservability().log(LogLevel.ERROR, `API Request failed: ${method} ${versionedPath}`, error);
                throw error;
            }
        };

        // Execute with rate limiting
        return withRateLimit<T>(makeRequest, this.rateLimitConfig)
            .then(result => result.result);
    }

    /**
     * Get a module instance by name
     * 
     * @param name Module name
     * @returns Module instance or undefined if not found
     */
    public module<T extends SDKModule = SDKModule>(name: string): T {
        const module = this.modules[name] as T;

        if (!module) {
            getObservability().log(
                LogLevel.ERROR,
                `Module "${name}" not found`,
                { availableModules: Object.keys(this.modules) }
            );
            throw new Error(`Module "${name}" not found. Available modules: ${Object.keys(this.modules).join(', ')}`);
        }

        return module;
    }
}