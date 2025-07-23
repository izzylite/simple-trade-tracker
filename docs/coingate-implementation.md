# Coingate Payment Gateway Implementation Guide

## Overview
This document outlines the complete implementation of Coingate payment gateway for the Simple Trade Tracker application with a three-tier subscription system.

## Subscription Plans

### 1. Basic Plan (Free)
- Limited image upload: 500KB max
- Trade entries: 100 per calendar
- Maximum calendars: 10
- No premium features

### 2. Premium Plan ($19.99/month)
- Everything in Basic plus:
- Economic Events access
- AI Assistant with 600 credit tokens
- Image upload: 1MB max
- Trade entries: 500 per calendar
- Maximum calendars: 50

### 3. Pro Plan ($39.99/month)
- Everything in Premium plus:
- AI Assistant with 1500 credit tokens
- Trade entries: 1000 per calendar
- Maximum calendars: 100

## 🗺️ Implementation Roadmap

### **Day 1: Core Infrastructure** ⏱️ 6-8 hours
- [ ] **1.1** Create subscription TypeScript types (`src/types/subscription.ts`)
- [ ] **1.2** Create Coingate order types and interfaces
- [ ] **1.3** Set up Firestore database schema and security rules
- [ ] **1.4** Create subscription limits configuration (`src/config/subscriptionLimits.ts`)
- [ ] **1.5** Implement basic Coingate service (`src/services/coingateService.ts`)
- [ ] **1.6** Create subscription context (`src/contexts/SubscriptionContext.tsx`)
- [ ] **1.7** Create subscription limits hook (`src/hooks/useSubscriptionLimits.ts`)
- [ ] **1.8** Add environment variables for Coingate

### **Day 2: Backend Functions** ⏱️ 4-6 hours
- [ ] **2.1** Create `createSubscriptionOrder` Cloud Function
- [ ] **2.2** Implement Coingate webhook handler
- [ ] **2.3** Create subscription activation function
- [ ] **2.4** Implement subscription cancellation function
- [ ] **2.5** Create usage tracking functions
- [ ] **2.6** Add webhook signature verification
- [ ] **2.7** Implement rate limiting middleware
- [ ] **2.8** Add comprehensive error handling

### **Day 3: Frontend Components** ⏱️ 6-8 hours
- [ ] **3.1** Create subscription plans component (`SubscriptionPlans.tsx`)
- [ ] **3.2** Build payment modal component (`PaymentModal.tsx`)
- [ ] **3.3** Create subscription status dashboard (`SubscriptionStatus.tsx`)
- [ ] **3.4** Implement usage meters (`UsageMeter.tsx`)
- [ ] **3.5** Create upgrade prompts (`UpgradePrompt.tsx`)
- [ ] **3.6** Build billing history component (`BillingHistory.tsx`)
- [ ] **3.7** Update navigation to include subscription menu
- [ ] **3.8** Add subscription route and page

### **Day 4: Feature Gating Integration** ⏱️ 4-6 hours
- [ ] **4.1** Update `TradeForm.tsx` with image size limits
- [ ] **4.2** Modify calendar creation with limits enforcement
- [ ] **4.3** Update AI chat components with token limits
- [ ] **4.4** Gate Economic Events behind premium subscription
- [ ] **4.5** Add limit checks to trade creation
- [ ] **4.6** Implement usage tracking in existing services
- [ ] **4.7** Update `calendarService.ts` with subscription checks
- [ ] **4.8** Add subscription validation to all relevant operations

### **Day 5: Testing & Polish** ⏱️ 2-4 hours
- [ ] **5.1** Test complete payment flow in sandbox
- [ ] **5.2** Test subscription upgrades and downgrades
- [ ] **5.3** Test limit enforcement across all features
- [ ] **5.4** Test webhook processing and subscription activation
- [ ] **5.5** Add error boundaries and user feedback
- [ ] **5.6** Implement loading states and optimistic updates
- [ ] **5.7** Add analytics tracking for subscription events
- [ ] **5.8** Final code review and documentation updates

