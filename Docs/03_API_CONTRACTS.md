# Yıldız Holding Etik Bildirim Uygulaması — API Contracts

## Genel Prensipler

Base URL yapısı ortam bazlı belirlenir; tüm endpoint'ler `/api/v1` prefix'i altında çalışır. Versioning URL path üzerinden yapılır (`/api/v1/...`); header-based versioning kullanılmaz. Yeni major versiyon gerekirse `/api/v2` açılır; eski versiyon sunset takvimi ile kaldırılır.

Tüm request ve response body'leri `Content-Type: application/json; charset=utf-8` ile taşınır. Dosya upload endpoint'leri `multipart/form-data` kabul eder. Tarih ve zaman alanları ISO 8601 UTC formatındadır (`2026-06-09T14:30:00Z`); timezone offset backend tarafından normalize edilir, client'a her zaman UTC döner.

URL path'leri kebab-case (`/api/v1/intake/reports`), JSON field'ları camelCase (`companyId`, `trackingCode`) kullanır. Query parameter'ları da camelCase'dir.

API dört güvenlik yüzeyine ayrılır; her yüzeyin session, CORS, CSRF, rate-limit ve guard davranışı farklıdır:

| Yüzey | Prefix | Auth | Session | CORS | CSRF |
|---|---|---|---|---|---|
| Public Intake | `/api/v1/intake/*` | Yok | Yok | Dış form origin allowlist | CSRF token zorunlu (double-submit cookie) |
| Anonymous Tracking | `/api/v1/tracking/*` | tracking_code + parola (her istekte) | Yok — cookie bırakılmaz | Dış form origin allowlist | CSRF token zorunlu |
| Internal Operations | `/api/v1/*` (intake/tracking/admin hariç) | OIDC session (HttpOnly cookie) | Server-side session | Kurumsal origin allowlist | CSRF token zorunlu |
| System Admin | `/api/v1/admin/*` | OIDC session + `admin` rolü | Server-side session | Kurumsal origin (dar) | CSRF token zorunlu |

CORS wildcard (`*`) hiçbir yüzeyde kullanılmaz. Allowlist `system_settings` tablosundan runtime'da yönetilir.

---

## Standart Response Zarfı

### Başarılı yanıt (tekil)

```json
{
  "data": {
    "id": "clx9abc123",
    "trackingCode": "ETK-2XA9-KP7M",
    "status": "SUBMITTED",
    "createdAt": "2026-06-09T14:30:00Z"
  }
}
```

### Başarılı yanıt (liste, paginated)

```json
{
  "data": [
    { "id": "clx9abc123", "status": "SUBMITTED" },
    { "id": "clx9def456", "status": "UNDER_REVIEW" }
  ],
  "pagination": {
    "nextCursor": "eyJpZCI6ImNseDlkZWY0NTYifQ==",
    "hasMore": true,
    "total": null
  }
}
```

`total` yalnızca hesaplaması ucuz olan endpoint'lerde döner (admin dashboard aggregate); büyük listelerde `null` bırakılır.

### Hata yanıtı

```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Takip kodu veya şifre hatalı.",
    "requestId": "req_clx9ghi789",
    "timestamp": "2026-06-09T14:30:01Z"
  }
}
```

Hata mesajları kullanıcıya gösterilecek Türkçe metinlerdir. Stack trace, SQL detayı, internal object key, policy rule adı veya şifreli alan bilgisi hata yanıtında döndürülmez.

