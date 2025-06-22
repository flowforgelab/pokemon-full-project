// Image optimization utilities with CDN integration

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  blur?: number;
  sharpen?: boolean;
  grayscale?: boolean;
}

export interface ImageCDNProvider {
  name: string;
  transformUrl(src: string, options: ImageOptimizationOptions): string;
  isSupported(src: string): boolean;
}

// Cloudinary CDN provider
class CloudinaryCDN implements ImageCDNProvider {
  name = 'cloudinary';
  private cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
  
  isSupported(src: string): boolean {
    return src.includes('cloudinary.com') || src.startsWith('http');
  }
  
  transformUrl(src: string, options: ImageOptimizationOptions): string {
    if (!this.cloudName) return src;
    
    const transformations: string[] = [];
    
    // Size transformations
    if (options.width || options.height) {
      let sizing = '';
      if (options.width) sizing += `w_${options.width}`;
      if (options.height) sizing += `${sizing ? ',' : ''}h_${options.height}`;
      if (options.fit) sizing += `,c_${this.mapFit(options.fit)}`;
      transformations.push(sizing);
    }
    
    // Quality
    if (options.quality) {
      transformations.push(`q_${options.quality}`);
    }
    
    // Format
    if (options.format && options.format !== 'auto') {
      transformations.push(`f_${options.format}`);
    } else {
      transformations.push('f_auto');
    }
    
    // Effects
    if (options.blur) {
      transformations.push(`e_blur:${options.blur}`);
    }
    if (options.sharpen) {
      transformations.push('e_sharpen');
    }
    if (options.grayscale) {
      transformations.push('e_grayscale');
    }
    
    // Progressive loading
    transformations.push('fl_progressive');
    
    // Build URL
    const transformation = transformations.join(',');
    
    if (src.includes('cloudinary.com')) {
      // Already a Cloudinary URL, insert transformations
      const parts = src.split('/upload/');
      return `${parts[0]}/upload/${transformation}/${parts[1]}`;
    } else {
      // External URL, use fetch
      return `https://res.cloudinary.com/${this.cloudName}/image/fetch/${transformation}/${encodeURIComponent(src)}`;
    }
  }
  
  private mapFit(fit: string): string {
    const fitMap: Record<string, string> = {
      cover: 'fill',
      contain: 'fit',
      fill: 'scale',
      inside: 'fit',
      outside: 'limit',
    };
    return fitMap[fit] || 'fill';
  }
}

// Imgix CDN provider
class ImgixCDN implements ImageCDNProvider {
  name = 'imgix';
  private domain = process.env.NEXT_PUBLIC_IMGIX_DOMAIN || '';
  
  isSupported(src: string): boolean {
    return src.includes('imgix.net') || src.startsWith('http');
  }
  
  transformUrl(src: string, options: ImageOptimizationOptions): string {
    if (!this.domain) return src;
    
    const params = new URLSearchParams();
    
    // Size
    if (options.width) params.set('w', options.width.toString());
    if (options.height) params.set('h', options.height.toString());
    if (options.fit) params.set('fit', options.fit);
    
    // Quality
    if (options.quality) params.set('q', options.quality.toString());
    
    // Format
    if (options.format === 'auto') {
      params.set('auto', 'format');
    } else if (options.format) {
      params.set('fm', options.format);
    }
    
    // Effects
    if (options.blur) params.set('blur', options.blur.toString());
    if (options.sharpen) params.set('sharp', '10');
    if (options.grayscale) params.set('sat', '-100');
    
    // Performance
    params.set('auto', 'compress');
    
    // Build URL
    const baseUrl = src.includes('imgix.net') ? src : `https://${this.domain}/${src}`;
    return `${baseUrl}?${params.toString()}`;
  }
}

// Next.js Image optimization
class NextImageCDN implements ImageCDNProvider {
  name = 'nextjs';
  
  isSupported(src: string): boolean {
    return src.startsWith('/') || src.startsWith('/_next');
  }
  
  transformUrl(src: string, options: ImageOptimizationOptions): string {
    const params = new URLSearchParams();
    
    params.set('url', src);
    if (options.width) params.set('w', options.width.toString());
    if (options.quality) params.set('q', options.quality.toString());
    
    return `/_next/image?${params.toString()}`;
  }
}

// Image optimization manager
export class ImageOptimizer {
  private static providers: ImageCDNProvider[] = [
    new CloudinaryCDN(),
    new ImgixCDN(),
    new NextImageCDN(),
  ];
  
