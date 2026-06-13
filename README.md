# Yıldız Holding Etik Bildirim Platformu

Anonim dış bildirimden kurul süreci, HYKB onayı, aksiyon takibi ve arşive kadar uçtan uca etik vaka yönetimi platformu.

## Tech Stack

- **Backend:** NestJS 11 + TypeScript strict
- **Frontend:** React 19 + Vite + MUI
- **Database:** PostgreSQL 16 + Prisma
- **Monorepo:** pnpm workspaces + Turborepo

Detaylı spesifikasyon: [`Docs/`](Docs/) klasörü.

## Ön Koşullar

- Node.js ≥ 22 (`.nvmrc` ile sabitlenmiş)
- pnpm ≥ 9
- Docker + Docker Compose

```bash
node --version    # ≥ 22
pnpm --version    # ≥ 9
docker compose version
```

## Kurulum

```bash
git clone https://github.com/semihdilekci/EtikBildirimPlatformu.git
cd EtikBildirimPlatformu
pnpm install
```

## Ortam Değişkenleri

```bash
cp .env.example .env.local
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
```

Secret değerleri team password manager'dan alın. `.env.example` dosyaları yalnızca isim ve açıklama içerir.

## Altyapı (Local Dev)

PostgreSQL, MinIO ve ClamAV servislerini başlatın:

```bash
docker compose up -d
docker compose ps
```

| Servis   | Adres            | Amaç                                                                                |
| -------- | ---------------- | ----------------------------------------------------------------------------------- |
| postgres | `localhost:5432` | PostgreSQL (`ethics_dev`) — port meşgulse `POSTGRES_PORT=5433 docker compose up -d` |
| minio    | `localhost:9000` | S3-compatible object storage                                                        |
| minio UI | `localhost:9001` | MinIO console                                                                       |
| clamav   | `localhost:3310` | Malware scanner                                                                     |

> ClamAV ilk başlatmada virus definition indirdiği için healthy olması birkaç dakika sürebilir.

## pnpm Scripts

| Komut               | Açıklama                              |
| ------------------- | ------------------------------------- |
| `pnpm dev`          | Turborepo dev (Faz 1+ ile aktif olur) |
| `pnpm build`        | Tüm workspace'leri derle              |
| `pnpm lint`         | ESLint (tüm paketler)                 |
| `pnpm typecheck`    | TypeScript `--noEmit`                 |
| `pnpm test`         | Test suite (placeholder)              |
| `pnpm format`       | Prettier format kontrolü              |
| `pnpm format:write` | Prettier otomatik düzeltme            |

## Monorepo Yapısı

```
apps/
  api/       NestJS backend (Faz 1+)
  web/       React SPA (Faz 1+)
  worker/    Background jobs (Faz 1+)
packages/
  shared/    Ortak enum, constant, util
  dto/       Paylaşımlı Zod schema
  policy/    RBAC+ABAC tanımları
  eslint-config/  Paylaşımlı ESLint config
```

## Git Kuralları

- Branch: `feature/F<N>-kısa-açıklama`
- Commit: [Conventional Commits](https://www.conventionalcommits.org/) — `type(scope): açıklama`
- Merge: squash only → `develop`
- Husky: pre-commit (lint-staged) + commit-msg (commitlint)

## Geliştirme Yol Haritası

Faz planı: [`Docs/10_IMPLEMENTATION_ROADMAP.md`](Docs/10_IMPLEMENTATION_ROADMAP.md)

| Faz | Kapsam                  | Durum      |
| --- | ----------------------- | ---------- |
| 0   | Monorepo scaffold       | tamamlandı |
| 1   | DB Schema + Auth        | planlandı  |
| 2   | Authorization RBAC+ABAC | planlandı  |

## Lisans

Proprietary — Yıldız Holding. Tüm hakları saklıdır.