### Validation hata yanıtı (çoklu alan)

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Formu kontrol edin.",
    "requestId": "req_clx9jkl012",
    "timestamp": "2026-06-09T14:30:02Z",
    "details": [
      { "field": "incidentDescription", "rule": "required", "message": "Olay açıklaması zorunludur." },
      { "field": "companyId", "rule": "exists", "message": "Geçerli bir şirket seçiniz." }
    ]
  }
}
```

---

## Error Taxonomy

### Error code format

Tüm error code'ları `DOMAIN_ENTITY_CONDITION` formatında, SCREAMING_SNAKE_CASE olarak tanımlanır. Frontend bu code'ları switch/map ile eşleyerek kullanıcı mesajı üretir veya API'den dönen `message` alanını doğrudan gösterir.

### Master error code tablosu

| Code | HTTP | Koşul | Kullanıcı mesajı | Frontend davranışı |
|---|---|---|---|---|
| `VALIDATION_FAILED` | 400 | Input validation hatası | "Formu kontrol edin." | Inline field error |
| `AUTH_SESSION_REQUIRED` | 401 | Session cookie yok veya expired | "Oturum bulunamadı." | Redirect → login |
| `AUTH_SESSION_EXPIRED` | 401 | Session idle/absolute timeout | "Oturumunuz sona erdi." | Redirect → login |
| `AUTH_INVALID_CREDENTIALS` | 401 | Anonim tracking'de yanlış kod/şifre | "Takip kodu veya şifre hatalı." | Inline error |
| `AUTH_ACCOUNT_LOCKED` | 401 | Brute-force lockout | "Hesap geçici olarak kilitlendi." | Inline error + bekleme süresi |
| `AUTH_OIDC_FAILED` | 401 | OIDC callback hatası | "Kimlik doğrulama başarısız." | Redirect → login |
| `AUTHZ_FORBIDDEN` | 403 | Rol/ABAC/clearance yetersiz | "Bu işlem için yetkiniz yok." | Toast + redirect back |
| `AUTHZ_FIELD_DENIED` | 403 | Field-level erişim engeli | — (alan response'da dönmez) | Sessiz — alan gösterilmez |
| `RESOURCE_NOT_FOUND` | 404 | Kaynak bulunamadı veya erişim yok | "Kayıt bulunamadı." | Toast |
| `CASE_INVALID_TRANSITION` | 409 | Geçersiz state transition | "Bu işlem vakanın mevcut durumunda yapılamaz." | Toast |
| `CASE_OPTIMISTIC_LOCK` | 409 | Concurrent update çakışması | "Kayıt başka bir kullanıcı tarafından güncellendi." | Toast + refresh |
| `USER_EMAIL_DUPLICATE` | 409 | E-posta çakışması | "Bu e-posta adresi zaten kayıtlı." | Inline error |
| `REPORT_TRACKING_DUPLICATE` | 409 | Tracking code çakışması (retry) | — (sistem yeniden üretir) | Sessiz retry |
| `DOCUMENT_QUARANTINED` | 422 | Dosya malware taramasında | "Dosya henüz taranıyor." | Toast |
| `DOCUMENT_REJECTED` | 422 | Dosya malware pozitif | "Dosya güvenlik taramasını geçemedi." | Toast |
| `DOCUMENT_TYPE_NOT_ALLOWED` | 422 | İzin verilmeyen dosya tipi | "Bu dosya formatı desteklenmiyor." | Inline error |
| `DOCUMENT_SIZE_EXCEEDED` | 422 | Dosya boyut limiti aşıldı | "Dosya boyutu limiti aşıyor." | Inline error |
| `MASTER_DATA_INACTIVE` | 422 | Referans verilen şirket/lokasyon pasif | "Seçilen kayıt aktif değil." | Inline error |
| `MAKER_CHECKER_REQUIRED` | 422 | İşlem onay bekliyor | "Bu işlem çift onay gerektiriyor." | Modal / pending state |
| `MAKER_CHECKER_SELF` | 422 | Maker ve checker aynı kişi | "Kendi işleminizi onaylayamazsınız." | Toast |
| `SLA_CONFIG_INVALID` | 422 | Geçersiz SLA konfigürasyonu | "SLA ayarları geçersiz." | Inline error |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit aşıldı | "Çok fazla istek gönderdiniz." | Toast + Retry-After |
| `INTERNAL_ERROR` | 500 | Beklenmeyen hata | "Bir hata oluştu, lütfen tekrar deneyin." | Toast |

### HTTP status özet mapping

| Status | Anlam | Ne zaman |
|---|---|---|
| 200 | OK | Başarılı GET, PUT, PATCH |
| 201 | Created | Başarılı POST (yeni kayıt) |
| 204 | No Content | Başarılı DELETE, mark-read |
| 400 | Bad Request | Validation hatası |
| 401 | Unauthorized | Session/auth eksik veya geçersiz |
| 403 | Forbidden | Yetki yetersiz (RBAC/ABAC/clearance) |
| 404 | Not Found | Kaynak yok veya erişim engelli (bilgi sızıntısı önlemek için 404) |
| 409 | Conflict | State conflict, duplicate, optimistic lock |
| 422 | Unprocessable Entity | İş kuralı ihlali |
| 429 | Too Many Requests | Rate limit |
| 500 | Internal Server Error | Beklenmeyen hata |

Yetki reddinde erişilmeye çalışılan kaynağın varlığı ifşa edilmez: yetkisiz kullanıcıya var olan kayıt için de 404 döner (403 değil) — `AUTHZ_FORBIDDEN` yalnızca kullanıcının kaynağı zaten görebildiği ama işlem yetkisi olmadığı durumlarda kullanılır.

---

## Rate Limiting

Rate limiting uygulama katmanında `@nestjs/throttler` ile endpoint bazlı uygulanır; WAF katmanı ek savunma derinliği olarak korunur ancak birincil güvenlik sınırı değildir.

| Yüzey / Endpoint | Limit | Pencere | Tanımlayıcı | Lockout |
|---|---|---|---|---|
| Public intake form submit | 5 req | 1 dk | IP | — |
| Public intake file upload | 10 req | 5 dk | IP | — |
| Anonymous tracking verify | 5 req | 15 dk | IP + tracking_code | 5 başarısız → 30 dk kilit |
| Anonymous tracking diğer | 20 req | 1 dk | IP + tracking_code | — |
| Internal operations (genel) | 60 req | 1 dk | user_id | — |
| Internal file upload | 10 req | 5 dk | user_id | — |
| OIDC login initiation | 10 req | 5 dk | IP | — |
| Admin endpoints | 30 req | 1 dk | user_id | — |

429 yanıtı `Retry-After` header'ı (saniye cinsinden) içerir. Tüm rate limit profilleri `system_settings` tablosundan runtime'da değiştirilebilir (`rate_limit_intake_per_minute`, `rate_limit_tracking_per_minute`, `rate_limit_login_per_minute`, `rate_limit_upload_per_minute`).

Brute-force lockout eşikleri de konfigüre edilebilir: `brute_force_max_attempts` (varsayılan 5), `brute_force_lockout_minutes` (varsayılan 30). Lockout olayları güvenlik audit event'i olarak kaydedilir.

---

## Pagination

Tüm liste endpoint'leri cursor-based pagination kullanır. Offset-based pagination kullanılmaz — append-heavy vaka/görev/audit listeleri için cursor tutarlı sonuç verir.

### Request

```
GET /api/v1/cases?limit=20&cursor=eyJpZCI6ImNseDlkZWY0NTYifQ==&sortBy=openedAt&sortOrder=desc
```

| Parametre | Tip | Default | Min | Max | Açıklama |
|---|---|---|---|---|---|
| `limit` | integer | 20 | 1 | 100 | Sayfa boyutu |
| `cursor` | string | null | — | — | Opaque base64 cursor |
| `sortBy` | string | varies | — | — | Endpoint'e özgü izinli alanlar |
| `sortOrder` | string | `desc` | — | — | `asc` veya `desc` |

### Response

```json
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6ImNseDlhYmMxMjMifQ==",
    "hasMore": true,
    "total": null
  }
}
```

`nextCursor` son sayfada `null` döner. Cursor opaque'tir; client decode etmez, aynen geri gönderir.

---

## Authentication

### İç kullanıcılar — OIDC + Server-Side Session

İç kullanıcılar OIDC Authorization Code Flow + PKCE ile kimlik doğrular. Frontend login butonuna tıklandığında backend OIDC redirect URL üretir; IdP'de kimlik doğrulandıktan sonra callback endpoint'i authorization code alır, token exchange yapar ve server-side session oluşturur. Access token ve refresh token backend'de tutulur; browser'a yalnızca session ID içeren `HttpOnly`, `Secure`, `SameSite=Lax` cookie gönderilir.

Session süreleri: idle timeout 30 dakika (privileged admin işlemler 15 dakika), absolute timeout 8 saat. Timeout dolduğunda session server-side sonlandırılır ve frontend login'e yönlendirilir. Logout endpoint'i session'ı server-side siler ve IdP'den de çıkış yapar.

JIT provisioning: ilk girişte `users` tablosunda kayıt yoksa OIDC claim'lerinden (`sub`, `email`, `name`) otomatik oluşturulur — ancak hiçbir rol atanmaz. Rolsüz kullanıcı sisteme girer ancak hiçbir içeriğe erişemez (deny-by-default).

### Anonim bildirimci — Tracking Code + Parola

Anonim takip endpoint'lerinde session/cookie kullanılmaz. Her istek `X-Tracking-Code` ve `X-Tracking-Password` custom header'ları ile gönderilir. Backend her istekte tracking_code + parola doğrulaması yapar (argon2id hash karşılaştırma); başarısızsa 401 döner. Brute-force koruması tracking_code başına 5 başarısız deneme → 30 dakika kilit uygular.

---

## Audit Annotation Kuralı

Tüm mutating endpoint'ler (POST, PUT, PATCH, DELETE) audit log'a event yazar. Her endpoint tanımında `Audit:` satırı, yazılacak event type'ı ve loglanacak metadata'yı belirtir.

Audit event'leri hassas içerik kopyalamaz: bildirim metni, karar yazısı, raportör raporu, aksiyon dönüşü, doküman içeriği, takip parolası, iletişim bilgisi veya decrypt edilmiş PII audit kaydına yazılmaz. Logda yalnızca resource ID, actor, action, policy decision, correlation ID, maskeli before/after diff ve idempotency key bulunur.

---

## Endpoint'ler — Modül Bazlı

### 8.1 Public Intake

Bu yüzeyin endpoint'leri login gerektirmez, session açmaz ve cookie bırakmaz. Rate limiting IP bazlıdır; CSRF double-submit cookie ile korunur.

---

#### GET /api/v1/intake/categories

**Purpose:** Bildirim formu için kategori üst grupları ve alt kategorileri döner.

**Auth:** Yok (public).

**Rate limit:** 60 req/dk per IP.

**Response 200:**

```json
{
  "data": [
    {
      "groupCode": "FRAUD_THEFT",
      "groupLabel": "Hırsızlık, Zimmet, Dolandırıcılık, Suiistimal",
      "categories": [
        { "code": "THEFT", "label": "Hırsızlık" },
        { "code": "EMBEZZLEMENT", "label": "Zimmet" },
        { "code": "FRAUD", "label": "Dolandırıcılık" },
        { "code": "MISUSE", "label": "Suiistimal" }
      ]
    }
  ]
}
```

**Errors:** Yalnızca 500 olası.

**Audit:** Yok — read-only, public.

---

#### GET /api/v1/intake/kvkk-text

**Purpose:** Güncel KVKK aydınlatma ve gizlilik metni ile versiyon bilgisini döner.

**Auth:** Yok (public).

**Rate limit:** 60 req/dk per IP.

**Response 200:**

```json
{
  "data": {
    "version": "1.2",
    "effectiveDate": "2026-06-01T00:00:00Z",
    "bodyHtml": "<p>Kişisel Verilerin Korunması Kanunu kapsamında...</p>",
    "privacyNoticeHtml": "<p>Bildiriminiz gizli tutulacaktır...</p>"
  }
}
```

**Audit:** Yok — read-only, public.

---

#### GET /api/v1/intake/companies

**Purpose:** Bildirim formu şirket seçimi dropdown'u için aktif şirket listesi döner.

**Auth:** Yok (public).

**Rate limit:** 60 req/dk per IP.

**Response 200:**

```json
{
  "data": [
    { "id": "clx1abc", "name": "Yıldız Holding A.Ş.", "code": "YH" },
    { "id": "clx2def", "name": "Pınar Süt A.Ş.", "code": "PS" }
  ]
}
```

Yalnızca `id`, `name`, `code` döner; iç detay (source_system, sync bilgisi) dış forma verilmez. Yalnızca `is_active = true` kayıtlar listelenir.

**Audit:** Yok — read-only, public.

---

#### POST /api/v1/intake/reports

**Purpose:** Yeni etik bildirim oluşturma.

**Auth:** Yok (public).

**Rate limit:** 5 req/dk per IP.

**Request body:**

```json
{
  "reporterCountry": "TUR",
  "reporterCity": "İstanbul",
  "companyId": "clx1abc",
  "incidentCountry": "TUR",
  "incidentCity": "Bursa",
  "incidentLocationDetail": "Pınar Fabrikası",
  "categoryGroup": "FRAUD_THEFT",
  "categories": ["EMBEZZLEMENT"],
  "isUncertainCategory": false,
  "incidentDescription": "...",
  "incidentDateStart": "2026-05-01",
  "incidentDateEnd": null,
  "incidentIsOngoing": true,
  "incidentRecurrence": "RECURRING",
  "howReporterLearned": "WITNESSED",
  "previouslyReported": false,
  "previouslyReportedTo": null,
  "urgentRiskFlag": false,
  "urgentRiskDescription": null,
  "involvedPersons": [
    {
      "name": "...",
      "title": "Müdür",
      "department": "Finans",
      "role": "İddia edilen",
      "companyName": "Pınar Süt"
    }
  ],
  "witnesses": [],
  "categorySpecificData": {
    "estimatedAmount": "100000-500000",
    "currency": "TRY",
    "discoveryMethod": "FINANCIAL_AUDIT"
  },
  "isAnonymous": true,
  "reporterIdentityName": null,
  "reporterIdentityTitle": null,
  "reporterIdentityRelation": null,
  "reporterContactEmail": null,
  "reporterContactPhone": null,
  "trackingPassword": "MySecretPass123!",
  "kvkkConsentVersion": "1.2"
}
```

**Field kuralları:**

| Alan | Kural |
|---|---|
| `companyId` | Zorunlu; aktif şirket ID'si |
| `categoryGroup` | Zorunlu; geçerli enum |
| `categories` | Zorunlu; en az 1 eleman, geçerli kategori kodları |
| `incidentDescription` | Zorunlu; 10–10000 karakter |
| `trackingPassword` | Zorunlu; min 8 karakter, en az 1 harf + 1 rakam |
| `kvkkConsentVersion` | Zorunlu; güncel aktif KVKK metin versiyonu |
| `isAnonymous` | Zorunlu |
| `reporterIdentity*`, `reporterContact*` | `isAnonymous=true` ise gönderilmez ve backend tarafından ignore edilir |
| `involvedPersons` | Opsiyonel; max 20 eleman |
| `witnesses` | Opsiyonel; max 10 eleman |
| `categorySpecificData` | Opsiyonel; seçilen kategorilere göre schema validate edilir |

**Response 201:**

```json
{
  "data": {
    "trackingCode": "ETK-2XA9-KP7M",
    "submittedAt": "2026-06-09T14:30:00Z",
    "message": "Bildiriminiz başarıyla alınmıştır. Takip kodunuzu güvenli bir yere kaydediniz."
  }
}
```

Response'da bildirim içeriği geri dönmez — yalnızca tracking code ve onay mesajı.

**Errors:**

| Code | HTTP | Koşul |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Alan doğrulama hatası |
| `MASTER_DATA_INACTIVE` | 422 | Seçilen şirket pasif |
| `DOCUMENT_TYPE_NOT_ALLOWED` | 422 | Kategori enum geçersiz |
| `RATE_LIMIT_EXCEEDED` | 429 | IP limiti aşıldı |

**Audit:** `REPORT_SUBMITTED` — correlation_id, channel=WEB_FORM, company_id, category_group, is_anonymous, confidentiality_level=SENSITIVE (varsayılan). Bildirim metni, kişi bilgisi ve iletişim verisi audit'e yazılmaz.

---

#### POST /api/v1/intake/reports/:trackingCode/attachments

**Purpose:** Bildirim formu sırasında dosya ekleme.

**Auth:** Yok (public). Tracking code URL'de taşınır; henüz parola doğrulama yapılmaz çünkü form submit ile aynı oturumda yapılır.

**Rate limit:** 10 req/5 dk per IP.

**Request:** `multipart/form-data`

| Field | Tip | Zorunlu | Kural |
|---|---|---|---|
| `file` | binary | Evet | Max 50 MB, izinli tipler: PDF, DOCX, XLSX, JPG, JPEG, PNG, MP4, MOV, ZIP, TXT |
| `description` | string | Hayır | Max 500 karakter |

**Response 201:**

```json
{
  "data": {
    "id": "clx9att001",
    "originalFilename": "kanit.pdf",
    "sizeBytes": 2048576,
    "mimeType": "application/pdf",
    "malwareScanStatus": "PENDING",
    "uploadedAt": "2026-06-09T14:30:05Z"
  }
}
```

**Errors:**

| Code | HTTP | Koşul |
|---|---|---|
| `DOCUMENT_TYPE_NOT_ALLOWED` | 422 | İzin verilmeyen dosya tipi |
| `DOCUMENT_SIZE_EXCEEDED` | 422 | 50 MB aşıldı |
| `RESOURCE_NOT_FOUND` | 404 | Tracking code bulunamadı |
| `RATE_LIMIT_EXCEEDED` | 429 | Upload limiti aşıldı |

**Audit:** `REPORT_ATTACHMENT_UPLOADED` — report_id, file_size, mime_type, malware_scan_status. Dosya adı ve içerik audit'e yazılmaz.

---

### 8.2 Anonymous Tracking

Bu yüzeyde session/cookie yoktur. Her istekte `X-Tracking-Code` ve `X-Tracking-Password` custom header'ları zorunludur. Başarısız doğrulama brute-force korumasına girer.

---

#### POST /api/v1/tracking/verify

**Purpose:** Tracking code + parola doğrulama. Frontend bu endpoint ile doğrulama yaptıktan sonra diğer tracking endpoint'lerini çağırır.

**Auth:** `X-Tracking-Code` + `X-Tracking-Password` header.

**Rate limit:** 5 req/15 dk per IP + tracking_code. Brute-force: 5 başarısız → 30 dk kilit.

**Request body:** Boş — credentials header'da.

**Response 200:**

```json
{
  "data": {
    "verified": true,
    "reportStatus": "UNDER_REVIEW",
    "hasUnreadMessages": true,
    "submittedAt": "2026-06-09T14:30:00Z"
  }
}
```

**Errors:**

| Code | HTTP | Koşul |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | Yanlış tracking code veya parola |
| `AUTH_ACCOUNT_LOCKED` | 401 | Brute-force lockout |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit aşıldı |

**Audit:** `TRACKING_VERIFY_ATTEMPT` — tracking_code (maskeli), success/fail, ip_address_hash. Parola audit'e yazılmaz.

---

#### GET /api/v1/tracking/status

**Purpose:** Bildirim durum bilgisi döner.

**Auth:** `X-Tracking-Code` + `X-Tracking-Password` header.

**Rate limit:** 20 req/dk per IP + tracking_code.

**Response 200:**

```json
{
  "data": {
    "trackingCode": "ETK-2XA9-KP7M",
    "status": "UNDER_REVIEW",
    "statusLabel": "İnceleniyor",
    "submittedAt": "2026-06-09T14:30:00Z",
    "lastActivityAt": "2026-06-10T09:15:00Z"
  }
}
```

Bildirimciye dönülen status basitleştirilmiştir: `SUBMITTED`, `ACKNOWLEDGED`, `UNDER_REVIEW`, `CLOSED`. İç workflow state'leri bildirimciye gösterilmez.

**Audit:** Yok — read-only, sensitive bilgi dönmez.

---

#### GET /api/v1/tracking/messages

**Purpose:** Güvenli mesajlaşma geçmişi.

**Auth:** `X-Tracking-Code` + `X-Tracking-Password` header.

**Rate limit:** 20 req/dk per IP + tracking_code.

**Response 200:**

```json
{
  "data": [
    {
      "id": "msg001",
      "direction": "INBOUND",
      "senderLabel": "Etik Kurul Sekretaryası",
      "bodyText": "Bildirdiğiniz olayla ilgili ek bilgi talep ediyoruz...",
      "sentAt": "2026-06-10T09:00:00Z",
      "isRead": true
    },
    {
      "id": "msg002",
      "direction": "OUTBOUND",
      "senderLabel": "Bildirimci",
      "bodyText": "Ek bilgi olarak...",
      "sentAt": "2026-06-10T10:30:00Z",
      "isRead": true
    }
  ]
}
```

`direction`: `INBOUND` (kurul → bildirimci), `OUTBOUND` (bildirimci → kurul). Mesaj içerikleri decrypt edilerek döner — yalnızca doğrulanmış bildirimci görebilir.

**Audit:** `SECURE_MESSAGE_READ` — report_id, message_count. Mesaj içeriği audit'e yazılmaz.

---

#### POST /api/v1/tracking/messages

**Purpose:** Bildirimci mesaj gönderme.

**Auth:** `X-Tracking-Code` + `X-Tracking-Password` header.

**Rate limit:** 5 req/dk per IP + tracking_code.

**Request body:**

```json
{
  "bodyText": "Ek bilgi olarak şunu belirtmek istiyorum..."
}
```

| Alan | Kural |
|---|---|
| `bodyText` | Zorunlu; 1–5000 karakter |

**Response 201:**

```json
{
  "data": {
    "id": "msg003",
    "sentAt": "2026-06-10T11:00:00Z"
  }
}
```

**Errors:**

| Code | HTTP | Koşul |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Boş mesaj veya karakter limiti |

**Audit:** `SECURE_MESSAGE_SENT` — report_id, direction=OUTBOUND, message_id. Mesaj içeriği audit'e yazılmaz.

---

#### POST /api/v1/tracking/attachments

**Purpose:** Bildirimci ek dosya yükleme (takip kodu doğrulaması sonrası).

**Auth:** `X-Tracking-Code` + `X-Tracking-Password` header.

**Rate limit:** 10 req/5 dk per IP + tracking_code.

**Request:** `multipart/form-data` — `file` (max 50 MB), `description` (opsiyonel, max 500 karakter).

**Response 201:** Aynı format `POST /api/v1/intake/reports/:trackingCode/attachments` ile.

**Audit:** `TRACKING_ATTACHMENT_UPLOADED` — report_id, file_size, mime_type.

---

### 8.3 Auth / Session

---

#### GET /api/v1/auth/oidc/login

**Purpose:** OIDC Authorization Code Flow + PKCE başlatma. Frontend bu endpoint'e redirect eder; backend IdP authorization URL üretir ve 302 redirect yapar.

**Auth:** Yok — login başlangıcı.

**Rate limit:** 10 req/5 dk per IP.

**Query params:**

| Param | Zorunlu | Açıklama |
|---|---|---|
| `returnUrl` | Hayır | Login sonrası yönlendirilecek URL (allowlist validate edilir) |

**Response 302:** `Location: https://idp.example.com/auth?response_type=code&client_id=...&code_challenge=...&redirect_uri=...`

