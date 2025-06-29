import { SignIn } from '@clerk/nextjs';

export default function TestSignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Direct Sign In Test</h1>
        <div className="border-2 border-red-500 p-4">
          <SignIn 
            fallbackRedirectUrl="/dashboard"
            signUpFallbackRedirectUrl="/sign-up"
          />
        </div>
      </div>
    </div>
  );
}