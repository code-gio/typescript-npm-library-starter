import type { SupaSDKOptions } from '../client';

/**
 * API Version specification
 * Format: 'v1', 'v2', etc.
 */
export type ApiVersion = 'v1' | 'v2';

/**
 * Default API version to use if not specified
 */
export const DEFAULT_API_VERSION: ApiVersion = 'v1';

/**
 * Extended SDK options with version support
 */
export interface VersionedSupaSDKOptions extends SupaSDKOptions {
    /**
     * API version to use
     * @default 'v1'
     */
    apiVersion?: ApiVersion;
}

/**
 * Build a versioned API path
 * 
 * @param path Base API path
 * @param version API version to use
 * @returns Versioned API path
 */
export function buildVersionedPath(path: string, version: ApiVersion = DEFAULT_API_VERSION): string {
    // Ensure path starts with a slash
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // Build versioned path
    return `/${version}${normalizedPath}`;
}

/**
 * Utility to handle version-specific logic
 * 
 * @param version API version
 * @param handlers Object with version-specific implementations
 * @returns Result from the appropriate version handler
 */
export function versionSpecific<T>(
    version: ApiVersion,
    handlers: Partial<Record<ApiVersion, () => T>>,
    fallback?: () => T
): T {
    const handler = handlers[version];

    if (handler) {
        return handler();
    }

    if (fallback) {
        return fallback();
    }

    throw new Error(`No handler found for API version ${version}`);
}