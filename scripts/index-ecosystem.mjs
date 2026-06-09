#!/usr/bin/env node
/**
 * Ecosystem code indexer — crawls all repos, embeds files, upserts to Qdrant.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://192.168.11.30:11434';
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';
const WORKSPACE = process.env.WORKSPACE || '/home/aggelos';
const VECTOR_DIM = 768;

const REPOS = [
  'BIRDS', 'SAMAKIA-NET', 'SAMAKIA-IDP', 'SAMAKIA-EMAIL', 'SAMAKIA-INGRESS',
  'SYSTEM', 'pb-ui', 'MALINOIS-BREEDER', 'AI-AGENT', 'avex',
  'BZK-DESIGN-SYSTEM', 'SAMAKIA-CALENDAR', 'COM-BREEDS', 'samakia-specs', 'samakia-agent',
];

const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.yaml', '.yml', '.json'];
const IGNORE_DIRS = ['node_modules', '.next', '.git', 'dist', 'out', 'build', 'data'];
const MAX_FILE_SIZE = 20000;

async function embed(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text.slice(0, 2000) }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.embedding;
}

async function ensureCollection(name) {
  const check = await fetch(`${QDRANT_URL}/collections/${name}`);
  if (check.ok) return;
  await fetch(`${QDRANT_URL}/collections/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors: { size: VECTOR_DIM, distance: 'Cosine' } }),
  });
}

async function upsertPoint(collection, id, vector, payload) {
  await fetch(`${QDRANT_URL}/collections/${collection}/points`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points: [{ id, vector, payload }] }),
  });
}

function walkRepo(repoPath) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORE_DIRS.includes(entry.name) || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!FILE_EXTENSIONS.some(ext => entry.name.endsWith(ext))) continue;
      const stat = fs.statSync(full);
      if (stat.size > MAX_FILE_SIZE) continue;
      files.push(full);
    }
  }
  walk(repoPath);
  return files;
}

function hashId(str) {
  return parseInt(crypto.createHash('md5').update(str).digest('hex').slice(0, 15), 16);
}

async function indexRepo(repoName) {
  const repoPath = path.join(WORKSPACE, repoName);
  if (!fs.existsSync(repoPath)) { console.log(`  skip ${repoName} (not found)`); return 0; }

  const collection = `code-${repoName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  await ensureCollection(collection);

  const files = walkRepo(repoPath);
  let indexed = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(repoPath, file);
    const vector = await embed(content);
    if (!vector) continue;

    await upsertPoint(collection, hashId(relPath), vector, {
      repo: repoName,
      path: relPath,
      content: content.slice(0, 2000),
      type: path.extname(file).slice(1),
      indexedAt: new Date().toISOString(),
    });
    indexed++;
  }
  return indexed;
}

async function main() {
  console.log('[indexer] starting ecosystem index');
  let total = 0;
  for (const repo of REPOS) {
    const count = await indexRepo(repo);
    if (count > 0) console.log(`  ✓ ${repo}: ${count} files indexed`);
    total += count;
  }
  console.log(`[indexer] done: ${total} files indexed across ${REPOS.length} repos`);
}

main().catch(e => { console.error('[indexer] fatal:', e.message); process.exit(1); });
