# Yıldız Holding Etik Bildirim Uygulaması — Geliştirme İş Akışı

## 1. Git Branching

### 1.1 Branch Yapısı

| Branch | Koruma | Amaç | Merge kaynağı |
|---|---|---|---|
| `main` | Protected — direct push yasak, required checks + human review | Production-ready kod | staging → main (PR + onay) |
| `staging` | Protected — required checks | Pre-production doğrulama, UAT | develop → staging (PR) |
| `develop` | Protected — required checks | Aktif geliştirme entegrasyonu | feature/* / fix/* → develop (PR) |
| `feature/*` | Yok | Yeni özellik geliştirme | develop'tan açılır |
| `fix/*` | Yok | Bug fix | develop'tan açılır |
| `hotfix/*` | Yok | Production acil düzeltme | main'den açılır, main + develop'a merge |

### 1.2 Branch Naming

Branch adları karar ID referanslı olur:

```
feature/AUTH-006-field-visibility-policy
feature/W-002-workflow-state-machine
fix/SEC-007-rate-limit-bypass
hotfix/AUD-011-audit-outbox-failure
```

Format: `type/KARAR_ID-kısa-açıklama` (kebab-case).

### 1.3 Merge Stratejisi

Tüm merge'ler **squash merge** ile yapılır. Feature branch'teki ara commit'ler tek commit'e sıkıştırılır; commit mesajı Conventional Commits formatını korur. Merge commit veya rebase kullanılmaz — squash, temiz ve izlenebilir git history sağlar.

`main` branch'e doğrudan push/merge yapmak yasaktır. Agent kullanıcı insan onayı olmadan main branch'e merge edemez veya doğrudan push yapamaz.

---

## 2. Commit Format

Conventional Commits zorunludur. Commitlint ile CI ve pre-commit hook'ta doğrulanır.

```
type(scope): açıklama

Types: feat, fix, docs, refactor, test, chore, perf, build, ci
```

### 2.1 Scope Listesi

| Scope | Kapsam |
|---|---|
| `auth` | Kimlik doğrulama, OIDC, session, MFA |
| `authz` | Yetkilendirme, PolicyGuard, PolicyScope, FieldMasking |
| `workflow` | State machine, WorkflowCommandHandler, transition |
| `task` | Görev yönetimi, SLA, delegation |
| `document` | Doküman yönetimi, upload, quarantine, encryption, grant |
| `audit` | Audit log, outbox, tamper-evidence, redaction |
| `notification` | Bildirim, e-posta, in-app, secure message |
| `intake` | Dış bildirim formu, report oluşturma |
| `tracking` | Anonim takip, tracking_code doğrulama |
| `admin` | Admin paneli, system settings, role management |
| `crypto` | CryptoService, KMS adapter, field/document encryption |
| `integration` | HR/SAP sync, SMTP adapter, object storage adapter |
| `api` | Genel API yapısı, middleware, error handling |
| `ui` | Frontend bileşenler, routing, layout |
| `db` | Migration, schema, seed |
| `infra` | CI/CD, AWS IaC (ECS, RDS, S3, KMS, ClamAV), deployment |
| `deps` | Dependency ekleme/güncelleme/kaldırma |

### 2.2 Örnekler

```
feat(auth): implement OIDC PKCE login flow with passport-openidconnect
feat(authz): add PolicyGuard RBAC+ABAC evaluation for case endpoints
feat(workflow): implement secretariat_review → pre_research transition
fix(document): prevent quarantined file from appearing in case detail
fix(authz): close field masking bypass for admin role on report_text
docs(api): document tracking verify endpoint error codes
refactor(audit): extract AuditEventPublisher from WorkflowCommandHandler
test(workflow): add negative transition tests for chair_gate command
chore(deps): bump prisma to 6.2.1 (SCA clean)
perf(db): add partial index on cases(company_id, status) for worklist query
ci(infra): add container image scan step to pipeline

Breaking change:
feat(auth)!: replace session cookie name from sid to ethics_session
```

---

## 3. PR Kuralları

### 3.1 Genel Kurallar

| Kural | Detay |
|---|---|
| Minimum reviewer | 1 onay (security-sensitive dosyalar için 2) |
| CI checks | Tüm zorunlu pipeline adımları yeşil |
| Merge yöntemi | Squash only |
| PR boyutu | Tek feature/fix odaklı; 500+ satır değişiklik gerekiyorsa bölünür |
| Draft PR | WIP çalışma için kullanılabilir; review istenmez |

### 3.2 Security-Sensitive Dosyalar

Aşağıdaki dosya/dizin değişiklikleri ek reviewer (Bilgi Güvenliği veya kıdemli geliştirici) gerektirir:

- `**/policy/**`, `**/guard/**`, `**/crypto/**` — yetkilendirme ve şifreleme
- `**/audit/**` — audit log mekanizması
- `prisma/schema.prisma`, `prisma/migrations/**` — veritabanı şeması
- `apps/api/src/modules/workflow/**` — state machine
- `infra/**` — altyapı ve deployment
- `.env.example` — ortam konfigürasyonu
- `pnpm-lock.yaml` — dependency değişikliği

### 3.3 PR Description Template

Her PR aşağıdaki checklist'i tamamlamadan merge adayı olamaz:

```markdown
## Değişiklik Özeti
[Ne değişti, 2-3 cümle]

## Karar Referansı
İlgili karar ID'leri: [AUTH-006], [SEC-012], ...

## Etki Analizi

### Policy Etkisi
- [ ] Yeni/etkilenen permission: [varsa listele]
- [ ] ABAC scope değişikliği: [varsa açıkla]
- [ ] Field masking değişikliği: [varsa açıkla]
- [ ] Negatif deny testleri eklendi/güncellendi

### Workflow Etkisi
- [ ] State/command değişikliği: [varsa açıkla]
- [ ] Task/SLA/outbox side-effect güncellendi
- [ ] Audit event eklendi/güncellendi

### Doküman Etkisi
- [ ] Document category/grant/scan/encryption/archive değişikliği: [varsa]
- [ ] Download audit kontrolü doğrulandı

### Audit/Log Etkisi
- [ ] İçerik kopyalamayan audit event doğrulandı
- [ ] Redacted log doğrulandı
- [ ] Hassas veri log/audit/error'a sızmıyor

### KVKK/Gizlilik
- [ ] Yeni kişisel veri alanı: [varsa — retention, consent, minimizasyon etkisi]
- [ ] Bu değişiklik PII içermiyor

### Migration
- [ ] Flyway/Prisma migration eklendi: [varsa]
- [ ] Rollback/forward planı mevcut
- [ ] Sentetik migration testi geçiyor

### Test
- [ ] Unit/integration/E2E testleri eklendi/güncellendi
- [ ] Karar traceability: test adlarında ilgili karar ID var
- [ ] Coverage düşmedi (düştüyse gerekçe:)

### Notification
- [ ] Hassas içeriksiz şablon doğrulandı
- [ ] Idempotent dispatch kontrolü var

### Dependency
- [ ] Yeni dependency yok / Yeni dependency: [isim, versiyon, lisans, SCA sonucu]

## Nasıl Test Edilir
[Manuel test adımları veya otomatik test referansı]

## Ekran Görüntüsü (UI değişiklikleri için)
[Varsa ekle]

## Breaking Change
- [ ] Yok / Var: [açıkla]
```

---

## 4. Environment Yapısı

### 4.1 Ortam Tanımları

| Ortam | Hosting | DB | Object Storage | Malware Scan | Secret Kaynağı | Deploy Trigger |
|---|---|---|---|---|---|---|
| `dev` | Local app + AWS cloud | AWS RDS PostgreSQL (`DATABASE_URL`) | AWS S3 (dev bucket) | AWS ECS ClamAV (dev) | `.env.local` dosyası | Manuel (`pnpm dev`) |
| `staging` | AWS ECS Fargate (staging hesabı) | RDS PostgreSQL (staging) | S3 (staging bucket) | AWS ECS ClamAV (staging) | AWS Secrets Manager (staging) | develop → staging PR merge |
| `production` | AWS ECS Fargate (prod hesabı, eu-central-1) | RDS PostgreSQL (prod, private subnet) | S3 (prod bucket, VPC Endpoint) | AWS ECS ClamAV (prod) | AWS Secrets Manager (prod) | staging → main PR merge + human approval |

### 4.2 Cloud-Only Altyapı Kararı

Local Docker Compose kullanılmaz. PostgreSQL (RDS), object storage (S3), encryption (KMS) ve malware tarama (ClamAV on ECS) tüm ortamlarda AWS üzerindedir. Geliştirici makinesi yalnızca uygulama kodunu (`pnpm dev`) çalıştırır; altyapı servisleri cloud endpoint'lerine env ile bağlanır.

ClamAV: `clamav/clamav` image ECS Fargate'te private subnet'te çalışır; API/worker TCP `3310` üzerinden internal DNS (`CLAMAV_HOST`) ile erişir. Üçüncü taraf AV SaaS kullanılmaz (KVKK).

### 4.3 Ortam İzolasyonu

prod, staging ve dev ortamları ayrı ağ, ayrı veritabanı, ayrı object storage bucket, ayrı KMS key scope, ayrı ClamAV instance ve ayrı service account kullanır. Non-prod ortamların production secret'larına, production object key'lerine veya production KMS key alias'larına erişimi olmaz. Development ve test ortamlarında gerçek etik bildirim verisi kullanılmaz; production verisi maskesiz kopyalanamaz.

## 5. Environment Variables

Aşağıdaki tablo tüm environment variable'ları listeler. **Değer içermez** — yalnızca isim, zorunluluk, açıklama ve format.

| Variable | Required | Açıklama | Format Örneği |
|---|---|---|---|
| `NODE_ENV` | Evet | Ortam tanımı | `development` / `staging` / `production` |
| `PORT` | Evet | API sunucu port | `3000` |
| `DATABASE_URL` | Evet | PostgreSQL bağlantısı | `postgresql://user:pass@host:5432/ethics_db?schema=public` |
| `OIDC_ISSUER_URL` | Evet | OIDC provider issuer URL | `https://accounts.google.com` |
| `OIDC_CLIENT_ID` | Evet | OIDC client identifier | `ethics-app-dev` |
| `OIDC_CLIENT_SECRET` | Evet | OIDC client secret | Secrets Manager'dan |
| `OIDC_CALLBACK_URL` | Evet | OIDC callback endpoint | `https://app.example.com/api/v1/auth/callback` |
| `SESSION_SECRET` | Evet | Express session signing key | 64+ karakter random string |
| `SESSION_STORE_TABLE` | Hayır | Session store tablo adı | `user_sessions` (varsayılan) |
| `CSRF_SECRET` | Evet | CSRF token signing key | 64+ karakter random string |
| `CORS_ALLOWED_ORIGINS` | Evet | İzin verilen origin'ler | `https://ethics.example.com,https://form.example.com` |
| `AWS_REGION` | Evet | AWS region (RDS ve S3 ile aynı) | `eu-west-1` |
| `AWS_ACCESS_KEY_ID` | Dev: Evet | IAM access key (dev local); staging/prod: ECS task role | IAM Console |
| `AWS_SECRET_ACCESS_KEY` | Dev: Evet | IAM secret key (dev local); staging/prod: Secrets Manager | IAM Console / Secrets Manager |
| `AWS_KMS_KEY_ALIAS_FIELD` | Evet | Per-field encryption KEK alias | `alias/ethics-field-key-dev` |
| `AWS_KMS_KEY_ALIAS_DOCUMENT` | Evet | Per-document encryption KEK alias | `alias/ethics-document-key-dev` |
| `S3_BUCKET_DOCUMENTS` | Evet | Doküman storage bucket (AWS S3) | `ethics-documents-dev` |
| `S3_BUCKET_QUARANTINE` | Evet | Quarantine bucket (AWS S3) | `ethics-quarantine-dev` |
| `S3_ENDPOINT` | Hayır | Yalnızca AWS dışı S3-compatible storage; AWS S3'te tanımlamayın | — |
| `SMTP_HOST` | Evet | E-posta relay sunucusu | `smtp.example.com` |
| `SMTP_PORT` | Evet | SMTP port | `587` |
| `SMTP_USER` | Evet | SMTP kullanıcı | `ethics-noreply@example.com` |
| `SMTP_PASSWORD` | Evet | SMTP parola | Secrets Manager'dan |
| `SMTP_FROM` | Evet | Gönderici adresi | `Etik Bildirim <ethics-noreply@example.com>` |
| `CLAMAV_HOST` | Faz 7+: Evet | AWS ECS ClamAV internal endpoint (host:port) | `clamav-dev.internal:3310` |
| `CLAMAV_TIMEOUT_MS` | Hayır | Tarama timeout | `30000` (varsayılan) |
| `ARGON2_PEPPER` | Evet | Anonim parola pepper | Secrets Manager'dan |
| `LOG_LEVEL` | Hayır | Log seviyesi | `info` (varsayılan) |
| `LOG_REDACTION_ENABLED` | Hayır | Log redaction aktif mi | `true` (varsayılan) |
| `OUTBOX_POLL_INTERVAL_MS` | Hayır | Outbox worker polling aralığı | `5000` (varsayılan) |
| `HR_SYNC_CRON` | Hayır | HR/SAP sync cron ifadesi | `0 2 * * *` (her gece 02:00) |
| `PAGERDUTY_ROUTING_KEY` | Staging/Prod | Alarm routing key | Secrets Manager'dan |

---

## 6. Local Setup

Sıfır-varsayım komut listesi — yeni geliştirici veya agent bu adımları izleyerek ortamı kurar:

```bash
# ─── Prerequisites ───
node --version       # ≥ 22 (LTS Jod)
pnpm --version       # ≥ 9

# ─── Clone and Install ───
git clone <repo-url>
cd ethics-platform
pnpm install         # --frozen-lockfile CI'da kullanılır; local'de install yeterli

# ─── Environment ───
cp .env.example .env.local
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
# apps/api/.env.local doldur:
#   DATABASE_URL — AWS RDS
#   OIDC_* — team password manager
#   AWS_* / S3_BUCKET_* — AWS S3
#   CLAMAV_* — Faz 7+ AWS ECS ClamAV endpoint (şimdilik yorum satırı)

# ─── Database migrations ───
pnpm --filter api prisma:migrate:dev    # Migration'ları çalıştır (RDS'e karşı)
pnpm --filter api prisma:seed           # Sentetik seed data yükle

# ─── Development ───
pnpm dev                                # Turborepo: API + Web paralel başlar
# API:  http://localhost:3000
# Web:  http://localhost:5173

# ─── Verify ───
curl http://localhost:3000/api/v1/health
# {"status":"ok","timestamp":"..."}
```

### AWS Cloud Servisleri (Local Setup'ta Docker yok)

| Servis | AWS | Env |
|---|---|---|
| PostgreSQL | RDS | `DATABASE_URL` |
| Object storage | S3 | `AWS_*`, `S3_BUCKET_*` |
| Encryption | KMS | `AWS_KMS_KEY_ALIAS_*` |
| Malware scan (Faz 7+) | ClamAV on ECS Fargate | `CLAMAV_HOST`, `CLAMAV_TIMEOUT_MS` |

ClamAV IaC (`infra/`, Faz 7 öncesi): ECS service + private subnet + security group (yalnızca API/worker SG → 3310/tcp) + Cloud Map internal DNS.

---

## 7. Tooling

| Araç | Konfigürasyon | Amaç |
|---|---|---|
| ESLint | `@ethics/eslint-config` (monorepo paylaşımlı) | Lint — TypeScript strict uyumu, no-any, güvenlik kuralları |
| Prettier | `.prettierrc` (monorepo kök) | Format — tutarlı kod biçimi |
| Husky | `.husky/pre-commit`, `.husky/commit-msg` | Pre-commit hook'ları |
| lint-staged | `package.json` → lint-staged config | Yalnızca staged dosyalarda lint + format |
| commitlint | `commitlint.config.js` | Conventional Commits formatı doğrulama |
| TypeScript | `tsconfig.json` (strict: true, noImplicitAny: true) | Tip güvenliği — `any` yasak |
| Turborepo | `turbo.json` | Monorepo task orchestration (build, dev, test, lint) |

### VS Code Önerileri

`.vscode/extensions.json` ile önerilen extension'lar:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "Prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright"
  ]
}
```

`.vscode/settings.json` ile format-on-save ve ESLint auto-fix aktif edilir.

---

## 8. Deployment

### 8.1 CI/CD Pipeline Akışı

Her PR'da çalışan pipeline:

```
1. Install (pnpm install --frozen-lockfile)
2. Lint + Format check (ESLint + Prettier)
3. Type check (tsc --noEmit)
4. Unit tests (Jest — backend + Vitest — frontend)
5. Integration tests (Testcontainers + Supertest)
6. SAST scan
7. SCA / dependency scan
8. Secret scanning
9. License / lockfile kontrolü
10. Build (backend + frontend)
11. Container image build
12. Container image scan
```

Staging deployment (develop → staging merge sonrası):

```
13. Deploy to staging
14. Prisma migrate deploy (staging DB)
15. DAST scan (staging ortamı)
16. Performance smoke test
17. Playwright E2E critical-path
```

Production deployment (staging → main merge sonrası):

```
18. Human approval gate (4-göz onayı)
19. Artifact tag + promote
20. Deploy to production
21. Prisma migrate deploy (production DB)
22. Health check + smoke test
23. Playwright critical-path (production smoke)
```

### 8.2 Production Deploy Kuralları

Production deploy dört-göz onayı ve release kaydı gerektirir. Aşağıdaki işlemler yasaktır:

- Manuel SSH/console deploy
- Canlı container içine hotfix kopyalama
- Production üzerinde elle config değiştirme
- Production'da `prisma migrate dev` çalıştırma (yalnızca `prisma migrate deploy`)

Config değişiklikleri version-controlled IaC/config repository, peer review ve pipeline üzerinden ilerler.

### 8.3 Migration Stratejisi

Migration sırası: **migrate-then-deploy.** Prisma migration production'da `prisma migrate deploy` ile çalıştırılır — otomatik schema update yapılmaz. Her migration PR'ı rollback/forward planı, sentetik migration testi ve veri gizliliği etkisi içerir. Schema drift CI/CD'de otomatik denetlenir. Production'da ddl-auto, manuel SQL hotfix veya console üzerinden şema değişikliği yapılmaz.

Migration naming: `YYYYMMDDHHMMSS_kebab_case_description` (Prisma varsayılan formatı korunur).

### 8.4 Rollback

Deployment rollback önceki container image'a geri dönüş ile yapılır. Migration rollback forward-fix yaklaşımı ile uygulanır: sorunlu migration'ı geri alan yeni bir migration yazılır ve deploy edilir. Doğrudan `prisma migrate rollback` production'da kullanılmaz.

### 8.5 Dependency Ekleme

Yeni dependency, build plugin, container image, frontend package, object storage/KMS/e-posta/AV SDK veya SaaS entegrasyonu eklemek ayrı PR gerekçesi ve SCA/license/security kontrolü gerektirir. Floating `latest` tag, CDN üzerinden script/style, unofficial package ve lisans belirsizliği kabul edilmez.

Tüm paketler `pnpm-lock.yaml` ile sabitlenir. CI/CD'de `--frozen-lockfile` flag'i ile çalıştırılır. `pnpm-lock.yaml` değişikliği olan PR'lar otomatik olarak dependency review'a girer.
