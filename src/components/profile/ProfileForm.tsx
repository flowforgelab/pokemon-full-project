'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUpdateProfile, useUserProfile } from '@/lib/auth/hooks';
import { Loader2 } from 'lucide-react';

const profileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters'),
  displayName: z.string().min(1, 'Display name is required').max(50, 'Display name must be less than 50 characters'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfileForm() {
  const { data: profile, isLoading } = useUserProfile();
  const updateProfile = useUpdateProfile();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: profile?.username || '',
      displayName: profile?.preferences?.displayName || '',
      bio: profile?.preferences?.bio || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setError(null);
      await updateProfile.mutateAsync(data);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label htmlFor="username" className="block text-sm font-medium mb-2">
          Username
        </label>
        <input
          {...register('username')}
          type="text"
          id="username"
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
          placeholder="trainer123"
        />
        {errors.username && (
          <p className="mt-1 text-sm text-destructive">{errors.username.message}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          This will be your unique identifier on the platform
        </p>
      </div>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium mb-2">
          Display Name
        </label>
        <input
          {...register('displayName')}
          type="text"
          id="displayName"
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
          placeholder="Pokemon Master"
        />
        {errors.displayName && (
          <p className="mt-1 text-sm text-destructive">{errors.displayName.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium mb-2">
          Bio
        </label>
        <textarea
          {...register('bio')}
          id="bio"
          rows={4}
          className="w-full px-3 py-2 border border-input rounded-md bg-background resize-none"
          placeholder="Tell us about yourself and your Pokemon journey..."
        />
        {errors.bio && (
          <p className="mt-1 text-sm text-destructive">{errors.bio.message}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {(register('bio').value?.length || 0)}/500 characters
        </p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-4">
        <button
          type="button"
          className="px-4 py-2 border border-input rounded-md hover:bg-accent"
          disabled={isSubmitting}
        >
          Cancel
        </button>
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
            'Save Changes'
          )}
        </button>
      </div>
    </form>
  );
}