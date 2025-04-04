import { SupaSDKClient } from '../client';

/**
 * Base interface for all SDK modules
 */
export interface SDKModule {
    name: string;
}

/**
 * Factory function for creating SDK modules
 */
export type ModuleFactory = (client: SupaSDKClient) => SDKModule;

/**
 * Configuration for module registration
 */
export interface ModuleConfig {
    name: string;
    factory: ModuleFactory;
}

/**
 * Result of a successful API operation
 */
export interface SuccessResult<T = any> {
    data: T;
    error: null;
}

/**
 * Result of a failed API operation
 */
export interface ErrorResult {
    data: null;
    error: {
        message: string;
        code?: string;
        details?: any;
    };
}

/**
 * Combined type for API operation results
 */
export type ApiResult<T = any> = SuccessResult<T> | ErrorResult;

/**
 * Base options for paginated requests
 */
export interface PaginationOptions {
    page?: number;
    limit?: number;
}

/**
 * Base options for filtered requests
 */
export interface FilterOptions {
    filter?: Record<string, any>;
    sort?: string | string[];
    sortDirection?: 'asc' | 'desc';
}

/**
 * Combined options for paginated and filtered requests
 */
export interface QueryOptions extends PaginationOptions, FilterOptions { }