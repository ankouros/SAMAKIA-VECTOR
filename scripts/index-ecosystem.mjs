#!/usr/bin/env node
/**
 * Ecosystem indexer — incremental (only re-indexes changed files via content hash).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { createOllamaClient } from '@samakia/ollama-client';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://192.168.11.30:11434';
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';
const ollamaClient = createOllamaClient(OLLAMA_URL);
const WORKSPACE = process.env.WORKSPACE || '/home/aggelos';
const CACHE_FILE = path.join(import.meta.dirname, '..', 'data', 'index-cache.json');
const VECTOR_DIM = 768;

const REPOS = ['BIRDS','SAMAKIA-NET','SAMAKIA-IDP','SAMAKIA-EMAIL','SAMAKIA-INGRESS','SYSTEM','pb-ui','MALINOIS-BREEDER','AI-AGENT','avex','BZK-DESIGN-SYSTEM','SAMAKIA-CALENDAR','COM-BREEDS','samakia-specs','samakia-agent'];
const EXTENSIONS = ['.ts','.tsx','.js','.jsx','.mjs','.md','.yaml','.yml'];
const IGNORE = ['node_modules','.next','.git','dist','out','build','data','agent/memory','agent/logs'];
const MAX_SIZE = 20000;

function loadCache() { try { return JSON.parse(fs.readFileSync(CACHE_FILE,'utf8')); } catch { return {}; } }
function saveCache(cache) { fs.mkdirSync(path.dirname(CACHE_FILE),{recursive:true}); fs.writeFileSync(CACHE_FILE,JSON.stringify(cache)); }
function hash(content) { return crypto.createHash('sha256').update(content).digest('hex').slice(0,16); }
function pointId(str) { return parseInt(crypto.createHash('md5').update(str).digest('hex').slice(0,15),16); }

async function embed(text) {
  try {
    const result = await ollamaClient.embed(text.slice(0, 2000), EMBED_MODEL);
    return result.embedding;
  } catch { return null; }
}

async function ensureCollection(name) {
  const r = await fetch(`${QDRANT_URL}/collections/${name}`);
  if (r.ok) return;
  await fetch(`${QDRANT_URL}/collections/${name}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({vectors:{size:VECTOR_DIM,distance:'Cosine'}})});
}

async function upsert(collection,id,vector,payload) {
  await fetch(`${QDRANT_URL}/collections/${collection}/points`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:[{id,vector,payload}]})});
}

function walkRepo(repoPath) {
  const files = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
      if (IGNORE.some(i => e.name === i || dir.includes(i))) continue;
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir,e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!EXTENSIONS.some(ext => e.name.endsWith(ext))) continue;
      if (fs.statSync(full).size > MAX_SIZE) continue;
      files.push(full);
    }
  }
  walk(repoPath);
  return files;
}

async function main() {
  const cache = loadCache();
  let indexed = 0, skipped = 0;
  console.log('[indexer] starting incremental index');

  for (const repo of REPOS) {
    const repoPath = path.join(WORKSPACE,repo);
    if (!fs.existsSync(repoPath)) continue;
    const collection = `code-${repo.toLowerCase().replace(/[^a-z0-9]/g,'-')}`;
    await ensureCollection(collection);

    const files = walkRepo(repoPath);
    for (const file of files) {
      const content = fs.readFileSync(file,'utf8');
      const h = hash(content);
      const relPath = path.relative(repoPath,file);
      const cacheKey = `${repo}:${relPath}`;

      if (cache[cacheKey] === h) { skipped++; continue; }

      const vector = await embed(content);
      if (!vector) continue;

      await upsert(collection, pointId(cacheKey), vector, {
        repo, path: relPath, content: content.slice(0,2000),
        type: path.extname(file).slice(1), indexedAt: new Date().toISOString(),
      });
      cache[cacheKey] = h;
      indexed++;
    }
    if (indexed > 0) console.log(`  ${repo}: ${indexed} new/updated`);
  }

  saveCache(cache);
  console.log(`[indexer] done: ${indexed} indexed, ${skipped} skipped (unchanged)`);
}

main().catch(e => { console.error('[indexer] fatal:', e.message); process.exit(1); });
