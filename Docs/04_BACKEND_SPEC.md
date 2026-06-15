# Yıldız Holding Etik Bildirim Uygulaması — Backend Spec

## Framework ve Runtime

Backend, **Node.js LTS** (≥20, implementation başlangıcında minor versiyon sabitlenir) üzerinde **NestJS** framework'ü ve **TypeScript strict mode** ile geliştirilir. `any` tipi tüm production kodunda yasaktır; `tsconfig.json` ayarları `strict: true`, `noImplicitAny: true`, `strictNullChecks: true` olarak sabitlenir. `as any` veya `@ts-ignore` kullanımı code review'da reddedilir.

Package manager **pnpm** olarak sabitlenir; `npm` ve `yarn` kullanılmaz. Monorepo **pnpm workspaces** ile yönetilir. Lockfile (`pnpm-lock.yaml`) her commit'te repository'de bulunur; CI/CD'de `--frozen-lockfile` flag'iyle çalışılır. Floating version yasaktır.

Monorepo workspace'leri:

| Workspace | Path | İçerik |
|---|---|---|
| `api` | `apps/api` | NestJS backend uygulaması |
| `web` | `apps/web` | React + Vite frontend uygulaması |
| `worker` | `apps/worker` | Background job worker runtime |
| `shared` | `packages/shared` | Ortak enum, constant, util |
| `dto` | `packages/dto` | Paylaşılan DTO/schema tanımları (Zod + class-validator) |
| `policy` | `packages/policy` | RBAC+ABAC policy tanımları, permission enum'ları |

Backend ve worker aynı codebase'ten derlenip ayrı entrypoint'lerle çalıştırılır. Worker, API server process'inden bağımsız bir runtime olarak deploy edilir; ancak aynı Prisma client, service ve module tanımlarını kullanır.

---

## Klasör Yapısı

