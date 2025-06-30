'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdateProfile, useUserProfile } from '@/lib/auth/hooks';
import { privacySettingsSchema } from '@/lib/validations';
import { z } from 'zod';
import { Loader2, Lock, Users, Eye, MessageSquare, Search, Activity } from 'lucide-react';

type PrivacySettingsFormData = z.infer<typeof privacySettingsSchema>;

const privacyOptions = [
  {
    name: 'profileVisibility',
    label: 'Profile Visibility',
    description: 'Control who can view your profile',
    icon: Eye,
    options: [
      { value: 'public', label: 'Public', description: 'Anyone can view your profile' },
      { value: 'friends', label: 'Friends Only', description: 'Only friends can view' },
      { value: 'private', label: 'Private', description: 'Nobody can view' },
    ],
  },
  {
    name: 'collectionVisibility',
    label: 'Collection Visibility',
    description: 'Control who can view your card collection',
    icon: Lock,
    options: [
      { value: 'public', label: 'Public', description: 'Anyone can view' },
      { value: 'friends', label: 'Friends Only', description: 'Only friends can view' },
      { value: 'private', label: 'Private', description: 'Only you can view' },
    ],
  },
  {
    name: 'decksVisibility',
    label: 'Decks Visibility',
    description: 'Control who can view your decks',
    icon: Users,
    options: [
      { value: 'public', label: 'Public', description: 'Anyone can view' },
      { value: 'friends', label: 'Friends Only', description: 'Only friends can view' },
      { value: 'private', label: 'Private', description: 'Only you can view' },
    ],
  },
];

const toggleSettings = [
  {
    name: 'showOnlineStatus',
    label: 'Show Online Status',
    description: 'Let others see when you\'re online',
    icon: Activity,
  },
  {
    name: 'allowFriendRequests',
    label: 'Allow Friend Requests',
    description: 'Let other users send you friend requests',
    icon: Users,
  },
  {
    name: 'allowMessages',
    label: 'Allow Messages',
    description: 'Let other users send you direct messages',
    icon: MessageSquare,
  },
  {
    name: 'allowTradeOffers',
    label: 'Allow Trade Offers',
    description: 'Let other users send you trade offers',
    icon: MessageSquare,
  },
  {
    name: 'showInLeaderboards',
    label: 'Show in Leaderboards',
    description: 'Allow your profile to appear in leaderboards',
    icon: Search,
  },
  {
    name: 'shareDataForAnalytics',
    label: 'Share Data for Analytics',
    description: 'Help improve the app with anonymous usage data',
    icon: Lock,
  },
];

export function PrivacySettingsForm() {
  const { data: profile, isLoading } = useUserProfile();
  const updateProfile = useUpdateProfile();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<PrivacySettingsFormData>({
    resolver: zodResolver(privacySettingsSchema),
    defaultValues: {
      profileVisibility: profile?.privacy?.profileVisibility || 'public',
      collectionVisibility: profile?.privacy?.collectionVisibility || 'friends',
      decksVisibility: profile?.privacy?.deckSharingDefault || 'public',
      showOnlineStatus: profile?.privacy?.showOnlineStatus ?? true,
      allowFriendRequests: profile?.privacy?.allowFriendRequests ?? true,
      allowMessages: profile?.privacy?.allowMessages ?? true,
      allowTradeOffers: profile?.privacy?.allowTradeOffers ?? true,
      showInLeaderboards: profile?.privacy?.searchableProfile ?? true,
      shareDataForAnalytics: !profile?.privacy?.analyticsOptOut ?? true,
    },
  });

  const onSubmit = async (data: PrivacySettingsFormData) => {
    try {
      // Transform the data to match PrivacySettings type
      const privacy = {
        profileVisibility: data.profileVisibility,
        collectionVisibility: data.collectionVisibility,
        deckSharingDefault: data.decksVisibility as 'public' | 'unlisted' | 'private',
        showOnlineStatus: data.showOnlineStatus,
        allowFriendRequests: data.allowFriendRequests,
        allowTradeOffers: data.allowTradeOffers,
        allowMessages: data.allowMessages,
        searchableProfile: data.showInLeaderboards,
        shareActivityFeed: true, // Not in schema, keeping default
        analyticsOptOut: !data.shareDataForAnalytics,
      };
      await updateProfile.mutateAsync({ privacy });
    } catch (error) {
      console.error('Failed to update privacy settings:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="space-y-6">
        {privacyOptions.map((option) => {
          const Icon = option.icon;
          return (
            <div key={option.name} className="space-y-3">
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium">{option.label}</h3>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                  
                  <Controller
                    name={option.name as keyof PrivacySettingsFormData}
                    control={control}
                    render={({ field }) => (
                      <div className="mt-3 space-y-2">
                        {option.options.map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                              field.value === opt.value
                                ? 'border-primary bg-primary/5'
                                : 'border-input hover:border-primary/50'
                            }`}
                          >
                            <input
                              type="radio"
                              value={opt.value}
                              checked={field.value === opt.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="sr-only"
                            />
                            <div>
                              <div className="font-medium text-sm">{opt.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {opt.description}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  />
                  {errors[option.name as keyof PrivacySettingsFormData] && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors[option.name as keyof PrivacySettingsFormData]?.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-6 space-y-4">
        <h3 className="font-medium">Additional Privacy Settings</h3>
        
        {toggleSettings.map((setting) => {
          const Icon = setting.icon;
          return (
            <div key={setting.name} className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <label className="font-medium text-sm">{setting.label}</label>
                  <p className="text-xs text-muted-foreground">{setting.description}</p>
                </div>
              </div>
              
              <Controller
                name={setting.name as keyof PrivacySettingsFormData}
                control={control}
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      field.value ? 'bg-primary' : 'bg-input'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        field.value ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                )}
              />
            </div>
            {errors[setting.name as keyof PrivacySettingsFormData] && (
              <p className="text-xs text-destructive">
                {errors[setting.name as keyof PrivacySettingsFormData]?.message}
              </p>
            )}
          );
        })}
      </div>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          disabled={isSubmitting || updateProfile.isPending}
        >
          {isSubmitting || updateProfile.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Saving...
            </>
          ) : (
            'Save Privacy Settings'
          )}
        </button>
      </div>
    </form>
  );
}