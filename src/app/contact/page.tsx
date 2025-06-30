'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MainLayout } from '@/components/layout/MainLayout';
import { 
  EnvelopeIcon, 
  ChatBubbleLeftRightIcon, 
  QuestionMarkCircleIcon,
  BugAntIcon,
  LightBulbIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { contactFormSchema, sanitizeInput } from '@/lib/validations';
import { FormField } from '@/components/ui/FormField';

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function ContactPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      category: 'general',
    },
  });

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Contact', href: '/contact' },
  ];

  const categories = [
    { value: 'general', label: 'General Inquiry', icon: EnvelopeIcon },
    { value: 'support', label: 'Technical Support', icon: QuestionMarkCircleIcon },
    { value: 'bug', label: 'Bug Report', icon: BugAntIcon },
    { value: 'feature', label: 'Feature Request', icon: LightBulbIcon },
    { value: 'business', label: 'Business Inquiry', icon: ChatBubbleLeftRightIcon },
  ];

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    
    try {
      // Sanitize inputs before sending
      const sanitizedData = {
        ...data,
        name: sanitizeInput(data.name),
        subject: sanitizeInput(data.subject),
        message: sanitizeInput(data.message),
      };
      
      // In production, send to API endpoint
      console.log('Form data:', sanitizedData);
      
      // Simulate form submission
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsSubmitted(true);
      reset();
      
      // Reset success message after a delay
      setTimeout(() => {
        setIsSubmitted(false);
      }, 5000);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout title="Contact Us" breadcrumbs={breadcrumbs}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Get in Touch</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Have a question, suggestion, or need help? We'd love to hear from you.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <EnvelopeIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Email Us</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">support@pokemontcgdeckbuilder.com</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <ChatBubbleLeftRightIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Community</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Join our Discord server</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <QuestionMarkCircleIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Help Center</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Browse our FAQ and guides</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700">
          {isSubmitted ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Thank You!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your message has been sent successfully. We'll get back to you soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  label="Your Name"
                  error={errors.name?.message}
                  required
                >
                  <input
                    type="text"
                    id="name"
                    {...register('name')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </FormField>

                <FormField
                  label="Email Address"
                  error={errors.email?.message}
                  required
                >
                  <input
                    type="email"
                    id="email"
                    {...register('email')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </FormField>
              </div>

              <FormField
                label="Category"
                error={errors.category?.message}
                required
              >
                <select
                  id="category"
                  {...register('category')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Subject"
                error={errors.subject?.message}
                required
              >
                <input
                  type="text"
                  id="subject"
                  {...register('subject')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </FormField>

              <FormField
                label="Message"
                error={errors.message?.message}
                required
              >
                <textarea
                  id="message"
                  {...register('message')}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Please describe your inquiry in detail..."
                />
              </FormField>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* FAQ Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                How do I import my collection from PTCGO?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Go to your collection page and click the import button. You can paste your PTCGO export directly, 
                and we'll automatically parse and add the cards to your collection.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Are the card prices updated in real-time?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Card prices are updated daily from TCGPlayer and CardMarket. Premium subscribers get access to 
                real-time price updates and price history charts.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Can I share my decks with friends?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Yes! Every deck has a share button that generates a unique link. You can also export your decks 
                in various formats including PTCGO, PTCGL, and plain text.
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}