### **Bonus Features** (Optional)
- [ ] **B.1** Implement subscription analytics dashboard
- [ ] **B.2** Add email notifications for subscription events
- [ ] **B.3** Create admin panel for subscription management
- [ ] **B.4** Implement proration for plan changes
- [ ] **B.5** Add referral system for subscription discounts

---

## 📊 Progress Tracking

**Overall Progress: 0/40 tasks completed (0%)**

### Daily Progress
- **Day 1**: 0/8 tasks completed
- **Day 2**: 0/8 tasks completed
- **Day 3**: 0/8 tasks completed
- **Day 4**: 0/8 tasks completed
- **Day 5**: 0/8 tasks completed

### Feature Categories
- **🏗️ Infrastructure**: 0/8 tasks completed
- **⚙️ Backend**: 0/8 tasks completed
- **🎨 Frontend**: 0/8 tasks completed
- **🔒 Integration**: 0/8 tasks completed
- **🧪 Testing**: 0/8 tasks completed

---

## Implementation Steps

### Phase 1: Database Schema & Types

#### 1.1 Create User Subscription Types
```typescript
// src/types/subscription.ts
export interface UserSubscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  coingateOrderId?: string;
  coingatePaymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionPlan = 'basic' | 'premium' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';

export interface SubscriptionLimits {
  maxImageSize: number; // in bytes
  maxTradesPerCalendar: number;
  maxCalendars: number;
  aiTokenCredits: number;
  hasEconomicEvents: boolean;
}

export interface CoingateOrder {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  amount: number;
  currency: string;
  status: CoingateOrderStatus;
  paymentUrl: string;
  orderId: string;
  createdAt: Date;
  expiresAt: Date;
}

export type CoingateOrderStatus = 'new' | 'pending' | 'confirming' | 'paid' | 'invalid' | 'expired' | 'canceled' | 'refunded';
```

#### 1.2 Firestore Collections Structure
```
users/{userId}/subscription (document)
├── plan: string
├── status: string
├── currentPeriodStart: timestamp
├── currentPeriodEnd: timestamp
├── cancelAtPeriodEnd: boolean
├── coingateOrderId: string
├── aiTokensRemaining: number
├── createdAt: timestamp
└── updatedAt: timestamp

coingate_orders/{orderId} (document)
├── userId: string
├── plan: string
├── amount: number
├── currency: string
├── status: string
├── paymentUrl: string
├── coingateOrderId: string
├── createdAt: timestamp
└── expiresAt: timestamp

subscription_usage/{userId} (document)
├── currentPeriod: string
├── aiTokensUsed: number
├── lastResetDate: timestamp
└── usage: map
    ├── calendarsCount: number
    └── tradesPerCalendar: map
```

### Phase 2: Coingate Integration

#### 2.1 Environment Variables
Add to `.env`:
```
COINGATE_API_KEY=your_coingate_api_key
COINGATE_APP_ID=your_coingate_app_id
COINGATE_API_SECRET=your_coingate_api_secret
COINGATE_ENVIRONMENT=sandbox # or live
COINGATE_WEBHOOK_SECRET=your_webhook_secret
```

#### 2.2 Coingate Service Implementation
```typescript
// src/services/coingateService.ts
export class CoingateService {
  private apiKey: string;
  private apiSecret: string;
  private appId: string;
  private baseUrl: string;

  async createOrder(orderData: CoingateOrderRequest): Promise<CoingateOrderResponse>
  async getOrder(orderId: string): Promise<CoingateOrderResponse>
  async listOrders(params?: CoingateListParams): Promise<CoingateOrderResponse[]>
  private generateSignature(payload: string): string
  private makeRequest(endpoint: string, method: string, data?: any): Promise<any>
}
```

#### 2.3 Firebase Cloud Functions for Coingate

##### 2.3.1 Create Subscription Order
```typescript
// functions/src/coingate/createSubscriptionOrder.ts
export const createSubscriptionOrder = onCall(async (request) => {
  // Validate user authentication
  // Create Coingate order
  // Store order in Firestore
  // Return payment URL
});
```

