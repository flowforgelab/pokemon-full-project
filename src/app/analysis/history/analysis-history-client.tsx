'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { PremiumCard } from '@/components/ui';
import { 
  Brain, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  Search
} from 'lucide-react';
import type { Analysis, Deck } from '@prisma/client';

interface AnalysisWithDeck extends Analysis {
  deck: Pick<Deck, 'id' | 'name' | 'formatId'>;
}

interface AnalysisHistoryClientProps {
  analyses: AnalysisWithDeck[];
}

export function AnalysisHistoryClient({ analyses }: AnalysisHistoryClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredAnalyses = analyses.filter(analysis => {
    const matchesSearch = analysis.deck.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || analysis.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'FAILED':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'PROCESSING':
        return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };


  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProcessingTime = (analysis: AnalysisWithDeck) => {
    if (!analysis.startedAt || !analysis.completedAt) return null;
    
    const start = new Date(analysis.startedAt).getTime();
    const end = new Date(analysis.completedAt).getTime();
    const seconds = Math.round((end - start) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleViewAnalysis = async (analysis: AnalysisWithDeck) => {
    if (analysis.status === 'COMPLETED') {
      // Navigate to the deck analysis page with the result
      router.push(`/decks/${analysis.deckId}/analyze/ai?analysisId=${analysis.id}`);
    } else if (analysis.status === 'PROCESSING' || analysis.status === 'PENDING') {
      // Navigate to the deck analysis page to continue monitoring
      router.push(`/decks/${analysis.deckId}/analyze/ai?jobId=${analysis.jobId}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-8 h-8 text-purple-600" />
          <h1 className="text-3xl font-bold">Analysis History</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          View and manage your AI deck analyses
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by deck name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-600"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-600"
          >
            <option value="all">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PROCESSING">In Progress</option>
            <option value="PENDING">Queued</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Analysis List */}
      {filteredAnalyses.length === 0 ? (
        <PremiumCard>
          <div className="p-12 text-center">
            <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No analyses found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'Start analyzing your decks to see them here'}
            </p>
            {analyses.length === 0 && (
              <Button
                onClick={() => router.push('/decks')}
                variant="primary"
              >
                Go to My Decks
              </Button>
            )}
          </div>
        </PremiumCard>
      ) : (
        <div className="space-y-4">
          {filteredAnalyses.map((analysis) => (
            <PremiumCard key={analysis.id}>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(analysis.status)}
                      <h3 className="text-lg font-semibold">{analysis.deck.name}</h3>
                      <span className="text-sm text-gray-500">
                        {analysis.deck.formatId ? 'Custom' : 'Standard'}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(analysis.createdAt)}</span>
                      </div>
                      
                      {analysis.model && (
                        <div className="flex items-center gap-1">
                          <Brain className="w-4 h-4" />
                          <span>{analysis.model}</span>
                        </div>
                      )}
                      
                      {getProcessingTime(analysis) && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{getProcessingTime(analysis)}</span>
                        </div>
                      )}
                    </div>

                    {analysis.focusAreas && analysis.focusAreas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {analysis.focusAreas.map((area) => (
                          <span
                            key={area}
                            className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    )}

                    {analysis.error && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        Error: {analysis.error}
                      </p>
                    )}
                  </div>

                  <div className="ml-4">
                    <Button
                      onClick={() => handleViewAnalysis(analysis)}
                      variant={analysis.status === 'COMPLETED' ? 'primary' : 'outline'}
                      size="sm"
                      disabled={analysis.status === 'FAILED'}
                    >
                      {analysis.status === 'COMPLETED' ? 'View Results' : 
                       analysis.status === 'PROCESSING' || analysis.status === 'PENDING' ? 'Check Status' :
                       'Failed'}
                      {analysis.status !== 'FAILED' ? <ArrowRight className="w-4 h-4 ml-1" /> : null}
                    </Button>
                  </div>
                </div>
              </div>
            </PremiumCard>
          ))}
        </div>
      )}
    </div>
  );
}