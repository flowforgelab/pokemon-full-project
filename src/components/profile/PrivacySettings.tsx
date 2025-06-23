'use client';

import { useForm, Controller } from 'react-hook-form';
import { useUpdateProfile, useUserProfile } from '@/lib/auth/hooks';
import { PrivacySettings } from '@/types/auth';
import { Loader2, Lock, Users, Eye, MessageSquare, Search, Activity } from 'lucide-react';

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
    name: 'deckSharingDefault',
    label: 'Default Deck Privacy',
    description: 'Default privacy setting for new decks',
    icon: Users,
    options: [
      { value: 'public', label: 'Public', description: 'Listed in deck directory' },
      { value: 'unlisted', label: 'Unlisted', description: 'Only with link' },
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
    name: 'allowTradeOffers',
    label: 'Allow Trade Offers',
    description: 'Let other users send you trade offers',
    icon: MessageSquare,
  },
  {
    name: 'allowMessages',
    label: 'Allow Messages',
    description: 'Let other users send you direct messages',
    icon: MessageSquare,
  },
  {
    name: 'searchableProfile',
    label: 'Searchable Profile',
    description: 'Allow your profile to appear in search results',
    icon: Search,
  },
  {
    name: 'shareActivityFeed',
    label: 'Share Activity Feed',
    description: 'Let friends see your recent activity',
    icon: Activity,
  },
  {
    name: 'analyticsOptOut',
    label: 'Opt Out of Analytics',
    description: 'Disable anonymous usage analytics',
    icon: Lock,
  },
];

export function PrivacySettingsForm() {
  const { data: profile, isLoading } = useUserProfile();
  const updateProfile = useUpdateProfile();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ privacy: PrivacySettings }>({
    defaultValues: {
      privacy: profile?.privacy || {
        profileVisibility: 'public',
        collectionVisibility: 'friends',
        deckSharingDefault: 'unlisted',
        showOnlineStatus: true,
        allowFriendRequests: true,
        allowTradeOffers: true,
        allowMessages: true,
        searchableProfile: true,
        shareActivityFeed: true,
        analyticsOptOut: false,
      },
    },
  });

  const onSubmit = async (data: { privacy: PrivacySettings }) => {
    await updateProfile.mutateAsync(data);
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
                    name={`privacy.${option.name}` as any}
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
                name={`privacy.${setting.name}` as any}
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