```
apps/api/
  src/
    main.ts                              # NestJS bootstrap, global middleware setup
    app.module.ts                        # Root module — tüm feature module'leri import eder
    common/
      config/
        env.schema.ts                    # Zod ile env validation şeması
        env.module.ts                    # ConfigModule wrapper, startup fail-fast
      guards/
        session.guard.ts                 # HttpOnly cookie session doğrulama
        auth.guard.ts                    # OIDC session + user context yükleme
        policy.guard.ts                  # Merkezi RBAC+ABAC+clearance policy check
        csrf.guard.ts                    # Double-submit cookie CSRF koruması
      interceptors/
        audit.interceptor.ts             # Mutating endpoint'lerde audit event üretimi
        correlation.interceptor.ts       # Request bazlı correlation_id üretimi
        response-transform.interceptor.ts # Standart response zarfı sarmalama
      pipes/
        validation.pipe.ts              # Global NestJS ValidationPipe + class-validator
      filters/
        global-exception.filter.ts      # Tüm exception → standart error response
      decorators/
        require-policy.decorator.ts     # @RequirePolicy('case:pre_review') gibi
        current-user.decorator.ts       # @CurrentUser() param decorator
        audit-action.decorator.ts       # @AuditAction('CASE_TRANSITION') gibi
      middleware/
        helmet.middleware.ts            # Security headers (helmet)
        rate-limit.middleware.ts         # @nestjs/throttler konfigürasyonu
    modules/
      auth/
        auth.module.ts                  # OIDC, session, JIT provisioning DI
        auth.controller.ts              # /auth/oidc/login, /callback, /logout, /me
        auth.service.ts                 # OIDC token exchange, session management
        strategies/
          oidc.strategy.ts              # passport-openidconnect strategy
        session/
          session.serializer.ts         # express-session serializer
          pg-session.store.ts           # connect-pg-simple adapter
        dto/
          login-query.dto.ts
      intake/
        intake.module.ts
        intake.controller.ts            # /intake/reports, /intake/categories, /intake/kvkk-text
        intake.service.ts               # Report oluşturma, tracking code üretimi
        dto/
          create-report.dto.ts          # Zod schema (packages/dto'dan re-export)
          create-attachment.dto.ts
        __tests__/
          intake.service.spec.ts
          intake.controller.spec.ts
      tracking/
        tracking.module.ts
        tracking.controller.ts          # /tracking/verify, /status, /messages, /attachments
        tracking.service.ts             # Anonim auth, argon2id verify, secure messaging
        tracking.guard.ts               # X-Tracking-Code + X-Tracking-Password header guard
        dto/
          verify-tracking.dto.ts
          send-message.dto.ts
        __tests__/
      case-management/
        case-management.module.ts
        case.controller.ts              # /cases CRUD + /cases/:id/transitions
        case.service.ts                 # Vaka CRUD, ABAC-scoped queries
        transition/
          transition.service.ts         # transitionCase(command) — state machine executor
          transition.validators.ts      # Command bazlı precondition doğrulama
          transition.commands.ts        # Command enum ve metadata tanımları
        dto/
          list-cases.dto.ts
          create-transition.dto.ts
        __tests__/
          transition.service.spec.ts
      task/
        task.module.ts
        task.controller.ts              # /tasks birleşik liste/detay + complete/delegate/decide
        task.service.ts                 # Görev lifecycle, SLA hesaplama
        unified-work-item.service.ts    # Task + ApprovalWorkItem birleşik projeksiyon
        sla/
          sla-calculator.service.ts     # İş günü takvimi + SLA hesaplama
          business-calendar.service.ts  # Tatil, yarım gün, hafta sonu kontrolü
        dto/
        __tests__/
      document/
        document.module.ts
        document.controller.ts          # /cases/:id/documents, /documents/:id/download
        document.service.ts             # Upload, quarantine, version, access grant
        document-access.service.ts      # document_access_grant CRUD ve policy
        dto/
        __tests__/
      decision/
        decision.module.ts
        decision.controller.ts          # /cases/:id/votes
        decision.service.ts             # Oy kaydetme, sessiz kabul, üye kontrolü
        silent-acceptance.handler.ts    # 24 saat timeout system command
        dto/
        __tests__/
      secure-message/
        secure-message.module.ts
        secure-message.controller.ts    # /cases/:id/secure-messages (iç kullanıcı tarafı)
        secure-message.service.ts
        dto/
        __tests__/
      notification/
        notification.module.ts
        notification.controller.ts      # /notifications (in-app)
        notification.service.ts         # Event üretimi, dispatch hazırlığı
        notification-template.service.ts
        dto/
        __tests__/
      admin/
        admin.module.ts
        users/
          admin-users.controller.ts     # /admin/users, /admin/users/:id/roles
          admin-users.service.ts
        maker-checker/
          approval-work-item.service.ts # Onay kuyruğu oluşturma + decide delegate
          maker-checker.service.ts
          action-matrix-config.service.ts
        master-data/
          master-data.controller.ts     # /admin/master-data/*
          master-data.service.ts
        config/
          system-settings.controller.ts # /admin/system-settings
          field-visibility.controller.ts
          action-matrix.controller.ts
          sla-policy.controller.ts
          business-calendar.controller.ts
          notification-template.controller.ts
          kvkk-text.controller.ts
          config.service.ts             # Merkezi config CRUD + maker-checker
        monitoring/
          audit-viewer.controller.ts    # /admin/audit-events
          document-ops.controller.ts    # /admin/document-operations
          system-health.controller.ts   # /admin/system-health
        dto/
        __tests__/
      dashboard/
        dashboard.module.ts
        dashboard.controller.ts         # /dashboard/summary
        dashboard.service.ts            # Aggregate projection queries
        __tests__/
      integration/
        integration.module.ts
        hr-sap/
          hr-sap-sync.service.ts        # Nightly HR/SAP senkronizasyon adapter
          hr-sap-sync.handler.ts        # Worker tarafında çalışan sync job
          hr-sap.mapper.ts              # SAP record → user/company/location mapping
        email/
          email-relay.service.ts        # SMTP outbound adapter
          email-relay.adapter.ts        # Nodemailer + TLS konfigürasyonu
        __tests__/
    authorization/
      authorization.module.ts           # Merkezi yetkilendirme modülü — tüm modüller import eder
      policy-guard.service.ts           # RBAC check: rol + permission
      policy-scope.service.ts           # ABAC check: company, assignment, function/location, clearance
      field-masking.service.ts          # Response seviyesinde alan maskeleme
      document-policy.service.ts        # Doküman bazlı erişim grant kontrolü
      permission.enum.ts                # Tüm permission constant'ları
      role-permission.map.ts            # Rol → permission set mapping
    crypto/
      crypto.module.ts
      crypto.service.ts                 # AES-256-GCM encrypt/decrypt, DEK yönetimi
      key-management.port.ts            # KMS adapter interface (port)
      key-management.adapter.ts         # AWS KMS implementation
    audit/
      audit.module.ts
      audit-event.publisher.ts          # Audit event üretimi ve outbox yazma
      audit-seal.service.ts             # Chain hash / tamper-evidence
      safe-logger.service.ts            # PII redaction + structured logging
      redaction.service.ts              # Hassas alan maskeleme kuralları
    prisma/
      prisma.module.ts                  # PrismaService provider
      prisma.service.ts                 # PrismaClient lifecycle, shutdown hook
      migrations/                       # prisma migrate tarafından yönetilen migration dosyaları
      schema.prisma                     # Ana Prisma şema dosyası
      seed.ts                           # Sentetik seed data script

apps/worker/
  src/
    main.ts                             # Worker bootstrap — API'den ayrı entrypoint
    worker.module.ts
    jobs/
      notification-dispatcher.job.ts    # Outbox → e-posta/in-app gönderimi
      sla-reminder.job.ts               # SLA uyarı ve eskalasyon
      silent-acceptance.job.ts          # 24 saat sessiz kabul kontrolü
      hr-sap-sync.job.ts               # Nightly HR/SAP senkronizasyon
      malware-scan.job.ts              # Dosya tarama orchestration
      audit-chain-verify.job.ts        # Audit chain hash doğrulama
      retention-purge.job.ts           # Retention süresi dolan kayıtların imhası

packages/shared/
  src/
    enums/
      workflow-state.enum.ts            # 17 state enum
      workflow-command.enum.ts           # Transition command enum
      task-type.enum.ts                 # 11 görev tipi enum
      role.enum.ts                      # 7 rol enum
      clearance-level.enum.ts           # NORMAL, SENSITIVE, STRICTLY_CONFIDENTIAL
      document-category.enum.ts         # 13 doküman kategori enum
      report-category.enum.ts           # 18 bildirim kategori + üst grup enum
      notification-template.enum.ts     # 28 şablon kodu
    constants/
      error-codes.ts                    # Tüm DomainErrorCode constant
    utils/
      cuid.ts                           # CUID üretici
      date.ts                           # ISO 8601 yardımcıları
      mask.ts                           # PII maskeleme yardımcıları

packages/dto/
  src/
    intake/
      create-report.schema.ts           # Zod schema — frontend ve backend paylaşır
    tracking/
      verify-tracking.schema.ts
    case/
      create-transition.schema.ts
    admin/
      update-system-setting.schema.ts

packages/policy/
  src/
    permissions.ts                      # Permission enum export
    role-permission-map.ts              # Rol × permission matrix
    abac-rules.ts                       # ABAC koşul tanımları
    field-visibility-defaults.ts        # Varsayılan alan görünürlük matrisi
```

