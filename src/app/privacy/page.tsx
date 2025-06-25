import { MainLayout } from '@/components/layout/MainLayout';

export default function PrivacyPage() {
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Privacy Policy', href: '/privacy' },
  ];

  return (
    <MainLayout title="Privacy Policy" breadcrumbs={breadcrumbs}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Last updated: January 2024</p>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">1. Introduction</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Welcome to Pokemon TCG Deck Builder. We respect your privacy and are committed to protecting your personal data. 
                This privacy policy will inform you about how we look after your personal data when you visit our website and 
                tell you about your privacy rights and how the law protects you.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">2. Information We Collect</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">We may collect, use, store and transfer different kinds of personal data about you:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 dark:text-gray-300">
                <li><strong>Identity Data:</strong> includes first name, last name, username, and similar identifiers.</li>
                <li><strong>Contact Data:</strong> includes email address.</li>
                <li><strong>Technical Data:</strong> includes internet protocol (IP) address, browser type and version, time zone setting, browser plug-in types and versions, operating system and platform.</li>
                <li><strong>Profile Data:</strong> includes your username, deck preferences, collection data, and game statistics.</li>
                <li><strong>Usage Data:</strong> includes information about how you use our website, products and services.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">We will only use your personal data when the law allows us to. Most commonly, we will use your personal data:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 dark:text-gray-300">
                <li>To provide and maintain our service</li>
                <li>To notify you about changes to our service</li>
                <li>To provide customer support</li>
                <li>To gather analysis or valuable information so that we can improve our service</li>
                <li>To monitor the usage of our service</li>
                <li>To detect, prevent and address technical issues</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">4. Data Security</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We have put in place appropriate security measures to prevent your personal data from being accidentally lost, 
                used or accessed in an unauthorized way, altered or disclosed. We use industry-standard encryption and security 
                practices to protect your data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">5. Third-Party Services</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">We use the following third-party services that may collect data:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 dark:text-gray-300">
                <li><strong>Clerk:</strong> For authentication and user management</li>
                <li><strong>Vercel:</strong> For hosting and analytics</li>
                <li><strong>Pokemon TCG API:</strong> For card data and pricing information</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Each of these services has their own privacy policy, and we encourage you to review them.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">6. Your Rights</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">Under data protection laws, you have rights including:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 dark:text-gray-300">
                <li><strong>Your right of access:</strong> You have the right to ask us for copies of your personal data.</li>
                <li><strong>Your right to rectification:</strong> You have the right to ask us to rectify personal data you think is inaccurate.</li>
                <li><strong>Your right to erasure:</strong> You have the right to ask us to erase your personal data in certain circumstances.</li>
                <li><strong>Your right to data portability:</strong> You have the right to ask that we transfer the personal data you gave us to another organization.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">7. Children's Privacy</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Our service is not intended for children under 13 years of age. We do not knowingly collect personal 
                information from children under 13. If you are a parent or guardian and believe your child has provided 
                us with personal information, please contact us.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">8. Changes to This Policy</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We may update our privacy policy from time to time. We will notify you of any changes by posting the new 
                privacy policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">9. Contact Us</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you have any questions about this privacy policy, please contact us:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 dark:text-gray-300">
                <li>By email: privacy@pokemontcgdeckbuilder.com</li>
                <li>By visiting our <a href="/contact" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">contact page</a></li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}