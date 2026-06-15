# Yıldız Holding Etik Bildirim Uygulaması — Test Stratejisi

## 1. Test Piramidi

| Seviye | Araç | Coverage Hedefi | Kapsam |
|---|---|---|---|
| Unit | Jest + NestJS Testing Module | ≥%80 line / ≥%70 branch (backend toplam); ≥%90 line / ≥%85 branch (authorization, workflow, document, audit, crypto, notification modülleri) | Business logic, domain kuralları, pure functions, state machine transition, policy evaluation, DTO validation, maskeleme/redaction |
| Integration | Jest + Testcontainers (PostgreSQL) + Supertest | Kritik path'ler (workflow, auth, document, audit) | API endpoint'leri gerçek DB ile, Prisma transaction, migration doğrulama, outbox/worker, factory-based test data |
| E2E | Playwright | Senaryo coverage (sayısal coverage yerine) | Dış bildirimden aksiyon takibine tam kullanıcı yolculuğu, çoklu rol, multi-step workflow, admin metadata-only doğrulama |
| Frontend Unit | Vitest + Testing Library | ≥%70 line (kritik form/guard/hook kodu) | Route guard, form validation, field masking UI davranışı, erişilebilirlik, hata mesajları |
| Security | SAST + SCA + Secret Scan + Container Scan + DAST | %100 zorunlu geçiş | Dependency CVE, secret leak, OWASP Top 10, security header, CORS, CSRF, upload validation |

---

## 2. Unit Test Kuralları

**Dosya konumu:** Co-located — her modül içinde `__tests__/` dizini veya `*.spec.ts` dosyası olarak tutulur. Test dosyası, test ettiği dosyayla aynı modülde yaşar.

**Naming convention:**

```typescript
describe('WorkflowCommandHandler', () => {
  describe('executeTransition', () => {
    it('should transition case from secretariat_review to pre_research when council_secretary issues PRE_RESEARCH command', () => { ... });
    it('should reject transition when actor role is action_owner', () => { ... });
    it('should reject transition when clearance_level < case confidentiality_level', () => { ... });
    it('should produce task_assigned audit event on successful transition', () => { ... });
  });
});
```

**Mock stratejisi:** Mock at boundary — dış servisler (KMS, S3, SMTP, ClamAV, OIDC provider) ve veritabanı mock/fake edilir. Internal module mock yasaktır; bir servisin davranışını doğrulamak için o servisin bağımlılıklarını mock et, servisi kendisini değil. Behavior-only test: implementation details (hangi metod kaç kez çağrıldı) test edilmez; gözlemlenebilir çıktı (return value, side-effect, thrown error) test edilir.

**Zorunlu negatif test kuralı:** Authorization, workflow, document ve audit modüllerinde her pozitif senaryonun karşılığında en az bir negatif deny/reject senaryosu bulunur.

---

## 3. Integration Test

### 3.1 Test Veritabanı

Testcontainers ile her test suite'i için izole PostgreSQL container ayağa kaldırılır. Container, test suite tamamlandığında yıkılır. Production veritabanına hiçbir test bağlanmaz.

### 3.2 Reset Stratejisi

Transaction rollback per-test tercih edilir: her test case bir transaction içinde çalışır, test bittiğinde rollback yapılır. Rollback uygulanamayan senaryolarda (multi-transaction workflow, outbox dispatch) truncate + reseed uygulanır.

### 3.3 Factory Pattern

Test verisi faker + typed factory ile üretilir. Manuel object yaratma yasaktır. Factory'ler `packages/test-fixtures` paketinde tutulur ve yalnızca sentetik veri içerir.

```typescript
// Örnek factory kullanımı
const secretary = await UserFactory.create({ role: 'council_secretary', clearance: 'STRICTLY_CONFIDENTIAL' });
const report = await ReportFactory.create({ confidentialityLevel: 'SENSITIVE', companyId: 'company-a' });
const case_ = await CaseFactory.createFromReport(report, { state: 'secretariat_review' });
```

### 3.4 Prisma Transaction Test

Prisma `$transaction([...])` interactive transaction zorunludur — kısmi commit kabul edilmez. Test senaryoları:

