'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdatePreferences, useUserProfile } from '@/lib/auth/hooks';
import { preferencesFormSchema } from '@/lib/validations';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

type PreferencesFormData = z.infer<typeof preferencesFormSchema>;

export function PreferencesForm() {
  const { data: profile, isLoading } = useUserProfile();
  const updatePreferences = useUpdatePreferences();
  const [activeTab, setActiveTab] = useState('general');

  const {
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: {
      currency: profile?.preferences?.preferredCurrency || 'USD',
      language: profile?.preferences?.language || 'en',
      timezone: profile?.preferences?.timezone || 'UTC',
      theme: profile?.preferences?.theme || 'system',
      collectionDisplay: profile?.preferences?.collectionDisplay || 'grid',
      deckBuildingMode: profile?.preferences?.deckBuildingMode === 'beginner' ? 'simple' : profile?.preferences?.deckBuildingMode || 'simple',
      defaultFormat: profile?.preferences?.defaultFormat || 'standard',
      priceAlerts: profile?.preferences?.priceAlerts || false,
    },
  });

  const onSubmit = async (data: PreferencesFormData) => {
    try {
      // Transform the data to match UserPreferences type
      const preferences = {
        preferredCurrency: data.currency as 'USD' | 'EUR' | 'GBP',
        language: data.language,
        timezone: data.timezone,
        theme: data.theme,
        collectionDisplay: data.collectionDisplay,
        deckBuildingMode: data.deckBuildingMode === 'simple' ? 'beginner' : 'advanced' as 'beginner' | 'advanced',
        defaultFormat: data.defaultFormat as 'standard' | 'expanded' | 'legacy',
        priceAlerts: data.priceAlerts,
      };
      await updatePreferences.mutateAsync(preferences);
    } catch (error) {
      console.error('Failed to update preferences:', error);
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
    <div className="space-y-6">
      <div className="border-b">
        <nav className="flex gap-6">
          {['general', 'display', 'game'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 capitalize font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {activeTab === 'general' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">
                Preferred Currency
              </label>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD (C$)</option>
                    <option value="AUD">AUD (A$)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                )}
              />
              {errors.currency && (
                <p className="mt-1 text-xs text-destructive">{errors.currency.message}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Used for displaying card prices throughout the app
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Language
              </label>
              <Controller
                name="language"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="it">Italiano</option>
                    <option value="ja">日本語</option>
                  </select>
                )}
              />
              {errors.language && (
                <p className="mt-1 text-xs text-destructive">{errors.language.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Timezone
              </label>
              <Controller
                name="timezone"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                  </select>
                )}
              />
              {errors.timezone && (
                <p className="mt-1 text-xs text-destructive">{errors.timezone.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium">
                  Price Alerts
                </label>
                <p className="text-xs text-muted-foreground">
                  Get notified when card prices change significantly
                </p>
              </div>
              <Controller
                name="priceAlerts"
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
            {errors.priceAlerts && (
              <p className="text-xs text-destructive">{errors.priceAlerts.message}</p>
            )}
          </>
        )}

        {activeTab === 'display' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">
                Theme
              </label>
              <Controller
                name="theme"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-3 gap-3">
                    {['light', 'dark', 'system'].map((theme) => (
                      <button
                        key={theme}
                        type="button"
                        onClick={() => field.onChange(theme)}
                        className={`px-3 py-2 border rounded-md capitalize transition-colors ${
                          field.value === theme
                            ? 'border-primary bg-primary/10'
                            : 'border-input hover:border-primary/50'
                        }`}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                )}
              />
              {errors.theme && (
                <p className="mt-1 text-xs text-destructive">{errors.theme.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Collection Display
              </label>
              <Controller
                name="collectionDisplay"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-3">
                    {['grid', 'list'].map((display) => (
                      <button
                        key={display}
                        type="button"
                        onClick={() => field.onChange(display)}
                        className={`px-3 py-2 border rounded-md capitalize transition-colors ${
                          field.value === display
                            ? 'border-primary bg-primary/10'
                            : 'border-input hover:border-primary/50'
                        }`}
                      >
                        {display} View
                      </button>
                    ))}
                  </div>
                )}
              />
              {errors.collectionDisplay && (
                <p className="mt-1 text-xs text-destructive">{errors.collectionDisplay.message}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                How cards are displayed in your collection
              </p>
            </div>
          </>
        )}

        {activeTab === 'game' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">
                Default Format
              </label>
              <Controller
                name="defaultFormat"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="standard">Standard</option>
                    <option value="expanded">Expanded</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                )}
              />
              {errors.defaultFormat && (
                <p className="mt-1 text-xs text-destructive">{errors.defaultFormat.message}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Default format when creating new decks
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Deck Building Mode
              </label>
              <Controller
                name="deckBuildingMode"
                control={control}
                render={({ field }) => (
                  <div className="space-y-3">
                    {[
                      {
                        value: 'simple',
                        label: 'Simple',
                        description: 'Guided experience with tips and suggestions',
                      },
                      {
                        value: 'advanced',
                        label: 'Advanced',
                        description: 'Full control with all features available',
                      },
                    ].map((mode) => (
                      <label
                        key={mode.value}
                        className={`block p-4 border rounded-md cursor-pointer transition-colors ${
                          field.value === mode.value
                            ? 'border-primary bg-primary/5'
                            : 'border-input hover:border-primary/50'
                        }`}
                      >
                        <input
                          type="radio"
                          value={mode.value}
                          checked={field.value === mode.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="sr-only"
                        />
                        <div>
                          <div className="font-medium">{mode.label}</div>
                          <div className="text-sm text-muted-foreground">
                            {mode.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              />
              {errors.deckBuildingMode && (
                <p className="mt-1 text-xs text-destructive">{errors.deckBuildingMode.message}</p>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-4 pt-4 border-t">
          <button
            type="button"
            className="px-4 py-2 border border-input rounded-md hover:bg-accent"
            disabled={isSubmitting}
          >
            Reset to Defaults
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            disabled={isSubmitting || updatePreferences.isPending}
          >
            {isSubmitting || updatePreferences.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}