import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-12 flex-col justify-between">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">P</span>
            </div>
            <span className="text-2xl font-bold">Pokemon TCG Deck Builder</span>
          </Link>
        </div>
        
        <div className="space-y-6">
          <h1 className="text-4xl font-bold">Welcome back, Trainer!</h1>
          <p className="text-lg text-muted-foreground">
            Sign in to access your collection, decks, and continue your journey to become a Pokemon Master.
          </p>
          
          <div className="grid grid-cols-2 gap-4 pt-8">
            <div className="bg-card p-4 rounded-lg border">
              <div className="text-3xl font-bold text-primary">10K+</div>
              <div className="text-sm text-muted-foreground">Active Trainers</div>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <div className="text-3xl font-bold text-primary">50K+</div>
              <div className="text-sm text-muted-foreground">Decks Created</div>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <div className="text-3xl font-bold text-primary">1M+</div>
              <div className="text-sm text-muted-foreground">Cards Tracked</div>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <div className="text-3xl font-bold text-primary">24/7</div>
              <div className="text-sm text-muted-foreground">Price Updates</div>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p>© 2024 Pokemon TCG Deck Builder. All rights reserved.</p>
          <div className="flex gap-4 mt-2">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </div>
      
      {/* Right Panel - Sign In Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2 mb-8">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">P</span>
              </div>
              <span className="text-2xl font-bold">Pokemon TCG</span>
            </Link>
          </div>
          
          <SignIn
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none p-0 bg-transparent",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                formButtonPrimary: "w-full bg-primary hover:bg-primary/90",
                footerActionLink: "text-primary hover:text-primary/90 font-medium",
                identityPreviewText: "text-foreground",
                identityPreviewEditButton: "text-primary hover:text-primary/90",
                formFieldLabel: "text-foreground font-medium",
                formFieldInput: "bg-background border-input",
                dividerLine: "bg-border",
                dividerText: "text-muted-foreground bg-background px-2",
                socialButtonsBlockButton: "bg-background border-input hover:bg-accent",
                socialButtonsBlockButtonText: "text-foreground font-medium",
                formHeaderTitle: "text-2xl font-bold text-foreground",
                formHeaderSubtitle: "text-muted-foreground",
                alertText: "text-sm",
                footer: "hidden",
              },
            }}
            path="/sign-in"
            routing="path"
            signUpUrl="/sign-up"
          />
          
          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="text-primary hover:text-primary/90 font-medium">
              Create one free
            </Link>
          </div>
          
          <div className="pt-4 text-center text-xs text-muted-foreground">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}