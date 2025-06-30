/**
 * XSS Protection utilities for the Pokemon TCG Deck Builder
 */

/**
 * List of allowed HTML tags for rich text content
 */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li'];

/**
 * List of allowed attributes for specific tags
 */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel'],
};

/**
 * Sanitize HTML content allowing only safe tags and attributes
 * For use when some HTML formatting is needed (like in descriptions)
 */
export function sanitizeHtmlContent(html: string): string {
  if (!html || typeof html !== 'string') return '';
  
  // First, encode all HTML entities
  let sanitized = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  // Then decode only allowed tags
  ALLOWED_TAGS.forEach(tag => {
    // Opening tags
    const openTagRegex = new RegExp(`&lt;${tag}(\\s[^&]*)?&gt;`, 'gi');
    sanitized = sanitized.replace(openTagRegex, (match, attributes) => {
      if (!attributes) return `<${tag}>`;
      
      // Process attributes for allowed tags
      if (ALLOWED_ATTRIBUTES[tag]) {
        const cleanedAttributes = sanitizeAttributes(attributes, ALLOWED_ATTRIBUTES[tag]);
        return `<${tag}${cleanedAttributes}>`;
      }
      
      return `<${tag}>`;
    });
    
    // Closing tags
    const closeTagRegex = new RegExp(`&lt;/${tag}&gt;`, 'gi');
    sanitized = sanitized.replace(closeTagRegex, `</${tag}>`);
  });
  
  return sanitized;
}

/**
 * Sanitize attributes for allowed HTML tags
 */
function sanitizeAttributes(attributeString: string, allowedAttrs: string[]): string {
  const attrs: string[] = [];
  const attrRegex = /(\w+)\s*=\s*["']([^"']*)["']/g;
  
  let match;
  while ((match = attrRegex.exec(attributeString)) !== null) {
    const [, attrName, attrValue] = match;
    
    if (allowedAttrs.includes(attrName.toLowerCase())) {
      // Special handling for href to prevent javascript: URLs
      if (attrName.toLowerCase() === 'href') {
        const sanitizedHref = sanitizeUrl(attrValue);
        if (sanitizedHref) {
          attrs.push(`${attrName}="${sanitizedHref}"`);
        }
      } else {
        // Escape quotes in attribute values
        const escapedValue = attrValue.replace(/"/g, '&quot;');
        attrs.push(`${attrName}="${escapedValue}"`);
      }
    }
  }
  
  // Add rel="noopener noreferrer" to links with target
  if (attributeString.includes('target=') && !attributeString.includes('rel=')) {
    attrs.push('rel="noopener noreferrer"');
  }
  
  return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
}

/**
 * Sanitize URLs to prevent XSS through javascript: and data: protocols
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  
  // Trim and lowercase for checking
  const trimmedUrl = url.trim();
  const lowerUrl = trimmedUrl.toLowerCase();
  
  // Block dangerous protocols
  const dangerousProtocols = [
    'javascript:',
    'vbscript:',
    'data:text/html',
    'data:text/javascript',
    'data:application/javascript',
  ];
  
  if (dangerousProtocols.some(protocol => lowerUrl.startsWith(protocol))) {
    return '';
  }
  
  // Allow relative URLs
  if (trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//')) {
    return trimmedUrl;
  }
  
  // Allow http(s) URLs
  try {
    const parsed = new URL(trimmedUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmedUrl;
    }
  } catch {
    // If parsing fails, it's not a valid URL
    return '';
  }
  
  return '';
}

/**
 * Escape HTML entities in a string
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return str.replace(/[&<>"'/]/g, (match) => htmlEscapes[match] || match);
}

/**
 * Create a safe text node that automatically escapes content
 */
export function createSafeTextNode(content: string): Text {
  return document.createTextNode(content || '');
}

/**
 * Set text content safely (alternative to innerHTML for plain text)
 */
export function setSafeTextContent(element: HTMLElement, content: string): void {
  element.textContent = content || '';
}

/**
 * Validate and sanitize image URLs
 */
export function sanitizeImageUrl(url: string, allowedDomains?: string[]): string {
  if (!url || typeof url !== 'string') return '/images/placeholder.png';
  
  // Default allowed domains for Pokemon TCG images
  const defaultAllowedDomains = [
    'images.pokemontcg.io',
    'api.pokemontcg.io',
    'tcgplayer.com',
    'assets.pokemon.com',
  ];
  
  const domains = allowedDomains || defaultAllowedDomains;
  
  try {
    const parsed = new URL(url);
    
    // Only allow http(s) protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '/images/placeholder.png';
    }
    
    // Check if domain is allowed
    const isAllowed = domains.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
    
    if (!isAllowed) {
      console.warn(`Blocked image from untrusted domain: ${parsed.hostname}`);
      return '/images/placeholder.png';
    }
    
    return url;
  } catch {
    // For relative URLs, allow them
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }
    return '/images/placeholder.png';
  }
}

/**
 * Sanitize JSON data to prevent XSS through property values
 */
export function sanitizeJsonData<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized: any = Array.isArray(data) ? [] : {};
  
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const value = data[key];
      
      if (typeof value === 'string') {
        // Sanitize string values
        sanitized[key] = sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeJsonData(value);
      } else {
        // Keep other types as-is
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized as T;
}

/**
 * Basic sanitization function that should match the one from validations
 */
function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/javascript/gi, '')
    .replace(/data:application\/javascript/gi, '')
    .replace(/[<>]/g, (match) => {
      const escapeMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
      };
      return escapeMap[match] || match;
    })
    .trim();
}