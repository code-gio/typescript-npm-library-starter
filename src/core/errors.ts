/**
 * Standard error codes for the SDK
 */
export enum ErrorCode {
    // Generic error codes
    UNKNOWN_ERROR = 'unknown_error',
    NETWORK_ERROR = 'network_error',
    TIMEOUT_ERROR = 'timeout_error',

    // Authentication error codes
    UNAUTHORIZED = 'unauthorized',
    FORBIDDEN = 'forbidden',
    TOKEN_EXPIRED = 'token_expired',

    // Request error codes
    INVALID_PARAMETERS = 'invalid_parameters',
    RESOURCE_NOT_FOUND = 'resource_not_found',
    CONFLICT = 'conflict',

    // Rate limiting error codes
    RATE_LIMITED = 'rate_limited',

    // Server error codes
    SERVER_ERROR = 'server_error',

    // SDK configuration errors
    CONFIGURATION_ERROR = 'configuration_error',
    MODULE_NOT_FOUND = 'module_not_found',
}

/**
 * Base SDK Error class
 */
export class SDKError extends Error {
    /**
     * Error code
     */
    public code: ErrorCode;

    /**
     * HTTP status code (if applicable)
     */
    public status?: number;

    /**
     * Additional error details
     */
    public details?: any;

    /**
     * Request ID for tracking (if available)
     */
    public requestId?: string;

    /**
     * Whether a retry might succeed
     */
    public retryable: boolean;

    constructor(
        message: string,
        code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
        options: {
            status?: number;
            details?: any;
            requestId?: string;
            retryable?: boolean;
            cause?: Error;
        } = {}
    ) {
        super(message, { cause: options.cause });
        this.name = 'SDKError';
        this.code = code;
        this.status = options.status;
        this.details = options.details;
        this.requestId = options.requestId;
        this.retryable = options.retryable ?? false;
    }

    /**
     * Convert the error to a plain object for logging
     */
    public toJSON(): Record<string, any> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            status: this.status,
            details: this.details,
            requestId: this.requestId,
            retryable: this.retryable,
            stack: this.stack,
        };
    }
}

/**
 * Network-related error
 */
export class NetworkError extends SDKError {
    constructor(
        message: string = 'Network error occurred',
        options: {
            details?: any;
            requestId?: string;
            cause?: Error;
        } = {}
    ) {
        super(message, ErrorCode.NETWORK_ERROR, {
            ...options,
            retryable: true,
        });
        this.name = 'NetworkError';
    }
}

/**
 * Authentication error
 */
export class AuthError extends SDKError {
    constructor(
        message: string = 'Authentication error',
        code: ErrorCode = ErrorCode.UNAUTHORIZED,
        options: {
            status?: number;
            details?: any;
            requestId?: string;
            cause?: Error;
        } = {}
    ) {
        super(message, code, {
            ...options,
            retryable: code === ErrorCode.TOKEN_EXPIRED,
        });
        this.name = 'AuthError';
    }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends SDKError {
    /**
     * When to retry (if available)
     */
    public retryAfter?: number;

    constructor(
        message: string = 'Rate limit exceeded',
        options: {
            status?: number;
            details?: any;
            requestId?: string;
            retryAfter?: number;
            cause?: Error;
        } = {}
    ) {
        super(message, ErrorCode.RATE_LIMITED, {
            ...options,
            retryable: true,
        });
        this.name = 'RateLimitError';
        this.retryAfter = options.retryAfter;
    }

    /**
     * Convert the error to a plain object for logging
     */
    public override toJSON(): Record<string, any> {
        return {
            ...super.toJSON(),
            retryAfter: this.retryAfter,
        };
    }
}

/**
 * Parse API error response into an appropriate SDK error
 * 
 * @param response Fetch Response object
 * @param responseText Error response text
 * @returns Appropriate SDK error
 */
export async function parseApiError(response: Response, responseText?: string): Promise<SDKError> {
    try {
        // Try to parse the error as JSON
        const errorText = responseText || await response.text();
        const errorData = JSON.parse(errorText);

        // Extract common fields
        const message = errorData.message || errorData.error || 'API error occurred';
        const code = mapHttpStatusToErrorCode(response.status, errorData.code);
        // Convert null to undefined for type compatibility
        const requestId = response.headers.get('x-request-id') || errorData.requestId || undefined;

        // Handle rate limiting
        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10) || undefined;
            return new RateLimitError(message, {
                status: response.status,
                details: errorData,
                requestId,
                retryAfter,
            });
        }

        // Handle auth errors
        if (response.status === 401 || response.status === 403) {
            return new AuthError(message, code, {
                status: response.status,
                details: errorData,
                requestId,
            });
        }

        // Handle generic errors
        return new SDKError(message, code, {
            status: response.status,
            details: errorData,
            requestId,
            retryable: isRetryableStatus(response.status),
        });
    } catch (e) {
        // Fallback for non-JSON responses
        return new SDKError(
            responseText || `API error: ${response.status} ${response.statusText}`,
            mapHttpStatusToErrorCode(response.status),
            {
                status: response.status,
                details: { rawError: responseText },
                requestId: response.headers.get('x-request-id') || undefined,
                retryable: isRetryableStatus(response.status),
                cause: e instanceof Error ? e : undefined,
            }
        );
    }
}

/**
 * Map HTTP status code to SDK error code
 */
function mapHttpStatusToErrorCode(status: number, apiCode?: string): ErrorCode {
    // Use API-provided code if available
    if (apiCode && Object.values(ErrorCode).includes(apiCode as ErrorCode)) {
        return apiCode as ErrorCode;
    }

    // Map based on status code
    switch (status) {
        case 400:
            return ErrorCode.INVALID_PARAMETERS;
        case 401:
            return ErrorCode.UNAUTHORIZED;
        case 403:
            return ErrorCode.FORBIDDEN;
        case 404:
            return ErrorCode.RESOURCE_NOT_FOUND;
        case 409:
            return ErrorCode.CONFLICT;
        case 429:
            return ErrorCode.RATE_LIMITED;
        case 500:
        case 502:
        case 503:
        case 504:
            return ErrorCode.SERVER_ERROR;
        default:
            return ErrorCode.UNKNOWN_ERROR;
    }
}

/**
 * Determine if a status code should be retried
 */
function isRetryableStatus(status: number): boolean {
    // 5xx errors and 429 (rate limit) are retryable
    return status === 429 || (status >= 500 && status < 600);
}