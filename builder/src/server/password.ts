import 'server-only';
import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 32;

function scryptAsync(password: string, salt: Buffer, keylen: number) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString('base64')}:${derivedKey.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const storedHash = Buffer.from(hashB64, 'base64');
  if (storedHash.length !== SCRYPT_KEYLEN) return false;
  const derivedKey = await scryptAsync(password, salt, storedHash.length);
  return crypto.timingSafeEqual(storedHash, derivedKey);
}