**Audit:** Yok — redirect only.

---

#### GET /api/v1/auth/oidc/callback

**Purpose:** OIDC callback. IdP'den authorization code ile gelir; backend token exchange yapar, user lookup/JIT provisioning yapar, server-side session oluşturur, session cookie set eder ve frontend'e redirect eder.

**Auth:** Yok — OIDC callback.

**Query params:** `code`, `state` (OIDC standard).

**Response 302:** `Location: /app` (veya `returnUrl`). `Set-Cookie: sid=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`.

JIT provisioning: kullanıcı `users` tablosunda yoksa OIDC claim'lerinden (`sub` → `oidc_subject_id`, `email`, `name` → `display_name`) yeni kayıt oluşturulur. Hiçbir rol atanmaz.

**Errors:**

| Code | HTTP | Koşul |
|---|---|---|
| `AUTH_OIDC_FAILED` | 401 | Token exchange veya claim validation hatası |

**Audit:** `USER_LOGIN` — user_id, oidc_subject, ip_address_hash, user_agent_hash, jit_provisioned (boolean).

---

#### POST /api/v1/auth/logout

**Purpose:** Oturum sonlandırma.

**Auth:** Mevcut session cookie.

**Response 200:**

```json
{
  "data": {
    "loggedOut": true,
    "idpLogoutUrl": "https://idp.example.com/logout?..."
  }
}
```

