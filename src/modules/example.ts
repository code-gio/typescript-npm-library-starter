import { BaseModule } from '../core/base-module';
import { registerModule } from '../core/module-loader';
import { SupaSDKClient } from '../client';

/**
 * Example module to demonstrate the module architecture
 * This pattern should be followed for all new modules
 */
export class ExampleModule extends BaseModule {
    name = 'example';

    /**
     * Get an example item by ID
     * 
     * Routing: API (read operation through secure API)
     * Rationale: All read operations go through API to hide database structure
     * 
     * @param id ID of the item to retrieve
     */
    async getItem(id: string) {
        // Using API for read operations to hide database structure
        return this.apiRequest<any>(`/examples/${id}`, 'GET');
    }

    /**
     * List example items with optional filtering
     * 
     * Routing: API (read operation through secure API)
     * Rationale: All read operations go through API to hide database structure
     * 
     * @param options Optional filtering and pagination
     */
    async listItems(options?: { filter?: string; limit?: number; offset?: number }) {
        // Using API for read operations
        return this.apiRequest<any[]>('/examples', 'GET', options);
    }

    /**
     * Create a new example item
     * 
     * Routing: API (write operation requiring validation)
     * Rationale: All write operations go through API
     * 
     * @param data Item data to create
     */
    async createItem(data: { name: string; description?: string }) {
        // Using API for write operations
        return this.apiRequest<{ id: string }>('/examples', 'POST', data);
    }

    /**
     * Update an existing example item
     * 
     * Routing: API (write operation requiring validation)
     * Rationale: All write operations go through API
     * 
     * @param id ID of the item to update
     * @param data Data to update
     */
    async updateItem(id: string, data: { name?: string; description?: string }) {
        // Using API for write operations
        return this.apiRequest<{ id: string }>(`/examples/${id}`, 'PUT', data);
    }

    /**
     * Delete an example item
     * 
     * Routing: API (write operation requiring validation)
     * Rationale: All write operations go through API
     * 
     * @param id ID of the item to delete
     */
    async deleteItem(id: string) {
        // Using API for write operations
        return this.apiRequest<{ success: boolean }>(`/examples/${id}`, 'DELETE');
    }

    /**
     * Subscribe to changes on an example item
     * 
     * Routing: Direct (read-only real-time subscription)
     * Rationale: Real-time subscriptions use direct Supabase access
     * 
     * @param id ID of the item to subscribe to
     * @param callback Function called on changes
     */
    subscribeToItem(id: string, callback: (item: any) => void) {
        // Using direct Supabase access ONLY for real-time subscriptions
        return this.getSupabase()
            .channel(`item:${id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'examples',
                filter: `id=eq.${id}`
            }, (payload) => {
                callback(payload.new);
            })
            .subscribe();
    }
}

// Register this module in the registry
registerModule({
    name: 'example',
    factory: (client: SupaSDKClient) => new ExampleModule(client),
});