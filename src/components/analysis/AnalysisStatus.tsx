import { Loader2, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

interface AnalysisStatusProps {
  status: string;
  error?: string | null;
  showProgress?: boolean;
}

export function AnalysisStatus({ status, error, showProgress = true }: AnalysisStatusProps) {
  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-600 mb-2">Analysis Failed</h3>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const isQueued = status.includes('queued');
  const isProcessing = status.includes('analyzing');
  const isComplete = status.includes('complete');

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        {isComplete ? (
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        ) : isQueued ? (
          <Clock className="w-12 h-12 text-blue-500 mx-auto mb-4" />
        ) : (
          <Loader2 className="w-12 h-12 text-purple-600 mx-auto mb-4 animate-spin" />
        )}
        
        <h3 className="text-lg font-semibold mb-2">{status}</h3>
        
        {showProgress && !isComplete && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className={`w-3 h-3 rounded-full ${isQueued || isProcessing || isComplete ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Analysis queued</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className={`w-3 h-3 rounded-full ${isProcessing || isComplete ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Processing started</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className={`w-3 h-3 rounded-full ${isComplete ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Analysis complete</span>
            </div>
          </div>
        )}
        
        {isProcessing && (
          <p className="text-sm text-gray-500 mt-4">
            The AI is carefully analyzing your deck. This may take 30-60 seconds for GPT-4 models.
          </p>
        )}
      </div>
    </div>
  );
}