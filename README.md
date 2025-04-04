# HyvSDK

A modular, extensible SDK for securely interacting with your backend services and Supabase database.

## Overview

HyvSDK provides a unified interface for frontend applications to interact with your system through a secure, modular architecture. It intelligently routes operations either through your backend API (for most operations) or directly to Supabase (for real-time subscriptions only).

## Features

- **Modular Architecture**: Easily extensible with a plugin-based system
- **Secure by Design**: All writes and data reads go through your secure backend API
- **Real-time Support**: Direct subscriptions to database changes through Supabase
- **Enterprise-Ready**: Built-in versioning, error handling, rate limiting, and observability
- **TypeScript-First**: Full type safety with comprehensive TypeScript definitions
- **Analytics Integration**: Track SDK usage patterns automatically

## Installation

```bash
npm install @mindhyv/sdk
# or
yarn add @mindhyv/sdk
# or
pnpm add @mindhyv/sdk
```

## Quick Start

```typescript
import { createClient } from '@mindhyv/sdk';

// Initialize the SDK
const sdk = createClient({
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-anon-key',
  apiUrl: 'https://your-api.example.com',
});

// After user authentication, set the auth token
sdk.setAuthToken(userSession.accessToken);

// Use modules
const profiles = sdk.module('hyvsync');
const connect = sdk.module('hyvconnect');

// Example: Get profile information
const myProfile = await profiles.getMyProfile();

// Example: Subscribe to real-time updates
const subscription = connect.subscribeToMessages('room-id', (message) => {
  console.log('New message:', message);
});
```

## Architecture

HyvSDK follows a modular, plugin-based architecture that separates concerns and enforces secure access patterns:

- **Core Client**: Manages module loading, authentication, and API routing
- **Modules**: Self-contained feature sets that register themselves with the SDK
- **Direct Operations**: Only used for real-time subscriptions via Supabase
- **API Operations**: Used for all data reads and writes through your secure backend

See the [Architecture Guide](./docs/ARCHITECTURE.md) for more details.

## Available Modules

HyvSDK comes with several built-in modules:

- **hyvsync**: Profile management and social media functionality
- **hyvconnect**: Chat and user connections functionality
- **analytics**: Usage tracking and event reporting

For detailed information on using these modules, please refer to our online documentation.

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on adding new modules, fixing bugs, and the development workflow.

## Development Rules

To maintain consistency and security, all SDK development follows specific guidelines:

- All reading operations except real-time subscriptions go through the backend API
- All writing operations go through the backend API
- Clear separation of concerns between modules
- Comprehensive error handling and typed responses

See the [Development Rules](./docs/RULES.md) for the complete set of development guidelines.

## License

[MIT](./LICENSE)