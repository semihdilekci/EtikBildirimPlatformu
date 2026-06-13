# Yıldız Holding Etik Bildirim Uygulaması — Proje Özeti

## Proje Tanıtımı

Yıldız Holding Etik Bildirim Uygulaması, Holding ve bağlı şirketlerdeki etik dışı, yasa dışı veya Holding Etik İlkeleri'ne aykırı durumların gizli ve güvenli biçimde bildirilebildiği, bildirimden arşive kadar uçtan uca süreç yönetimi sağlayan kurumsal bir web platformudur.

Uygulama yalnızca bir form toplama aracı değildir. Anonim bildirim kabul, ön araştırma, kurul gündemi, raportör süreci, karar yazısı, Holding Yönetim Kurulu Başkanı (HYKB) onayı/vetosu, uygulama yazısı, aksiyon takibi, arşiv, SLA izleme ve denetim kaydı tek platform üzerinde yürütülür. Dışa açık bildirim formu login gerektirmez; iç süreç ekranları kurumsal kimlik doğrulama, çok faktörlü doğrulama ve katmanlı yetkilendirme ile korunur.

Platform single-tenant olarak çalışır; kurulum Yıldız Holding ve bağlı şirketler içindir. Sistemdeki `company` kavramı tenant sınırı değil, yetkilendirme mimarisinde veri kırılımı olarak kullanılan bir attribute'tır. Holding seviyesi roller tüm şirketleri görebilir; dar roller şirket, atama, fonksiyon, lokasyon ve gizlilik attribute'larıyla sınırlandırılır.

MVP platformu responsive web uygulaması olarak teslim edilir; native mobil uygulama ve çok dilli yapı ilk faz kapsamı dışındadır. Geliştirme dili Türkçe'dir.

---

## Hedef Kullanıcılar

**Dış bildirimci (reporter):** Etik bildirimi yapan kişi. Çalışan, eski çalışan, tedarikçi, iş ortağı, müşteri, vatandaş veya herhangi bir dış paydaş olabilir. Sistem hesabı oluşturmaz; anonim kalabilir veya isteğe bağlı iletişim bilgisi bırakabilir. Takip kodu ve kendi belirlediği parola ile bildirim durumunu sorgular, ek bilgi taleplerine cevap verir ve dosya yükler. Kullanım sıklığı düşüktür — genellikle tek bir bildirim ve sonrasında birkaç takip girişi.

**Kurul Sekreterliği (council_secretary):** Süreci uçtan uca yöneten holding seviyesi kullanıcı. Günlük iş listesi üzerinden çalışır: yeni bildirimleri değerlendirir, ön araştırma yürütür, raportör atar, gündem/karar/uygulama yazıları hazırlar, aksiyon ataması yapar, bildirimciyle güvenli mesajlaşma yürütür. Sistemin en yoğun iç kullanıcısıdır; günde birden fazla oturum açar.

**Kurul Başkanı (council_chair):** Ön araştırma sonrası vakanın kurul gündemine alınıp alınmayacağına karar verir. Gizlilik seviyesini güncelleyebilir. Kullanım sıklığı kurul periyoduna ve yeni vaka akışına bağlıdır; haftada birkaç kez oturum açabilir.

**Kurul Üyesi (council_member):** Gündemdeki vakaları inceler, karar yazısına onay veya itiraz verir. 24 takvim saati içinde dönüş yapmazsa sessiz kabul uygulanır. Kullanım sıklığı kurul periyoduna bağlıdır. Üyelerden biri genel sekreter olabilir; bu durum ayrı bir sistem rolü değil, üye kaydındaki bir attribute ile modellenir.

**Raportör (rapporteur):** Kurul sekreterliği tarafından vaka bazında atanan iç kullanıcı. Atandığı vakada inceleme yapar, rapor hazırlar, ek doküman yükler. Yalnızca atandığı vakaları görür. Kullanım sıklığı atama bazlıdır.

**Holding Yönetim Kurulu Başkanı — HYKB (board_chair):** Karar yazısı sonrası nihai onay veya veto verir. Veto durumunda vaka bir sonraki kurul gündemine döner. Kullanım sıklığı karar bazlıdır.

