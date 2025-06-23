'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { UserProfile, SubscriptionDetails, UserPreferences } from '@/types/auth';

export function useUserProfile() {
  const { user, isLoaded } = useUser();
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated');
      
      const response = await fetch('/api/user/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      
      return response.json() as Promise<UserProfile>;
    },
    enabled: isLoaded && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
    },
  });
}

export function useSubscription() {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['subscription', userId],
    queryFn: async () => {
      const response = await fetch('/api/user/subscription');
      if (!response.ok) throw new Error('Failed to fetch subscription');
      
      return response.json() as Promise<SubscriptionDetails>;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFeatureAccess(feature: string) {
  const { data: subscription } = useSubscription();
  
  if (!subscription) return false;
  
  const featureMap: Record<string, (sub: SubscriptionDetails) => boolean> = {
    advancedAnalysis: (sub) => sub.features.advancedAnalysis,
    priceAlerts: (sub) => sub.features.priceAlerts,
    apiAccess: (sub) => sub.features.apiAccess,
    prioritySupport: (sub) => sub.features.prioritySupport,
    exportFeatures: (sub) => sub.features.exportFeatures,
    customBranding: (sub) => sub.features.customBranding,
    teamFeatures: (sub) => sub.features.teamFeatures,
    aiRecommendations: (sub) => sub.features.aiRecommendations,
    tournamentTools: (sub) => sub.features.tournamentTools,
  };

  const checkAccess = featureMap[feature];
  return checkAccess ? checkAccess(subscription) : false;
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  return useMutation({
    mutationFn: async (preferences: Partial<UserPreferences>) => {
      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) throw new Error('Failed to update preferences');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
    },
  });
}

export function useRequireAuth(redirectTo = '/sign-in') {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push(redirectTo);
    }
  }, [isLoaded, isSignedIn, router, redirectTo]);

  return { isLoaded, isSignedIn };
}

export function useRequireSubscription(
  requiredTier: 'BASIC' | 'PREMIUM' | 'ULTIMATE',
  redirectTo = '/pricing'
) {
  const { isSignedIn } = useAuth();
  const { data: subscription, isLoading } = useSubscription();
  const router = useRouter();

  const tierHierarchy = {
    FREE: 0,
    BASIC: 1,
    PREMIUM: 2,
    ULTIMATE: 3,
  };

  useEffect(() => {
    if (!isSignedIn || isLoading) return;

    if (!subscription || tierHierarchy[subscription.tier] < tierHierarchy[requiredTier]) {
      router.push(redirectTo);
    }
  }, [isSignedIn, subscription, isLoading, requiredTier, router, redirectTo]);

  return {
    hasAccess: subscription && tierHierarchy[subscription.tier] >= tierHierarchy[requiredTier],
    isLoading,
  };
}

export function useSignOut() {
  const { signOut } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await signOut();
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      router.push('/');
    },
  });
}

export function useAuthenticatedFetch() {
  const { getToken } = useAuth();

  return async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };
}

export function useUserActivity() {
  const { userId } = useAuth();

  useEffect(() => {
    if (!userId) return;

    // Update last active timestamp
    const updateActivity = async () => {
      await fetch('/api/user/activity', {
        method: 'POST',
      });
    };

    // Update immediately
    updateActivity();

    // Update every 5 minutes while active
    const interval = setInterval(updateActivity, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId]);
}

import { useEffect } from 'react';