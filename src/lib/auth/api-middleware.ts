import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDbUser, getUserRole } from './clerk';
import { canAccess } from './rbac';

interface ApiMiddlewareOptions {
  requiredRole?: string;
  requiredPermission?: {
    resource: string;
    action: string;
    conditions?: Record<string, any>;
  };
  rateLimit?: {
    requests: number;
    window: number; // in seconds
  };
}

export function withAuth(
  handler: (req: NextRequest, context: any) => Promise<NextResponse>,
  options: ApiMiddlewareOptions = {}
) {
  return async (req: NextRequest, context: any) => {
    try {
      // Check authentication
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get user role
      const userRole = await getUserRole(userId);

      // Check role requirement
      if (options.requiredRole && !userRole.permissions.length) {
        return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
      }

      // Check permission requirement
      if (options.requiredPermission) {
        const hasPermission = canAccess(
          userRole.name,
          options.requiredPermission.resource,
          options.requiredPermission.action,
          options.requiredPermission.conditions
        );

        if (!hasPermission) {
          return NextResponse.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
          );
        }
      }

      // Add user context to request
      const extendedContext = {
        ...context,
        userId,
        userRole: userRole.name,
      };

      // Call the actual handler
      return handler(req, extendedContext);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      );
    }
  };
}

export function withRateLimit(
  handler: (req: NextRequest, context: any) => Promise<NextResponse>,
  requests: number = 10,
  windowSeconds: number = 60
) {
  // Simple in-memory rate limiting (you should use Redis in production)
  const requestCounts = new Map<string, { count: number; resetAt: number }>();

  return async (req: NextRequest, context: any) => {
    const identifier = context.userId || req.ip || 'anonymous';
    const now = Date.now();
    
    const userRequests = requestCounts.get(identifier);
    
    if (!userRequests || userRequests.resetAt < now) {
      requestCounts.set(identifier, {
        count: 1,
        resetAt: now + windowSeconds * 1000,
      });
    } else if (userRequests.count >= requests) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((userRequests.resetAt - now) / 1000),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': requests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': userRequests.resetAt.toString(),
            'Retry-After': Math.ceil((userRequests.resetAt - now) / 1000).toString(),
          },
        }
      );
    } else {
      userRequests.count++;
    }

    const response = await handler(req, context);
    
    // Add rate limit headers
    const currentRequests = requestCounts.get(identifier);
    if (currentRequests) {
      response.headers.set('X-RateLimit-Limit', requests.toString());
      response.headers.set(
        'X-RateLimit-Remaining',
        Math.max(0, requests - currentRequests.count).toString()
      );
      response.headers.set('X-RateLimit-Reset', currentRequests.resetAt.toString());
    }
    
    return response;
  };
}

export function withPermissions(
  resource: string,
  action: string,
  conditions?: Record<string, any>
) {
  return (handler: (req: NextRequest, context: any) => Promise<NextResponse>) => {
    return withAuth(handler, {
      requiredPermission: { resource, action, conditions },
    });
  };
}

// Composed middleware
export function protectedApiRoute(
  handler: (req: NextRequest, context: any) => Promise<NextResponse>,
  options: ApiMiddlewareOptions & { rateLimit?: { requests: number; window: number } } = {}
) {
  let wrappedHandler = handler;

  // Apply rate limiting if specified
  if (options.rateLimit) {
    wrappedHandler = withRateLimit(
      wrappedHandler,
      options.rateLimit.requests,
      options.rateLimit.window
    );
  }

  // Apply authentication and authorization
  wrappedHandler = withAuth(wrappedHandler, options);

  return wrappedHandler;
}