**Aksiyon Sahibi (action_owner):** İlgili şirket CEO'su veya fonksiyon lideri. Kendisine iletilen uygulama/aksiyon yazısını görür, 14 iş günü içinde dönüş yapar. Vaka dosyasının tamamını göremez; yalnızca kendi şirket/fonksiyon aksiyon alanlarına erişir. Kullanım sıklığı düşüktür — aksiyon atandığında aktif olur.

**Sistem Yöneticisi (admin):** Teknik ve yönetsel ayarları yönetir: kullanıcı/rol/clearance ataması, master data senkron izleme, iş günü takvimi, sistem ayarları, audit metadata görüntüleme, doküman operasyon izleme. Vaka içeriğine, bildirim metnine, bildirimci kimliğine, raportör raporuna, karar yazısına veya ek dosya içeriğine hiçbir koşulda erişemez.

---

## Kapsam

### MVP kapsamı (in-scope)

- **Dış etik bildirim formu:** Login gerektirmeyen, 18 alt kategori ve kategori bazlı dinamik alanlarla çalışan, KVKK aydınlatma metni onaylı, responsive web formu. Bildirimci anonim kalabilir veya isteğe bağlı iletişim bilgisi bırakabilir.

- **Anonim takip ve güvenli mesajlaşma:** Takip kodu + bildirimci parolası ile durum sorgulama, ek bilgi talebi/cevabı ve dosya yükleme. Session/cookie açılmaz; her istek yeniden doğrulanır. Mesaj içerikleri e-posta'ya taşınmaz.

- **Kurul sekreterliği iş listesi ve ön değerlendirme:** Yeni bildirim kabulü, ön araştırma, bilgi talebi, gizlilik seviyesi belirleme. Yeni bildirimlerin varsayılan gizlilik seviyesi `SENSITIVE` olarak atanır.

- **Raportör atama ve rapor süreci:** Kurul başkanı kararıyla raportör görevlendirme, inceleme, rapor yükleme. Raportör döngüsü opsiyonel ve kurul gündemine geri döner.

- **Kurul gündemi, üye onayı ve sessiz kabul:** Gündemdeki vakaların kurul üyelerine sunulması, 24 takvim saati içinde onay/itiraz beklenmesi, süre dolduğunda sessiz kabul kaydı üretilmesi.

- **Karar yazısı ve HYKB onay/veto:** Kurul sekreterliğinin karar yazısı hazırlaması, HYKB'ye sunulması, onay veya veto. Veto durumunda vaka sonraki kurul gündemine döner. Tüm onaylar dijitaldir; ıslak imza adımı bulunmaz.

- **Uygulama yazısı ve aksiyon atama:** İlgili şirket aksiyon sahibine uygulama/aksiyon yazısı iletilmesi, 14 iş günü SLA ile dönüş beklenmesi. Aksiyon dönüşü dosyayı otomatik kapatmaz; sonraki kurul gündeminde takip kararı verilir.

- **RBAC + ABAC yetkilendirme:** Hibrit rol ve attribute bazlı yetkilendirme. Üç katmanlı savunma: API guard/policy check, ORM/query seviyesinde row filtering, response serialization seviyesinde field masking. Deny-by-default çalışır.

- **Per-field encryption:** Hassas vaka alanları ve doküman içerikleri per-field AES-256-GCM ile veritabanında şifreli saklanır; her alan ayrı DEK'e sahiptir. Developer, DBA ve admin dahil hiçbir kullanıcı plaintext içeriğe veritabanı erişimiyle ulaşamaz.

- **Doküman yönetimi:** Private object storage, per-document envelope encryption, doküman bazlı erişim grant modeli, malware taraması, versiyonlama, kısa ömürlü erişim token'ı ve arşiv güvenliği.

- **Audit log:** Append-only, fail-closed, chain hash/tamper-evidence destekli merkezi denetim katmanı. İçerik kopyalamaz; metadata, yetki kararı ve olay izini tutar.

