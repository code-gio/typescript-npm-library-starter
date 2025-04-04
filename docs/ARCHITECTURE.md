# HyvSDK Architecture Guide

This document explains the architecture of HyvSDK, its design principles, and how the various components interact.

## Design Philosophy

HyvSDK is built on several key principles:

1. **Security First**: Sensitive operations go through a secure backend
2. **Modular Design**: Features are encapsulated in self-contained modules
3. **Consistent Patterns**: Common approaches for error handling, versioning, etc.
4. **Developer Experience**: Clear APIs and comprehensive type definitions
5. **Scalability**: Architecture supports hundreds of tools without becoming unwieldy

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Front-End App                       │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                         HyvSDK                           │
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐    │
│  │ Core Client │ │ Module      │ │ Observability   │    │
│  └─────┬───────┘ │ Registry    │ └─────────────────┘    │
│        │         └──────┬──────┘                        │
│        │                │                               │
│  ┌─────▼────────────────▼────────────────────────────┐  │
│  │                                                    │  │
│  │  ┌──────────┐  ┌───────────┐  ┌───────────────┐   │  │
│  │  │ HyvSync  │  │HyvConnect │  │ Other Modules │   │  │
│  │  └──────────┘  └───────────┘  └───────────────┘   │  │
│  │                                                    │  │
│  └────────────────────────┬───────────────────────────┘  │
│                           │                              │
└───────────────────────────┼──────────────────────────────┘
                            │
                   ┌────────┴───────┐
                   ▼                ▼
┌─────────────────────────┐ ┌──────────────────────┐
│   Direct to Supabase    │ │  Backend API Server  │
│   (Only Subscriptions)  │ │  (All Other Ops)     │
└─────────────────────────┘ └──────────────────────┘
```

## Core Components

### Client

The SDK client is the main entry point and coordinates all operations:

- Manages module loading and initialization
- Handles authentication tokens
- Routes operations to the appropriate destination (API or Supabase)
- Implements versioning, error handling, and rate limiting

```typescript
const sdk = createClient({
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-anon-key',
  apiUrl: 'https://your-api.example.com',
  apiVersion: 'v1', // Optional
  rateLimit: { maxRetries: 3 }, // Optional
  observability: { enableLogging: true } // Optional
});
```

### Module System

Modules are self-contained feature sets that register themselves with the SDK:

- Each module focuses on a specific domain (e.g., profiles, messaging)
- Modules handle both API and direct Supabase operations
- Modules are loaded dynamically at initialization
- Module factories allow for dependency injection

```typescript
// How modules are registered
registerModule({
  name: 'example',
  factory: (client) => new ExampleModule(client),
});

// How modules are used
const example = sdk.module('example');
```

### Base Module

All modules extend the `BaseModule` class which provides common functionality:

- Access to the Supabase client (for subscriptions)
- Standardized API request method
- Consistent error handling
- Type safety

### Routing Logic

Operations are routed based on strict rules:

- **Direct to Supabase**: Only real-time subscriptions
- **Through Backend API**: All reads and writes

This separation ensures security and maintainability.

## Advanced Features

### Versioning

The SDK supports versioned API endpoints for backward compatibility:

```typescript
// Set version on initialization
// Set version on initialization
const sdk = createClient({ 
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-anon-key',
  apiUrl: 'https://your-api.example.com',
  apiVersion: 'v2' 
});

// Or change version later
sdk.setApiVersion('v2');

// Or change version later
sdk.setApiVersion('v2');
```

### Error Handling

Comprehensive error handling with standardized error types:

- `SDKError`: Base error class with code, details, etc.
- `NetworkError`: For connectivity issues
- `AuthError`: For authentication failures
- `RateLimitError`: For rate limiting

### Observability

Built-in logging and telemetry for monitoring SDK usage:

```typescript
// Configure observability
sdk.configure({
  observability: {
    enableLogging: true,
    logLevel: 'info',
    enableTelemetry: true,
    telemetryHandler: (event) => {
      // Custom telemetry handling
    }
  }
});
```

### Rate Limiting

Automatic handling of rate limits with exponential backoff:

```typescript
// Configure rate limiting
sdk.configure({
  rateLimit: {
    enableRetry: true,
    maxRetries: 3,
    baseDelay: 1000,
  }
});
```

## Flow of Operations

1. Application calls a method on a module
2. Module determines routing (API for everything except subscriptions)
3. For API calls:
   - Request is versioned
   - Authentication token is added
   - Rate limiting is applied
   - Request is sent to backend
   - Response is parsed and typed
   - Errors are standardized
4. For subscriptions:
   - Direct connection to Supabase is established
   - Real-time updates are received
   - Updates are passed to callback

## Code Organization

```
/sdk
├── /src
│   ├── /core              # Core SDK functionality
│   │   ├── types.ts       # Type definitions
│   │   ├── base-module.ts # Base module class
│   │   ├── errors.ts      # Error handling
│   │   ├── versioning.ts  # API versioning
│   │   ├── rate-limiting.ts # Rate limiting
│   │   ├── observability.ts # Logging and telemetry
│   │   ├── module-loader.ts # Module loading
│   │   └── module-registry.ts # Module registration
│   │
│   ├── /modules           # SDK modules
│   │   ├── hyvsync.ts     # Profile management
│   │   ├── hyvconnect.ts  # Chat and connections
│   │   ├── analytics.ts   # Analytics module
│   │   └── ...            # Other modules
│   │
│   ├── client.ts          # Main SDK client
│   └── index.ts           # Entry point
│
├── package.json
└── tsconfig.json
```

This architecture provides a solid foundation for adding new features while maintaining security, performance, and developer experience.