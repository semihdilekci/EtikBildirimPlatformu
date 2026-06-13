# CLAUDE.md — Yıldız Holding Etik Bildirim Uygulaması

> Bu proje **`.cursor/rules/*.mdc`** altında tanımlı kural seti ile yönetilir.
> Bu dosya always-apply + glob + göreve-bağlı kuralların **yönlendiricisidir**.
> **Spec tek doğruluk kaynağı:** `Docs/`. `.mdc` ile Docs çelişirse Docs kazanır.

---

## ⚙️ Çalışma Protokolü — Her Görevde

1. **Her zaman geçerli (00–04)** — özet aşağıda; tereddütte tam `.mdc` oku.
2. **Dosyaya dokunmadan önce** glob tablosundan ilgili kuralı oku.
3. **Görev prosedürüyse** (endpoint, ekran, migration…) how-to tablosundan ilgili `4x` kuralı oku.
4. **Faz çalışmasıysa** (`Faz N — İterasyon M`) ilgili `5x-phase-*.mdc` oku + `48-git-phase-branch`.
5. Spec detayı için `Docs/` path'ine git — rule'da kopyalanmış tablo arama.

> **Verimlilik:** Tüm `.mdc` dosyalarını okuma. Yalnızca dokunduğun dosya + görev tipine uygun kurallar.

---

## 📌 Her Zaman Geçerli (00–04 özet)

Tam metin: `.cursor/rules/00-*.mdc` … `04-*.mdc`.

- **[00] Kimlik** — Etik bildirim platformu; NestJS + React + Prisma monorepo; OIDC session (JWT yok); AES-256-GCM encryption.
- **[01] Felsefe** — Vibe coding + faz bazlı dilim; test-first; human gate; agent main'e merge edemez.
- **[02] Naming** — TR UI / EN code; Conventional Commits; `DOMAIN_ENTITY_CONDITION` error codes.
- **[03] Güvenlik** — 6 zorunlu kontrol (auth, authz 3-katman, crypto, input, audit, KVKK); skip yasak.
- **[04] Kalite** — Kritik modül ≥%90 coverage; CI 12 adım gate; TypeScript strict; OWASP ASVS L3 hedef.

---

## 🗂 Glob Yönlendirme

| Dosya deseni | Oku |
| --- | --- |
| `apps/api/src/**/*.ts`, `apps/worker/src/**/*.ts` | `10-backend-architecture` |
| `apps/api/src/modules/auth/**`, `tracking/**`, session/csrf guards | `11-auth-session` |
| `authorization/**`, `policy.guard.ts`, `packages/policy/**` | `12-authorization-policy` |
| `case-management/**`, `decision/**`, `transition/**` | `13-workflow-engine` |
| `apps/api/**/*.controller.ts` | `14-backend-controllers` |
| `apps/api/prisma/**`, `**/*.service.ts` (api/worker) | `15-database-prisma` |
| `audit/**`, `crypto/**`, audit interceptor/decorator | `16-audit-crypto` |
| `apps/web/src/**/*.{ts,tsx}` | `20-frontend-architecture` |
| `apps/web/src/routes/**`, `layouts/**`, `App.tsx` | `21-frontend-routes` |
| `*Form*.tsx`, `features/**/pages/**`, `schemas/**` | `22-frontend-forms` |
| `**/hooks/use*.ts`, `features/**/hooks/**` | `23-frontend-queries` |
| `components/**`, `features/**/components/**` | `24-frontend-components` |
| `apps/web/**/*.tsx` | `25-frontend-a11y` |
| `infra/**`, `.github/**`, `turbo.json` | `30-infrastructure` |
| `**/*.{test,spec}.{ts,tsx}`, `packages/test-fixtures/**` | `35-testing` |

> Birden fazla desen eşleşebilir — hepsini uygula.

---

## 🛠 How-To Yönlendirme

| Görev türü | Oku |
| --- | --- |
| Yeni REST endpoint | `40-add-new-endpoint` |
| Yeni ekran (S-*) | `41-add-new-screen` |
| Prisma migration | `42-add-prisma-migration` |
| Yeni permission | `43-add-new-permission` |
| Legacy → pattern hizalama | `44-refactor-to-pattern` |
| Mimari karar (ADR) | `45-write-adr` |
| CI/test kırığı | `46-fix-failing-test` |
| Workflow transition ekleme | `47-add-workflow-transition` |
| Faz implementasyonu branch | `48-git-phase-branch` |

---

## 🚦 Faz Yönlendirme

Mesajda **「Faz N — İterasyon M」** belirt. Kod öncesi `48-git-phase-branch` ile feature branch aç.

| Faz | Kural | Durum |
| --- | --- | --- |
| 0 Monorepo Scaffold | `50-phase-00-monorepo-scaffold` | hazır |
| 1 DB + Auth | `51-phase-01-database-auth` | hazır |
| 2 Authorization | `52-phase-02-authorization` | hazır |
| 3 Crypto + Audit | `53-phase-03-crypto-audit` | hazır |
| 4 Intake + Tracking | `54-phase-04-intake-tracking` | hazır |
| 5 Case + Workflow | `55-phase-05-case-workflow` | hazır |
| 6 Task + SLA | `56-phase-06-task-sla` | hazır |
| 7 Document | `57-phase-07-document` | hazır |
| 8 Notification | `58-phase-08-notification` | hazır |
| 9 Admin Panel | `59-phase-09-admin` | hazır |
| 10 Dashboard + Polish | `60-phase-10-dashboard-polish` | hazır |
| 11 Performance | `61-phase-11-performance` | hazır |
| 12 Security Hardening | `62-phase-12-security-hardening` | hazır |
| 13 UAT + Go-Live | `63-phase-13-uat-go-live` | hazır |

Faz `.mdc` paketi tamamlandı (Faz 0–13). Yeni faz için `@phase-creator`.

---

## 📚 Docs/ — Nihai Kaynak

| Dosya | Ne zaman |
| --- | --- |
| `Docs/00_PROJECT_OVERVIEW.md` | Kapsam, stack, MVP sınırları |
| `Docs/01_DOMAIN_MODEL.md` | Entity, state machine, iş kuralları |
| `Docs/02_DATABASE_SCHEMA.md` | Tablo, migration, encryption alanları |
| `Docs/03_API_CONTRACTS.md` | Endpoint, error taxonomy |
| `Docs/04_BACKEND_SPEC.md` | NestJS modül, guard zinciri |
| `Docs/05_FRONTEND_SPEC.md` | React routing, state, form |
| `Docs/06_SCREEN_CATALOG.md` | S-* ekran detayları |
| `Docs/07_SECURITY_IMPLEMENTATION.md` | Auth, authz, encryption, KVKK |
| `Docs/08_TESTING_STRATEGY.md` | Test piramidi, coverage |
| `Docs/09_DEV_WORKFLOW.md` | Git, PR, CI/CD, env |
| `Docs/10_IMPLEMENTATION_ROADMAP.md` | Faz planı, human gate |

> Yeni faz / spec değişikliği → önce Docs güncelle, sonra ilgili `.mdc` referansını doğrula.

---

## 🔁 Yer Konumu

Kural paketi: **`.cursor/rules/`**. Numara → dosya adı öneki (`14` → `14-backend-controllers.mdc`).