- **Admin paneli:** Rol/clearance yönetimi, master data senkron izleme, iş günü takvimi, sistem ayarları, audit metadata görüntüleme, doküman operasyon izleme. İçerik gören superuser ekranı değildir.

- **E-posta bildirimleri:** SMTP outbound-only, hassas içerik taşımayan şablon bildirimleri. SLA hatırlatma, görev atama, sessiz kabul uyarısı ve durum güncellemesi.

- **Temel dashboard:** Aggregate ve metadata bazlı göstergeler — toplam bildirim, açık/kapalı durum, SLA aşımı, bekleyen görev. Vaka satırına drill-down normal içerik erişim politikasından geçer.

### Kapsam dışı (v2+ veya reddedilen)

- **Çok dilli yapı:** MVP Türkçe'dir. Global kapsam Navex benzeri ürünlerin alanıdır; MVP maliyet/karmaşıklığını artırır.

- **Native mobil uygulama:** Yıllık bildirim hacmi ve ilk faz hedefi düşünüldüğünde responsive web yeterlidir.

- **Telefon/çağrı merkezi kanalı ve manuel intake:** KVKK, aydınlatma metni, ses kaydı/transkript ve operatör yetkisi gibi ek kararlar gerektirir. İleride açılırsa kontrollü `manual_intake_report` akışıyla tasarlanır.

- **MİM API entegrasyonu:** MİM'den gelen etik nitelikli başvurular dış forma yönlendirilir; otomatik vaka açma MVP'de yoktur.

- **E-imza entegrasyonu:** Tüm onaylar dijitaldir; gelişmiş e-imza platformu entegrasyonu faz 2 değerlendirmesidir.

- **Gelişmiş analytics ve eğitim modülü:** MVP temel dashboard ile başlar.

- **Full-text/OCR doküman arama:** Şifreli doküman içeriklerinden arama indeksi üretilmez; arama metadata alanlarıyla sınırlıdır. İş sahibi bu özelliğin ileride de istenmediğini netleştirmiştir.

- **Disclosure management ve global ülke/şehir kırılımları:** Global enterprise kapsamıdır.

---

## Ölçek ve Kısıtlar

**Bildirim hacmi:** Yıllık yaklaşık 200–250 etik bildirim. Sistem bu hacme uygun, sade ama güvenli workflow, dashboard ve arşivleme sunar; yüksek hacimli call-center ürünü gibi tasarlanmaz.

**Eşzamanlılık:** İç kullanıcı eşzamanlılığı düşük/orta kabul edilir. Kurul, sekreterya, raportör, HYKB, aksiyon sahipleri ve admin grupları sınırlı sayıdadır. Kritik kalite ölçütü yüksek throughput değil; veri gizliliği, doğru yetkilendirme, izlenebilirlik ve workflow bütünlüğüdür.

**İşlem modeli:** Bildirim ve iş akışı near-real-time çalışır; hard real-time gereksinimi yoktur.

**Coğrafya ve veri koruma:** MVP coğrafyası Türkiye'dir. Temel veri koruma rejimi KVKK olarak uygulanır. Tüm veriler tek AWS region sınırında tutulur; veri ikametgâhı Türkiye'de barındırma yönündedir. AWS region, VPC/topology ve compute runtime production öncesi Bilgi Güvenliği onayıyla kesinleşir.

**Dil:** MVP dili Türkçe'dir; uygulama arayüzü, form metinleri, KVKK/gizlilik metinleri ve bildirim şablonları Türkçe'dir. Teknik terimler İngilizce kullanılır.

**Uyumluluk:** OWASP ASVS v5.0.0 Level 3 hedefi phased delivery ile uygulanır. MVP'de L3 gereksinimlerinin kritik %80'i karşılanır; kalan %20 ilk production release öncesi tamamlanır. KVKK veri minimizasyonu, aydınlatma metni versiyonlama, retention/imha kabiliyeti ve legal hold desteği tasarımda bulunur.

**Güvenlik hedefi:** Privacy by design, least privilege, need-to-know, deny-by-default, segregation of duties ve auditability prensipleri uygulanır. Developer, DBA ve admin dahil hiç kimse plaintext etik bildirim içeriğine veritabanı veya storage erişimiyle ulaşamaz.

