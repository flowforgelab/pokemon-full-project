import { z } from 'zod';
import pRetry from 'p-retry';
import { ApiError, NetworkError, RateLimitError, type ApiCallResult, type RateLimitInfo } from './types';

export interface ApiClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  rateLimitConfig?: {
    maxRequests: number;
    windowMs: number;
  };
}

export abstract class BaseApiClient {
  protected baseUrl: string;
  protected headers: Record<string, string>;
  protected timeout: number;
  protected maxRetries: number;
  protected retryDelay: number;
  protected requestQueue: Array<() => Promise<any>> = [];
  protected rateLimitInfo: Map<string, RateLimitInfo> = new Map();
  
  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.headers = config.headers || {};
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodSchema<T>
  ): Promise<ApiCallResult<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await pRetry(
        async () => {
          // Check rate limits before making request
          const rateLimitKey = this.getRateLimitKey();
          const currentLimit = this.rateLimitInfo.get(rateLimitKey);
          
          if (currentLimit && currentLimit.remaining === 0 && currentLimit.reset > new Date()) {
            throw new RateLimitError(
              'Rate limit exceeded',
              Math.ceil((currentLimit.reset.getTime() - Date.now()) / 1000),
              currentLimit.limit,
              0
            );
          }

          const res = await fetch(url, {
            ...options,
            headers: {
              ...this.headers,
              ...options.headers,
            },
            signal: controller.signal,
          });

          // Update rate limit info from response headers
          this.updateRateLimitInfo(res.headers);

          if (!res.ok) {
            await this.handleErrorResponse(res);
          }

          return res;
        },
        {
          retries: this.maxRetries,
          minTimeout: this.retryDelay,
          maxTimeout: this.retryDelay * 8,
          onFailedAttempt: (error) => {
            console.error(`API request failed (attempt ${error.attemptNumber}):`, error.message);
            
            // Don't retry certain errors
            if (error instanceof ApiError && !error.retryable) {
              throw error;
            }
          },
          retryOptions: {
            shouldRetry: (error) => {
              if (error instanceof ApiError) {
                return error.retryable;
              }
              return true;
            },
          },
        }
      );

      clearTimeout(timeoutId);

      const data = await response.json();
      
      // Validate response data if schema provided
      if (schema) {
        const validationResult = schema.safeParse(data);
        if (!validationResult.success) {
          throw new ApiError(
            'Response validation failed',
            'VALIDATION_ERROR',
            undefined,
            false,
            validationResult.error.flatten()
          );
        }
        return { data: validationResult.data };
      }

      return { data };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof ApiError) {
        return { error };
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { error: new NetworkError('Request timeout', error) };
        }
        return { error: new NetworkError(error.message, error) };
      }
      
      return { error: new ApiError('Unknown error occurred', 'UNKNOWN_ERROR') };
    }
  }

  protected async handleErrorResponse(response: Response): Promise<void> {
    const contentType = response.headers.get('content-type');
    let errorData: any = {};

    if (contentType?.includes('application/json')) {
      try {
        errorData = await response.json();
      } catch {
        // Ignore JSON parse errors
      }
    }

    switch (response.status) {
      case 429:
        const retryAfter = parseInt(response.headers.get('retry-after') || '60');
        const limit = parseInt(response.headers.get('x-ratelimit-limit') || '0');
        const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '0');
        throw new RateLimitError(
          errorData.message || 'Rate limit exceeded',
          retryAfter,
          limit,
          remaining
        );
      
      case 401:
        throw new ApiError(
          errorData.message || 'Authentication failed',
          'AUTHENTICATION_FAILED',
          401,
          true
        );
      
      case 403:
        throw new ApiError(
          errorData.message || 'Access forbidden',
          'FORBIDDEN',
          403,
          false
        );
      
      case 404:
        throw new ApiError(
          errorData.message || 'Resource not found',
          'NOT_FOUND',
          404,
          false
        );
      
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ApiError(
          errorData.message || 'Server error',
          'SERVER_ERROR',
          response.status,
          true
        );
      
      default:
        throw new ApiError(
          errorData.message || `Request failed with status ${response.status}`,
          'REQUEST_FAILED',
          response.status,
          response.status >= 500
        );
    }
  }

  protected updateRateLimitInfo(headers: Headers): void {
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');

    if (limit && remaining && reset) {
      const rateLimitKey = this.getRateLimitKey();
      this.rateLimitInfo.set(rateLimitKey, {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        reset: new Date(parseInt(reset) * 1000),
      });
    }
  }

  protected abstract getRateLimitKey(): string;

  public getRateLimitStatus(): RateLimitInfo | undefined {
    return this.rateLimitInfo.get(this.getRateLimitKey());
  }
}