import { BaseModule } from '../core/base-module';
import { registerModule } from '../core/module-loader';
import { SupaSDKClient } from '../client';
import { type AnySDKEvent, type CustomEvent, getObservability, LogLevel, SDKEventType, type TelemetryHandler } from '../core/observability';

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
    /**
     * Whether to automatically enable analytics
     * @default true
     */
    enabled?: boolean;

    /**
     * Enable event batching to reduce API calls
     * @default true
     */
    batchEvents?: boolean;

    /**
     * Batch size before sending events
     * @default 10
     */
    batchSize?: number;

    /**
     * Maximum time (ms) to hold events before sending
     * @default 5000 (5 seconds)
     */
    flushInterval?: number;

    /**
     * Add additional context to events
     * @default {}
     */
    globalContext?: Record<string, any>;
}

/**
 * Analytics module for tracking SDK usage and events
 */
export class AnalyticsModule extends BaseModule {
    name = 'analytics';

    private config: Required<AnalyticsConfig>;
    private eventQueue: AnySDKEvent[] = [];
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private telemetryHandler: TelemetryHandler | null = null;
    private sessionId: string;
    private isEnabled: boolean;

    // Default configuration
    private static readonly DEFAULT_CONFIG: Required<AnalyticsConfig> = {
        enabled: true,
        batchEvents: true,
        batchSize: 10,
        flushInterval: 5000,
        globalContext: {},
    };

    constructor(client: SupaSDKClient) {
        super(client);

        // Generate session ID
        this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Initialize with default config
        this.config = { ...AnalyticsModule.DEFAULT_CONFIG };

        // Disabled by default until initialized
        this.isEnabled = false;
    }

    /**
     * Initialize analytics with configuration
     * 
     * Routing: N/A (Client-side configuration)
     * 
     * @param config Analytics configuration
     */
    public initialize(config: AnalyticsConfig = {}): void {
        // Merge with default config
        this.config = {
            ...AnalyticsModule.DEFAULT_CONFIG,
            ...config,
        };

        // Set enabled state from config
        this.isEnabled = this.config.enabled;

        // Create and register telemetry handler
        this.telemetryHandler = (event: AnySDKEvent) => this.handleEvent(event);

        // Register the handler with observability system
        if (this.isEnabled) {
            this.enable();
        }

        getObservability().log(LogLevel.INFO, 'Analytics module initialized', {
            batchEvents: this.config.batchEvents,
            batchSize: this.config.batchSize,
            flushInterval: this.config.flushInterval,
        });
    }

    /**
     * Enable analytics collection
     * 
     * Routing: N/A (Client-side configuration)
     */
    public enable(): void {
        if (!this.isEnabled && this.telemetryHandler) {
            getObservability().configure({
                enableTelemetry: true,
                telemetryHandler: this.telemetryHandler,
            });

            this.isEnabled = true;

            // Start flush timer if batching is enabled
            if (this.config.batchEvents) {
                this.startFlushTimer();
            }

            getObservability().log(LogLevel.INFO, 'Analytics collection enabled');
        }
    }

    /**
     * Disable analytics collection
     * 
     * Routing: N/A (Client-side configuration)
     */
    public disable(): void {
        if (this.isEnabled) {
            getObservability().configure({
                enableTelemetry: false,
            });

            this.isEnabled = false;

            // Stop flush timer if it exists
            if (this.flushTimer) {
                clearTimeout(this.flushTimer);
                this.flushTimer = null;
            }

            // Flush any pending events
            this.flush();

            getObservability().log(LogLevel.INFO, 'Analytics collection disabled');
        }
    }

    /**
     * Track a custom event
     * 
     * Routing: API (Write operation)
     * Rationale: Persists data to the server
     * 
     * @param eventName Name of the event
     * @param properties Event properties
     */
    public async track(eventName: string, properties: Record<string, any> = {}): Promise<void> {
        if (!this.isEnabled) {
            return;
        }

        const event: CustomEvent = {
            type: SDKEventType.CUSTOM_EVENT,
            name: eventName,
            properties,
            timestamp: Date.now(),
        };

        this.handleEvent(event);
    }

    /**
     * Set persistent user properties
     * 
     * Routing: API (Write operation)
     * Rationale: Updates user data on the server
     * 
     * @param userId User identifier
     * @param properties User properties
     */
    public async identify(userId: string, properties: Record<string, any> = {}): Promise<void> {
        if (!this.isEnabled) {
            return;
        }

        await this.apiRequest('/analytics/identify', 'POST', {
            user_id: userId,
            properties,
            session_id: this.sessionId,
        });

        // Update global context with user info
        this.config.globalContext = {
            ...this.config.globalContext,
            user_id: userId,
        };

        getObservability().log(LogLevel.DEBUG, 'User identified', { userId });
    }

    /**
     * Get analytics data for a specific period
     * 
     * Routing: API (Read operation through secure API)
     * Rationale: Access to analytics data requires authentication and authorization
     * 
     * @param options Query options
     */
    public async getAnalytics(options: {
        startDate?: string;
        endDate?: string;
        eventTypes?: string[];
    } = {}): Promise<any> {
        return this.apiRequest('/analytics/data', 'GET', options);
    }

    /**
     * Flush any pending events to the server
     * 
     * Routing: N/A (Client-side operation)
     */
    public async flush(): Promise<void> {
        if (this.eventQueue.length === 0) {
            return;
        }

        // Make a copy of the current queue and clear it
        const events = [...this.eventQueue];
        this.eventQueue = [];

        // Process the events
        try {
            await this.persistEvents(events);
            getObservability().log(LogLevel.DEBUG, 'Flushed analytics events', { count: events.length });
        } catch (error) {
            // On error, put events back in the queue
            this.eventQueue = [...events, ...this.eventQueue];
            getObservability().log(LogLevel.ERROR, 'Failed to flush analytics events', error);
        }
    }

    /**
     * Handle an incoming event
     * @private
     */
    private handleEvent(event: AnySDKEvent): void {
        if (!this.isEnabled) {
            return;
        }

        // Add global context to the event
        const enrichedEvent = {
            ...event,
            context: {
                ...this.config.globalContext,
                session_id: this.sessionId,
            },
        };

        if (this.config.batchEvents) {
            // Add to queue
            this.eventQueue.push(enrichedEvent);

            // Flush if we've reached the batch size
            if (this.eventQueue.length >= this.config.batchSize) {
                this.flush();
            }
        } else {
            // Send immediately
            this.persistEvents([enrichedEvent]).catch(error => {
                getObservability().log(LogLevel.ERROR, 'Failed to persist analytics event', error);
            });
        }
    }

    /**
     * Persist events to the server
     * @private
     */
    private async persistEvents(events: AnySDKEvent[]): Promise<void> {
        if (events.length === 0) {
            return;
        }

        await this.apiRequest('/analytics/events', 'POST', {
            events,
            session_id: this.sessionId,
        });
    }

    /**
     * Start the flush timer
     * @private
     */
    private startFlushTimer(): void {
        // Clear existing timer if there is one
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
        }

        // Set new timer
        this.flushTimer = setTimeout(() => {
            this.flush().finally(() => {
                // Restart timer if still enabled
                if (this.isEnabled) {
                    this.startFlushTimer();
                }
            });
        }, this.config.flushInterval);
    }
}

// Register this module in the registry
registerModule({
    name: 'analytics',
    factory: (client: SupaSDKClient) => new AnalyticsModule(client),
});