**Büyüme:** Sistem yıllık 200–250 bildirim hacmi için tasarlanır. Hacim artışı olursa async altyapı (outbox + worker modeli zaten mevcut) ve ihtiyaç halinde ek broker bileşenleri eklenebilir; mimari bu genişlemeye kapalı değildir.

---

## Başarı Kriterleri

| Kriter | Hedef | Ölçüm yöntemi |
|---|---|---|
| API p95 latency (iç ekranlar) | < 500 ms | CloudWatch / uygulama metrikleri |
| Dış form submit latency (p95) | < 2 saniye | Synthetic monitoring |
| Uptime (aylık) | ≥ %99 | Health check + monitoring dashboard |
| RPO (veri kaybı toleransı) | ≤ 4 saat | PostgreSQL PITR continuous backup |
| RTO (kesinti sonrası ayağa kalkma) | ≤ 2 iş saati | Runbook + restore tatbikatı (6 ayda bir) |
| Audit chain bütünlüğü | %100 — kırılma yok | Periyodik verification job + alarm |
| Güvenlik gate geçiş oranı | %100 — yüksek/kritik bulgu ile release yok | CI/CD pipeline SAST/SCA/secret/container scan |
| MVP'de dijitalleşen süreç | 1 adet: uçtan uca etik bildirim → aksiyon takibi → arşiv | Production deploy + UAT kabul |
| Yetkilendirme doğruluğu | Sıfır yanlış pozitif erişim (yetkisiz kullanıcı içerik göremez) | Authorization regression test suite |
| Test coverage (kritik modüller) | ≥ %90 line, ≥ %85 branch | Jest/Vitest coverage raporu |

---

## Kısıtlamalar (Teknik ve Organizasyonel)

**Takım profili:** Geliştirme vibe-coding destekli in-house yürütülür. Production kodu test, security gate, insan review, KVKK ve Bilgi Güvenliği onaylarından geçmeden canlıya alınmaz. Agent/AI araçları hızlandırıcı olarak kullanılabilir; ancak agent tek başına production yolunu açamaz — `main` branch'e merge insan onayı gerektirir.

**Tech stack:** Node.js v22 LTS + NestJS v11 + TypeScript (strict mode, `any` yasak), React 19 + Vite, PostgreSQL, Prisma ORM + prisma migrate, pnpm workspaces monorepo. Modular monolith mimari; mikroservis MVP dışıdır.

**Altyapı:** Local development + AWS production hedefi. Kesin AWS region, VPC/topology, compute runtime, KMS/HSM ve secret manager seçimi production öncesi Bilgi Güvenliği onayıyla kesinleşir. Bu onay alınmadan doküman/PII içeren production deployment yapılamaz.

**Encryption altyapısı:** AWS KMS customer-managed keys + AWS Secrets Manager önerilen yöndür. Kesin ürün/servis kararı ve key rotation prosedürü production öncesi kesinleşir. Bu karar alınmadan per-field encryption ve doküman encryption altyapısı canlıya açılamaz.

**Dosya yükleme güvenliği:** MVP başlangıç değerleri: PDF, DOCX, XLSX, JPG, JPEG, PNG, MP4, MOV, ZIP, TXT; tek dosya 50 MB, toplam 200 MB. ClamAV (self-hosted, KVKK uyumlu) ile malware taraması. Değerler system_settings'ten konfigüre edilebilir.

**HR/SAP entegrasyonu:** ABAC attribute'ları ve rol türetme için nightly read-only senkron modeli tasarlanmıştır. Kesin teknik sözleşme (kaynak endpoint, alan mapping, unique key, schedule) production öncesi HR/SAP ekibiyle kesinleşir. Gerçek entegrasyon sözleşmesi kapanmadan canlı yetki otomasyonu açılamaz; MVP'de mock/sentetik veriyle ilerlenebilir.

**SSO/Session:** İç kullanıcılar OIDC Authorization Code Flow + PKCE ile giriş yapar; provider env variable ile konfigüre edilir. MFA production'da TOTP (Microsoft Authenticator) ile IdP katmanında zorunludur. Kesin session timeout süreleri (varsayılan: idle 30 dk, absolute 8 saat) Bilgi Güvenliği onayıyla kesinleşir.

