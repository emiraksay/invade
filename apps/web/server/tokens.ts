import { createHash, randomInt } from 'node:crypto';

// No 0/O/1/I/L: tokens are sometimes typed by hand into the Shortcut.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Player sync token, e.g. `INV-7K3P-9QX2-M4TD` (~59 bits). Shown to the player once, stored only hashed. */
export function generateToken(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `INV-${group()}-${group()}-${group()}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token.trim().toUpperCase()).digest('hex');
}
