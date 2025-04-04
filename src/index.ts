import { SupaSDKClient, type SupaSDKOptions } from './client';

/**
 * Create and configure a new SDK client instance
 * 
 * @param options Configuration options for the SDK
 * @returns Configured SDK client instance
 */
export function createClient(options: SupaSDKOptions): SupaSDKClient {
    return new SupaSDKClient(options);
}

// Re-export types
export * from './core/types';

// Create a default export for convenience
export default {
    createClient,
};