Backend session server-side silinir, cookie clear edilir. Frontend `idpLogoutUrl`'e redirect ederek IdP oturumunu da sonlandırır.

**Audit:** `USER_LOGOUT` — user_id, session_duration_seconds.

---

#### GET /api/v1/auth/me

**Purpose:** Mevcut oturum bilgisi ve kullanıcı profili.

**Auth:** Session cookie (zorunlu).

**Response 200:**

```json
{
  "data": {
    "id": "clxuser01",
    "email": "ali.veli@yildizholding.com",
    "displayName": "Ali Veli",
    "roles": ["council_secretary"],
    "clearanceLevel": "STRICTLY_CONFIDENTIAL",
    "companyId": "clx1abc",
    "companyName": "Yıldız Holding A.Ş.",
    "isGeneralSecretary": false,
    "sessionExpiresAt": "2026-06-09T22:30:00Z"
  }
}
```

Frontend bu bilgiyle menü, navigation ve role-gated UI davranışını belirler. Permission set detayı bu response'da döndürülmez — frontend her aksiyon öncesi backend'e sorar veya UI guard amaçlı basitleştirilmiş izin seti kullanır.

**Audit:** Yok — read-only, kendi profili.

---

### 8.4 Cases

Tüm case endpoint'leri OIDC session gerektirir. Liste endpoint'leri otomatik olarak RBAC+ABAC+clearance scope filtresi uygular — kullanıcı yalnızca yetkili olduğu vakaları görür.

---

#### GET /api/v1/cases

**Purpose:** Vaka listesi (filtrelenmiş, paginated).

**Auth:** Session — ilgili roller (council_secretary, council_chair, council_member, rapporteur, board_chair, action_owner).

**Rate limit:** 60 req/dk per user.

**Query params:**

| Param | Tip | Açıklama |
|---|---|---|
| `status` | string | State filtresi (çoklu: `status=agenda_ready,rapporteur_assigned`) |
| `companyId` | string | Şirket filtresi |
| `confidentialityLevel` | string | Gizlilik filtresi |
| `dateFrom` | ISO date | Açılış tarihi başlangıç |
| `dateTo` | ISO date | Açılış tarihi bitiş |
| `assignedToMe` | boolean | Yalnızca bana atanmış vakalar |
| `limit`, `cursor`, `sortBy`, `sortOrder` | — | Standart pagination |

**Response 200:** Paginated case listesi. Her eleman `PolicyScope` ve `FieldMaskingPolicy` üzerinden geçer — yetkisiz alanlar response'da dönmez.