- Audit outbox ve domain yazımının aynı transaction'da olduğunun doğrulanması.
- Transaction rollback'in her iki kaydı da geri aldığının doğrulanması.
- Concurrent transaction'larda optimistic locking davranışının doğrulanması.

### 3.5 Seed Farkı

Test seed minimal tutulur: yalnızca factory'lerin ihtiyaç duyduğu referans veriler (enum değerleri, varsayılan system_settings, test permission set). Production seed'i (superadmin, production calendar) test ortamında çalıştırılmaz.

---

## 4. Workflow Transition Matrix Testleri

Workflow transition test matrisi zorunludur. Her workflow_version için state × command × izinli rol × ABAC koşulu × precondition × side-effect × negatif senaryo test edilir.

**Her geçiş için minimum test seti:**

| # | Test senaryosu | Beklenen sonuç |
|---|---|---|
| 1 | Doğru rol + doğru state + doğru clearance + doğru atama | Başarılı transition |
| 2 | Yanlış rol (yetkisiz) | 403 — reddedilir |
| 3 | Yanlış state (geçerli olmayan kaynak state) | 409 — reddedilir |
| 4 | Clearance yetersiz (clearance < confidentiality_level) | 403 — reddedilir |
| 5 | Atama dışı kullanıcı (rapporteur başka vakanın) | 403 — reddedilir |
| 6 | Aynı command ikinci kez (idempotency) | Çift state geçişi üretmez |
| 7 | Side-effect doğrulama | Beklenen task, audit_event, notification_event, case_transition ve SLA kayıtları oluşur |
| 8 | Precondition eksik (gerekli doküman/görev tamamlanmamış) | 422 — reddedilir |

**Kapsanması gereken kritik transition'lar:**

- report_submitted → secretariat_review (council_secretary)
- secretariat_review → pre_research (council_secretary)
- chair_gate → agenda_ready / not_on_agenda_closed (council_chair)
- agenda_ready → rapporteur_assigned (council_secretary)
- rapporteur_report_submitted → agenda_ready (döngüsel)
- agenda_ready → member_approval (council_secretary)
- member_approval → decision_draft (24 saat sessiz kabul dahil)
- decision_draft → board_chair_review (council_secretary)
- board_chair_review → board_approved / agenda_ready (board_chair onay/veto)
- board_approved → implementation_letter_prepared → action_assigned → action_response_pending (council_secretary + action_owner)
- action_response_pending → agenda_ready (takip)
- follow_up_decision → closed_archived

---

## 5. RBAC+ABAC Authorization Regression

Authorization regression suite zorunludur. İzin verilen her pozitif senaryonun karşılığında en az bir negatif deny senaryosu bulunur.

**Test matrisi boyutları:**

| Boyut | Değerler |
|---|---|
| role | council_secretary, council_chair, council_member, board_chair, rapporteur, action_owner, admin |
| permission | PermissionCode enum'undaki tüm değerler |
| company_scope | Kendi şirketi, farklı şirket, holding seviyesi |
| assignment_scope | Atandığı vaka, atanmadığı vaka |
| function_location_scope | Kendi fonksiyon/lokasyonu, farklı fonksiyon/lokasyon |
| confidentiality_clearance | NORMAL, SENSITIVE, STRICTLY_CONFIDENTIAL (kullanıcı clearance vs vaka level) |
| document_access_grant | Grant var, grant yok, grant iptal edilmiş |
| field_masking | Her alan × rol kombinasyonu — görünür mü, maskelenmiş mi, hiç dönmüyor mu |

**Kritik negatif senaryolar (mutlaka test edilir):**

- admin rolü herhangi bir vaka içeriği alanını okumaya çalışır → 403 veya alan hiç dönmez
- action_owner başka şirketin aksiyonunu görmeye çalışır → 403
- rapporteur atanmadığı vakanın dokümanını indirmeye çalışır → 403
- council_member reporter_identity alanını okumaya çalışır → alan dönmez
- clearance=NORMAL kullanıcı SENSITIVE vakayı görmeye çalışır → satır listelenmez
- Rol ataması yapılmamış JIT kullanıcı herhangi bir endpoint'e erişmeye çalışır → 403
- document_access_grant iptal edilmiş kullanıcı doküman indirmeye çalışır → 403

