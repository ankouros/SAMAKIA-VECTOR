# SAMAKIA-VECTOR Contracts

Source of truth: `/home/aggelos/samakia-specs/repo-contracts/samakia-vector.md`
Sync target: `/home/aggelos/SAMAKIA-VECTOR/CONTRACTS.md`.
Shared ecosystem contract: `/home/aggelos/samakia-specs/specs/base/ecosystem.yaml`.

## Purpose

Clustered Qdrant vector search platform providing semantic code search, embeddings storage, and RAG context retrieval for all ecosystem agents.

## Contract

- Deployed as 3-node Qdrant cluster via Docker Compose
- Exposed at `vector.samakia.net` via SAMAKIA-INGRESS
- Collections: `code-{repo}` per repo + `contracts` ecosystem-wide
- Embedding model: `nomic-embed-text` via Ollama
- Indexed by samakia-specs central indexer
- Consumed by all per-repo agents via `@samakia/agent-core`

## Availability

- Health: `GET /healthz`
- Collections: `GET /collections`
- Internal port: 6333 (HTTP), 6334 (gRPC)
- Edge hostname: `vector.samakia.net`

## Docker Compose Project Naming Contract

- Top-level `name: samakia-vector`