```json
{
  "data": [
    {
      "id": "clxcase01",
      "reportId": "clxrpt01",
      "currentState": "agenda_ready",
      "currentStateLabel": "Kurul Gündeminde",
      "confidentialityLevel": "SENSITIVE",
      "companyId": "clx1abc",
      "companyName": "Pınar Süt A.Ş.",
      "categoryGroup": "FRAUD_THEFT",
      "openedAt": "2026-06-09T14:30:00Z",
      "lastActivityAt": "2026-06-10T09:15:00Z"
    }
  ],
  "pagination": { "nextCursor": "...", "hasMore": true, "total": null }
}
```

**Audit:** Yok — read-only. Erişim denemeleri `AUTH_DENY` audit'ine düşer (guard seviyesinde).

---

#### GET /api/v1/cases/:id

**Purpose:** Vaka detayı. Field masking uygulanır — kullanıcının rolü ve clearance'ına göre alanlar filtrelenir veya maskelenir.

**Auth:** Session — vakaya erişim yetkisi (RBAC + ABAC + clearance + assignment).

**Rate limit:** 60 req/dk per user.

**Response 200:**

```json
{
  "data": {
    "id": "clxcase01",
    "reportId": "clxrpt01",
    "currentState": "agenda_ready",
    "workflowVersion": "1.0",
    "confidentialityLevel": "SENSITIVE",
    "companyId": "clx1abc",
    "companyName": "Pınar Süt A.Ş.",
    "categoryGroup": "FRAUD_THEFT",
    "categories": ["EMBEZZLEMENT"],
    "incidentDescription": "...",
    "incidentDateStart": "2026-05-01",
    "involvedPersons": [...],
    "witnesses": null,
    "reporterIdentityName": null,
    "urgentRiskFlag": false,
    "assignedRapporteurId": null,
    "openedAt": "2026-06-09T14:30:00Z",
    "availableActions": ["assign_rapporteur", "submit_to_member_approval", "close_not_on_agenda"]
  }
}
```

`availableActions`: kullanıcının mevcut state'te ve rolüyle yapabileceği workflow komutları. Frontend bu listeye göre butonları gösterir.

Maskeleme örnekleri: `action_owner` rolü `incidentDescription`, `involvedPersons`, `witnesses` alanlarını göremez — response'da bu alanlar bulunmaz. `council_member` rolü `witnesses` ve `reporterIdentityName` göremez. `admin` rolü bu endpoint'e hiç erişemez (404 döner).

**Errors:**

| Code | HTTP | Koşul |
|---|---|---|
| `RESOURCE_NOT_FOUND` | 404 | Vaka yok veya erişim yetkisi yok |

**Audit:** `CASE_VIEWED` — case_id, user_id, fields_visible (alan listesi), clearance_level_snapshot.

---

#### POST /api/v1/cases/:id/transitions

**Purpose:** Workflow state transition komutu. Tek command endpoint; komut tipi body'de belirtilir.

**Auth:** Session — komut tipine göre gerekli rol.

**Rate limit:** 30 req/dk per user.

**Request body:**

```json
{
  "command": "approve_agenda",
  "reason": "Gündeme alınması uygun görüldü.",
  "idempotencyKey": "uuid-v4-unique",
  "metadata": {}
}
```

**Desteklenen command'lar ve yetkilendirme:**

| Command | Gerekli state | Gerekli rol | Hedef state | Ek koşul |
|---|---|---|---|---|
| `acknowledge_report` | `report_submitted` | `council_secretary` | `secretariat_review` | — |
| `start_pre_research` | `secretariat_review` | `council_secretary` | `pre_research` | — |
| `submit_to_chair_gate` | `pre_research` | `council_secretary` | `chair_gate` | — |
| `approve_agenda` | `chair_gate` | `council_chair` | `agenda_ready` | — |
| `close_not_on_agenda` | `chair_gate` | `council_chair` | `not_on_agenda_closed` | `reason` zorunlu |
| `assign_rapporteur` | `agenda_ready` | `council_secretary` | `rapporteur_assigned` | `metadata.rapporteurUserId` zorunlu |
| `submit_rapporteur_report` | `rapporteur_assigned` | `rapporteur` | `rapporteur_report_submitted` | Rapor dokümanı yüklenmiş olmalı |
| `return_to_agenda` | `rapporteur_report_submitted` | `council_secretary` | `agenda_ready` | — |
| `submit_to_member_approval` | `agenda_ready` | `council_secretary` | `member_approval` | — |
| `create_decision_draft` | `member_approval` | `council_secretary` | `decision_draft` | Tüm üye oyları tamamlanmış (onay veya sessiz kabul) |
| `submit_to_board_review` | `decision_draft` | `council_secretary` | `board_chair_review` | Karar dokümanı yüklenmiş olmalı |
| `board_approve` | `board_chair_review` | `board_chair` | `board_approved` | — |
| `board_veto` | `board_chair_review` | `board_chair` | `agenda_ready` | `reason` zorunlu |
| `prepare_implementation_letter` | `board_approved` | `council_secretary` | `implementation_letter_prepared` | — |
| `assign_action` | `implementation_letter_prepared` | `council_secretary` | `action_assigned` | `metadata.actionOwnerUserId` zorunlu |
| `submit_action_response` | `action_response_pending` | `action_owner` | `agenda_ready` | — |
| `follow_up_close` | `follow_up_decision` | `council_secretary` | `closed_archived` | — |
| `follow_up_reassign` | `follow_up_decision` | `council_secretary` | `action_assigned` | — |

**Field kuralları:**

| Alan | Kural |
|---|---|
| `command` | Zorunlu; geçerli command enum |
| `reason` | Bazı command'larda zorunlu (close, veto) |
| `idempotencyKey` | Zorunlu; UUID v4; aynı key ile tekrar istek gelirse 200 döner (idempotent) |
| `metadata` | Command'a özgü ek veri (rapporteur atama, action owner atama) |

**Response 200:**

```json
{
  "data": {
    "caseId": "clxcase01",
    "transitionId": "clxtrans01",
    "fromState": "chair_gate",
    "toState": "agenda_ready",
    "command": "approve_agenda",
    "transitionedAt": "2026-06-10T10:00:00Z",
    "tasksCreated": [
      { "id": "clxtask01", "taskType": "agenda_review_task", "assignedRole": "council_secretary" }
    ]
  }
}
```

**Errors:**

| Code | HTTP | Koşul |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Eksik/geçersiz alan |
| `AUTHZ_FORBIDDEN` | 403 | Rol yetersiz |
| `CASE_INVALID_TRANSITION` | 409 | Command mevcut state'te geçersiz |
| `CASE_OPTIMISTIC_LOCK` | 409 | Concurrent update |
| `RESOURCE_NOT_FOUND` | 404 | Vaka yok veya erişim yetkisi yok |

**Audit:** `CASE_TRANSITION` — case_id, from_state, to_state, command, actor, idempotency_key, tasks_created. Reason metni maskeli veya exclude edilir.

---

#### GET /api/v1/cases/:id/transitions

**Purpose:** Vaka state transition geçmişi (timeline).

**Auth:** Session — vakaya erişim yetkisi.

**Response 200:** Transition listesi (append-only, kronolojik).

```json
{
  "data": [
    {
      "id": "clxtrans01",
      "fromState": "report_submitted",
      "toState": "secretariat_review",
      "command": "acknowledge_report",
      "actorType": "USER",
      "actorDisplayName": "Ali Veli",
      "transitionedAt": "2026-06-09T15:00:00Z"
    }
  ]
}
```

`reason` alanı field masking policy'ye tabidir — yetkisiz kullanıcıya dönmez.

**Audit:** Yok — read-only.

---

### 8.5 Tasks

---

#### GET /api/v1/tasks

**Purpose:** Görev listesi (kullanıcının kendi görevleri).

**Auth:** Session — tüm iç kullanıcı rolleri.

