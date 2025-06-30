import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security middleware to add Content Security Policy and other security headers
 */
export function securityMiddleware(request: NextRequest, response: NextResponse) {
  // Content Security Policy
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.*.lcl.dev https://*.clerk.accounts.dev;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' https: data: blob:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://api.pokemontcg.io https://*.clerk.accounts.dev https://*.vercel-insights.com wss://localhost:* ws://localhost:*;
    media-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  // Apply security headers
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Strict Transport Security (only for production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  return response;
}

/**
 * Sanitize user input to prevent XSS
 * This is a backup to the validation library sanitization
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: protocol for scripts
    .replace(/data:text\/javascript/gi, '')
    // Escape HTML entities
    .replace(/[<>]/g, (match) => {
      const escapeMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
      };
      return escapeMap[match] || match;
    })
    .trim();
}

/**
 * Validate and sanitize URLs
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  
  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    
    // Prevent javascript: and data: URLs
    if (url.toLowerCase().includes('javascript:') || url.toLowerCase().includes('data:')) {
      return '';
    }
    
    return url;
  } catch {
    // If URL parsing fails, check if it's a relative URL
    if (url.startsWith('/') && !url.includes('//')) {
      return url;
    }
    return '';
  }
}