##### 2.3.2 Webhook Handler
```typescript
// functions/src/coingate/webhook.ts
export const coingateWebhook = onRequest(async (req, res) => {
  // Verify webhook signature
  // Process payment status updates
  // Update user subscription
  // Handle subscription activation/cancellation
});
```

##### 2.3.3 Subscription Management Functions
```typescript
// functions/src/subscription/
- checkSubscriptionLimits.ts
- updateSubscriptionUsage.ts
- cancelSubscription.ts
- renewSubscription.ts
```

### Phase 3: Frontend Implementation

#### 3.1 Subscription Context
```typescript
// src/contexts/SubscriptionContext.tsx
export interface SubscriptionContextType {
  subscription: UserSubscription | null;
  limits: SubscriptionLimits;
  usage: SubscriptionUsage;
  loading: boolean;
  createOrder: (plan: SubscriptionPlan) => Promise<string>;
  cancelSubscription: () => Promise<void>;
  checkLimit: (feature: string) => boolean;
  refreshSubscription: () => Promise<void>;
}
```

#### 3.2 Subscription Components
```
src/components/subscription/
├── SubscriptionPlans.tsx
├── PaymentModal.tsx
├── SubscriptionStatus.tsx
├── UsageMeter.tsx
├── UpgradePrompt.tsx
└── BillingHistory.tsx
```

#### 3.3 Limit Enforcement Components
```
src/components/limits/
├── ImageUploadLimiter.tsx
├── CalendarLimiter.tsx
├── TradeLimiter.tsx
└── AITokenLimiter.tsx
```

### Phase 4: Feature Gating

#### 4.1 Hook for Subscription Checks
```typescript
// src/hooks/useSubscriptionLimits.ts
export const useSubscriptionLimits = () => {
  const { subscription, limits, usage } = useSubscription();
  
  const canUploadImage = (fileSize: number) => fileSize <= limits.maxImageSize;
  const canCreateCalendar = () => usage.calendarsCount < limits.maxCalendars;
  const canAddTrade = (calendarId: string) => {
    const calendarTrades = usage.tradesPerCalendar[calendarId] || 0;
    return calendarTrades < limits.maxTradesPerCalendar;
  };
  const canUseAI = (tokensNeeded: number) => {
    return usage.aiTokensRemaining >= tokensNeeded;
  };
  const hasEconomicEvents = () => limits.hasEconomicEvents;
  
  return {
    canUploadImage,
    canCreateCalendar,
    canAddTrade,
    canUseAI,
    hasEconomicEvents,
    limits,
    usage
  };
};
```

#### 4.2 Update Existing Services
- Modify `calendarService.ts` to check calendar limits
- Update `TradeForm.tsx` to enforce image size and trade limits
- Modify AI chat components to check token limits
- Update economic calendar to check premium access

### Phase 5: Security & Validation

#### 5.1 Server-side Validation
- All subscription checks must be validated server-side
- Cloud Functions should verify limits before operations
- Webhook signature verification for Coingate

#### 5.2 Rate Limiting
- Implement rate limiting for subscription operations
- Prevent abuse of free tier features

### Phase 6: Testing Strategy

#### 6.1 Unit Tests
- Test subscription limit calculations
- Test Coingate service methods
- Test webhook processing

#### 6.2 Integration Tests
- Test complete payment flow
- Test subscription upgrades/downgrades
- Test limit enforcement

#### 6.3 E2E Tests
- Test user journey from free to paid
- Test payment success/failure scenarios
- Test subscription cancellation flow

### Phase 7: Monitoring & Analytics

#### 7.1 Metrics to Track
- Subscription conversion rates
- Payment success/failure rates
- Feature usage by plan
- Churn analysis

#### 7.2 Error Handling
- Payment failures
- Webhook delivery failures
- Subscription sync issues

## Recommendations

### 1. Gradual Rollout
- Start with sandbox environment
- Implement feature flags for subscription features
- Beta test with limited users

