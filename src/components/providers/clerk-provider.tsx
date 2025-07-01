'use client';

import { ClerkProvider as BaseClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { PropsWithChildren, useEffect, useContext } from 'react';
import { useTheme } from './ThemeProvider';
import { ThemeContext } from './ThemeProvider';

const publicRoutes = [
  '/',
  '/pricing',
  '/features',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback',
  '/verify-email',
];

export function ClerkProvider({ children }: PropsWithChildren) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  if (!publishableKey) {
    console.warn('Clerk publishable key not found. Authentication disabled.');
    return (
      <div>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <strong className="font-bold">Clerk Authentication Error:</strong>
          <span className="block sm:inline"> NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set.</span>
        </div>
        {children}
      </div>
    );
  }

  console.log('Clerk initialized with key:', publishableKey.substring(0, 10) + '...');

  return (
    <ClerkProviderWithTheme publishableKey={publishableKey}>
      {children}
    </ClerkProviderWithTheme>
  );
}

function ClerkProviderWithTheme({ children, publishableKey }: PropsWithChildren & { publishableKey: string }) {
  // Try to use theme context, but fallback if not available
  const themeContext = useContext(ThemeContext);
  const resolvedTheme = themeContext?.resolvedTheme || 'light';
  
  return (
    <BaseClerkProvider
      publishableKey={publishableKey}
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in'}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up'}
      signInFallbackRedirectUrl={process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/dashboard'}
      signUpFallbackRedirectUrl={process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/onboarding'}
      appearance={{
        baseTheme: resolvedTheme === 'dark' ? dark : undefined,
        elements: {
          formButtonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90',
          card: 'shadow-none',
          footerActionLink: 'text-primary hover:text-primary/90',
          identityPreviewText: 'text-foreground',
          identityPreviewEditButton: 'text-primary hover:text-primary/90',
          formFieldLabel: 'text-foreground',
          formFieldInput: 'bg-background border-input',
          dividerLine: 'bg-border',
          dividerText: 'text-muted-foreground',
          socialButtonsBlockButton: 'bg-background border-input hover:bg-accent',
          socialButtonsBlockButtonText: 'text-foreground',
          formHeaderTitle: 'text-foreground',
          formHeaderSubtitle: 'text-muted-foreground',
          alertText: 'text-foreground',
          userButtonPopoverCard: 'bg-popover',
          userButtonPopoverActionButton: 'hover:bg-accent',
          userButtonPopoverActionButtonText: 'text-foreground',
          userButtonPopoverFooter: 'hidden',
          userPreviewSecondaryIdentifier: 'text-muted-foreground',
        },
        variables: {
          colorPrimary: 'hsl(var(--primary))',
          colorBackground: 'hsl(var(--background))',
          colorInputBackground: 'hsl(var(--background))',
          colorText: 'hsl(var(--foreground))',
          colorTextSecondary: 'hsl(var(--muted-foreground))',
          colorDanger: 'hsl(var(--destructive))',
          colorSuccess: 'hsl(142.1 76.2% 36.3%)',
          colorWarning: 'hsl(38 92% 50%)',
          colorNeutral: 'hsl(var(--muted))',
          borderRadius: '0.5rem',
          fontFamily: 'var(--font-geist-sans)',
        },
        layout: {
          socialButtonsPlacement: 'bottom',
          socialButtonsVariant: 'blockButton',
          privacyPageUrl: '/privacy',
          termsPageUrl: '/terms',
        },
      }}
      localization={{
        signIn: {
          start: {
            title: 'Welcome back to Pokemon TCG Deck Builder',
            subtitle: 'Sign in to access your collection and decks',
          },
        },
        signUp: {
          start: {
            title: 'Create your Pokemon TCG account',
            subtitle: 'Join thousands of trainers building winning decks',
          },
        },
        userProfile: {
          navbar: {
            title: 'Account Settings',
            description: 'Manage your profile and preferences',
          },
        },
      }}
    >
      <AuthenticationListener />
      {children}
    </BaseClerkProvider>
  );
}

function AuthenticationListener() {
  useEffect(() => {
    // Track authentication events
    const handleSignIn = () => {
      // Log sign in event
      console.log('User signed in');
      // You can add analytics tracking here
    };

    const handleSignOut = () => {
      // Log sign out event
      console.log('User signed out');
      // Clean up any cached data
    };

    // Set up event listeners
    window.addEventListener('clerk:signin', handleSignIn);
    window.addEventListener('clerk:signout', handleSignOut);

    return () => {
      window.removeEventListener('clerk:signin', handleSignIn);
      window.removeEventListener('clerk:signout', handleSignOut);
    };
  }, []);

  return null;
}