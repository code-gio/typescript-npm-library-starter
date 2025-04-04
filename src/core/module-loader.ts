import { SupaSDKClient } from '../client';
import type { SDKModule, ModuleConfig } from './types';
import { moduleRegistry } from './module-registry';

/**
 * Loads and initializes all registered SDK modules
 * 
 * @param client The SDK client instance
 * @returns Record of initialized modules
 */
export function loadModules(client: SupaSDKClient): Record<string, SDKModule> {
    const modules: Record<string, SDKModule> = {};

    // Load each registered module
    for (const config of moduleRegistry) {
        const module = config.factory(client);
        modules[config.name] = module;
    }

    return modules;
}

/**
 * Helper function to register a new module
 * This is used internally by module implementations
 * 
 * @param config Module configuration
 */
export function registerModule(config: ModuleConfig): void {
    // Check for duplicate module names
    const existingModule = moduleRegistry.find(m => m.name === config.name);
    if (existingModule) {
        throw new Error(`Module with name "${config.name}" is already registered`);
    }

    moduleRegistry.push(config);
}