import { z } from 'zod';
import { BaseApiClient } from './base-client';
import type {
  TCGPlayerAuthResponse,
  TCGPlayerProduct,
  TCGPlayerPrice,
  TCGPlayerPriceHistory,
  ApiCallResult,
  AuthenticationError,
} from './types';

// Zod schemas for validation
const TCGPlayerAuthSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  scope: z.string(),
});

const TCGPlayerProductSchema = z.object({
  productId: z.number(),
  name: z.string(),
  cleanName: z.string(),
  imageUrl: z.string().optional(),
  categoryId: z.number(),
  groupId: z.number(),
  url: z.string(),
  modifiedOn: z.string(),
});

const TCGPlayerPriceSchema = z.object({
  productId: z.number(),
  lowPrice: z.number().nullable().optional(),
  midPrice: z.number().nullable().optional(),
  highPrice: z.number().nullable().optional(),
  marketPrice: z.number().nullable().optional(),
  directLowPrice: z.number().nullable().optional(),
  subTypeName: z.string(),
});

export class TCGPlayerClient extends BaseApiClient {
  private publicKey: string;
  private privateKey: string;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private categoryId = 3; // Pokemon TCG category ID

  constructor(publicKey: string, privateKey: string) {
    super({
      baseUrl: process.env.TCGPLAYER_API_URL || 'https://api.tcgplayer.com',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimitConfig: {
        maxRequests: 1000,
        windowMs: 60 * 60 * 1000, // 1 hour
      },
    });
    this.publicKey = publicKey;
    this.privateKey = privateKey;
  }

  protected getRateLimitKey(): string {
    return 'tcgplayer-api';
  }

  /**
   * Authenticate with TCGPlayer API
   */
  async authenticateAPI(): Promise<ApiCallResult<TCGPlayerAuthResponse>> {
    const authString = Buffer.from(`${this.publicKey}:${this.privateKey}`).toString('base64');
    
    const result = await this.request<TCGPlayerAuthResponse>(
      '/token',
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      },
      TCGPlayerAuthSchema
    );

    if (result.data) {
      this.accessToken = result.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (result.data.expires_in * 1000));
      // Update headers for future requests
      this.headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return result;
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry <= new Date()) {
      const result = await this.authenticateAPI();
      if (result.error) {
        throw new AuthenticationError('Failed to authenticate with TCGPlayer API');
      }
    }
  }

  /**
   * Get prices for multiple products
   */
  async getCardPrices(productIds: number[]): Promise<ApiCallResult<TCGPlayerPrice[]>> {
    await this.ensureAuthenticated();

    if (productIds.length === 0) {
      return { data: [] };
    }

    // TCGPlayer API accepts up to 250 product IDs per request
    const chunks = this.chunkArray(productIds, 250);
    const allPrices: TCGPlayerPrice[] = [];

    for (const chunk of chunks) {
      const productIdString = chunk.join(',');
      
      const result = await this.request<{ results: TCGPlayerPrice[] }>(
        `/pricing/product/${productIdString}`,
        { method: 'GET' },
        z.object({ results: z.array(TCGPlayerPriceSchema) })
      );

      if (result.error) {
        return { error: result.error };
      }

      if (result.data) {
        allPrices.push(...result.data.results);
      }
    }

    return { data: allPrices };
  }

  /**
   * Get market prices for a specific product
   */
  async getMarketPrices(productId: number): Promise<ApiCallResult<TCGPlayerPrice[]>> {
    await this.ensureAuthenticated();

    const result = await this.request<{ results: TCGPlayerPrice[] }>(
      `/pricing/product/${productId}`,
      { method: 'GET' },
      z.object({ results: z.array(TCGPlayerPriceSchema) })
    );

    return result.data ? { data: result.data.results } : result;
  }

  /**
   * Get price history for a product
   */
  async getPriceHistory(
    productId: number,
    days = 30
  ): Promise<ApiCallResult<TCGPlayerPriceHistory[]>> {
    await this.ensureAuthenticated();

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

    const result = await this.request<{ results: TCGPlayerPriceHistory[] }>(
      `/pricing/marketprices/${productId}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
      { method: 'GET' }
    );

    return result.data ? { data: result.data.results } : result;
  }

  /**
   * Search for products by name
   */
  async searchProducts(
    name: string,
    setName?: string,
    limit = 50
  ): Promise<ApiCallResult<TCGPlayerProduct[]>> {
    await this.ensureAuthenticated();

    const filters: string[] = [`productName:"${name}"`];
    if (setName) {
      filters.push(`groupName:"${setName}"`);
    }

    const result = await this.request<{ results: TCGPlayerProduct[] }>(
      `/catalog/products?categoryId=${this.categoryId}&productTypes=Cards&limit=${limit}&includeSkus=false&filters=${encodeURIComponent(filters.join(' AND '))}`,
      { method: 'GET' },
      z.object({ results: z.array(TCGPlayerProductSchema) })
    );

    return result.data ? { data: result.data.results } : result;
  }

  /**
   * Get product details by ID
   */
  async getProductById(productId: number): Promise<ApiCallResult<TCGPlayerProduct>> {
    await this.ensureAuthenticated();

    const result = await this.request<{ results: TCGPlayerProduct[] }>(
      `/catalog/products/${productId}`,
      { method: 'GET' },
      z.object({ results: z.array(TCGPlayerProductSchema) })
    );

    if (result.data && result.data.results.length > 0) {
      return { data: result.data.results[0] };
    }

    return { error: new Error('Product not found') };
  }

  /**
   * Get products by TCGPlayer IDs
   */
  async getProductsByIds(productIds: number[]): Promise<ApiCallResult<TCGPlayerProduct[]>> {
    await this.ensureAuthenticated();

    if (productIds.length === 0) {
      return { data: [] };
    }

    const chunks = this.chunkArray(productIds, 250);
    const allProducts: TCGPlayerProduct[] = [];

    for (const chunk of chunks) {
      const productIdString = chunk.join(',');
      
      const result = await this.request<{ results: TCGPlayerProduct[] }>(
        `/catalog/products/${productIdString}`,
        { method: 'GET' },
        z.object({ results: z.array(TCGPlayerProductSchema) })
      );

      if (result.error) {
        return { error: result.error };
      }

      if (result.data) {
        allProducts.push(...result.data.results);
      }
    }

    return { data: allProducts };
  }

  /**
   * Get all Pokemon TCG sets/groups
   */
  async getAllGroups(limit = 1000): Promise<ApiCallResult<any[]>> {
    await this.ensureAuthenticated();

    const result = await this.request<{ results: any[] }>(
      `/catalog/groups?categoryId=${this.categoryId}&limit=${limit}`,
      { method: 'GET' }
    );

    return result.data ? { data: result.data.results } : result;
  }

  /**
   * Helper method to chunk arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}