**Query params:** `status`, `taskType`, `caseId`, `dueBefore`, `dueAfter`, `limit`, `cursor`, `sortBy`, `sortOrder`.

**Response 200:** Paginated, ABAC-scoped görev listesi.

```json
{
  "data": [
    {
      "id": "clxtask01",
      "caseId": "clxcase01",
      "taskType": "secretariat_review_task",
      "taskTypeLabel": "Ön Değerlendirme",
      "status": "PENDING",
      "assignedRole": "council_secretary",
      "dueAt": "2026-06-12T17:00:00Z",
      "slaStatus": "ON_TRACK",
      "createdAt": "2026-06-09T15:00:00Z"
    }
  ],
  "pagination": { "nextCursor": "...", "hasMore": false, "total": null }
}
```

`slaStatus`: hesaplanan türetilmiş alan — `ON_TRACK`, `WARNING`, `OVERDUE`. Veritabanında saklanmaz, business_calendar ve sla_policy_config üzerinden runtime hesaplanır.

**Audit:** Yok — read-only.

---

#### GET /api/v1/tasks/:id

**Purpose:** Görev detayı.

**Auth:** Session — göreve erişim yetkisi (atanmış kullanıcı veya üst rol).

**Response 200:** Task detayı + ilişkili case metadata.

**Audit:** Yok — read-only.

---

#### POST /api/v1/tasks/:id/complete

**Purpose:** Görevi tamamlama.

**Auth:** Session — göreve atanmış kullanıcı.

**Request body:**

```json
{
  "outcome": "Ön değerlendirme tamamlandı; gündeme alma önerisi.",
  "idempotencyKey": "uuid-v4"
}
```

**Response 200:** Güncellenen task bilgisi. Görev tamamlanması ilgili workflow transition'ı tetikleyebilir (backend side-effect).

**Audit:** `TASK_COMPLETED` — task_id, case_id, task_type, actor. Outcome metni audit'e yazılmaz.

---

#### POST /api/v1/tasks/:id/delegate

**Purpose:** Görev devri.

**Auth:** Session — göreve atanmış kullanıcı veya üst yetki.

**Request body:**

```json
{
  "delegateToUserId": "clxuser02",
  "reason": "İzin nedeniyle devrediyorum."
}
```

**Response 200:** Yeni görev bilgisi (delegation zinciri korunur).

**Audit:** `TASK_DELEGATED` — task_id, from_user, to_user, case_id.

---

### 8.6 Documents

---

#### POST /api/v1/cases/:caseId/documents

**Purpose:** Vaka dokümanı yükleme.

**Auth:** Session — vakaya doküman yükleme yetkisi (rol + state + ABAC).

**Rate limit:** 10 req/5 dk per user.

**Request:** `multipart/form-data`

| Field | Tip | Zorunlu | Kural |
|---|---|---|---|
| `file` | binary | Evet | Max 50 MB; izinli tipler kontrol edilir |
| `documentCategory` | string | Evet | Geçerli kategori enum |
| `title` | string | Evet | 1–255 karakter |
| `taskId` | string | Hayır | İlişkili görev (varsa) |

**Response 201:**

```json
{
  "data": {
    "id": "clxdoc01",
    "versionNo": 1,
    "status": "QUARANTINED",
    "malwareScanStatus": "PENDING",
    "uploadedAt": "2026-06-10T10:00:00Z"
  }
}
```

Yüklenen dosya önce `QUARANTINED` → malware scan → `AVAILABLE` veya `REJECTED`. Scan tamamlanmadan doküman başka kullanıcıya gösterilmez.

**Errors:**

| Code | HTTP | Koşul |
|---|---|---|
| `DOCUMENT_TYPE_NOT_ALLOWED` | 422 | İzin verilmeyen dosya tipi |
| `DOCUMENT_SIZE_EXCEEDED` | 422 | 50 MB aşıldı |
| `AUTHZ_FORBIDDEN` | 403 | Yükleme yetkisi yok |
| `RESOURCE_NOT_FOUND` | 404 | Vaka bulunamadı |

**Audit:** `DOCUMENT_UPLOADED` — document_id, case_id, category, size_bytes, mime_type, uploader_user_id. Dosya adı ve içerik audit'e yazılmaz.

---

#### GET /api/v1/cases/:caseId/documents

**Purpose:** Vakaya ait doküman listesi.

**Auth:** Session — vakaya erişim yetkisi. Doküman bazlı `document_access_grant` ayrıca kontrol edilir.

