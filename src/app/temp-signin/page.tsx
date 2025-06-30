'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signInSchema } from '@/lib/validations';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';

type SignInFormData = z.infer<typeof signInSchema>;

export default function TempSignInPage() {
  const router = useRouter();
  
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
  
  const onSubmit = (data: SignInFormData) => {
    setFormError('root', {
      message: 'Authentication is temporarily disabled. Please check back later or contact support.',
    });
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">Sign In</h1>
        
        <div className="bg-amber-50 border border-amber-200 p-4 rounded mb-6">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> We are experiencing technical difficulties with our authentication system. 
            We apologize for the inconvenience.
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
            className="w-full bg-gray-400 text-white py-2 px-4 rounded-md cursor-not-allowed"
            disabled
          >
            Sign In (Temporarily Disabled)
          </button>
        </form>
        
        {errors.root && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {errors.root.message}
          </div>
        )}
        
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Need help? <a href="mailto:support@example.com" className="text-blue-600 hover:underline">Contact Support</a>
          </p>
          <Link href="/" className="block text-gray-500 hover:underline">
            Back to Home
          </Link>
        </div>
        
        <div className="mt-6 pt-6 border-t">
          <div className="text-center">
            <Link 
              href="/clerk-config" 
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              View Clerk Configuration →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}