### 2. User Experience Enhancements
- Clear upgrade prompts when limits are reached
- Usage dashboards for users
- Email notifications for subscription events

### 3. Business Intelligence
- A/B test different pricing strategies
- Track feature adoption by plan
- Monitor support tickets by subscription tier

### 4. Technical Considerations
- Implement caching for subscription data
- Use Firebase Extensions for additional functionality
- Consider implementing proration for plan changes

### 5. Compliance & Legal
- Implement proper refund handling
- Add terms of service for subscriptions
- Ensure GDPR compliance for billing data

## Next Steps

1. Set up Coingate account and obtain API credentials
2. Implement database schema changes
3. Create basic subscription types and context
4. Implement Coingate service and cloud functions
5. Build subscription management UI
6. Implement feature gating throughout the app
7. Test thoroughly in sandbox environment
8. Deploy to production with monitoring

## Estimated Timeline
- Phase 1-2: 1-2 weeks
- Phase 3-4: 2-3 weeks  
- Phase 5-6: 1-2 weeks
- Phase 7 & Polish: 1 week

**Total: 5-8 weeks for complete implementation**

## Detailed Implementation Examples

### Coingate API Integration Example

```typescript
// src/services/coingateService.ts
import crypto from 'crypto';

export interface CoingateOrderRequest {
  order_id: string;
  price_amount: number;
  price_currency: string;
  receive_currency: string;
  title: string;
  description: string;
  callback_url: string;
  cancel_url: string;
  success_url: string;
  token: string;
}

export class CoingateService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly appId: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.COINGATE_API_KEY!;
    this.apiSecret = process.env.COINGATE_API_SECRET!;
    this.appId = process.env.COINGATE_APP_ID!;
    this.baseUrl = process.env.COINGATE_ENVIRONMENT === 'live'
      ? 'https://api.coingate.com/v2'
      : 'https://api-sandbox.coingate.com/v2';
  }

  async createOrder(orderData: CoingateOrderRequest): Promise<any> {
    const endpoint = '/orders';
    return this.makeRequest(endpoint, 'POST', orderData);
  }

  async getOrder(orderId: string): Promise<any> {
    const endpoint = `/orders/${orderId}`;
    return this.makeRequest(endpoint, 'GET');
  }

  private generateSignature(payload: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');
  }

  private async makeRequest(endpoint: string, method: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    let body = '';
    if (data) {
      body = JSON.stringify(data);
    }

    const message = timestamp + method + endpoint + body;
    const signature = this.generateSignature(message);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'CG-Access-Timestamp': timestamp,
      'CG-Access-Signature': signature,
      'CG-Access-Nonce': nonce,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: data ? body : undefined,
    });

    if (!response.ok) {
      throw new Error(`Coingate API error: ${response.statusText}`);
    }

    return response.json();
  }
}
```

### Firebase Cloud Function Examples

```typescript
// functions/src/subscription/createSubscriptionOrder.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { CoingateService } from '../services/coingateService';
import { getFirestore } from 'firebase-admin/firestore';

export const createSubscriptionOrder = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { plan } = request.data;
  const userId = request.auth.uid;

  if (!['premium', 'pro'].includes(plan)) {
    throw new HttpsError('invalid-argument', 'Invalid subscription plan');
  }

  const planPrices = {
    premium: 9.99,
    pro: 19.99
  };

  const orderId = `sub_${userId}_${Date.now()}`;
  const coingateService = new CoingateService();

  try {
    const orderData = {
      order_id: orderId,
      price_amount: planPrices[plan],
      price_currency: 'USD',
      receive_currency: 'USD',
      title: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Subscription`,
      description: `Monthly subscription to ${plan} plan`,
      callback_url: `${process.env.FUNCTION_URL}/coingateWebhook`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription?status=cancelled`,
      success_url: `${process.env.FRONTEND_URL}/subscription?status=success`,
      token: orderId
    };

    const coingateOrder = await coingateService.createOrder(orderData);

    // Store order in Firestore
    const db = getFirestore();
    await db.collection('coingate_orders').doc(orderId).set({
      userId,
      plan,
      amount: planPrices[plan],
      currency: 'USD',
      status: 'new',
      paymentUrl: coingateOrder.payment_url,
      coingateOrderId: coingateOrder.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    return {
      orderId,
      paymentUrl: coingateOrder.payment_url,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  } catch (error) {
    console.error('Error creating Coingate order:', error);
    throw new HttpsError('internal', 'Failed to create payment order');
  }
});
```

