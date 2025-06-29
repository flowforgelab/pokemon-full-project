import Link from 'next/link';

export default function BasicSignInPage() {
  // Extract domain from publishable key for Clerk hosted pages
  const CLERK_DOMAIN = 'tolerant-bream-18.clerk.accounts.dev';
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Sign In Options</h1>
        
        <div className="space-y-4">
          <a
            href={`https://${CLERK_DOMAIN}/sign-in?redirect_url=${process.env.NEXT_PUBLIC_APP_URL || 'https://pokemon-full-project.vercel.app'}/dashboard`}
            className="block w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 text-center transition-colors"
          >
            Sign In with Clerk (Hosted)
          </a>
          
          <a
            href={`https://accounts.${CLERK_DOMAIN}/sign-in`}
            className="block w-full bg-purple-600 text-white py-3 px-4 rounded-md hover:bg-purple-700 text-center transition-colors"
          >
            Sign In (Accounts Portal)
          </a>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
            </div>
          </div>
          
          <Link
            href="/sign-up"
            className="block w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-md hover:bg-gray-300 text-center transition-colors"
          >
            Create New Account
          </Link>
          
          <Link
            href="/"
            className="block text-center text-gray-500 hover:underline"
          >
            Back to Home
          </Link>
        </div>
        
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> If the embedded sign-in isn't working, use the "Sign In with Clerk (Hosted)" option above.
          </p>
        </div>
      </div>
    </div>
  );
}