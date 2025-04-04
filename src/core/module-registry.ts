import type { ModuleConfig } from './types';

/**
 * Registry of all available SDK modules
 * Modules register themselves by adding to this array
 */
export const moduleRegistry: ModuleConfig[] = [];