"Buton UI'da gizli" testi tek başına yeterli değildir; backend deny testi zorunludur.

---

## 6. Doküman Erişim ve Güvenlik Testleri

Upload'dan arşiv erişimine kadar uçtan uca test ailesi:

| # | Test senaryosu | Doğrulama |
|---|---|---|
| 1 | İzin verilen dosya tipi (PDF) yükleme | uploaded → quarantined → available akışı tamamlanır |
| 2 | İzin verilmeyen dosya tipi (.exe) yükleme | 422 — reddedilir, dosya quarantine'a bile alınmaz |
| 3 | MIME/uzantı uyuşmazlığı (.pdf uzantılı .exe) | 422 — reddedilir |
| 4 | Boyut limiti aşımı (>50 MB tek dosya) | 413 — reddedilir |
| 5 | Toplam boyut limiti aşımı (>200 MB vaka başına) | 422 — reddedilir |
| 6 | Malware scan positive | Dosya QUARANTINED kalır, council_secretary bildirim alır |
| 7 | Scan tamamlanmadan doküman erişim denemesi | 403 — erişim verilmez |
| 8 | Grant'li kullanıcı doküman indirme | Başarılı indirme + audit kaydı |
| 9 | Grant'siz kullanıcı doküman indirme | 403 + audit kaydı (denied) |
| 10 | Grant iptal sonrası eski token ile indirme | 403 — token geçersiz |
| 11 | Object storage path/key ile doğrudan erişim denemesi | Başarısız — public erişim kapalı |
| 12 | Admin rolü doküman indirme denemesi | 403 — admin içerik göremez |
| 13 | Arşivlenmiş vakadaki doküman erişimi | Aynı RBAC+ABAC+clearance+grant kontrolü uygulanır |
| 14 | Doküman versiyonlama (yeni yükleme → yeni version_no) | Eski versiyon korunur, overwrite olmaz |
| 15 | Encryption doğrulama: DB'deki encrypted değer plaintext değil | Raw DB sorgusu ile doğrulama |

---

## 7. Audit Bütünlük Testleri

| # | Test senaryosu | Doğrulama |
|---|---|---|
| 1 | case_transition → audit_event üretimi | Her transition sonrası beklenen event_type, actor, resource, outcome alanları doğru |
| 2 | document_download → audit_event üretimi | document_id, document_category, sha256_hash, action=document_downloaded kaydedilir |
| 3 | Audit kayıt içerik kopyalamama | report_text, karar metni, doküman içeriği audit kaydında plaintext bulunmaz |
| 4 | Maskeleme doğrulama | before_masked ve after_masked alanları PII içermiyor |
| 5 | ip_address_hash doğrulama | Ham IP değil pepper+SHA-256 hash tutulur |
| 6 | Hash-chain doğrulama | Yeni event'in prev_hash'i önceki event'in event_hash'iyle eşleşir |
| 7 | Fail-closed outbox | Audit outbox yazılamadığında domain transaction da rollback olur |
| 8 | Audit outbox yazılıp domain transaction rollback | Outbox kaydı da rollback olur (aynı transaction) |
| 9 | Serbest string event tipi engeli | AuditEventType enum dışında event üretme denemesi derleme hatası verir |
| 10 | Audit viewer erişim sınırı | audit_viewer yetkisi içerik alanlarını göstermez — yalnızca maskeli metadata |

---

## 8. Field Masking ve Serialization Testleri

Hassas alanların yanlışlıkla DTO, API response, notification, log veya audit içine taşmadığı ayrı test ailesi olarak doğrulanır.

| # | Test senaryosu | Doğrulama |
|---|---|---|
| 1 | council_member → reporter_identity alanı | API response'ta alan hiç yer almaz (null bile dönmez) |
| 2 | action_owner → report_text alanı | API response'ta alan hiç yer almaz |
| 3 | admin → tüm içerik alanları | Yalnızca case_metadata döner |
| 4 | E-posta notification body | Vaka içeriği, kişi adı, karar detayı içermez |
| 5 | Uygulama log çıktısı | Correlation ID, event type, resource ID var; içerik, parola, token yok |
| 6 | Audit event kaydı | Document hash, category, action var; dosya/metin içeriği yok |
| 7 | Error response | Stack trace, SQL, policy rule adı, object key, şifreli alan bilgisi yok |
| 8 | Serialization sırası değişikliği | Policy değişikliği sonrası alan görünürlüğü güncelleniyor |

