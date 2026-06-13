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
- AWS hesabı (RDS, S3, KMS; Faz 7+ ClamAV ECS)

```bash
node --version    # ≥ 22
pnpm --version    # ≥ 9
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

## Altyapı (AWS Cloud)

Tüm ortamlar **cloud-only**: local Docker Compose yok. Geliştirme makinesi yalnızca `pnpm dev` çalıştırır; veri ve servisler AWS üzerindedir.

| Servis                  | AWS bileşeni                   | Env                    |
| ----------------------- | ------------------------------ | ---------------------- |
| Veritabanı              | RDS PostgreSQL                 | `DATABASE_URL`         |
| Object storage          | S3                             | `AWS_*`, `S3_BUCKET_*` |
| Şifreleme               | KMS                            | `AWS_KMS_KEY_ALIAS_*`  |
| Malware tarama (Faz 7+) | ClamAV on ECS (private subnet) | `CLAMAV_HOST`          |

`apps/api/.env.local` örneği:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@your-db.region.rds.amazonaws.com:5432/ethics_dev?schema=public

AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=<IAM access key>
AWS_SECRET_ACCESS_KEY=<IAM secret key>
S3_BUCKET_DOCUMENTS=etikbildirim-documents-dev
S3_BUCKET_QUARANTINE=etikbildirim-quarantine-dev

# Faz 7+ — AWS ECS ClamAV internal endpoint
# CLAMAV_HOST=clamav-dev.internal:3310
# CLAMAV_TIMEOUT_MS=30000
```

S3 bucket'ları AWS Console'da oluşturun (public access kapalı, SSE-KMS önerilir). `S3_ENDPOINT` tanımlamayın.

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
- Merge: squash only → `main` (PR ile)
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
