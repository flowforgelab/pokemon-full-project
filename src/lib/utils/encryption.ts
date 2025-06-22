import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const secretKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const salt = process.env.ENCRYPTION_SALT || crypto.randomBytes(16).toString('hex');

function getKey(): Buffer {
  return crypto.scryptSync(secretKey, salt, 32);
}

export async function encrypt(data: string): Promise<string> {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return JSON.stringify({
    encrypted,
    authTag: authTag.toString('hex'),
    iv: iv.toString('hex'),
  });
}

export async function decrypt(encryptedData: string): Promise<string> {
  const { encrypted, authTag, iv } = JSON.parse(encryptedData);
  const key = getKey();
  
  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}