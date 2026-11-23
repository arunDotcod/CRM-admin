#!/usr/bin/env node
/**
 * Local-only helper: runs the Nest API from ../CRM-backend-server with the admin API switched on,
 * for developing CRM-admin. Nothing here is used in production.
 *
 * The shared backend .env has no ADMIN_JWT_SECRET or TOTP keyring, so this script keeps
 * dev-only values in `CRM-admin/.local/admin-api.env` (gitignored). On first run it creates that
 * file with random secrets. Process env beats the backend .env (dotenv does not override), so
 * these values apply only to this API process.
 *
 *   node scripts/dev-api.mjs            # API on http://127.0.0.1:4150, admin origin :8090
 *   ADMIN_API_PORT=4160 node scripts/dev-api.mjs
 *
 * The TOTP secrets of staff enrolled through this API are encrypted with the keyring in that
 * file: keep it, or those staff need a TOTP reset.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(here, '..');
const backendRoot = path.resolve(adminRoot, '..', 'CRM-backend-server');
const localDir = path.join(adminRoot, '.local');
const envFile = path.join(localDir, 'admin-api.env');

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    values[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return values;
}

if (!existsSync(envFile)) {
  mkdirSync(localDir, { recursive: true });
  const kid = 'admindev1';
  writeFileSync(
    envFile,
    [
      '# Dev-only values for scripts/dev-api.mjs (generated). Never commit or reuse elsewhere.',
      `ADMIN_JWT_SECRET=${randomBytes(48).toString('base64url')}`,
      `CHANNEL_SECRET_KEYS=${kid}:${randomBytes(32).toString('base64')}`,
      `CHANNEL_SECRET_ACTIVE_KID=${kid}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  console.log(`dev-api: created ${path.relative(adminRoot, envFile)} with new dev secrets`);
}

const port = process.env.ADMIN_API_PORT || '4150';
const adminOrigin = process.env.ADMIN_PORTAL_ORIGIN || 'http://127.0.0.1:8090';
const env = {
  ...process.env,
  ...parseEnv(readFileSync(envFile, 'utf8')),
  APP_PORT: port,
  APP_URL: `http://127.0.0.1:${port}`,
  ADMIN_PORTAL_ORIGIN: adminOrigin,
  ADMIN_PORTAL_URL: process.env.ADMIN_PORTAL_URL || adminOrigin,
};

console.log(`dev-api: starting the API on :${port} with admin origin ${adminOrigin}`);
const child = spawn('npx', ['tsx', 'src/main.ts'], {
  cwd: backendRoot,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