### Subscription Limits Configuration

```typescript
// src/config/subscriptionLimits.ts
export const SUBSCRIPTION_LIMITS: Record<SubscriptionPlan, SubscriptionLimits> = {
  basic: {
    maxImageSize: 500 * 1024, // 500KB
    maxTradesPerCalendar: 100,
    maxCalendars: 10,
    aiTokenCredits: 0,
    hasEconomicEvents: false,
  },
  premium: {
    maxImageSize: 1024 * 1024, // 1MB
    maxTradesPerCalendar: 500,
    maxCalendars: 50,
    aiTokenCredits: 600,
    hasEconomicEvents: true,
  },
  pro: {
    maxImageSize: 1024 * 1024, // 1MB
    maxTradesPerCalendar: 1000,
    maxCalendars: 100,
    aiTokenCredits: 1500,
    hasEconomicEvents: true,
  },
};

export const getSubscriptionLimits = (plan: SubscriptionPlan): SubscriptionLimits => {
  return SUBSCRIPTION_LIMITS[plan];
};
```

### React Components Examples

```typescript
// src/components/subscription/SubscriptionPlans.tsx
import React from 'react';
import { Card, CardContent, Button, Typography, Box, Chip } from '@mui/material';
import { useSubscription } from '../../contexts/SubscriptionContext';

const plans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 'Free',
    features: [
      '500KB image uploads',
      '100 trades per calendar',
      '10 calendars maximum',
      'Basic features'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$9.99/month',
    features: [
      'Everything in Basic',
      '1MB image uploads',
      '500 trades per calendar',
      '50 calendars maximum',
      'Economic Events',
      '600 AI tokens'
    ],
    popular: true
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19.99/month',
    features: [
      'Everything in Premium',
      '1000 trades per calendar',
      '100 calendars maximum',
      '1500 AI tokens'
    ]
  }
];

export const SubscriptionPlans: React.FC = () => {
  const { subscription, createOrder } = useSubscription();

  const handleUpgrade = async (planId: string) => {
    if (planId === 'basic') return;

    try {
      const paymentUrl = await createOrder(planId as SubscriptionPlan);
      window.location.href = paymentUrl;
    } catch (error) {
      console.error('Failed to create order:', error);
    }
  };

  return (
    <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
      {plans.map((plan) => (
        <Card
          key={plan.id}
          sx={{
            minWidth: 300,
            position: 'relative',
            border: plan.popular ? '2px solid #1976d2' : '1px solid #e0e0e0'
          }}
        >
          {plan.popular && (
            <Chip
              label="Most Popular"
              color="primary"
              sx={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)' }}
            />
          )}
          <CardContent>
            <Typography variant="h5" gutterBottom>
              {plan.name}
            </Typography>
            <Typography variant="h4" color="primary" gutterBottom>
              {plan.price}
            </Typography>
            <Box mb={2}>
              {plan.features.map((feature, index) => (
                <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                  ✓ {feature}
                </Typography>
              ))}
            </Box>
            <Button
              variant={plan.popular ? "contained" : "outlined"}
              fullWidth
              onClick={() => handleUpgrade(plan.id)}
              disabled={subscription?.plan === plan.id}
            >
              {subscription?.plan === plan.id ? 'Current Plan' :
               plan.id === 'basic' ? 'Free' : 'Upgrade'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};
```

### Usage Monitoring Hook

