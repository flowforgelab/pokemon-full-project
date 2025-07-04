'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Play, Pause, Trash2, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

interface RedisHealth {
  status: 'healthy' | 'error';
  message: string;
  details?: any;
  error?: string;
}

const QUEUE_NAMES = [
  'priceUpdates',
  'setImports',
  'cardSync',
  'dataCleanup',
  'reports',
  'collectionIndex',
  'aiAnalysis',
] as const;

export default function JobsMonitoringPage() {
  const router = useRouter();
  const [queues, setQueues] = useState<Record<string, QueueStats>>({});
  const [redisHealth, setRedisHealth] = useState<RedisHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Check Redis health
  const checkRedisHealth = async () => {
    try {
      const response = await fetch('/api/health/redis');
      const data = await response.json();
      setRedisHealth(data);
    } catch (error) {
      setRedisHealth({
        status: 'error',
        message: 'Failed to check Redis health',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Fetch queue statistics
  const fetchQueueStats = async () => {
    try {
      const response = await fetch('/api/jobs/stats');
      if (response.ok) {
        const data = await response.json();
        setQueues(data);
      }
    } catch (error) {
      console.error('Failed to fetch queue stats:', error);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([checkRedisHealth(), fetchQueueStats()]);
      setLoading(false);
    };
    loadData();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchQueueStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([checkRedisHealth(), fetchQueueStats()]);
    setRefreshing(false);
  };

  // Queue control actions
  const handleQueueAction = async (queueName: string, action: 'pause' | 'resume' | 'clean') => {
    try {
      const response = await fetch(`/api/jobs/${queueName}/${action}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        await fetchQueueStats();
      }
    } catch (error) {
      console.error(`Failed to ${action} queue ${queueName}:`, error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Job Queue Monitor</h1>
          <p className="text-muted-foreground">Monitor and manage background job queues</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Redis Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Redis Connection Status
            {redisHealth?.status === 'healthy' ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {redisHealth ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={redisHealth.status === 'healthy' ? 'default' : 'destructive'}>
                  {redisHealth.status}
                </Badge>
                <span className="text-sm text-muted-foreground">{redisHealth.message}</span>
              </div>
              {redisHealth.details && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(redisHealth.details, null, 2)}
                  </pre>
                </div>
              )}
              {redisHealth.error && (
                <div className="mt-2 p-3 bg-destructive/10 text-destructive rounded-md">
                  <p className="text-sm font-medium">Error: {redisHealth.error}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Checking Redis connection...</p>
          )}
        </CardContent>
      </Card>

      {/* Queue Statistics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Queue Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {QUEUE_NAMES.map((queueName) => {
              const stats = queues[queueName] || {
                waiting: 0,
                active: 0,
                completed: 0,
                failed: 0,
                delayed: 0,
                paused: false,
              };

              return (
                <Card key={queueName}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {queueName.replace(/([A-Z])/g, ' $1').trim()}
                      </CardTitle>
                      <Badge variant={stats.paused ? 'secondary' : 'default'}>
                        {stats.paused ? 'Paused' : 'Active'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Waiting:</span>
                        <span className="font-medium">{stats.waiting}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Active:</span>
                        <span className="font-medium text-blue-600">{stats.active}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Completed:</span>
                        <span className="font-medium text-green-600">{stats.completed}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Failed:</span>
                        <span className="font-medium text-red-600">{stats.failed}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Delayed:</span>
                        <span className="font-medium text-yellow-600">{stats.delayed}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQueueAction(queueName, stats.paused ? 'resume' : 'pause')}
                      >
                        {stats.paused ? (
                          <>
                            <Play className="h-3 w-3 mr-1" />
                            Resume
                          </>
                        ) : (
                          <>
                            <Pause className="h-3 w-3 mr-1" />
                            Pause
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQueueAction(queueName, 'clean')}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clean
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Queue Details</CardTitle>
              <CardDescription>
                Detailed information about each queue and recent jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {QUEUE_NAMES.map((queueName) => {
                  const stats = queues[queueName] || {
                    waiting: 0,
                    active: 0,
                    completed: 0,
                    failed: 0,
                    delayed: 0,
                    paused: false,
                  };

                  const total = stats.waiting + stats.active + stats.completed + stats.failed + stats.delayed;

                  return (
                    <div key={queueName} className="space-y-2">
                      <h3 className="font-semibold">
                        {queueName.replace(/([A-Z])/g, ' $1').trim()}
                      </h3>
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        {total > 0 && (
                          <div className="h-full flex">
                            {stats.completed > 0 && (
                              <div
                                className="bg-green-500"
                                style={{ width: `${(stats.completed / total) * 100}%` }}
                              />
                            )}
                            {stats.active > 0 && (
                              <div
                                className="bg-blue-500"
                                style={{ width: `${(stats.active / total) * 100}%` }}
                              />
                            )}
                            {stats.waiting > 0 && (
                              <div
                                className="bg-gray-400"
                                style={{ width: `${(stats.waiting / total) * 100}%` }}
                              />
                            )}
                            {stats.delayed > 0 && (
                              <div
                                className="bg-yellow-500"
                                style={{ width: `${(stats.delayed / total) * 100}%` }}
                              />
                            )}
                            {stats.failed > 0 && (
                              <div
                                className="bg-red-500"
                                style={{ width: `${(stats.failed / total) * 100}%` }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-green-500 rounded-full" />
                          Completed
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-blue-500 rounded-full" />
                          Active
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-gray-400 rounded-full" />
                          Waiting
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                          Delayed
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-red-500 rounded-full" />
                          Failed
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}