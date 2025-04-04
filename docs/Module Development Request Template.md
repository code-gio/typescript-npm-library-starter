# Module Development Request Template

Use this template when requesting a new module for the HyvSDK. Fill out each section with as much detail as possible to ensure the module meets your requirements and follows our SDK architecture standards.

## Client Requirements

[Provide a clear description of what the client needs this module to accomplish. Include specific features, data types, and any integration points with existing systems.]

## Module Name

[Suggested name for the module following our 'hyv' prefix convention, e.g., hyvpayments, hyvanalytics]

## Key Operations

[List the primary operations this module should support, such as:
- Getting data of type X
- Creating records of type Y
- Updating Z information
- Real-time notifications for events]

## Data Types

[Define the primary data structures this module will work with:
- What objects/entities are involved?
- What fields/properties are required?
- What relationships exist between different data types?]

## Security Considerations

[Note any specific security requirements:
- What permissions are required?
- Are there sensitive operations that need special handling?
- Any rate limiting concerns?]

## Routing Strategy

[Indicate which operations should use the API vs. direct Supabase access, remembering our rule that only subscriptions use direct access]

## Integration Points

[Describe how this module will interact with:
- Other SDK modules
- External APIs
- Supabase tables/functions]

## Response Examples

[Provide sample response structures that users of the module should expect]

## Additional Context

[Any other relevant information about the client's use case or technical environment]

---

## Example (Payment Module)

Here's an example of a completed request for a payments module:

### Client Requirements

Our client needs a module to handle payment processing and subscription management. They're using Stripe for payment processing and need to store payment methods, track subscriptions, and handle usage-based billing.

### Module Name

hyvpayments

### Key Operations

- List saved payment methods
- Add a new payment method
- Set default payment method
- Remove payment method
- Get subscription details
- Change subscription plan
- Cancel subscription
- Get invoice history
- Subscribe to payment events (successful payments, failed payments)

### Data Types

**PaymentMethod**
```typescript
interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  last4: string;
  expMonth?: number; // Only for cards
  expYear?: number;  // Only for cards
  isDefault: boolean;
  createdAt: string;
}
```

**Subscription**
```typescript
interface Subscription {
  id: string;
  planId: string;
  planName: string;
  status: 'active' | 'canceled' | 'past_due';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paymentMethodId: string;
}
```

**Invoice**
```typescript
interface Invoice {
  id: string;
  amount: number;
  status: 'paid' | 'open' | 'failed';
  createdAt: string;
  paidAt?: string;
  lineItems: Array<{
    description: string;
    amount: number;
  }>;
}
```

### Security Considerations

- All payment operations should require authentication
- Stripe API keys must be kept secure on the backend
- Payment method information should never be exposed directly to the client
- Rate limiting should be applied to prevent abuse

### Routing Strategy

- All operations should go through the backend API for security
- Only payment event subscriptions should use direct Supabase access

### Integration Points

- Will interact with Stripe API through our backend
- Needs to store payment references in Supabase tables
- Should integrate with the notification system for payment alerts
- May need to interact with the user profile module to update subscription status

### Response Examples

**Get Payment Methods Response**
```json
{
  "data": [
    {
      "id": "pm_123456",
      "type": "card",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2025,
      "isDefault": true,
      "createdAt": "2023-05-15T14:23:45Z"
    }
  ]
}
```

### Additional Context

The client is migrating from a legacy payment system and needs to maintain historical invoice data. They also need webhooks to be set up to handle payment events from Stripe.