  static getOptimizedUrl(
    src: string,
    options: ImageOptimizationOptions = {}
  ): string {
    // Find suitable provider
    const provider = this.providers.find(p => p.isSupported(src));
    
    if (!provider) {
      return src;
    }
    
    // Apply defaults
    const defaultOptions: ImageOptimizationOptions = {
      quality: 85,
      format: 'auto',
      ...options,
    };
    
    return provider.transformUrl(src, defaultOptions);
  }
  
  static generateSrcSet(
    src: string,
    widths: number[],
    options: ImageOptimizationOptions = {}
  ): string {
    return widths
      .map(width => {
        const url = this.getOptimizedUrl(src, { ...options, width });
        return `${url} ${width}w`;
      })
      .join(', ');
  }
  
  static generateSizes(breakpoints: { width: number; size: string }[]): string {
    return breakpoints
      .map(({ width, size }) => `(max-width: ${width}px) ${size}`)
      .join(', ');
  }
  
  static getBlurDataURL(src: string): string {
    return this.getOptimizedUrl(src, {
      width: 10,
      quality: 10,
      blur: 20,
    });
  }
  
  static preloadImage(src: string, options?: ImageOptimizationOptions): void {
    if (typeof window === 'undefined') return;
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = this.getOptimizedUrl(src, options);
    
    if (options?.format) {
      link.type = `image/${options.format}`;
    }
    
    document.head.appendChild(link);
  }
  
  static async analyzeImage(src: string): Promise<{
    width: number;
    height: number;
    aspectRatio: number;
    size?: number;
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight,
        });
      };
      
      img.onerror = reject;
      img.src = src;
    });
  }
}

// Pokemon card image optimization
export class PokemonCardImageOptimizer {
  static readonly CARD_SIZES = {
    thumbnail: { width: 100, height: 140 },
    small: { width: 200, height: 280 },
    medium: { width: 300, height: 420 },
    large: { width: 400, height: 560 },
    full: { width: 600, height: 840 },
  };
  
  static getCardImageUrl(
    cardImageUrl: string,
    size: keyof typeof PokemonCardImageOptimizer.CARD_SIZES = 'medium',
    options?: Partial<ImageOptimizationOptions>
  ): string {
    const dimensions = this.CARD_SIZES[size];
    
    return ImageOptimizer.getOptimizedUrl(cardImageUrl, {
      ...dimensions,
      quality: 90,
      format: 'webp',
      ...options,
    });
  }
  
  static getCardSrcSet(cardImageUrl: string): string {
    const sizes = Object.entries(this.CARD_SIZES).map(([_, dim]) => dim.width);
    
    return ImageOptimizer.generateSrcSet(cardImageUrl, sizes, {
      quality: 90,
      format: 'webp',
    });
  }
  
  static getCardSizes(): string {
    return ImageOptimizer.generateSizes([
      { width: 640, size: '100px' },
      { width: 768, size: '200px' },
      { width: 1024, size: '300px' },
      { width: 1280, size: '400px' },
    ]);
  }
  
  static preloadCardImages(cardImageUrls: string[]): void {
    cardImageUrls.slice(0, 5).forEach(url => {
      ImageOptimizer.preloadImage(url, {
        width: this.CARD_SIZES.medium.width,
        quality: 90,
        format: 'webp',
      });
    });
  }
}

// Image lazy loading manager
export class ImageLazyLoader {
  private static observer: IntersectionObserver | null = null;
  private static loadedImages = new Set<string>();
  
  static initialize(): void {
    if (typeof window === 'undefined' || this.observer) return;
    
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            this.loadImage(img);
            this.observer?.unobserve(img);
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
      }
    );
  }
  
  static observe(img: HTMLImageElement): void {
    if (!this.observer) this.initialize();
    this.observer?.observe(img);
  }
  
  static loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    if (!src || this.loadedImages.has(src)) return;
    
    // Create a new image to preload
    const tempImg = new Image();
    
    tempImg.onload = () => {
      img.src = src;
      img.classList.add('loaded');
      this.loadedImages.add(src);
      
      // Remove blur placeholder if exists
      const placeholder = img.previousElementSibling;
      if (placeholder?.classList.contains('image-placeholder')) {
        placeholder.remove();
      }
    };
    
    tempImg.onerror = () => {
      img.classList.add('error');
    };
    
    tempImg.src = src;
  }
  
  static loadImagesInViewport(): void {
    const images = document.querySelectorAll('img[data-src]');
    images.forEach(img => {
      const rect = img.getBoundingClientRect();
      if (
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= window.innerHeight &&
        rect.left <= window.innerWidth
      ) {
        this.loadImage(img as HTMLImageElement);
      }
    });
  }
  
  static destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.loadedImages.clear();
  }
}