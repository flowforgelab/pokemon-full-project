import { MainLayout } from '@/components/layout/MainLayout';

export default function TermsPage() {
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Terms of Service', href: '/terms' },
  ];

  return (
    <MainLayout title="Terms of Service" breadcrumbs={breadcrumbs}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Terms of Service</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Last updated: January 2024</p>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                By accessing and using Pokemon TCG Deck Builder, you accept and agree to be bound by the terms and provision 
                of this agreement. If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">2. Description of Service</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Pokemon TCG Deck Builder provides tools and services for Pokemon Trading Card Game players including:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 dark:text-gray-300">
                <li>Deck building and analysis tools</li>
                <li>Collection tracking and management</li>
                <li>Card pricing and market data</li>
                <li>Community features for sharing and trading</li>
                <li>Tournament preparation tools</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">3. User Accounts</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                When you create an account with us, you must provide information that is accurate, complete, and current at all times. 
                You are responsible for safeguarding the password and for all activities that occur under your account.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You agree to notify us immediately of any unauthorized access to or use of your account.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">4. Acceptable Use</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">You agree not to use the service to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 dark:text-gray-300">
                <li>Violate any laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Distribute malware or harmful code</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Engage in any activity that disrupts or interferes with our service</li>
                <li>Use automated systems or software to extract data from our service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">5. Intellectual Property</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                The service and its original content, features, and functionality are owned by Pokemon TCG Deck Builder and are 
                protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Pokemon and all character names are trademarks of Nintendo, Creatures, and GAMEFREAK. We are not affiliated with 
                or endorsed by these companies.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">6. User Content</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Our service allows you to post, link, store, share and otherwise make available certain information, text, or materials 
                ("Content"). You are responsible for the Content that you post to the service.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                By posting Content to the service, you grant us the right and license to use, modify, publicly perform, publicly display, 
                reproduce, and distribute such Content on and through the service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">7. Subscription and Payments</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Some parts of the service are billed on a subscription basis. You will be billed in advance on a recurring and 
                periodic basis ("Billing Cycle"). Billing cycles are set on a monthly or annual basis.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                You agree to pay all charges at the prices then in effect for your purchases, and you authorize us to charge your 
                chosen payment provider.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">8. Termination</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, 
                including without limitation if you breach the Terms.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Upon termination, your right to use the service will cease immediately. If you wish to terminate your account, 
                you may do so through your account settings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">9. Disclaimer</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                The service is provided on an "AS IS" and "AS AVAILABLE" basis. The service is provided without warranties of any kind, 
                whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a 
                particular purpose, non-infringement or course of performance.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">10. Limitation of Liability</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                In no event shall Pokemon TCG Deck Builder, nor its directors, employees, partners, agents, suppliers, or affiliates, 
                be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, 
                loss of profits, data, use, goodwill, or other intangible losses.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">11. Changes to Terms</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, 
                we will try to provide at least 30 days notice prior to any new terms taking effect.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">12. Contact Information</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you have any questions about these Terms, please contact us:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 dark:text-gray-300">
                <li>By email: legal@pokemontcgdeckbuilder.com</li>
                <li>By visiting our <a href="/contact" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">contact page</a></li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}