---

## Modül İskeleti (Konvansiyon)

Her feature module aşağıdaki yapıyı izler:

| Dosya | Zorunlu | Sorumluluk |
|---|---|---|
| `*.module.ts` | Evet | NestJS DI konfigürasyonu — provider'lar, import'lar, export'lar |
| `*.controller.ts` | Evet (HTTP endpoint varsa) | HTTP request/response handling, DTO validation, decorator'lar |
| `*.service.ts` | Evet | Business logic — HTTP concern yok, Prisma transaction yönetimi |
| `dto/` | Evet (endpoint varsa) | Request/response DTO sınıfları, class-validator decoratorları |
| `__tests__/` | Evet | Unit ve slice testler — her servis ve controller için |
| `strategies/`, `guards/`, `handlers/` | Opsiyonel | Auth stratejileri, özel guard'lar, command handler'lar |

Controller yalnızca request parse, DTO validation ve response serialize yapar. İş kuralı, veritabanı sorgusu, yetki detayı veya crypto işlemi controller'da bulunmaz. Controller → Service → Prisma/CryptoService/PolicyScope akışı zorunludur.

Bir modül başka modülün servisini doğrudan inject etmez. Modüller arası bağımlılık yalnızca şu yollarla sağlanır: (1) shared enum/constant/DTO import (packages/shared, packages/dto), (2) NestJS module export/import zinciri (authorization, crypto, audit modülleri global olarak inject edilebilir), (3) domain event (outbox tabanlı — doğrudan method call değil).

---

## Middleware / Guard / Interceptor / Pipe Zinciri

Request lifecycle'da aşağıdaki zincir sırasıyla çalışır. Sıra değiştirilemez; her katman bir sonrakine ancak başarılı geçişte ulaşır.

