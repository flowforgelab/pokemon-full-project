'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';

export default function ImportPage() {
  const { isSignedIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/import-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action,
          setLimit: action === 'import-sets' ? 10 : 3 // Import 10 sets, but only cards from 3
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="min-h-screen p-8">
        <h1 className="text-3xl font-bold mb-4">Admin - Import Cards</h1>
        <p className="text-red-600">You must be signed in to access this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Pokemon Card Import</h1>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
        <h2 className="font-semibold mb-2">⚠️ Rate Limits</h2>
        <ul className="text-sm space-y-1">
          <li>• With API key: 20,000 requests/day</li>
          <li>• Without API key: 1,000 requests/day</li>
          <li>• Current limit: 1,000 requests/hour</li>
        </ul>
      </div>

      <div className="space-y-6">
        {/* Get Stats */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">📊 Database Statistics</h2>
          <button
            onClick={() => handleAction('get-stats')}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Get Current Stats'}
          </button>
        </div>

        {/* Import Sets */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">📦 Step 1: Import Sets</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Import Pokemon TCG sets (metadata only, no cards). This is fast and uses minimal API calls.
          </p>
          <button
            onClick={() => handleAction('import-sets')}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Importing...' : 'Import 10 Recent Sets'}
          </button>
        </div>

        {/* Import Cards */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">🎴 Step 2: Import Cards</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Import cards from the most recent sets. This will import the first 50 cards from each of the 3 most recent sets.
          </p>
          <button
            onClick={() => handleAction('import-cards')}
            disabled={loading}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {loading ? 'Importing...' : 'Import Cards (Test)'}
          </button>
        </div>

        {/* Results */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 rounded-lg p-4">
            <h3 className="font-semibold text-red-600 dark:text-red-400">Error</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-100 dark:bg-green-900/20 border border-green-400 rounded-lg p-4">
            <h3 className="font-semibold text-green-600 dark:text-green-400 mb-2">Result</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
        <h3 className="font-semibold mb-2">💡 Import Strategy</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>First, click "Get Current Stats" to see what's already imported</li>
          <li>Click "Import Sets" to import set metadata</li>
          <li>Click "Import Cards" to import a test batch of cards</li>
          <li>For full import, use the script: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">npx tsx src/scripts/import-cards.ts</code></li>
        </ol>
      </div>
    </div>
  );
}