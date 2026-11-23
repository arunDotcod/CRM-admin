#!/usr/bin/env node
/**
 * Dev-only: prints the current TOTP code (RFC 6238, SHA-1, 6 digits, 30 s) for the local test
 * staff account, reading the base32 key from `.local/test-staff.md` (gitignored) or argv[2].
 * Use it instead of a phone when testing sign-in locally.
 */
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readKey() {
  if (process.argv[2]) return process.argv[2];
  const text = readFileSync(path.join(root, '.local', 'test-staff.md'), 'utf8');
  const match = text.match(/TOTP key \(base32\):\s*([A-Z2-7 ]+)\s*$/m);
  if (!match) throw new Error('No TOTP key in .local/test-staff.md');
  return match[1];
}

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/[\s=]/g, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error('Invalid base32 key');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

const key = base32Decode(readKey());
const step = Math.floor(Date.now() / 1000 / 30);
const counter = Buffer.alloc(8);
counter.writeBigUInt64BE(BigInt(step));
const hmac = createHmac('sha1', key).update(counter).digest();
const offset = hmac[hmac.length - 1] & 0x0f;
const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
const secondsLeft = 30 - (Math.floor(Date.now() / 1000) % 30);
console.log(`${String(code).padStart(6, '0')} (${secondsLeft}s left)`);