1. **Helmet middleware** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy`. Tüm endpoint'lere uygulanır.

2. **CORS middleware** — Allowlist bazlı origin kontrolü. Public intake ve anonymous tracking yüzeyleri için dış form origin'i; internal ve admin yüzeyleri için kurumsal origin. Wildcard (`*`) yasaktır. Allowlist `system_settings` tablosundan runtime'da okunur.

3. **CSRF guard** — Double-submit cookie pattern. Tüm mutating endpoint'lerde (POST, PUT, PATCH, DELETE) `X-CSRF-Token` header zorunlu; token cookie'deki değerle eşleştirilir. GET endpoint'leri exempt.

4. **Body parser** — JSON body için `express.json({ limit: '1mb' })`. Dosya upload endpoint'leri `multer` ile ayrı konfigüre edilir; tek dosya 50 MB, toplam 200 MB limiti (system_settings'ten konfigüre edilebilir).

5. **Rate limiter** — `@nestjs/throttler` + Redis-free (in-memory veya PostgreSQL backed). Endpoint grubu bazlı profiller: public intake, anonymous tracking, internal operations, admin. Profiller system_settings'ten runtime'da okunur. Brute-force lockout tracking_code/IP bazlı.

6. **Correlation interceptor** — Her request için unique `correlationId` (UUID v4) üretir; response header `X-Correlation-Id` olarak döner. Logger context'e inject edilir; tüm log satırları bu ID'yi taşır.

7. **Session guard** — Internal ve admin endpoint'lerinde `HttpOnly` cookie'den session ID okur, `user_sessions` tablosundan session doğrular, idle/absolute timeout kontrolü yapar. Public intake ve anonymous tracking endpoint'leri bu guard'dan exempt.

8. **Auth guard** — Session'dan user context yükler (`users` + `user_roles` + clearance). `req.user` object'ini set eder. Anonymous tracking endpoint'lerinde `tracking.guard.ts` farklı bir akış çalıştırır (X-Tracking-Code + X-Tracking-Password header doğrulama, argon2id hash karşılaştırma).

9. **Policy guard** — `@RequirePolicy()` decorator'ı ile tetiklenir. RBAC kontrolü (rol + permission), ABAC kontrolü (company scope, assignment scope, function/location scope, clearance level) ve resource-level erişim kontrolü tek seferde çalışır. Deny durumunda 403 veya 404 döner (kaynağın varlığını ifşa etmemek için 404 tercih edilir).

10. **Validation pipe** — NestJS global `ValidationPipe` + `class-validator` + `class-transformer`. Tüm DTO'lar `whitelist: true` (tanımsız alanlar strip edilir), `forbidNonWhitelisted: true` (tanımsız alan gelirse 400), `transform: true` (type coercion). Validation hatası `VALIDATION_FAILED` error code ile standart error zarfında döner.

11. **Audit interceptor** — Response dönüşü sonrası (after handler execution) çalışır. `@AuditAction()` decorator'ı olan mutating endpoint'lerde audit event üretir ve outbox'a yazar. Audit kaydı hassas içerik kopyalamaz; yalnızca resource ID, action, actor, policy decision, correlation ID ve maskeli metadata içerir.

12. **Response transform interceptor** — Başarılı response'ları standart `{ data: ... }` zarfına sarar. Paginated response'lar `{ data: [...], pagination: {...} }` zarfına sarar.

13. **Global exception filter** — Yakalanmamış exception'ları standart error response zarfına dönüştürür. `DomainException` alt sınıfları bilinen HTTP status'a eşlenir. Bilinmeyen exception'lar 500 döner. Hata response'unda stack trace, SQL detayı, internal path, policy rule adı veya şifreli alan bilgisi bulunmaz.

---

## Servis Katmanı Kuralları

**Sorumluluk sınırı:** Servis sınıfları yalnızca business logic içerir. HTTP request/response concern'leri (header okuma, status code set etme, file stream) controller'da kalır. Servis sınıfı `Request` veya `Response` object'ine erişmez.

**Transaction yönetimi:** Birden fazla tablo veya outbox yazımı gerektiren işlemler Prisma interactive transaction içinde çalışır. Kısmi commit kabul edilmez — workflow transition, görev oluşturma ve audit event üretimi tek transaction'da yazılır.

```typescript
// Doğru — interactive transaction
async transitionCase(command: TransitionCommand): Promise<CaseTransitionResult> {
  return this.prisma.$transaction(async (tx) => {
    const caseEntity = await tx.case.findUniqueOrThrow({
      where: { id: command.caseId },
    });

    // 1. State precondition check
    this.validateTransition(caseEntity, command);

    // 2. State update
    const updated = await tx.case.update({
      where: { id: command.caseId, optimisticLockVersion: caseEntity.optimisticLockVersion },
      data: {
        currentState: command.targetState,
        optimisticLockVersion: { increment: 1 },
      },
    });

    // 3. Transition record (append-only)
    const transition = await tx.caseTransition.create({
      data: {
        caseId: command.caseId,
        fromState: caseEntity.currentState,
        toState: command.targetState,
        command: command.commandType,
        actorType: 'USER',
        performedByUserId: command.actorUserId,
        idempotencyKey: command.idempotencyKey,
      },
    });

    // 4. Task creation (side-effect)
    const tasks = await this.taskService.createTasksForTransition(tx, transition);

    // 5. Audit outbox
    await this.auditPublisher.publish(tx, {
      eventType: 'CASE_TRANSITION',
      resourceType: 'case',
      resourceId: command.caseId,
      actorUserId: command.actorUserId,
      metadata: { fromState: caseEntity.currentState, toState: command.targetState },
    });

    // 6. Notification outbox
    await this.notificationService.enqueueTransitionNotifications(tx, transition, tasks);

    return { transition, tasks };
  });
}
```

**Optimistic locking:** `cases` tablosundaki `optimisticLockVersion` alanı concurrent update'leri yakalar. Update sırasında mevcut version koşulu eklenir; version uyuşmazlığında Prisma `RecordNotFound` fırlatır ve `CASE_OPTIMISTIC_LOCK` error code ile 409 döner.

**CryptoService erişim kuralı:** Şifreleme/çözme yalnızca `CryptoService` üzerinden yapılır. Controller, repository veya worker kodu doğrudan crypto API çağırmaz. Decrypt işlemi yalnızca yetkili request anında — PolicyGuard geçtikten sonra — yapılır ve plaintext log, cache veya ara storage'a yazılmaz.

**Servisler arası bağımlılık:** Servis A, Servis B'yi doğrudan inject edebilir (NestJS DI); ancak modüller arası bağımlılık yalnızca tanımlı export/import zinciri üzerinden olur. Circular dependency yasaktır. Cross-module side-effect'ler (notification tetikleme, audit yazma) outbox pattern ile asenkron yapılır — senkron method call değil.

---

## Repository / Data Katmanı

**ORM:** Prisma ORM, schema-first. `prisma/schema.prisma` dosyası tek doğruluk kaynağıdır. `PrismaClient` NestJS modül olarak global inject edilir; her module kendi service'inde `this.prisma` üzerinden erişir. Ayrı repository wrapper sınıfı zorunlu değildir — Prisma type-safe client yeterlidir.

**Migration:** `prisma migrate dev` development ortamında, `prisma migrate deploy` production/staging'de çalışır. Production'da `prisma migrate dev` veya `db push` kullanılmaz. Migration dosyaları naming convention: `YYYYMMDDHHMMSS_description` (Prisma otomatik üretir). Her migration PR'ı rollback planı ve veri gizliliği etkisi içerir.

**N+1 önleme:** Liste endpoint'lerinde ilişkili entity'ler `include` ile eager load edilir. İç içe 3+ seviye include yasaktır — performans riski. Aggregate/count sorgularında `_count` kullanılır. Dashboard aggregate query'leri raw SQL veya Prisma `$queryRaw` ile yazılabilir; ancak parameterized query zorunludur (SQL injection koruması).

**PolicyScope ile filtered queries:** Tüm liste sorguları `PolicyScope` servisinden geçer. Bu servis, mevcut kullanıcının rol, şirket, atama, fonksiyon/lokasyon ve clearance attribute'larına göre Prisma `where` koşulu üretir. Controller veya service katmanında ad-hoc `where` koşulu ile yetki filtresi yazılmaz.

```typescript
// Doğru — PolicyScope kullanımı
async listCases(user: AuthenticatedUser, filters: ListCasesDto) {
  const policyWhere = this.policyScope.buildCaseScope(user);
  return this.prisma.case.findMany({
    where: {
      ...policyWhere,
      ...(filters.status ? { currentState: { in: filters.status } } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
    },
    take: filters.limit,
    cursor: filters.cursor ? { id: filters.cursor } : undefined,
    orderBy: { [filters.sortBy]: filters.sortOrder },
    include: { report: { select: { categoryGroup: true, companyId: true } } },
  });
}
```

**Connection pool:** Prisma'nın default connection pool'u kullanılır. Production'da `connection_limit` env variable ile ayarlanır (varsayılan 10). Worker ayrı connection pool kullanır.

---

## Background Jobs / Workers

Asenkron işler PostgreSQL outbox + worker pattern ile çalışır. Kafka, RabbitMQ veya Redis gibi ek altyapı bileşeni kullanılmaz. Worker `apps/worker` olarak ayrı runtime'da çalışır; API server'dan bağımsızdır.

**Outbox pattern:** Mutating transaction sonunda `notification_events`, `audit_events` tablolarına outbox kaydı yazılır. Worker belirli aralıklarla (varsayılan 5 saniye, `outbox_poll_interval_seconds` ile konfigüre edilebilir) outbox tablosunu poll eder, `PENDING` kayıtları işler ve durumu `SENT`/`FAILED` olarak günceller.

**Tekil çalıştırma:** Her job tipi PostgreSQL advisory lock ile korunur. Aynı anda birden fazla worker instance aynı job'ı çalıştıramaz. Advisory lock job başlangıcında alınır, tamamlanma veya hata durumunda serbest bırakılır.

**İdempotency:** Tüm worker job'ları idempotent tasarlanır. Outbox kaydındaki `idempotency_key` tekrar işlenmeyi engeller. Tekrar deneme çift bildirim, çift state geçişi veya çift audit kaydı üretmez.

**Retry / backoff:** Başarısız job'lar exponential backoff ile yeniden denenir. Varsayılan: 3 deneme, backoff 30s → 60s → 120s. Kalıcı hata sonrası kayıt `PERMANENTLY_FAILED` olarak işaretlenir ve admin paneli `system_health` ekranına düşer.

### Worker job kataloğu

| Job | Tetikleyici | Periyot | Açıklama |
|---|---|---|---|
| `notification_dispatcher` | Outbox poll | 5 sn | `notification_events` tablosundan PENDING kayıtları alır; e-posta (SMTP) veya in-app kaydı oluşturur |
| `sla_reminder` | Cron | Her 15 dk | Görevlerin SLA durumunu kontrol eder; uyarı ve aşım bildirimleri üretir |
| `silent_acceptance` | Cron | Her 5 dk | `member_approval` state'indeki vakaları kontrol eder; 24 saat dolmuşsa `SILENT_ACCEPTANCE` vote üretir |
| `hr_sap_sync` | Cron | Gece 02:00 (konfigüre edilebilir) | HR/SAP'tan kullanıcı, şirket, lokasyon, fonksiyon, pozisyon senkronizasyonu |
| `malware_scan` | Outbox poll | 10 sn | `QUARANTINED` durumdaki dosyaları ClamAV'a gönderir; sonuca göre `AVAILABLE` veya `REJECTED` işaretler |
| `audit_chain_verify` | Cron | Her 1 saat | Audit event zincirinin hash bütünlüğünü doğrular; bozulma tespit edilirse alarm üretir |
| `retention_purge` | Cron | Haftada 1 | Retention süresi dolan kayıtları denetlenebilir imha akışıyla temizler |

**Worker kendi başına domain state mutate etmez.** Worker tarafından tetiklenen state değişiklikleri (sessiz kabul, SLA eskalasyon) `actor_type=SYSTEM` ile normal transition akışından geçer ve audit'e kaydedilir.

---

## Logging

Logging kütüphanesi **Pino** + **nestjs-pino**. Tüm loglar structured JSON formatındadır; plaintext veya printf-style log yazılmaz.

### Standart log alanları

Her log satırında zorunlu olarak bulunan alanlar:

| Alan | Kaynak | Açıklama |
|---|---|---|
| `timestamp` | Pino otomatik | ISO 8601 UTC |
| `level` | Pino | `debug`, `info`, `warn`, `error`, `fatal` |
| `requestId` | Correlation interceptor | Request bazlı unique ID |
| `correlationId` | Outbox/event zinciri | Job/event zinciri izleme |
| `userId` | Auth guard | Oturum sahibi kullanıcı ID (anonim ise null) |
| `method` | Logger middleware | HTTP method |
| `path` | Logger middleware | Request path |
| `statusCode` | Response | HTTP status code |
| `durationMs` | Logger middleware | İstek süre (ms) |
| `userAgent` | Request header | Truncated user-agent |
| `module` | NestJS context | Kaynak modül/servis adı |
| `msg` | Kod | Log mesajı |

### Log seviyeleri

| Seviye | Kullanım |
|---|---|
| `debug` | Development/test detayı; production'da kapalı |
| `info` | Normal operasyon: request başlangıç/bitiş, job çalıştırma, sync tamamlanma |
| `warn` | Dikkat gerektiren: rate limit yaklaşımı, SLA uyarısı, retry |
| `error` | Hata: exception, dış servis hatası, validation beklenmedik durum |
| `fatal` | Kritik: startup failure, DB bağlantı kaybı, KMS erişim hatası |

### Log YASAK alanlar

Aşağıdaki veriler hiçbir koşulda log satırına yazılmaz:

- Bildirim metni, karar yazısı, raportör raporu, aksiyon dönüşü
- Doküman içeriği veya dosya adı
- Bildirimci kimlik/iletişim bilgisi
- İlgili kişiler, tanıklar
- Tracking code parolası, OIDC token, session secret
- Decrypt edilmiş PII veya vaka alanı
- KMS key material
- E-posta gövdesi, güvenli mesaj içeriği
- SQL query parametreleri (hassas veri içerebilir)

`SafeLogger` wrapper servisi, log çağrılarında otomatik redaction uygular. Redaction pattern'leri `RedactionService` tarafından yönetilir ve hassas alan adlarını (password, token, secret, email, phone, description, body, content) regex ile maskeler.

---

## Exception Hiyerarşisi

Tüm domain exception'ları `DomainException` temel sınıfından türer. Her exception `DomainErrorCode` enum değeri ve HTTP status code taşır. Global exception filter bu sınıfı tanır ve standart error response zarfına dönüştürür.

```
DomainException (abstract)
├── ValidationException          → 400 VALIDATION_FAILED
├── AuthenticationException      → 401 AUTH_*
│   ├── SessionRequiredException       AUTH_SESSION_REQUIRED
│   ├── SessionExpiredException        AUTH_SESSION_EXPIRED
│   ├── InvalidCredentialsException    AUTH_INVALID_CREDENTIALS
│   ├── AccountLockedException         AUTH_ACCOUNT_LOCKED
│   └── OidcFailedException            AUTH_OIDC_FAILED
├── AuthorizationException       → 403 AUTHZ_*
│   ├── ForbiddenException             AUTHZ_FORBIDDEN
│   └── FieldDeniedException           AUTHZ_FIELD_DENIED
├── NotFoundException            → 404 RESOURCE_NOT_FOUND
├── ConflictException            → 409
│   ├── InvalidTransitionException     CASE_INVALID_TRANSITION
│   ├── OptimisticLockException        CASE_OPTIMISTIC_LOCK
│   └── DuplicateException             USER_EMAIL_DUPLICATE, REPORT_TRACKING_DUPLICATE
├── UnprocessableException       → 422
│   ├── DocumentQuarantinedException   DOCUMENT_QUARANTINED
│   ├── DocumentRejectedException      DOCUMENT_REJECTED
│   ├── DocumentTypeException          DOCUMENT_TYPE_NOT_ALLOWED
│   ├── DocumentSizeException          DOCUMENT_SIZE_EXCEEDED
│   ├── MasterDataInactiveException    MASTER_DATA_INACTIVE
│   ├── MakerCheckerRequiredException  MAKER_CHECKER_REQUIRED
│   └── MakerCheckerSelfException      MAKER_CHECKER_SELF
├── RateLimitException           → 429 RATE_LIMIT_EXCEEDED
└── InternalException            → 500 INTERNAL_ERROR
```

Global exception filter bilinmeyen exception'ları (Prisma `PrismaClientKnownRequestError`, Node.js native error vb.) yakalayıp `INTERNAL_ERROR` olarak döndürür. Hata response'unda stack trace, SQL detayı, Prisma error code, internal file path veya environment bilgisi bulunmaz.

```typescript
// Global exception filter çıktı örneği
{
  "error": {
    "code": "CASE_INVALID_TRANSITION",
    "message": "Bu işlem vakanın mevcut durumunda yapılamaz.",
    "requestId": "req_clx9ghi789",
    "timestamp": "2026-06-09T14:30:01Z"
  }
}
```

---

## Config Yönetimi

### Environment validation

Uygulama başlangıcında tüm environment variable'ları Zod şeması ile validate edilir. Eksik veya geçersiz değer varsa uygulama başlamaz (fail-fast). Runtime'da environment variable değişikliği desteklenmez; değişiklik deploy gerektirir.

```typescript
// env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().default(10),

  OIDC_ISSUER_URL: z.string().url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(1),

  SESSION_SECRET: z.string().min(32),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().default(30),
  SESSION_ABSOLUTE_TIMEOUT_HOURS: z.coerce.number().default(8),

  KMS_KEY_ID: z.string().min(1),
  AWS_REGION: z.string().default('eu-central-1'),

  S3_BUCKET_NAME: z.string().min(1),
  S3_ENDPOINT: z.string().url().optional(),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_ADDRESS: z.string().email(),

  CLAMAV_HOST: z.string().default('localhost'),
  CLAMAV_PORT: z.coerce.number().default(3310),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  CORS_ALLOWED_ORIGINS: z.string().transform((s) => s.split(',')),
});