**Response 200:** Kullanıcının görebildiği dokümanlar (grant'i olmayan dokümanlar listede yer almaz).

```json
{
  "data": [
    {
      "id": "clxdoc01",
      "documentCategory": "PRE_RESEARCH_NOTE",
      "title": "Ön Araştırma Notu",
      "currentVersionNo": 2,
      "status": "AVAILABLE",
      "confidentialityLevel": "CONFIDENTIAL",
      "uploadedAt": "2026-06-10T10:00:00Z",
      "uploadedByDisplayName": "Ali Veli"
    }
  ]
}
```

**Audit:** Yok — read-only (doküman bazlı grant kontrolü guard'da).

---

#### GET /api/v1/documents/:id/download

**Purpose:** Doküman indirme. Kısa süreli signed URL issue eder.

**Auth:** Session — doküman erişim yetkisi (RBAC + ABAC + clearance + document_access_grant).

**Response 200:**

```json
{
  "data": {
    "downloadUrl": "https://storage.internal/signed/...",
    "expiresAt": "2026-06-10T10:05:00Z",
    "filename": "on-arastirma-notu-v2.pdf"
  }
}
```

Signed URL 5 dakika geçerlidir. Object storage path kullanıcıya gösterilmez; download URL proxy veya signed URL olarak sunulur.

**Errors:**

| Code | HTTP | Koşul |
|---|---|---|
| `DOCUMENT_QUARANTINED` | 422 | Dosya henüz taranıyor |
| `DOCUMENT_REJECTED` | 422 | Dosya malware pozitif |
| `RESOURCE_NOT_FOUND` | 404 | Doküman yok veya erişim yetkisi yok |

**Audit:** `DOCUMENT_DOWNLOADED` — document_id, version_no, case_id, user_id, signed_url_ttl. Dosya içeriği audit'e yazılmaz.

---

### 8.7 Decision Votes

---

#### GET /api/v1/cases/:caseId/votes

**Purpose:** Vaka için kurul üye oyları.

**Auth:** Session — council_secretary, council_chair, council_member.

**Response 200:**

```json
{
  "data": [
    {
      "id": "clxvote01",
      "voterDisplayName": "Mehmet Demir",
      "voteType": "APPROVE",
      "isSilentAcceptance": false,
      "votedAt": "2026-06-11T14:00:00Z"
    }
  ]
}
```

**Audit:** Yok — read-only.

---

#### POST /api/v1/cases/:caseId/votes

**Purpose:** Kurul üyesi oy verme (onay veya itiraz).

**Auth:** Session — `council_member` rolü; vaka `member_approval` state'inde.

**Request body:**

```json
{
  "voteType": "APPROVE",
  "reason": null,
  "idempotencyKey": "uuid-v4"
}
```

| Alan | Kural |
|---|---|
| `voteType` | Zorunlu; `APPROVE` veya `REJECT` |
| `reason` | `REJECT` seçildiğinde zorunlu; 1–5000 karakter |

**Response 201:**

```json
{
  "data": {
    "id": "clxvote02",
    "voteType": "APPROVE",
    "votedAt": "2026-06-11T15:00:00Z"
  }
}
```

**Audit:** `DECISION_VOTE_CAST` — case_id, voter_user_id, vote_type, is_silent_acceptance=false. Reason metni audit'e yazılmaz.

---

### 8.8 Secure Messages (İç Kullanıcı Tarafı)

---

#### GET /api/v1/cases/:caseId/secure-messages

**Purpose:** Bildirimci ile güvenli mesajlaşma geçmişi (iç kullanıcı görünümü).

**Auth:** Session — `council_secretary`.

**Response 200:** Mesaj listesi (kronolojik).

**Audit:** `SECURE_MESSAGE_VIEWED_INTERNAL` — case_id, user_id, message_count.

---

#### POST /api/v1/cases/:caseId/secure-messages

**Purpose:** Bildirimciye mesaj gönderme (ek bilgi talebi).

**Auth:** Session — `council_secretary`.

**Request body:**

```json
{
  "bodyText": "Bildirdiğiniz olayla ilgili şu bilgilere ihtiyacımız var..."
}
```

**Response 201:** Oluşturulan mesaj bilgisi. Bildirimciye `in_app` (secure_message) ve opsiyonel nötr e-posta bildirimi tetiklenir.

**Audit:** `SECURE_MESSAGE_SENT_INTERNAL` — case_id, direction=INBOUND, message_id. Mesaj içeriği audit'e yazılmaz.

---

### 8.9 Notifications

---

#### GET /api/v1/notifications

**Purpose:** Kullanıcının in-app bildirimleri.

**Auth:** Session — tüm iç kullanıcı rolleri.

**Query params:** `isRead` (boolean), `limit`, `cursor`.

**Response 200:**

```json
{
  "data": [
    {
      "id": "clxnotif01",
      "templateCode": "rapporteur_assigned",
      "title": "Raportör Görevi Atandı",
      "body": "Yeni bir raportör görevi atanmıştır.",
      "caseId": "clxcase01",
      "taskId": "clxtask01",
      "isRead": false,
      "createdAt": "2026-06-10T09:00:00Z"
    }
  ],
  "pagination": { "nextCursor": "...", "hasMore": true, "total": null }
}
```

Notification body'si hassas içerik taşımaz — yalnızca görev tipi ve eylem ifadesi içerir.

**Audit:** Yok — read-only.

---

#### PATCH /api/v1/notifications/:id/read

**Purpose:** Bildirimi okundu olarak işaretleme.

**Auth:** Session — bildirimin sahibi.

**Response 204:** No content.

**Audit:** Yok — UX operasyonu.

---

#### POST /api/v1/notifications/mark-all-read

**Purpose:** Tüm okunmamış bildirimleri okundu olarak işaretleme.

**Auth:** Session.

**Response 204:** No content.

**Audit:** Yok — UX operasyonu.

---

### 8.10 Admin — Users & Roles

Tüm admin endpoint'leri `admin` rolü gerektirir. Admin vakalara ait içeriğe erişemez.

---

#### GET /api/v1/admin/users

**Purpose:** Kullanıcı listesi (admin görünümü — vaka içeriği yok).

**Auth:** Session — `admin`.

**Query params:** `search` (email veya displayName), `companyId`, `roleCode`, `isActive`, `limit`, `cursor`.

**Response 200:** Kullanıcı metadata listesi (clearance, roller, şirket, son giriş). Vaka bilgisi, atama detayı veya içerik yok.

**Audit:** Yok — read-only, metadata.

---

#### GET /api/v1/admin/users/:id

**Purpose:** Kullanıcı detayı (metadata).

**Auth:** Session — `admin`.

**Response 200:** Kullanıcı metadata + aktif roller + HR/SAP sync bilgisi. Vaka veya görev içeriği yok.

**Audit:** Yok — read-only, metadata.

---

#### POST /api/v1/admin/users/:id/roles

**Purpose:** Kullanıcıya rol atama (maker-checker gerektirir).

**Auth:** Session — `admin` (maker).

**Request body:**

```json
{
  "roleCode": "council_member",
  "reason": "Yeni kurul üyesi ataması."
}
```

**Response 201:**

```json
{
  "data": {
    "id": "clxrole01",
    "roleCode": "council_member",
    "status": "PENDING_APPROVAL",
    "assignedBy": "clxadmin01",
    "reason": "..."
  }
}
```

Rol ataması hemen aktif olmaz — maker-checker akışına girer. Checker onaylayana kadar `PENDING_APPROVAL` durumundadır.

**Audit:** `ROLE_ASSIGNMENT_REQUESTED` — user_id, role_code, maker_user_id, reason.

---

#### POST /api/v1/admin/users/:id/roles/:roleId/approve

**Purpose:** Maker-checker onayı — rol ataması aktifleştirme.

**Auth:** Session — action_matrix'te tanımlı checker rolü.

**Request body:**

```json
{
  "approved": true,
  "reason": "Onaylanmıştır."
}
```

**Errors:**

| Code | HTTP | Koşul |
|---|---|---|
| `MAKER_CHECKER_SELF` | 422 | Maker ve checker aynı kişi |

**Audit:** `ROLE_ASSIGNMENT_APPROVED` — user_id, role_code, checker_user_id.

---

#### DELETE /api/v1/admin/users/:id/roles/:roleId

**Purpose:** Rol geri alma (revoke).

**Auth:** Session — `admin` (maker-checker).

**Request body:**

```json
{
  "reason": "Kurul üyeliği sonlandırıldı."
}
```

**Response 200:** `is_active = false`, `revoked_at` set edilir.

**Audit:** `ROLE_REVOKED` — user_id, role_code, revoker_user_id, reason.

---

#### PATCH /api/v1/admin/users/:id/clearance

**Purpose:** Kullanıcı clearance seviyesi güncelleme (maker-checker).

**Auth:** Session — `admin` (maker) veya action_matrix tanımlı rol.

**Request body:**

```json
{
  "clearanceLevel": "STRICTLY_CONFIDENTIAL",
  "reason": "Kurul başkan vekili olarak yükseltildi."
}
```

**Audit:** `CLEARANCE_UPDATED` — user_id, old_level, new_level, reason.

---

### 8.11 Admin — Master Data

---

#### GET /api/v1/admin/master-data/companies

**Purpose:** Şirket listesi (sync durumu dahil).

**Auth:** Session — `admin`.

**Response 200:** Şirket listesi + son sync zamanı, kaynak sistem, aktif/pasif durumu.

**Audit:** Yok — read-only.

---

#### GET /api/v1/admin/master-data/locations

**Purpose:** Lokasyon listesi.

**Auth:** Session — `admin`.

**Audit:** Yok — read-only.

---

#### GET /api/v1/admin/master-data/functions

**Purpose:** Fonksiyon listesi.

**Auth:** Session — `admin`.

**Audit:** Yok — read-only.

---

#### GET /api/v1/admin/master-data/sync-runs

**Purpose:** HR/SAP senkronizasyon koşu geçmişi.

**Auth:** Session — `admin`.

**Response 200:**

```json
{
  "data": [
    {
      "id": "clxsync01",
      "integrationName": "HR_SAP_USER_SYNC",
      "status": "COMPLETED",
      "recordCount": 1250,
      "startedAt": "2026-06-09T02:00:00Z",
      "finishedAt": "2026-06-09T02:05:00Z",
      "errorCount": 0
    }
  ]
}
```

Sync loglarında PII, vaka içeriği veya parola bilgisi bulunmaz.

**Audit:** Yok — read-only, metadata.

---

### 8.12 Admin — Config

---

#### GET /api/v1/admin/system-settings

**Purpose:** Runtime konfigürasyon parametreleri.

**Auth:** Session — `admin` (system rolü).

**Response 200:**

```json
{
  "data": [
    {
      "key": "auth_cache_ttl_seconds",
      "value": "60",
      "group": "auth",
      "description": "Yetki cache TTL (saniye)",
      "updatedAt": "2026-06-09T10:00:00Z",
      "updatedBy": "clxadmin01"
    }
  ]
}
```

**Audit:** Yok — read-only.

---

#### PATCH /api/v1/admin/system-settings/:key

**Purpose:** System setting güncelleme (maker-checker).

**Auth:** Session — `admin` (system rolü, maker).

**Request body:**

```json
{
  "value": "120",
  "reason": "Cache TTL artırıldı."
}
```

**Response 200:** Güncellenen ayar. Maker-checker akışına girer.

**Audit:** `SYSTEM_SETTING_CHANGED` — key, old_value, new_value, reason, maker_user_id.

---

#### GET /api/v1/admin/field-visibility

**Purpose:** Rol bazlı alan görünürlük matrisi.

**Auth:** Session — `admin`.

**Response 200:** Rol × alan checkbox matrisi JSON yapısı.

---

#### PATCH /api/v1/admin/field-visibility

**Purpose:** Alan görünürlük güncelleme (maker-checker).

**Auth:** Session — `admin` (maker).

**Audit:** `FIELD_VISIBILITY_CHANGED` — changed_fields, maker_user_id.

---

#### GET /api/v1/admin/action-matrix

**Purpose:** Maker-checker aksiyon matrisi.

**Auth:** Session — `admin`.

---

#### PATCH /api/v1/admin/action-matrix/:actionId

**Purpose:** Aksiyon matrisi güncelleme (maker-checker).

**Auth:** Session — `admin` (maker).

**Audit:** `ACTION_MATRIX_CHANGED` — action_id, old_maker_role, new_maker_role, old_checker_role, new_checker_role.

---

#### GET /api/v1/admin/sla-policies

**Purpose:** Görev tipi bazlı SLA konfigürasyonları.

**Auth:** Session — `admin`.

---

#### PATCH /api/v1/admin/sla-policies/:taskType

**Purpose:** SLA konfigürasyon güncelleme.

**Auth:** Session — `admin` (maker-checker).

**Request body:**

```json
{
  "slaDurationBusinessDays": 14,
  "warningThresholdDays": 3,
  "dailyOverdueNotification": true,
  "escalationRecipientRole": "council_secretary",
  "reason": "Aksiyon SLA 14 iş gününe sabitlendi."
}
```

**Audit:** `SLA_POLICY_CHANGED` — task_type, old_config, new_config, reason.

---

#### GET /api/v1/admin/business-calendar

**Purpose:** İş günü takvimi (tatiller, yarım günler).

**Auth:** Session — `admin`.

---

#### POST /api/v1/admin/business-calendar

**Purpose:** Tatil/yarım gün ekleme.

**Auth:** Session — `admin`.

**Audit:** `BUSINESS_CALENDAR_UPDATED` — date, type, reason.

---

#### GET /api/v1/admin/notification-templates

**Purpose:** Bildirim şablonları listesi.

**Auth:** Session — `admin`.

**Response 200:** 28 şablon — template_code, kanal, aktif/pasif durumu, son güncelleme.

---

#### PATCH /api/v1/admin/notification-templates/:templateCode

**Purpose:** Bildirim şablonu güncelleme (maker-checker).

**Auth:** Session — `admin`.

**Audit:** `NOTIFICATION_TEMPLATE_CHANGED` — template_code, version, maker_user_id.

---

#### GET /api/v1/admin/kvkk-texts

**Purpose:** KVKK/gizlilik metin versiyonları.

**Auth:** Session — `admin`.

---

#### POST /api/v1/admin/kvkk-texts

**Purpose:** Yeni KVKK metin versiyonu oluşturma (maker-checker).

**Auth:** Session — `admin`.

**Audit:** `KVKK_TEXT_PUBLISHED` — version, effective_date, maker_user_id.

---

### 8.13 Admin — Monitoring

---

#### GET /api/v1/admin/audit-events

**Purpose:** Audit log viewer — maskeli metadata araması.

**Auth:** Session — `admin` (audit yetkisi).

**Query params:** `eventType`, `actorUserId`, `resourceType`, `resourceId`, `dateFrom`, `dateTo`, `limit`, `cursor`.

**Response 200:** Audit event listesi. İçerik alanları (bildirim metni, karar yazısı vb.) response'da dönmez — yalnızca event tipi, aktör, kaynak, zaman, policy decision ve correlation ID.

**Audit:** Yok — audit viewer'ın kendisi ayrıca loglanmaz (döngü riski).

---

#### GET /api/v1/admin/document-operations

**Purpose:** Doküman operasyon monitörü — malware scan, karantina, storage durumu.

**Auth:** Session — `admin`.

**Response 200:** Doküman metadata listesi (scan status, boyut, MIME, hash). İçerik preview veya indirme yetkisi yok.

**Audit:** Yok — read-only, metadata.

---

#### GET /api/v1/admin/system-health

**Purpose:** Worker, notification, sync, queue ve job durumu.

**Auth:** Session — `admin`.

**Response 200:**

```json
{
  "data": {
    "workers": [
      {
        "name": "notification_dispatcher",
        "status": "RUNNING",
        "lastRunAt": "2026-06-09T14:29:00Z",
        "pendingCount": 3,
        "failedCount": 0
      }
    ],
    "syncStatus": {
      "hrSapLastSync": "2026-06-09T02:05:00Z",
      "hrSapStatus": "COMPLETED"
    }
  }
}
```

**Audit:** Yok — read-only, system telemetry.

---

### 8.14 Dashboard / Reporting

---

#### GET /api/v1/dashboard/summary

**Purpose:** Aggregate dashboard verileri. Rol ve ABAC scope'a göre filtrelenir.

**Auth:** Session — tüm iç kullanıcı rolleri (kendi scope'larında).

**Response 200:**

```json
{
  "data": {
    "totalReports": 47,
    "openCases": 12,
    "closedCases": 35,
    "pendingTasks": 5,
    "overdueTaskCount": 1,
    "byState": {
      "secretariat_review": 3,
      "agenda_ready": 4,
      "rapporteur_assigned": 2,
      "action_assigned": 3
    },
    "byCompany": [
      { "companyId": "clx1abc", "companyName": "Pınar Süt", "count": 8 },
      { "companyId": "clx2def", "companyName": "Yıldız Holding", "count": 4 }
    ],
    "byCategory": [
      { "categoryGroup": "FRAUD_THEFT", "count": 15 },
      { "categoryGroup": "HARASSMENT", "count": 8 }
    ],
    "slaOverview": {
      "onTrack": 10,
      "warning": 1,
      "overdue": 1
    }
  }
}
```

Dashboard yalnızca aggregate metadata döner — tekil vaka detayı, bildirim metni veya kişi bilgisi içermez. `action_owner` yalnızca kendi şirketine ait aggregate görür.

**Audit:** Yok — read-only, aggregate metadata.

---

## Webhook'lar

MVP'de outgoing veya incoming webhook bulunmaz. Dış sistem entegrasyonları HR/SAP nightly sync (adapter tabanlı), SMTP outbound e-posta ve OIDC kimlik doğrulama ile sınırlıdır.

---

## SLA Hedefleri

| Kategori | p50 | p95 | p99 |
|---|---|---|---|
| Auth (login/callback/logout) | 100 ms | 200 ms | 500 ms |
| Public intake (form submit) | 150 ms | 300 ms | 800 ms |
| Anonymous tracking (verify) | 200 ms | 400 ms | 1000 ms |
| Liste endpoint'leri (paginated) | 100 ms | 250 ms | 600 ms |
| Detay endpoint'leri | 80 ms | 200 ms | 500 ms |
| Workflow transition | 150 ms | 300 ms | 700 ms |
| File upload (URL issue, dosya transfer hariç) | 50 ms | 120 ms | 300 ms |
| File download (signed URL issue) | 50 ms | 120 ms | 300 ms |
| Admin config endpoint'leri | 80 ms | 200 ms | 500 ms |
| Dashboard aggregate | 200 ms | 500 ms | 1200 ms |

Argon2id hash doğrulaması (anonim tracking verify) CPU-intensive olduğundan p99'u diğerlerinden yüksektir. SLA ölçümü backend response time'dır; network latency ve client rendering dahil değildir.
