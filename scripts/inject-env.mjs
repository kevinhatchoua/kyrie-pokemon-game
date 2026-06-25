#!/usr/bin/env node
/**
 * Vercel build: inject Supabase env vars into index.html → dist/
 * Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel Project Settings → Environment Variables.
 * Local: copy .env.example → .env or config.js.example → config.js
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'index.html');
const outDir = join(root, 'dist');
const out = join(outDir, 'index.html');

function loadDotEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv();

const url = (process.env.SUPABASE_URL || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const key = (process.env.SUPABASE_ANON_KEY || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

let html = readFileSync(src, 'utf8');

html = html.replace(
  "const SUPABASE_URL = '';",
  `const SUPABASE_URL = '${url}';`,
);
html = html.replace(
  "const SUPABASE_ANON_KEY = '';",
  `const SUPABASE_ANON_KEY = '${key}';`,
);

mkdirSync(outDir, { recursive: true });
writeFileSync(out, html);

const assetsSrc = join(root, 'assets');
const assetsOut = join(outDir, 'assets');
if (existsSync(assetsSrc)) {
  cpSync(assetsSrc, assetsOut, { recursive: true });
  console.log('[build] Copied assets/ → dist/assets/');
}

const configSrc = join(root, 'config.js');
const configOut = join(outDir, 'config.js');
if (existsSync(configSrc)) {
  cpSync(configSrc, configOut);
  console.log('[build] Copied config.js → dist/config.js');
}

console.log('[build] Wrote dist/index.html');
console.log('[build] Supabase URL:', url ? 'injected ✓' : 'empty — set SUPABASE_URL on Vercel');
console.log('[build] Supabase anon key:', key ? 'injected ✓' : 'empty — set SUPABASE_ANON_KEY on Vercel');
