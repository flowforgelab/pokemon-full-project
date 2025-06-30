'use client';

import { useSignIn } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signInSchema } from '@/lib/validations';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';

type SignInFormData = z.infer<typeof signInSchema>;

export default function SimpleSignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignInFormData) => {
    if (!isLoaded) return;

    try {
      const result = await signIn.create({
        identifier: data.email,
        password: data.password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.push('/dashboard');
      }
    } catch (err: any) {
      const errorMessage = err.errors?.[0]?.message || 'An error occurred';
      setFormError('root', { message: errorMessage });
    }
  };

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">Sign In</h1>
        
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
          
          {errors.root && (
            <div className="text-red-600 text-sm">{errors.root.message}</div>
          )}
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don\'t have an account?{' '}
            <a href="/sign-up" className="text-blue-600 hover:underline">
              Sign up
            </a>
          </p>
        </div>
        
        <div className="mt-4 text-center">
          <a href="/" className="text-sm text-gray-500 hover:underline">
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}