'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useUserProfile } from '@/lib/auth/hooks';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredPermission?: {
    resource: string;
    action: string;
  };
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  redirectTo = '/sign-in',
}: ProtectedRouteProps) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile();

  useEffect(() => {
    if (!isLoaded || profileLoading) return;

    if (!isSignedIn) {
      router.push(redirectTo);
      return;
    }

    // Check role-based access
    if (requiredRole && profile) {
      // This would need to be implemented based on your role system
      // For now, we'll use a simple check
      const hasRole = checkUserRole(profile, requiredRole);
      if (!hasRole) {
        router.push('/unauthorized');
      }
    }

    // Check permission-based access
    if (requiredPermission && profile) {
      // This would check specific permissions
      const hasPermission = checkUserPermission(profile, requiredPermission);
      if (!hasPermission) {
        router.push('/unauthorized');
      }
    }
  }, [isLoaded, isSignedIn, profile, profileLoading, requiredRole, requiredPermission, router, redirectTo]);

  if (!isLoaded || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return <>{children}</>;
}

function checkUserRole(profile: any, requiredRole: string): boolean {
  // Implement your role checking logic here
  // This is a placeholder implementation
  return true;
}

function checkUserPermission(
  profile: any,
  permission: { resource: string; action: string }
): boolean {
  // Implement your permission checking logic here
  // This is a placeholder implementation
  return true;
}