export type EnvConfig = z.infer<typeof envSchema>;
```

### Environment dosya hierarchy

`.env.local` > `.env.development` > `.env` (development ortamında). Production'da tüm değerler container environment veya AWS Secrets Manager'dan gelir; `.env` dosyası kullanılmaz.

### Secret yönetimi

Secret'lar (OIDC client secret, session secret, KMS key ID, SMTP credential, database password) repository'ye, container image'a veya düz config dosyasına yazılmaz. Production'da AWS Secrets Manager'dan runtime'da çekilir. Development ortamında `.env.local` dosyası kullanılır; bu dosya `.gitignore`'da bulunur.

---

## Referans Patterns

### Tipik controller

```typescript
@Controller('cases')
@UseGuards(SessionGuard, AuthGuard, PolicyGuard)
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Get()
  @RequirePolicy('case:list')
  async listCases(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCasesDto,
  ): Promise<PaginatedResponse<CaseSummaryDto>> {
    const result = await this.caseService.listCases(user, query);
    return toPaginatedResponse(result);
  }

  @Get(':id')
  @RequirePolicy('case:read')
  async getCaseDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DataResponse<CaseDetailDto>> {
    const result = await this.caseService.getCaseDetail(user, id);
    return toDataResponse(result);
  }

  @Post(':id/transitions')
  @RequirePolicy('case:transition')
  @AuditAction('CASE_TRANSITION')
  async createTransition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') caseId: string,
    @Body() body: CreateTransitionDto,
  ): Promise<DataResponse<TransitionResultDto>> {
    const result = await this.caseService.transitionCase({
      caseId,
      commandType: body.command,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
      metadata: body.metadata,
      actorUserId: user.id,
    });
    return toDataResponse(result);
  }
}
```

### Tipik service (workflow transition)

```typescript
@Injectable()
export class CaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyScope: PolicyScopeService,
    private readonly fieldMasking: FieldMaskingService,
    private readonly cryptoService: CryptoService,
    private readonly taskService: TaskService,
    private readonly auditPublisher: AuditEventPublisher,
    private readonly notificationService: NotificationService,
  ) {}

  async getCaseDetail(user: AuthenticatedUser, caseId: string): Promise<CaseDetailDto> {
    const policyWhere = this.policyScope.buildCaseScope(user);
    const caseEntity = await this.prisma.case.findFirst({
      where: { id: caseId, ...policyWhere },
      include: { report: true },
    });

    if (!caseEntity) {
      throw new NotFoundException('case', caseId);
    }

    // Decrypt şifreli alanlar
    const decrypted = await this.cryptoService.decryptCaseFields(
      caseEntity,
      caseEntity.report,
    );

    // Field masking — kullanıcının göremeyeceği alanları çıkar
    const masked = this.fieldMasking.applyCaseFieldPolicy(user, decrypted);

    // Available actions hesapla
    const availableActions = this.getAvailableActions(user, caseEntity);

    return { ...masked, availableActions };
  }

  async transitionCase(command: TransitionCommand): Promise<TransitionResultDto> {
    return this.prisma.$transaction(async (tx) => {
      // [Tam transaction akışı — Servis Katmanı Kuralları bölümündeki örneğe bakınız]
    });
  }
}
```

### Tipik PolicyScope query builder

```typescript
@Injectable()
export class PolicyScopeService {
  buildCaseScope(user: AuthenticatedUser): Prisma.CaseWhereInput {
    const roles = user.roles.map((r) => r.roleCode);

    // Holding seviyesi roller — tüm vakalar (clearance sınırıyla)
    if (roles.some((r) => ['council_secretary', 'council_chair', 'council_member', 'board_chair'].includes(r))) {
      return {
        confidentialityLevel: { in: this.getAllowedLevels(user.clearanceLevel) },
      };
    }

    // Rapporteur — yalnızca atandığı vakalar
    if (roles.includes('rapporteur')) {
      return {
        assignedRapporteurId: user.id,
        confidentialityLevel: { in: this.getAllowedLevels(user.clearanceLevel) },
      };
    }

    // Action owner — yalnızca kendi şirketi/fonksiyonu
    if (roles.includes('action_owner')) {
      return {
        assignedActionOwnerId: user.id,
        confidentialityLevel: { in: this.getAllowedLevels(user.clearanceLevel) },
      };
    }

    // Admin — vakalara erişim yok
    if (roles.includes('admin') && roles.length === 1) {
      return { id: '__DENY_ALL__' }; // Hiçbir vaka dönmez
    }

    // Deny-by-default — rol tanınmadı
    return { id: '__DENY_ALL__' };
  }