---

## 9. SLA, Task ve Notification Testleri

### 9.1 SLA ve Takvim Testleri

Testler fake clock / controllable clock kullanır. business_calendar hafta sonu, resmi tatil, holding özel tatili ve yarım gün senaryolarıyla doğrulanır.

| # | Senaryo | Doğrulama |
|---|---|---|
| 1 | 24 takvim saati sessiz kabul — süre doldu | Kabul sayılır, transition üretilir, audit kaydedilir |
| 2 | 24 takvim saati sessiz kabul — süre dolmadan üye yanıtladı | Sessiz kabul tetiklenmez |
| 3 | 14 iş günü aksiyon SLA — normal hafta | 14 iş günü sonunda SLA breached |
| 4 | 14 iş günü aksiyon SLA — araya resmi tatil | Tatil günleri sayılmaz |
| 5 | 14 iş günü aksiyon SLA — hafta sonu | Hafta sonu günleri sayılmaz |
| 6 | SLA pause/resume | Pause süresince SLA ilerlemez; resume sonrası kalan süre devam eder |
| 7 | SLA aşımı bildirim — ilk gün | action_sla_overdue e-posta + in-app bildirim üretilir |
| 8 | SLA aşımı bildirim — sonraki günler | Her gün tekrar bildirim üretilir |
| 9 | task_sla_admin'den SLA süresi değişikliği | Yeni görevler yeni süreyle oluşturulur; mevcut görevler etkilenmez |

### 9.2 Notification Testleri

| # | Senaryo | Doğrulama |
|---|---|---|
| 1 | İçeriksiz e-posta şablonu | E-posta body'sinde vaka metni, kişi adı, karar detayı yok — yalnızca "sisteme bakın" niteliğinde |
| 2 | Idempotent dispatch | Aynı notification_event ikinci kez dispatch edilmez |
| 3 | Retry/backoff | Geçici SMTP hatası → retry; kalıcı hata → alarm |
| 4 | in_app + email ayrımı | Doğru kanal doğru alıcıya gider |
| 5 | secure_reporter_message | Anonim bildirimciye yönelik mesaj tracking_code ile erişilebilir; e-posta yok |
| 6 | Notification template aktif/pasif | Pasif template bildirim üretmez |

### 9.3 Maker-Checker Onay İşleri (Approval Work Item)

| # | Senaryo | Doğrulama |
|---|---|---|
| 1 | Admin rol ataması proposal | `approval_work_items` PENDING + `GET /tasks` `kind=APPROVAL` |
| 2 | Council secretary checker listede görür | ABAC/checker rol filtresi; admin users sayfasına erişim gerekmez |
| 3 | Checker onaylar | `POST /tasks/:id/decide` → rol ACTIVE + work item COMPLETED |
| 4 | Maker self-decide | 422 `MAKER_CHECKER_SELF` |
| 5 | Yanlış checker rolü | 403 `MAKER_CHECKER_FORBIDDEN` |
| 6 | Config batch (system settings) | Proposal → work item → decide → batch APPROVED |
| 7 | Idempotent decide | Aynı item ikinci decide → 409 veya no-op |

---

## 10. Concurrency ve Idempotency Testleri

| # | Senaryo | Doğrulama |
|---|---|---|
| 1 | Çift tıklama — aynı transition komutu 2 kez gönderilir | İkinci istek 409 döner; çift state geçişi üretilmez |
| 2 | Eşzamanlı kurul üyesi onayları | Her üye kendi oyunu verir; race condition çift oy üretmez |
| 3 | HYKB onay/veto — concurrent submit | Yalnızca ilk submit geçerli; ikincisi 409 |
| 4 | Aksiyon dönüşü — retry | Idempotency key ile aynı dönüş tekrar yazılmaz |
| 5 | Document token issuance — concurrent | Aynı kullanıcı için çift token üretilmez |
| 6 | Notification dispatch — duplicate | Outbox processor aynı event'i iki kez dispatch etmez |
| 7 | Optimistic locking — concurrent case update | İkinci transaction OptimisticLockException alır |

