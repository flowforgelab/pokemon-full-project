'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signInSchema } from '@/lib/validations';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';

type SignInFormData = z.infer<typeof signInSchema>;

export default function ManualSignInPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError: setFormError,
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });
  
  const onSubmit = async (data: SignInFormData) => {
    setFormError('root', {
      message: 'This is a fallback page. Please check /clerk-debug for configuration issues.',
    });
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">Manual Sign In (Fallback)</h1>
        
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-6">
          <p className="text-sm text-yellow-800">
            This is a fallback sign-in page. The Clerk authentication system is not loading properly.
          </p>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Email"
            error={errors.email?.message}
            required
          >
            <Input
              type="email"
              placeholder="your@email.com"
              {...register('email')}
              className="w-full"
            />
          </FormField>
          
          <FormField
            label="Password"
            error={errors.password?.message}
            required
          >
            <Input
              type="password"
              placeholder="••••••••"
              {...register('password')}
              className="w-full"
            />
          </FormField>
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            Sign In (Disabled)
          </button>
        </form>
        
        {errors.root && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {errors.root.message}
          </div>
        )}
        
        <div className="mt-6 space-y-2 text-center">
          <Link href="/clerk-debug" className="block text-blue-600 hover:underline">
            → Check Clerk Debug Info
          </Link>
          <Link href="/" className="block text-gray-500 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}