import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export default function ClerkTestPage() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Clerk Test - Official Pattern</h1>
      
      <div className="space-y-8">
        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-4">SignedOut State</h2>
          <SignedOut>
            <div className="flex gap-4">
              <SignInButton mode="modal" />
              <SignUpButton mode="modal" />
            </div>
          </SignedOut>
        </div>

        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-4">SignedIn State</h2>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </div>
  );
}