import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Derive an encryption key from a password using scrypt.
 * In production, consider using system keychain instead.
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

/**
 * Get the encryption password from environment or use machine-specific default.
 * In production, this should use system keychain (keytar, etc.)
 */
function getEncryptionPassword(): string {
  // Use environment variable if set
  if (process.env.FLOWSFARM_ENCRYPTION_KEY) {
    return process.env.FLOWSFARM_ENCRYPTION_KEY;
  }

  // Fall back to machine-specific value
  // This is not ideal but works for local-only use
  const machineId = process.env.USER || process.env.USERNAME || 'flowsfarm';
  return `flowsfarm-${machineId}-local-encryption`;
}

/**
 * Encrypt a string value.
 * Returns base64-encoded string containing: salt + iv + tag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const password = getEncryptionPassword();
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Combine: salt + iv + tag + ciphertext
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt a string value.
 * Expects base64-encoded string containing: salt + iv + tag + ciphertext
 */
export function decrypt(encryptedBase64: string): string {
  const password = getEncryptionPassword();
  const combined = Buffer.from(encryptedBase64, 'base64');

  // Extract parts
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + TAG_LENGTH
  );
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(password, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
