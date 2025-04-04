import { SupaSDKClient } from '../client';
import type { SDKModule } from './types';

/**
 * Base class for all SDK modules
 * Provides common functionality and access to the client
 */
export abstract class BaseModule implements SDKModule {
    /**
     * The name of the module
     * Must be overridden by subclasses
     */
    abstract name: string;

    constructor(protected client: SupaSDKClient) { }

    /**
     * Get the Supabase client for direct subscription operations
     * Direct Supabase access should ONLY be used for real-time subscriptions
     */
    protected getSupabase() {
        return this.client.getSupabaseClient();
    }

    /**
     * Make an API request for write operations
     * 
     * @param path API endpoint path
     * @param method HTTP method
     * @param data Request payload
     * @returns Promise resolving to the API response
     */
    protected apiRequest<T = any>(
        path: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        data?: any
    ): Promise<T> {
        return this.client.apiRequest<T>(path, method, data);
    }
}