**E-posta altyapısı:** SMTP outbound-only. Kurumsal SMTP relay sözleşmesi (gönderici domain, DKIM/SPF/DMARC, rate limit) production öncesi IT ekibiyle kesinleşir. Production bildirim gönderimi bu sözleşme kapanmadan aktif edilemez.

**Dış ürün kararı:** MVP yönü in-house geliştirmedir. Navex, Pick Up / Speak Up ve benzeri ürünler benchmark ve faz 2 karşılaştırması olarak değerlendirilebilir; gerçek etik veri vendor ortamına aktarılmaz.

**Non-prod veri politikası:** Development, test ve demo ortamlarında gerçek etik bildirim verisi kullanılmaz. Tüm test ve demo senaryoları synthetic seed data ile yürütülür.

---

## Doküman Haritası

Bu proje için 11 adet teknik doküman üretilmiştir. Her doküman kendi kendine yeter; başka bir doküman olmadan da anlaşılır. Aşağıdaki tablo her dokümanın içeriğini ve ne zaman başvurulacağını özetler.

| Doküman | İçerik | Ne zaman bakılır |
|---|---|---|
| **01 DOMAIN_MODEL** | Entity'ler, ilişkiler, iş kuralları, state machine'ler, kardinalite tablosu | Yeni bir entity yazarken, iş kuralı sorusu olduğunda, workflow akışını anlamak için |
| **02 DATABASE_SCHEMA** | Tablo tanımları, kolon detayları, index'ler, ERD, encryption alanları, migration stratejisi | DB değişikliği yaparken, Prisma schema düzenlerken, migration yazarken |
| **03 API_CONTRACTS** | Tüm REST endpoint'ler, request/response şemaları, error taxonomy, yetki gereksinimleri | Yeni endpoint yazarken, frontend-backend entegrasyonu sırasında, hata yönetimi tasarlarken |
| **04 BACKEND_SPEC** | NestJS modül yapısı, katmanlar, guard zinciri, CryptoService, outbox/worker, logging, exception handling | Backend kod yazarken, yeni modül/servis eklerken, middleware/guard sorusu olduğunda |
| **05 FRONTEND_SPEC** | React routing, state yönetimi, form yapısı, fetch stratejisi, güvenlik yüzeyleri, a11y, Web Vitals | Frontend geliştirirken, yeni ekran/component eklerken, güvenlik yüzeyi sorusu olduğunda |
| **06 SCREEN_CATALOG** | Ekran ekran detay (layout, bileşenler, veri kaynakları, yetkiler, durumlar), ekran haritası | UI tasarımı ve implementasyonu sırasında, yeni ekran eklerken, UX sorusu olduğunda |
| **07 SECURITY_IMPLEMENTATION** | Auth akış, OIDC, anonim auth, token/session, encryption, CORS/CSP, rate limit, KVKK, maker-checker, break-glass, PII alanları | Güvenlik implementasyonu, yetkilendirme sorusu, KVKK kontrolü, encryption/decryption akışı sırasında |
| **08 TESTING_STRATEGY** | Test piramidi, coverage hedefleri, CI gate, factory pattern, workflow transition matrix, security test | Test yazarken, CI pipeline düzenlerken, coverage sorusu olduğunda |
| **09 DEV_WORKFLOW** | Git branching, commit format, PR kuralları, environment yapısı, env vars, local setup, deployment | Projeye ilk başlarken, branch/commit/PR sorusu olduğunda, yeni ortam kurulumunda |
| **10 IMPLEMENTATION_ROADMAP** | MVP kapsamı, sprint planı, build order, risk register, accepted debt, critical path | Sprint planlaması, önceliklendirme, risk değerlendirmesi ve ilerleme takibi sırasında |

---

*Bu doküman Yıldız Holding Etik Bildirim Uygulaması mimari kararlarından türetilmiştir. Kararlar değiştiğinde doküman yeniden üretilir.*
