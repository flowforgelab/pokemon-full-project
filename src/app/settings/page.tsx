'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { useUser } from '@clerk/nextjs';
import {
  UserIcon,
  CogIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  BellIcon,
  KeyIcon,
  DocumentTextIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

type SettingsSection = 'profile' | 'account' | 'subscription' | 'privacy' | 'notifications' | 'security';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const { user } = useUser();

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Settings', href: '/settings' },
  ];

  const navigationItems = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'account', label: 'Account', icon: CogIcon },
    { id: 'subscription', label: 'Subscription', icon: CreditCardIcon },
    { id: 'privacy', label: 'Privacy', icon: ShieldCheckIcon },
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'security', label: 'Security', icon: KeyIcon },
  ];

  return (
    <MainLayout title="Settings" breadcrumbs={breadcrumbs}>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-4">
            {/* Settings Navigation */}
            <div className="bg-gray-50 dark:bg-gray-700 p-6 lg:border-r dark:border-gray-600">
              <nav className="space-y-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id as SettingsSection)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-8 pt-8 border-t dark:border-gray-600">
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors">
                  <TrashIcon className="h-5 w-5" />
                  Delete Account
                </button>
              </div>
            </div>

            {/* Settings Content */}
            <div className="lg:col-span-3 p-6">
              {activeSection === 'profile' && <ProfileSettings />}
              {activeSection === 'account' && <AccountSettings />}
              {activeSection === 'subscription' && <SubscriptionSettings />}
              {activeSection === 'privacy' && <PrivacySettings />}
              {activeSection === 'notifications' && <NotificationSettings />}
              {activeSection === 'security' && <SecuritySettings />}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function ProfileSettings() {
  const { user } = useUser();
  const [isUpdating, setIsUpdating] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Profile Information
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Update your profile information and how others see you.
        </p>
      </div>

      <div className="space-y-4">
        {/* Avatar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Avatar
          </label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Change Avatar
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                JPG, PNG or GIF. Max 2MB.
              </p>
            </div>
          </div>
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Display Name
          </label>
          <input
            type="text"
            id="displayName"
            defaultValue={user?.fullName || ''}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Username */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Username
          </label>
          <input
            type="text"
            id="username"
            defaultValue={user?.username || ''}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Your unique username for sharing decks and trading.
          </p>
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Bio
          </label>
          <textarea
            id="bio"
            rows={4}
            placeholder="Tell others about yourself..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Location
          </label>
          <input
            type="text"
            id="location"
            placeholder="City, Country"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div className="pt-4">
          <button
            onClick={() => setIsUpdating(true)}
            disabled={isUpdating}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isUpdating ? 'Updating...' : 'Update Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountSettings() {
  const { user } = useUser();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Account Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Address
          </label>
          <div className="flex items-center gap-4">
            <input
              type="email"
              value={user?.emailAddresses[0]?.emailAddress || ''}
              disabled
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
            />
            <button className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-lg">
              Change
            </button>
          </div>
        </div>

        {/* Language */}
        <div>
          <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Language
          </label>
          <select
            id="language"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
          </select>
        </div>

        {/* Timezone */}
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Timezone
          </label>
          <select
            id="timezone"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="UTC">UTC</option>
            <option value="EST">Eastern Time</option>
            <option value="CST">Central Time</option>
            <option value="MST">Mountain Time</option>
            <option value="PST">Pacific Time</option>
          </select>
        </div>

        {/* Date Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date Format
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input type="radio" name="dateFormat" value="MM/DD/YYYY" defaultChecked className="mr-2" />
              <span className="text-sm text-gray-700 dark:text-gray-300">MM/DD/YYYY</span>
            </label>
            <label className="flex items-center">
              <input type="radio" name="dateFormat" value="DD/MM/YYYY" className="mr-2" />
              <span className="text-sm text-gray-700 dark:text-gray-300">DD/MM/YYYY</span>
            </label>
            <label className="flex items-center">
              <input type="radio" name="dateFormat" value="YYYY-MM-DD" className="mr-2" />
              <span className="text-sm text-gray-700 dark:text-gray-300">YYYY-MM-DD</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubscriptionSettings() {
  const { data: subscription } = api.user.getSubscription.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Subscription
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your subscription and billing.
        </p>
      </div>

      {/* Current Plan */}
      <div className="bg-blue-50 dark:bg-blue-900/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {subscription?.planName || 'Free Plan'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {subscription?.status === 'active' ? 'Active' : 'Inactive'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${subscription?.price || '0'}/mo
            </p>
          </div>
        </div>

        {subscription?.nextBillingDate && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Next billing date: {new Date(subscription.nextBillingDate).toLocaleDateString()}
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Upgrade Plan
          </button>
          {subscription?.status === 'active' && (
            <button className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">
              Manage Billing
            </button>
          )}
        </div>
      </div>

      {/* Features */}
      <div>
        <h3 className="font-medium text-gray-900 dark:text-white mb-3">
          Your Plan Features
        </h3>
        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="text-green-500">✓</span>
            Build up to {subscription?.maxDecks || 3} decks
          </li>
          <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="text-green-500">✓</span>
            Basic deck analysis
          </li>
          <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="text-green-500">✓</span>
            Collection tracking
          </li>
          {subscription?.planName !== 'Free' && (
            <>
              <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-green-500">✓</span>
                Advanced AI analysis
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-green-500">✓</span>
                Priority support
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}

function PrivacySettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Privacy Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Control your privacy and how others can interact with you.
        </p>
      </div>

      <div className="space-y-4">
        {/* Profile Visibility */}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Profile Visibility
          </h3>
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Show profile to public
              </span>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Show collection value
              </span>
              <input type="checkbox" className="toggle" />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Show deck statistics
              </span>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
          </div>
        </div>

        {/* Sharing */}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Sharing Preferences
          </h3>
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Allow deck cloning
              </span>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Share decks publicly by default
              </span>
              <input type="checkbox" className="toggle" />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Allow trade offers
              </span>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
          </div>
        </div>

        {/* Data */}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Data & Analytics
          </h3>
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Share usage data for improvements
              </span>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Personalized recommendations
              </span>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Notification Preferences
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Choose what notifications you want to receive.
        </p>
      </div>

      <div className="space-y-4">
        {/* Email Notifications */}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Email Notifications
          </h3>
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Trade offers
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  When someone sends you a trade offer
                </p>
              </div>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Price alerts
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  When cards in your watchlist hit target prices
                </p>
              </div>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Weekly digest
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Summary of your collection and deck performance
                </p>
              </div>
              <input type="checkbox" className="toggle" />
            </label>
          </div>
        </div>

        {/* Push Notifications */}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Push Notifications
          </h3>
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Deck comments
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  When someone comments on your decks
                </p>
              </div>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Tournament reminders
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Upcoming tournament notifications
                </p>
              </div>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Security Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Keep your account secure with these settings.
        </p>
      </div>

      <div className="space-y-4">
        {/* Two-Factor Authentication */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Two-Factor Authentication
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Add an extra layer of security to your account
              </p>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              Enable
            </button>
          </div>
        </div>

        {/* API Keys */}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            API Keys
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Generate API keys to access your data programmatically.
          </p>
          <button className="px-4 py-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/70">
            Generate New Key
          </button>
        </div>

        {/* Sessions */}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Active Sessions
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Current Session
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Chrome on macOS • Active now
                </p>
              </div>
              <span className="text-xs text-green-600 dark:text-green-400">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Download Data */}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Your Data
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Download a copy of all your data including decks, collection, and settings.
          </p>
          <button className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">
            Download Data
          </button>
        </div>
      </div>
    </div>
  );
}