Test araçları: Prisma `$transaction` rollback, advisory lock doğrulama, concurrent request simulation (Promise.all + Supertest).

---

## 11. Integration / Contract Testleri

Tüm integration/contract testleri gerçek dış sistem credential'ları olmadan çalışır. CI ortamı production credential'ı veya gerçek etik veri kullanamaz.

| Adapter | Mock/Fake Yöntemi | Test Kapsamı |
|---|---|---|
| OIDC Provider | Fake OIDC issuer (jose kütüphanesiyle test JWT üretimi) | Claim mapping, JIT provisioning, session oluşturma, logout |
| HR/SAP Sync | JSON fixture (staging → validation → apply) | Mapping doğruluğu, pasif kullanıcı kapatma, partial failure davranışı, source_hash idempotency |
| SMTP Relay | Fake SMTP server (nodemailer mock) | İçeriksiz şablon doğrulama, encoding, header, retry |
| S3 Object Storage | LocalStack veya in-memory S3 mock | Upload, download, signed URL TTL, bucket private erişim, encryption |
| AWS KMS | Local KMS mock (aws-sdk-mock) | Encrypt/decrypt, key alias ayrımı, rotation, access denied senaryosu |
| ClamAV / Malware Scanner | Mock adapter (CLEAN/INFECTED response fixture) | Quarantine akışı, scan timeout, scan failure davranışı |

Gerçek endpoint testleri yalnızca yetkili staging ortamında, minimum veriyle ve güvenlik onayıyla yapılır.

---

## 12. E2E Kritik Akışlar

Playwright ile test edilen minimum senaryo seti:

### Akış 1 — Dış Bildirim ve Takip

1. Bildirimci dış formu doldurur (kategori: genel etik ihlali, anonim, dosya ekli)
2. Form gönderilir → tracking_code + parola ekranı gösterilir
3. Bildirimci tracking_code + parola ile takip ekranına girer
4. Durum "Alındı" olarak görünür
5. Yanlış parola ile giriş denemesi → hata mesajı
6. Rate-limit aşımı → 429 yanıtı

### Akış 2 — Sekreterya İş Akışı

1. council_secretary SSO ile giriş yapar
2. Yeni bildirim iş listesinde görünür
3. Ön değerlendirme yapılır → pre_research state'ine geçilir
4. Raportör atanır (rapporteur_assigned)
5. Raportör SSO ile giriş yapar → yalnızca atandığı vaka görünür
6. Raportör rapor yükler + rapor gönderir → agenda_ready'e döner

### Akış 3 — Kurul Kararı ve HYKB

1. council_secretary vakayı member_approval'a sunar
2. council_member onay/itiraz verir (24 saat sessiz kabul senaryosu ayrı)
3. council_secretary karar taslağı yazar
4. board_chair onaylar → board_approved
5. board_chair veto eder → agenda_ready'e döner (alternatif akış)

### Akış 4 — Aksiyon Atama ve Takip

1. council_secretary uygulama yazısı hazırlar → aksiyon atanır
2. action_owner SSO ile giriş yapar → yalnızca kendi şirket aksiyonu görünür
3. action_owner dönüş yapar + doküman yükler
4. Vaka sonraki kurul gündemine taşınır → takip kararı → kapatılır

### Akış 5 — Admin Metadata-Only Doğrulama

1. admin SSO ile giriş yapar
2. Vaka listesinde yalnızca metadata görünür (numara, tarih, şirket, kategori, durum)
3. Vaka detayına tıklandığında içerik alanları hiç gösterilmez
4. Doküman indirme butonu yok veya devre dışı
5. Rol/clearance yönetimi ekranı erişilebilir

### Akış 6 — Checker Onay (Birleşik Görev Kuyruğu)

1. admin rol ataması başlatır → PENDING_APPROVAL
2. council_secretary SSO ile giriş yapar → `/app/tasks` listesinde "Rol Ataması Onayı" satırı
3. Detayda özet + Onayla → gerekçe → görev tamamlanır (COMPLETED)
4. admin kullanıcı detayında rol ACTIVE
5. Negatif: admin kendi talebini görev detayında onaylayamaz (buton yok / API 422)