```typescript
// src/hooks/useSubscriptionLimits.ts
import { useSubscription } from '../contexts/SubscriptionContext';
import { SUBSCRIPTION_LIMITS } from '../config/subscriptionLimits';

export const useSubscriptionLimits = () => {
  const { subscription, usage } = useSubscription();

  const limits = SUBSCRIPTION_LIMITS[subscription?.plan || 'basic'];

  const checkImageUpload = (fileSize: number): { allowed: boolean; message?: string } => {
    if (fileSize <= limits.maxImageSize) {
      return { allowed: true };
    }

    const maxSizeMB = limits.maxImageSize / (1024 * 1024);
    return {
      allowed: false,
      message: `Image size exceeds ${maxSizeMB}MB limit. Upgrade to increase limit.`
    };
  };

  const checkCalendarCreation = (): { allowed: boolean; message?: string } => {
    if (usage.calendarsCount < limits.maxCalendars) {
      return { allowed: true };
    }

    return {
      allowed: false,
      message: `You've reached the maximum of ${limits.maxCalendars} calendars. Upgrade to create more.`
    };
  };

  const checkTradeCreation = (calendarId: string): { allowed: boolean; message?: string } => {
    const calendarTrades = usage.tradesPerCalendar[calendarId] || 0;

    if (calendarTrades < limits.maxTradesPerCalendar) {
      return { allowed: true };
    }

    return {
      allowed: false,
      message: `You've reached the maximum of ${limits.maxTradesPerCalendar} trades per calendar. Upgrade to add more.`
    };
  };

  const checkAIUsage = (tokensNeeded: number): { allowed: boolean; message?: string } => {
    if (limits.aiTokenCredits === 0) {
      return {
        allowed: false,
        message: 'AI Assistant is not available in your current plan. Upgrade to access AI features.'
      };
    }

    if (usage.aiTokensRemaining >= tokensNeeded) {
      return { allowed: true };
    }

    return {
      allowed: false,
      message: `Insufficient AI tokens. You need ${tokensNeeded} tokens but have ${usage.aiTokensRemaining} remaining.`
    };
  };

  return {
    limits,
    usage,
    checkImageUpload,
    checkCalendarCreation,
    checkTradeCreation,
    checkAIUsage,
    hasEconomicEvents: limits.hasEconomicEvents
  };
};
```

## Additional Security Considerations

### 1. Webhook Verification
```typescript
// functions/src/coingate/webhook.ts
import { onRequest } from 'firebase-functions/v2/https';
import crypto from 'crypto';

export const coingateWebhook = onRequest(async (req, res) => {
  const signature = req.headers['cg-signature'] as string;
  const payload = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac('sha256', process.env.COINGATE_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error('Invalid webhook signature');
    res.status(401).send('Unauthorized');
    return;
  }

  // Process webhook...
  const { status, order_id } = req.body;

  if (status === 'paid') {
    await activateSubscription(order_id);
  } else if (status === 'expired' || status === 'canceled') {
    await handleFailedPayment(order_id);
  }

  res.status(200).send('OK');
});
```

### 2. Rate Limiting Implementation
```typescript
// functions/src/middleware/rateLimiting.ts
import { getFirestore } from 'firebase-admin/firestore';

export const checkRateLimit = async (userId: string, action: string, limit: number, windowMs: number) => {
  const db = getFirestore();
  const now = Date.now();
  const windowStart = now - windowMs;

  const rateLimitDoc = db.collection('rate_limits').doc(`${userId}_${action}`);
  const doc = await rateLimitDoc.get();

  if (!doc.exists) {
    await rateLimitDoc.set({
      count: 1,
      windowStart: now,
      lastRequest: now
    });
    return true;
  }

  const data = doc.data()!;

  if (data.windowStart < windowStart) {
    // Reset window
    await rateLimitDoc.set({
      count: 1,
      windowStart: now,
      lastRequest: now
    });
    return true;
  }

  if (data.count >= limit) {
    return false;
  }

  await rateLimitDoc.update({
    count: data.count + 1,
    lastRequest: now
  });

  return true;
};
```

This comprehensive implementation guide provides everything needed to integrate Coingate payments with a robust subscription system for your trade tracker application.
