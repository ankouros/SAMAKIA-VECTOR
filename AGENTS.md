# SAMAKIA-VECTOR Agent Handbook

Canonical specs live in `/home/aggelos/samakia-specs`.
Spec version (authoritative): v1.3.187 (see /home/aggelos/samakia-specs/versions/v1.3.187.yaml).
Shared ecosystem contract: `/home/aggelos/samakia-specs/specs/base/ecosystem.yaml`.

## Scope

Clustered Qdrant vector search platform for semantic code search, embeddings, and RAG context across all ecosystem agents.

## Validation

- Verify cluster: `docker compose ps`
- Health check: `curl http://localhost:6333/healthz`
- Collections: `curl http://localhost:6333/collections`
