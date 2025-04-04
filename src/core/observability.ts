import { type ApiVersion } from './versioning';

/**
 * Log levels for SDK logging
 */
export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
}

/**
 * SDK event types for telemetry
 */
export enum SDKEventType {
    REQUEST_START = 'request_start',
    REQUEST_END = 'request_end',
    REQUEST_ERROR = 'request_error',
    SUBSCRIPTION_START = 'subscription_start',
    SUBSCRIPTION_END = 'subscription_end',
    SUBSCRIPTION_ERROR = 'subscription_error',
    RATE_LIMIT_HIT = 'rate_limit_hit',
    CONFIGURATION_CHANGE = 'configuration_change',
    CUSTOM_EVENT = 'custom_event',
}

/**
 * Base interface for all SDK events
 */
export interface SDKEvent {
    type: SDKEventType;
    timestamp: number;
    moduleId?: string;
    operationId?: string;
}

/**
 * Request event with detailed timing information
 */
export interface RequestEvent extends SDKEvent {
    type: SDKEventType.REQUEST_START | SDKEventType.REQUEST_END | SDKEventType.REQUEST_ERROR;
    method: string;
    path: string;
    status?: number;
    duration?: number;
    error?: any;
    apiVersion: ApiVersion;
}

/**
 * Rate limit event
 */
export interface RateLimitEvent extends SDKEvent {
    type: SDKEventType.RATE_LIMIT_HIT;
    method: string;
    path: string;
    retryAfter?: number;
    apiVersion: ApiVersion;
}

/**
 * Subscription event
 */
export interface SubscriptionEvent extends SDKEvent {
    type: SDKEventType.SUBSCRIPTION_START | SDKEventType.SUBSCRIPTION_END | SDKEventType.SUBSCRIPTION_ERROR;
    channel: string;
    error?: any;
}

/**
 * Configuration change event
 */
export interface ConfigurationEvent extends SDKEvent {
    type: SDKEventType.CONFIGURATION_CHANGE;
    changes: Record<string, { oldValue?: any; newValue?: any }>;
}

/**
 * Custom event
 */
export interface CustomEvent extends SDKEvent {
    type: SDKEventType.CUSTOM_EVENT;
    name: string;
    properties: Record<string, any>;
}

/**
 * Union type for all possible SDK events
 */
export type AnySDKEvent = RequestEvent | RateLimitEvent | SubscriptionEvent | ConfigurationEvent | CustomEvent;

/**
 * SDK telemetry handler function type
 */
export type TelemetryHandler = (event: AnySDKEvent) => void;

/**
 * SDK logger function type
 */
export type LoggerFunction = (level: LogLevel, message: string, data?: any) => void;

/**
 * Configuration for SDK observability
 */
export interface ObservabilityConfig {
    /**
     * Enable SDK logging
     * @default false in production, true in development
     */
    enableLogging?: boolean;

    /**
     * Minimum log level to record
     * @default LogLevel.INFO
     */
    logLevel?: LogLevel;

    /**
     * Custom logger function
     * If not provided, logs will go to console
     */
    logger?: LoggerFunction;

    /**
     * Enable telemetry events
     * @default false
     */
    enableTelemetry?: boolean;

    /**
     * Custom telemetry handler
     * If telemetry is enabled but no handler is provided,
     * events are logged but not sent anywhere
     */
    telemetryHandler?: TelemetryHandler;
}

/**
 * Observability service for SDK monitoring
 */
export class Observability {
    private static instance: Observability;

    private config: ObservabilityConfig;
    private operationCounter = 0;

    /**
     * Default configuration
     */
    private static readonly DEFAULT_CONFIG: ObservabilityConfig = {
        enableLogging: process.env.NODE_ENV !== 'production',
        logLevel: LogLevel.INFO,
        // logger and telemetryHandler are intentionally omitted
        enableTelemetry: false,
    };

    private constructor(config: ObservabilityConfig = {}) {
        // Initialize with default config and merge with provided config
        this.config = {
            ...Observability.DEFAULT_CONFIG,
            ...config
        };
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): Observability {
        if (!Observability.instance) {
            Observability.instance = new Observability();
        }

        return Observability.instance;
    }

    /**
     * Configure the observability service
     * 
     * @param config Observability configuration
     */
    public configure(config: ObservabilityConfig): void {
        const oldConfig = { ...this.config };

        // Create a copy of the current config and merge with new config
        this.config = {
            ...this.config,
            ...config
        };

        // Log configuration changes
        const changes: Record<string, { oldValue?: any; newValue?: any }> = {};

        for (const [key, value] of Object.entries(config)) {
            if (oldConfig[key as keyof ObservabilityConfig] !== value) {
                changes[key] = {
                    oldValue: oldConfig[key as keyof ObservabilityConfig],
                    newValue: value,
                };
            }
        }

        if (Object.keys(changes).length > 0) {
            this.emitEvent({
                type: SDKEventType.CONFIGURATION_CHANGE,
                timestamp: Date.now(),
                changes,
            });

            this.log(LogLevel.DEBUG, 'Observability configuration changed', changes);
        }
    }

    /**
     * Generate a unique operation ID
     */
    public generateOperationId(): string {
        return `op_${Date.now()}_${++this.operationCounter}`;
    }

    /**
     * Log a message
     * 
     * @param level Log level
     * @param message Log message
     * @param data Additional data
     */
    public log(level: LogLevel, message: string, data?: any): void {
        if (this.config.enableLogging === false) {
            return;
        }

        const logLevels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const configLevelIndex = logLevels.indexOf(this.config.logLevel || LogLevel.INFO);
        const messageLevelIndex = logLevels.indexOf(level);

        // Only log if message level is >= configured level
        if (messageLevelIndex >= configLevelIndex) {
            if (this.config.logger) {
                this.config.logger(level, message, data);
            } else {
                const timestamp = new Date().toISOString();
                const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

                switch (level) {
                    case LogLevel.DEBUG:
                        console.debug(formattedMessage, data);
                        break;
                    case LogLevel.INFO:
                        console.info(formattedMessage, data);
                        break;
                    case LogLevel.WARN:
                        console.warn(formattedMessage, data);
                        break;
                    case LogLevel.ERROR:
                        console.error(formattedMessage, data);
                        break;
                }
            }
        }
    }

    /**
     * Emit a telemetry event
     * 
     * @param event SDK event
     */
    public emitEvent(event: AnySDKEvent): void {
        if (this.config.enableTelemetry !== true) {
            return;
        }

        // Add timestamp if not already present
        if (!event.timestamp) {
            event.timestamp = Date.now();
        }

        // Send to telemetry handler if configured
        if (this.config.telemetryHandler) {
            try {
                this.config.telemetryHandler(event);
            } catch (error) {
                this.log(LogLevel.ERROR, 'Error in telemetry handler', { error, event });
            }
        } else {
            // Log event if no handler is configured but telemetry is enabled
            this.log(LogLevel.DEBUG, 'SDK Event', event);
        }
    }
}

/**
 * Get the global observability instance
 */
export function getObservability(): Observability {
    return Observability.getInstance();
}