import { RateLimitError } from './errors';

/**
 * Configuration options for rate limiting
 */
export interface RateLimitConfig {
    /**
     * Whether to enable automatic retries
     * @default true
     */
    enableRetry?: boolean;

    /**
     * Maximum number of retries
     * @default 3
     */
    maxRetries?: number;

    /**
     * Base delay for exponential backoff (in ms)
     * @default 1000
     */
    baseDelay?: number;

    /**
     * Maximum delay between retries (in ms)
     * @default 30000
     */
    maxDelay?: number;

    /**
     * Jitter factor (0-1) for randomizing delay
     * @default 0.1
     */
    jitter?: number;
}

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: Required<RateLimitConfig> = {
    enableRetry: true,
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    jitter: 0.1,
};

/**
 * Result including the return value and rate limit information
 */
export interface RateLimitedResult<T> {
    /**
     * The operation result
     */
    result: T;

    /**
     * Rate limit information (if available)
     */
    rateLimit?: {
        /**
         * Number of requests remaining in the current window
         */
        remaining?: number;

        /**
         * Total request limit in the current window
         */
        limit?: number;

        /**
         * Timestamp when the rate limit resets (Unix timestamp in seconds)
         */
        resetAt?: number;
    };
}

/**
 * Execute a function with retry logic for rate limiting
 * 
 * @param fn Function to execute
 * @param config Rate limit configuration
 * @returns Result of the function with rate limit information
 */
export async function withRateLimit<T>(
    fn: () => Promise<T>,
    config: RateLimitConfig = {}
): Promise<RateLimitedResult<T>> {
    // Merge with default config
    const finalConfig: Required<RateLimitConfig> = {
        ...DEFAULT_RATE_LIMIT_CONFIG,
        ...config,
    };

    let attempt = 0;
    let lastError: RateLimitError | null = null;

    while (attempt <= finalConfig.maxRetries) {
        try {
            // Attempt the operation
            const result = await fn();

            // Extract rate limit info from the last error if available
            const rateLimit = lastError?.details?.rateLimit;

            return { result, rateLimit };
        } catch (error) {
            // Only retry rate limit errors if retries are enabled
            if (
                error instanceof RateLimitError &&
                finalConfig.enableRetry &&
                attempt < finalConfig.maxRetries
            ) {
                lastError = error;
                attempt++;

                // Calculate delay with exponential backoff
                const expDelay = Math.min(
                    finalConfig.baseDelay * Math.pow(2, attempt - 1),
                    finalConfig.maxDelay
                );

                // Add jitter to prevent thundering herd
                const jitterFactor = 1 - finalConfig.jitter + Math.random() * (2 * finalConfig.jitter);
                const delay = expDelay * jitterFactor;

                // Use the retry-after header if available, otherwise use calculated delay
                const retryAfterMs = error.retryAfter ? error.retryAfter * 1000 : delay;

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, retryAfterMs));
                continue;
            }

            // Re-throw other errors or if we've exhausted retries
            throw error;
        }
    }

    // This should never be reached due to the throw in the catch block,
    // but TypeScript needs it for type safety
    throw new Error('Rate limit exceeded after maximum retries');
}

/**
 * Extract rate limit information from response headers
 * 
 * @param headers Response headers
 * @returns Rate limit information if available
 */
export function extractRateLimitInfo(headers: Headers): RateLimitedResult<void>['rateLimit'] | undefined {
    const remaining = headers.get('x-ratelimit-remaining');
    const limit = headers.get('x-ratelimit-limit');
    const reset = headers.get('x-ratelimit-reset');

    if (!remaining && !limit && !reset) {
        return undefined;
    }

    return {
        remaining: remaining ? parseInt(remaining, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        resetAt: reset ? parseInt(reset, 10) : undefined,
    };
}