---

## 13. Coverage Hedefleri ve CI Gates

### 13.1 Coverage Eşikleri

| Kapsam | Minimum Hedef | Not |
|---|---|---|
| Backend toplam | ≥%80 line, ≥%70 branch | Düşüş PR'da gerekçelendirilir |
| authorization, workflow, document, audit, crypto, notification modülleri | ≥%90 line, ≥%85 branch | Pozitif + negatif senaryo zorunlu |
| Frontend kritik form/guard/hook kodu | ≥%70 line | UI coverage tek başına kabul kriteri değil |
| E2E kritik akışlar | Senaryo coverage | 5 akış tam kapsanır |
| Security gate | %100 zorunlu geçiş | Yüksek/kritik güvenlik bulgusu release bloklar |

Coverage yüzdesi tek başına yeterli değildir; hassas negatif test eksikliği coverage ile telafi edilemez.

### 13.2 CI/CD Güvenlik ve Performans Kalite Kapıları

**SAST/SCA (her PR'da):**

| Seviye | CVSS Aralığı | Davranış |
|---|---|---|
| CRITICAL | ≥ 9.0 | Blocker — merge edilemez |
| HIGH | 7.0–8.9 | Blocker — merge edilemez |
| MEDIUM | 4.0–6.9 | Uyarı — 1 sprint içinde giderilmeli |
| LOW/INFO | < 4.0 | Log — backlog'a alınır |

**Container scan (her image build'de):**

| Seviye | Davranış |
|---|---|
| CRITICAL CVE | Blocker — deploy edilemez |
| HIGH CVE (fix available) | Blocker — deploy edilemez |
| HIGH CVE (no fix) | Uyarı + exception kaydı (süreli, gerekçeli, Bilgi Güvenliği onaylı) |

**DAST (staging'de, her release öncesi):** OWASP Top 10 kritik bulgu release bloklar. Kapsam: authentication, authorization, injection, XSS, CSRF, security headers.

**Performance smoke (staging'de):**

| Metrik | Eşik | Davranış |
|---|---|---|
| API p95 yanıt süresi | < 2 saniye (normal load) | Uyarı + performans incelemesi |
| Sayfa ilk yüklenme | < 3 saniye | Uyarı + performans incelemesi |

Performance eşikleri hard blocker değil; aşılırsa inceleme gerektirir.

**Playwright critical-path (her deploy sonrası):** Dış bildirim formu gönderimi → takip kodu ile durum sorgulama → council_secretary login → vaka görüntüleme → raportör atama → member_approval → board_chair onayı → aksiyon atama.

### 13.3 Minimum Release Gate Özeti

| Gate | Bloklayıcı | Açıklama |
|---|---|---|
| Unit + integration tests | Evet | Domain, policy, DB, migration, adapter testleri |
| Workflow transition matrix | Evet | State/command/role/ABAC/side-effect/negative coverage |
| Authorization regression | Evet | RBAC + ABAC + masking + document grant deny/allow |
| Audit integrity tests | Evet | Kritik command audit'i, redaction ve hash-chain doğrulama |
| Security scans (SAST/SCA/secret/container/lockfile) | Evet | CVSS ≥7.0 ve CRITICAL CVE blocker |
| E2E critical flows | Evet | Dış bildirimden aksiyon takibine kritik happy/negative paths |
| UAT sign-off | Go-live için evet | Etik ekibi + KVKK + Bilgi Güvenliği kabulü |
| Human PR approval | Evet | Agent onaysız merge/push yapamaz |
| Lint + format | Evet | ESLint + Prettier geçmeli |
| Type check | Evet | TypeScript strict mode — derleme hatası blocker |

---

## 14. Test Data Management

### 14.1 Sentetik Seed

Tüm otomasyon, demo ve UAT test verisi sentetik olur. Production etik bildirim metni, doküman, karar yazısı, raportör raporu, aksiyon dönüşü, bildirimci iletişim bilgisi veya audit içeriği test/dev/demo ortamına taşınmaz.

Sentetik seed seti minimum persona ve vaka kombinasyonları:

| Persona | Rol | Şirket | Clearance |
|---|---|---|---|
| Anonim bildirimci | — | — | — |
| İsimli dış bildirimci | — | — | — |
| SSO iç çalışan (rol yok) | JIT user | Şirket A | — |
| Kurul sekretaryası | council_secretary | Holding | STRICTLY_CONFIDENTIAL |
| Kurul başkanı | council_chair | Holding | STRICTLY_CONFIDENTIAL |
| Kurul üyesi (×3) | council_member | Holding | SENSITIVE |
| Raportör (×2) | rapporteur | Farklı şirketler | SENSITIVE |
| HYKB | board_chair | Holding | STRICTLY_CONFIDENTIAL |
| Aksiyon sahibi (×2) | action_owner | Farklı şirketler | NORMAL |
| Sistem yöneticisi | admin | Holding | — (içerik göremez) |

Vaka kombinasyonları: NORMAL, SENSITIVE, STRICTLY_CONFIDENTIAL gizlilik seviyelerinde en az birer vaka; farklı state'lerde (açık, kapalı, arşiv) vakalar.

### 14.2 Factory Pattern

Faker + typed factory kullanılır. Manuel object yaratma yasaktır. Factory'ler tutarlı ve tekrarlanabilir test verisi üretir; her test run izole olur.

### 14.3 Test Artifact Redaction

Test çıktıları, CI artifact'ları, ekran görüntüleri, video kayıtları, loglar ve failed test payload'ları redaction politikasına tabidir. Secret, kişisel veri, bildirim metni veya doküman içeriği test artifact'ı olarak saklanmaz. Playwright video/screenshot sentetik veriyle üretilir. Gerçek secret içeren .env, token, cookie veya object key test raporlarında bulunamaz.

---

## 15. Flaky Test Yönetimi

| Parametre | Kural |
|---|---|
| CI retry policy | Maksimum 2 retry |
| Quarantine stratejisi | Flaky testler `@flaky` tag ile ayrı job'a taşınır; ana pipeline'ı bloklamaz |
| Nightly full suite | Tüm testler (quarantine dahil) nightly çalışır; flaky test trendi izlenir |
| Flaky root-cause | 5 iş günü içinde root-cause analizi ve fix zorunlu; 2 hafta içinde çözülmeyen test kalıcı olarak kaldırılır veya yeniden yazılır |

---

## 16. Test Traceability

Kritik test sınıfı veya spec açıklaması ilgili karar ID'lerini referanslar. Bu zorunluluk; bir karar değiştiğinde hangi testlerin güncellenmesi gerektiğini görünür kılar.

```typescript
/**
 * Tests for [AUTH-006] Field Visibility Policy
 * Validates that unauthorized roles cannot access restricted case fields.
 */
describe('[AUTH-006] FieldMaskingPolicy', () => {
  it('[AUTH-006][R-007] should exclude all content fields for admin role', () => { ... });
  it('[AUTH-006][R-004] should include action_letter only for assigned action_owner', () => { ... });
});
```

Workflow, authorization, document, audit ve security testlerinde karar ID'leri test adı, test açıklaması veya test metadata'sında yer alır.

---

## 17. UAT ve Go-Live Kabul

UAT ve go-live kabul testleri sentetik veriyle, rol bazlı persona setiyle ve iş birimi onayıyla yürütülür. Etik ekibi, KVKK ve Bilgi Güvenliği onayı olmadan production canlıya çıkılmaz.

UAT teknik testlerin yerine geçmez; teknik kapılar geçtikten sonra iş akışı, metinler, gizlilik mesajları ve rol deneyimi doğrulanır. Doğrulanması gereken ekranlar: dış bildirim formu, takip kodu ekranı, admin/sekreterya iş listesi, ön değerlendirme, raportör atama, kurul karar ekranı, HYKB onayı/vetosu, aksiyon takip ekranı ve dashboard.

`main` branch'e merge yalnızca tüm zorunlu test/security gate'leri başarılı ve insan onayı mevcutsa yapılır. Agent kullanıcı insan onayı olmadan main branch'e merge edemez veya doğrudan push yapamaz.
