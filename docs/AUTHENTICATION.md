# Authentication System Documentation

This document describes the comprehensive authentication and user management system implemented using Clerk, Stripe, and custom RBAC.

## Table of Contents

1. [Overview](#overview)
2. [Authentication Setup](#authentication-setup)
3. [User Management](#user-management)
4. [Subscription System](#subscription-system)
5. [Role-Based Access Control](#role-based-access-control)
6. [Privacy & Security](#privacy--security)
7. [API Protection](#api-protection)
8. [Configuration](#configuration)

## Overview

The authentication system provides:

- 🔐 **Clerk Authentication**: Sign-in/up with email, social providers (Google, Apple, Discord)
- 💳 **Stripe Subscriptions**: Tiered access (Free, Basic, Premium, Ultimate)
- 👥 **User Profiles**: Customizable preferences, privacy settings, notifications
- 🛡️ **RBAC**: Fine-grained permissions and role management
- 🔒 **Security**: GDPR compliance, audit logging, secure sessions
- 📧 **Notifications**: Email, push, and in-app notification management

## Authentication Setup

### Basic Implementation

```typescript
// In your layout.tsx
import { ClerkProvider } from '@/components/providers/clerk-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
```

### Custom Sign-in/Sign-up Pages

The app includes custom-branded authentication pages at:
- `/sign-in` - Custom sign-in page with branding
- `/sign-up` - Custom sign-up page with feature highlights
- `/sso-callback` - OAuth callback handler

### Social Authentication

Configured providers:
- Google OAuth
- Apple Sign In
- Discord OAuth

Enable/disable providers in `/src/lib/auth/social-providers.ts`

## User Management

### User Profile Structure

```typescript
interface UserProfile {
  clerkUserId: string;
  username: string;
  email: string;
  avatar: string;
  preferences: UserPreferences;
  subscription: SubscriptionDetails;
  privacy: PrivacySettings;
  notifications: NotificationSettings;
}
```

### Profile Management Components

- `ProfileForm` - Edit username, display name, bio
- `PreferencesForm` - Manage app preferences
- `PrivacySettings` - Control privacy and visibility
- `NotificationSettings` - Configure notification preferences

### API Endpoints

- `GET /api/user/profile` - Fetch user profile
- `PATCH /api/user/profile` - Update profile
- `GET /api/user/subscription` - Get subscription details
- `POST /api/user/activity` - Update last active timestamp

## Subscription System

### Tiers

1. **Free** - Basic features, 3 deck slots
2. **Basic** ($4.99/mo) - 10 decks, advanced analysis, price alerts
3. **Premium** ($9.99/mo) - 50 decks, AI recommendations, API access
4. **Ultimate** ($19.99/mo) - Unlimited decks, tournament tools

### Stripe Integration

```typescript
// Create checkout session
const response = await fetch('/api/stripe/checkout', {
  method: 'POST',
  body: JSON.stringify({
    tier: 'PREMIUM',
    period: 'monthly'
  })
});
```

### Feature Gating

```typescript
// Component-level gating
<FeatureGate feature="advancedAnalysis">
  <AdvancedAnalysisComponent />
</FeatureGate>

// Hook-based checking
const hasAccess = useFeatureAccess('priceAlerts');
```

### Webhook Handling

Stripe webhooks are handled at `/api/stripe/webhook`:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Role-Based Access Control

### Roles Hierarchy

1. `user` - Basic permissions
2. `premium_user` - Premium features
3. `pro_user` - Pro features
4. `moderator` - Content moderation
5. `admin` - User management
6. `super_admin` - Full system access

### Permission System

```typescript
// Check permissions
const canEdit = canAccess(userRole, 'deck', 'update', { own: true });

// Require permission (throws if denied)
requirePermission(userRole, 'analysis', 'create');
```

### Protected Routes

```typescript
// Client-side protection
<ProtectedRoute requiredRole="admin">
  <AdminDashboard />
</ProtectedRoute>

// API route protection
export const GET = protectedApiRoute(
  handler,
  {
    requiredRole: 'moderator',
    requiredPermission: {
      resource: 'user_content',
      action: 'read'
    }
  }
);
```

## Privacy & Security

### Privacy Settings

- Profile visibility (public/friends/private)
- Collection visibility controls
- Deck sharing defaults
- Online status visibility
- Friend request permissions
- Analytics opt-out

### Security Features

- Two-factor authentication support
- Session management
- Audit logging
- Suspicious activity detection
- Rate limiting on sensitive operations

### GDPR Compliance

- Data export functionality
- Right to be forgotten
- Consent management
- Privacy policy acceptance tracking
- Data processing transparency

## API Protection

### Authentication Middleware

```typescript
import { protectedApiRoute } from '@/lib/auth/api-middleware';

export const GET = protectedApiRoute(
  async (req, context) => {
    // Handler implementation
    // context.userId and context.userRole are available
  },
  {
    requiredRole: 'premium_user',
    rateLimit: {
      requests: 100,
      window: 60 // seconds
    }
  }
);
```

### Rate Limiting

Built-in rate limiting with configurable windows:
- Default: 10 requests per 60 seconds
- Customizable per endpoint
- Headers included: `X-RateLimit-*`

## Configuration

### Environment Variables

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
STRIPE_BASIC_MONTHLY_PRICE_ID=price_...
STRIPE_BASIC_YEARLY_PRICE_ID=price_...
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_...
STRIPE_PREMIUM_YEARLY_PRICE_ID=price_...
STRIPE_ULTIMATE_MONTHLY_PRICE_ID=price_...
STRIPE_ULTIMATE_YEARLY_PRICE_ID=price_...
```

### Clerk Dashboard Setup

1. Create application at clerk.com
2. Configure OAuth providers
3. Set up webhook endpoints
4. Configure session settings
5. Customize email templates

### Stripe Dashboard Setup

1. Create products and prices
2. Configure customer portal
3. Set up webhook endpoint
4. Configure tax settings
5. Set up payment methods

## Usage Examples

### Check User Authentication

```typescript
import { useAuth } from '@clerk/nextjs';

function MyComponent() {
  const { isSignedIn, userId } = useAuth();
  
  if (!isSignedIn) {
    return <SignInPrompt />;
  }
  
  // Authenticated content
}
```

### Fetch User Profile

```typescript
import { useUserProfile } from '@/lib/auth/hooks';

function ProfileDisplay() {
  const { data: profile, isLoading } = useUserProfile();
  
  if (isLoading) return <Spinner />;
  
  return <div>Welcome, {profile.username}!</div>;
}
```

### Upgrade Subscription

```typescript
async function upgradeToPremium() {
  const response = await fetch('/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({
      tier: 'PREMIUM',
      period: 'yearly'
    })
  });
  
  const { url } = await response.json();
  window.location.href = url;
}
```

### Protected API Call

```typescript
// Automatically includes auth token
const authenticatedFetch = useAuthenticatedFetch();

const data = await authenticatedFetch('/api/admin/users');
```

## Testing

### Test Users

Create test users with different subscription tiers:
1. Free user - Basic access
2. Premium user - Premium features
3. Admin user - Admin dashboard access

### Stripe Testing

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires auth: `4000 0025 0000 3155`

### Webhook Testing

Use Stripe CLI for local webhook testing:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Troubleshooting

### Common Issues

1. **"User not authenticated"** - Check Clerk middleware configuration
2. **"Subscription not found"** - Ensure webhook handler is running
3. **"Permission denied"** - Verify role assignments in database
4. **"Rate limit exceeded"** - Check rate limit configuration

### Debug Mode

Enable debug logging:
```typescript
// In development
console.log('User role:', await getUserRole(userId));
console.log('Permissions:', await getPermissionsForRole(role));
```

## Support

For issues or questions:
1. Check Clerk documentation: https://clerk.com/docs
2. Review Stripe guides: https://stripe.com/docs
3. File issues in the project repository