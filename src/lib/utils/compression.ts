import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export async function compress(data: string): Promise<Buffer> {
  return gzipAsync(Buffer.from(data, 'utf-8'));
}

export async function decompress(data: Buffer): Promise<string> {
  const decompressed = await gunzipAsync(data);
  return decompressed.toString('utf-8');
}