  private getAllowedLevels(clearance: ClearanceLevel): ClearanceLevel[] {
    const hierarchy: ClearanceLevel[] = ['NORMAL', 'SENSITIVE', 'STRICTLY_CONFIDENTIAL'];
    const index = hierarchy.indexOf(clearance);
    return hierarchy.slice(0, index + 1);
  }
}
```

### Tipik CryptoService kullanımı

```typescript
@Injectable()
export class CryptoService {
  constructor(private readonly kmsAdapter: KeyManagementPort) {}

  async encryptField(plaintext: string): Promise<EncryptedFieldResult> {
    // 1. Yeni DEK üret (random 256-bit)
    const dek = crypto.randomBytes(32);

    // 2. Plaintext → AES-256-GCM encrypt
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 3. DEK → KMS ile wrap
    const wrappedDek = await this.kmsAdapter.wrapKey(dek);

    return {
      ciphertext: Buffer.concat([iv, authTag, encrypted]).toString('base64'),
      encryptedDek: wrappedDek.encryptedDek,
      kmsKeyId: wrappedDek.kmsKeyId,
      algorithm: 'AES-256-GCM',
    };
  }

  async decryptField(encrypted: EncryptedFieldData): Promise<string> {
    // 1. KMS'ten DEK unwrap
    const dek = await this.kmsAdapter.unwrapKey(encrypted.encryptedDek, encrypted.kmsKeyId);

    // 2. AES-256-GCM decrypt
    const buffer = Buffer.from(encrypted.ciphertext, 'base64');
    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const ciphertext = buffer.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Plaintext yalnızca RAM'de — log, cache veya ara storage'a yazılmaz
    return decrypted.toString('utf8');
  }
}
```
