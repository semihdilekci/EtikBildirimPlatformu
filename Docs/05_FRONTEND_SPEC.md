# Yıldız Holding Etik Bildirim Uygulaması — Frontend Spec

## Framework ve Render Model

Frontend, **React** + **TypeScript** + **Vite** ile SPA (Single Page Application) olarak geliştirilir. Server-Side Rendering (SSR), Static Site Generation (SSG) ve React Server Components kullanılmaz — Next.js veya Remix gibi meta-framework'ler MVP kapsamında değildir.

TypeScript strict mode zorunludur; `any` tipi tüm frontend kodunda yasaktır. `tsconfig.json` ayarları `strict: true`, `noImplicitAny: true`, `strictNullChecks: true` olarak sabitlenir.

Build toolchain Vite'tır; CRA (Create React App) veya Webpack kullanılmaz. Production build `vite build` ile üretilir; output `dist/` klasörüne statik dosyalar olarak yazılır ve CDN veya static hosting üzerinden sunulur. Dış CDN'den runtime script/style yüklenmez — tüm asset'ler build içinde paketlenir.

UI component kütüphanesi olarak **MUI (Material UI)** kullanılır; tema Yıldız Holding kurumsal kimliğine hizalanır. Harici CDN üzerinden component veya font yüklenmez. Erişilebilirlik kontrolleri MUI'nin built-in a11y desteği üzerine ek kontroller ile güçlendirilir.

---

## Brand & Theme

Renk ve tipografi token'ları [yildizholding.com.tr](https://www.yildizholding.com.tr/) kurumsal sitesinden alınır.

- Design system: `Docs/design-system/README.md`
- Token'lar: `Docs/design-system/tokens/colors.md`, `typography.md`, `spacing.md`, `effects.md`
- Bileşen spec: `Docs/design-system/components/button.md`

### Renk paleti (özet)

| Rol | Hex | MUI |
| --- | --- | --- |
| Primary kırmızı | `#EB1C2E` | `palette.primary.main` |
| Metin siyah | `#000000` | `palette.text.primary` |
| Beyaz yüzey | `#FFFFFF` | `palette.background.paper` |
| Gri arka plan | `#F8F8F8` / `#F3F1F2` | `palette.background.default`, alternatif yüzey |
| İkincil metin | `#636466` | `palette.text.secondary` |

PWA/tile referans rengi: `#D30E1D` (meta `theme-color`; UI primary `#EB1C2E`).

### Tipografi

- Birincil font: **Poppins** (400, 500, 600, 700).
- Bundle: `@fontsource/poppins` — `main.tsx` import; Google Fonts CDN yasak.
- Monospace: tracking code alanları (`fontFamily: monospace` variant).

### Uygulama kuralları

1. Tüm renkler `apps/web/src/styles/theme.ts` üzerinden; bileşenlerde hardcoded hex yasak.
2. Yapıcı aksiyonlar `color="primary"`; destructive onay `color="error"` (aynı marka kırmızısı).
3. Inline `style={{ color: '#…' }}` yasak — MUI `sx` + theme token.
4. Kontrast WCAG AA — bkz. §Accessibility Color contrast.

---

## Klasör Yapısı

```
apps/web/
  src/
    main.tsx                                # React DOM render entry
    App.tsx                                 # Router setup, provider wrapper'lar
    routes/
      index.tsx                             # Route tanımları — React Router
      guards/
        AuthGuard.tsx                       # Session kontrolü, redirect to login
        RoleGuard.tsx                       # Rol bazlı route koruması
        GuestGuard.tsx                      # Login olmuş kullanıcıyı /app'e redirect eder
    layouts/
      PublicIntakeLayout.tsx                # Dış form layout — header, KVKK footer, sade
      AnonymousFollowupLayout.tsx           # Anonim takip layout — tracking code context
      InternalLayout.tsx                    # İç operasyon layout — sidebar, topbar, navigation
      AdminLayout.tsx                       # Admin layout — admin sidebar, restricted nav
    features/
      public-intake/                        # Dış bildirim formu
        pages/
          ReportFormPage.tsx                # Multi-step bildirim formu
          ReportSuccessPage.tsx             # Takip kodu teslim ekranı
        components/
          StepIndicator.tsx
          CategorySelector.tsx
          DynamicCategoryFields.tsx         # Kategori bazlı dinamik alan render
          IdentityChoiceSection.tsx
          TrackingPasswordSection.tsx
          KvkkConsentCheckbox.tsx
          FileUploadZone.tsx
        hooks/
          useReportForm.ts                  # Multi-step form state yönetimi
          useCategories.ts                  # Kategori listesi query
          useKvkkText.ts                    # KVKK metin query
        schemas/
          report-form.schema.ts             # Zod validation (packages/dto'dan import)
      anonymous-followup/                   # Anonim takip ekranı
        pages/
          TrackingLoginPage.tsx             # Tracking code + parola giriş
          TrackingStatusPage.tsx            # Durum görüntüleme
          SecureMessagesPage.tsx            # Güvenli mesajlaşma
        components/
          TrackingVerifyForm.tsx
          StatusBadge.tsx
          MessageThread.tsx
          MessageComposer.tsx
        hooks/
          useTrackingAuth.ts               # Tracking code doğrulama state
          useTrackingStatus.ts
          useSecureMessages.ts
        context/
          TrackingContext.tsx               # Tracking code + password in-memory context
      internal/                             # İç kullanıcı operasyon ekranları
        cases/
          pages/
            CaseListPage.tsx
            CaseDetailPage.tsx
          components/
            CaseFilters.tsx
            CaseTimeline.tsx
            CaseActionBar.tsx              # availableActions butonları
            TransitionDialog.tsx           # Workflow command onay dialog'u
          hooks/
            useCases.ts
            useCaseDetail.ts
            useCaseTransition.ts
        tasks/
          pages/
            TaskListPage.tsx
            TaskDetailPage.tsx
          components/
            TaskFilters.tsx
            TaskSlaIndicator.tsx
            ApprovalDecideDialog.tsx   # kind=APPROVAL onay/red + gerekçe
          hooks/
            useTasks.ts
            useApprovalDecide.ts
        documents/
          components/
            DocumentList.tsx
            DocumentUploadDialog.tsx
            DocumentDownloadButton.tsx
          hooks/
            useDocuments.ts
            useDocumentUpload.ts
            useDocumentDownload.ts
        decisions/
          components/
            VoteList.tsx
            CastVoteDialog.tsx
          hooks/
            useDecisionVotes.ts
        secure-messages/
          components/
            InternalMessageThread.tsx
            InternalMessageComposer.tsx
          hooks/
            useInternalSecureMessages.ts
        notifications/
          components/
            NotificationCenter.tsx
            NotificationBell.tsx
            NotificationItem.tsx
          hooks/
            useNotifications.ts
        dashboard/
          pages/
            DashboardPage.tsx
          components/
            SummaryCards.tsx
            StateDistributionChart.tsx
            CompanyBreakdownChart.tsx
            SlaOverviewWidget.tsx
          hooks/
            useDashboardSummary.ts
      admin/                                # Admin paneli ekranları
        users/
          pages/
            AdminUserListPage.tsx
            AdminUserDetailPage.tsx
          components/
            RoleAssignDialog.tsx
            ClearanceUpdateDialog.tsx
            MakerCheckerApprovalDialog.tsx
          hooks/
            useAdminUsers.ts
        master-data/
          pages/
            MasterDataSyncPage.tsx
          hooks/
            useMasterData.ts
        config/
          pages/
            SystemSettingsPage.tsx
            FieldVisibilityPage.tsx
            ActionMatrixPage.tsx
            SlaPolicyPage.tsx
            BusinessCalendarPage.tsx
            NotificationTemplatePage.tsx
            KvkkTextPage.tsx
          hooks/
            useSystemSettings.ts
            useFieldVisibility.ts
        monitoring/
          pages/
            AuditViewerPage.tsx
            DocumentOpsPage.tsx
            SystemHealthPage.tsx
          hooks/
            useAuditEvents.ts
    shared/
      components/
        DataTable/
          DataTable.tsx                     # TanStack Table + MUI wrapper
          DataTablePagination.tsx
          DataTableSkeleton.tsx
        FormLayout/
          FormLayout.tsx                    # Standart form wrapper
          FormActions.tsx                   # Submit/cancel buton grubu
        ConfirmDialog/
          ConfirmDialog.tsx                 # Genel onay dialog'u
        EmptyState/
          EmptyState.tsx                    # İllüstrasyon + mesaj + CTA
        LoadingSpinner.tsx
        ErrorBoundary.tsx
        Toast/
          ToastProvider.tsx
          useToast.ts
        FileUpload/
          FileUploadDropzone.tsx
          FileUploadProgress.tsx
          AllowedFileTypes.tsx
      hooks/
        useAuth.ts                          # /auth/me query + session state
        useCurrentUser.ts                   # CurrentUser context accessor
        useCsrfToken.ts                     # CSRF token management
        useDebounce.ts
      api/
        client.ts                           # Axios/fetch wrapper — base URL, interceptors
        interceptors/
          csrf.interceptor.ts               # CSRF token header injection
          session-expired.interceptor.ts    # 401 → redirect to login
          error-transform.interceptor.ts    # API error → typed DomainError
        query-keys.ts                       # TanStack Query key factory
      types/
        api.types.ts                        # API response type definitions
        domain.types.ts                     # Frontend domain types
        auth.types.ts                       # User, role, session types
      utils/
        date.ts                             # Tarih formatting (day.js veya date-fns)
        mask.ts                             # PII maskeleme yardımcıları
        validation.ts                       # Zod schema re-exports
    styles/
      theme.ts                              # MUI theme customization
      global.css                            # Global reset ve typography
    config/
      env.ts                                # Vite env variable typing
```

---

## Route Konfigürasyonu

Routing **React Router v6** ile yapılır. Route'lar 4 layout grubuna ayrılır; her grup farklı güvenlik yüzeyi, session davranışı ve navigation yapısı kullanır.

### Route grupları

| Grup | Path prefix | Layout | Auth | Guard |
|---|---|---|---|---|
| Public Intake | `/report/*` | `PublicIntakeLayout` | Yok | `GuestGuard` (login olmuş iç kullanıcıyı /app'e yönlendirir) |
| Anonymous Followup | `/tracking/*` | `AnonymousFollowupLayout` | Tracking code + parola | `TrackingContext` (in-memory, cookie yok) |
| Internal Operations | `/app/*` | `InternalLayout` | OIDC session | `AuthGuard` + `RoleGuard` |
| Admin Console | `/app/admin/*` | `AdminLayout` | OIDC session + admin rolü | `AuthGuard` + `RoleGuard('admin')` |

### Route listesi

```
/                                → Redirect: /report
/report                          → ReportFormPage (multi-step)
/report/success                  → ReportSuccessPage (takip kodu teslim)

/tracking                        → TrackingLoginPage
/tracking/status                 → TrackingStatusPage
/tracking/messages               → SecureMessagesPage

/auth/login                      → OIDC login redirect trigger
/auth/callback                   → OIDC callback handler (otomatik → /app)

/app                             → Redirect: /app/dashboard
/app/dashboard                   → DashboardPage
/app/cases                       → CaseListPage
/app/cases/:id                   → CaseDetailPage
/app/reports/pending             → PendingReportsPage (council_secretary)
/app/tasks                       → TaskListPage
/app/tasks/:id                   → TaskDetailPage
/app/notifications               → (NotificationCenter sidebar olarak da açılır)

**InternalLayout sidebar (Faz 5.1):** `council_secretary` rolü için "Bekleyen Bildirimler" menü öğesi (`/app/reports/pending`) — `PermissionGate(case:pre_review)` ile gösterilir. Diğer iç roller bu öğeyi görmez.

/app/admin/users                 → AdminUserListPage
/app/admin/users/:id             → AdminUserDetailPage
/app/admin/master-data           → MasterDataSyncPage
/app/admin/settings              → SystemSettingsPage
/app/admin/field-visibility      → FieldVisibilityPage
/app/admin/action-matrix         → ActionMatrixPage
/app/admin/sla-policies          → SlaPolicyPage
/app/admin/business-calendar     → BusinessCalendarPage
/app/admin/notification-templates → NotificationTemplatePage
/app/admin/kvkk-texts            → KvkkTextPage
/app/admin/audit                 → AuditViewerPage
/app/admin/document-ops          → DocumentOpsPage
/app/admin/system-health         → SystemHealthPage

/403                             → ForbiddenPage
/404                             → NotFoundPage
/500                             → ErrorPage
```

### Protected route mekanizması

`AuthGuard` bileşeni `InternalLayout` ve `AdminLayout`'a sarılır. Çalışma akışı:

1. `GET /api/v1/auth/me` çağrısı yapılır (TanStack Query, `staleTime: 5 * 60 * 1000`).
2. 401 dönerse kullanıcı `/auth/login`'e redirect edilir.
3. 200 dönerse `CurrentUser` context'e set edilir.
4. `RoleGuard` mevcut kullanıcının rollerini kontrol eder; yetersizse `/403`'e redirect eder.

Session idle/absolute timeout durumunda backend 401 döner; API client interceptor'ı bunu yakalar ve otomatik login redirect yapar. Kullanıcıya "Oturumunuz sona erdi" toast gösterilir.

### Redirect davranışları

| Durum | Davranış |
|---|---|
| Unauthenticated → /app/* | Redirect → /auth/login?returnUrl=... |
| Authenticated → /report | /report gösterilir (iç kullanıcı da dış form kullanabilir) |
| Wrong role → /app/admin/* | Redirect → /403 |
| Rolsüz kullanıcı → /app/* | /app/dashboard açılır ama tüm data endpoint'leri boş döner (deny-by-default) |

---

## State Boundaries (Sıkı Kural)

Frontend state yönetimi kesin sınırlarla ayrılır. Her state tipi tek bir araçla yönetilir; aynı veri iki ayrı state store'da tutulmaz.

| State tipi | Araç | Örnek | Yasak |
|---|---|---|---|
| API / server cache | TanStack Query | Vaka listesi, görev listesi, kullanıcı profili, dashboard verisi | Zustand'a veya useState'e kopyalanmaz |
| UI transient | Zustand (minimal) | Sidebar açık/kapalı, aktif tab, notification center açık/kapalı | API datası buraya yazılmaz |
| URL-shareable | URL query params | Filtreler, pagination cursor, sortBy, aktif vaka ID | Zustand'a çift yazılmaz |
| Form draft | React Hook Form | Bildirim formu, admin ayar formu, onay dialog'u | Zustand'a veya global store'a kaymaz |
| Tracking auth | React Context (in-memory) | Anonim tracking code + parola (session boyunca bellekte) | localStorage/sessionStorage'a yazılmaz |

**localStorage / sessionStorage kullanımı tamamen yasaktır.** Token, session ID, tracking code parolası, vaka içeriği, kişisel veri veya herhangi bir uygulama state'i browser storage'a yazılmaz. Bu kural XSS durumunda veri sızıntısını önlemek için konulmuştur. Tek istisna: CSRF token double-submit cookie'si (HttpOnly olmayan cookie — bu browser tarafından yönetilir, JavaScript ile okunur ama storage'a yazılmaz).

**Optimistic update kullanılmaz.** Bu projede tüm mutating işlemler güvenlik-kritik (workflow transition, rol atama, doküman upload, oy verme) ve audit zorunludur. Client-side optimistic update yapılması halinde, backend reddi durumunda kullanıcıya geçici olarak yanlış state gösterilir ve audit ile tutarsız UI oluşur. Tüm mutation'lar backend confirmation sonrası TanStack Query invalidation ile güncellenir.

---

## Form Pattern (Referans İmplementasyon)

Formlar **React Hook Form (RHF)** + **Zod** + **MUI** üçlüsüyle oluşturulur. Backend validation tek doğruluk kaynağıdır; client-side validation kullanıcı deneyimi optimizasyonudur, güvenlik kontrolü değildir.

### Referans: Basit admin ayar formu

```tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField, Button, Alert } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSystemSetting } from '@/shared/api/admin';
import { useToast } from '@/shared/components/Toast/useToast';

const schema = z.object({
  value: z.string().min(1, 'Değer zorunludur.'),
  reason: z.string().min(1, 'Gerekçe zorunludur.'),
});

type FormValues = z.infer<typeof schema>;

export function SystemSettingEditForm({ settingKey, currentValue }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { value: currentValue, reason: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => updateSystemSetting(settingKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-settings'] });
      toast.success('Ayar güncellendi.');
    },
    onError: (error: ApiError) => {
      if (error.code === 'VALIDATION_FAILED' && error.details) {
        error.details.forEach((d) => setError(d.field as keyof FormValues, { message: d.message }));
      } else if (error.code === 'MAKER_CHECKER_REQUIRED') {
        toast.info('İşlem çift onay gerektiriyor. Onay bekleniyor.');
      } else {
        toast.error(error.message);
      }
    },
  });

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <Controller
        name="value"
        control={control}
        render={({ field }) => (
          <TextField {...field} label="Değer" error={!!errors.value} helperText={errors.value?.message} fullWidth />
        )}
      />
      <Controller
        name="reason"
        control={control}
        render={({ field }) => (
          <TextField {...field} label="Gerekçe" error={!!errors.reason} helperText={errors.reason?.message} fullWidth multiline rows={2} />
        )}
      />
      <Button type="submit" variant="contained" disabled={isSubmitting} loading={isSubmitting}>
        Kaydet
      </Button>
    </form>
  );
}
```

### Multi-step form pattern (bildirim formu)

Bildirim formu 10 adımlı multi-step akışa sahiptir. Her adım kendi Zod schema'sıyla validate edilir; `useReportForm` custom hook tüm adımların state'ini RHF `useForm` ile tek form instance'da yönetir. Adımlar arası geçişte mevcut adımın validation'ı çalışır; geçersizse ilerleme engellenir. Son adımda tüm form verisi tek `POST /api/v1/intake/reports` isteğiyle gönderilir.

Kategori seçimine bağlı dinamik alanlar `DynamicCategoryFields` bileşeni ile render edilir. Bu bileşen seçilen `categoryGroup` ve `categories` değerlerine göre ek form alanlarını gösterir/gizler. Dinamik alan tanımları `packages/dto` içindeki kategori schema'larından gelir.

---

## Data Fetching Pattern

### TanStack Query kullanımı

Tüm API çağrıları TanStack Query (React Query v5) üzerinden yapılır. Doğrudan `fetch` veya `axios` çağrısı component içinde bulunmaz — her API çağrısı custom hook içinde kapsüllenir.

### Query key şeması

Tutarlı ve öngörülebilir query key'ler `queryKeys` factory ile üretilir:

```typescript
// shared/api/query-keys.ts
export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  cases: {
    all: () => ['cases'] as const,
    list: (filters: CaseFilters) => ['cases', 'list', filters] as const,
    detail: (id: string) => ['cases', 'detail', id] as const,
    transitions: (id: string) => ['cases', 'transitions', id] as const,
    votes: (id: string) => ['cases', 'votes', id] as const,
    documents: (id: string) => ['cases', 'documents', id] as const,
    secureMessages: (id: string) => ['cases', 'secure-messages', id] as const,
  },
  tasks: {
    all: () => ['tasks'] as const,
    list: (filters: TaskFilters) => ['tasks', 'list', filters] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
  },
  notifications: {
    all: () => ['notifications'] as const,
    list: (filters: NotificationFilters) => ['notifications', 'list', filters] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },
  dashboard: {
    summary: () => ['dashboard', 'summary'] as const,
  },
  admin: {
    users: {
      list: (filters: UserFilters) => ['admin', 'users', 'list', filters] as const,
      detail: (id: string) => ['admin', 'users', 'detail', id] as const,
    },
    systemSettings: () => ['admin', 'system-settings'] as const,
    fieldVisibility: () => ['admin', 'field-visibility'] as const,
    actionMatrix: () => ['admin', 'action-matrix'] as const,
    slaPolicies: () => ['admin', 'sla-policies'] as const,
    businessCalendar: () => ['admin', 'business-calendar'] as const,
    notificationTemplates: () => ['admin', 'notification-templates'] as const,
    kvkkTexts: () => ['admin', 'kvkk-texts'] as const,
    auditEvents: (filters: AuditFilters) => ['admin', 'audit-events', filters] as const,
    masterData: {
      companies: () => ['admin', 'master-data', 'companies'] as const,
      syncRuns: () => ['admin', 'master-data', 'sync-runs'] as const,
    },
    systemHealth: () => ['admin', 'system-health'] as const,
  },
  tracking: {
    status: () => ['tracking', 'status'] as const,
    messages: () => ['tracking', 'messages'] as const,
  },
  intake: {
    categories: () => ['intake', 'categories'] as const,
    kvkkText: () => ['intake', 'kvkk-text'] as const,
    companies: () => ['intake', 'companies'] as const,
  },
} as const;
```

### Stale time tablosu

| Veri tipi | staleTime | gcTime | Gerekçe |
|---|---|---|---|
| Kullanıcı profili (`auth/me`) | 5 dk | 10 dk | Session kontrolü; sık refresh gereksiz |
| Vaka listesi | 30 sn | 5 dk | Diğer kullanıcıların işlemleri listeyi değiştirebilir |
| Vaka detayı | 0 (always fresh) | 5 dk | Workflow state güncel olmalı |
| Görev listesi | 30 sn | 5 dk | SLA ve durum güncellemeleri |
| Dashboard summary | 1 dk | 5 dk | Aggregate veri; anlık güncellik kritik değil |
| Kategori listesi | 30 dk | 1 saat | Nadiren değişir |
| KVKK metni | 30 dk | 1 saat | Versiyonlu; sık değişmez |
| Şirket listesi | 10 dk | 30 dk | Master data; senkron sonrası değişir |
| Admin config tabloları | 1 dk | 5 dk | Config değişiklikleri hemen yansımalı |
| Notification listesi | 15 sn | 5 dk | Yeni bildirimler hızlı görünmeli |
| Tracking status | 0 (always fresh) | 0 | Her ziyarette güncel durum |
| Secure messages | 0 (always fresh) | 0 | Yeni mesajlar anında görünmeli |

### Mutation + invalidation pattern

```typescript
// Workflow transition mutation örneği
export function useCaseTransition(caseId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (command: CreateTransitionDto) =>
      apiClient.post(`/cases/${caseId}/transitions`, command),
    onSuccess: () => {
      // İlgili query'leri invalidate et
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.transitions(caseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
      toast.success('İşlem başarıyla tamamlandı.');
    },
    onError: (error: ApiError) => {
      if (error.code === 'CASE_INVALID_TRANSITION') {
        toast.error('Bu işlem vakanın mevcut durumunda yapılamaz.');
        queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) });
      } else if (error.code === 'CASE_OPTIMISTIC_LOCK') {
        toast.warning('Vaka başka bir kullanıcı tarafından güncellendi. Sayfa yenileniyor.');
        queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) });
      } else {
        toast.error(error.message);
      }
    },
  });
}
```

**Optimistic update yasaktır.** Tüm mutation'lar `onSuccess` callback'inde invalidation ile güncellenir. `onMutate` içinde cache manipülasyonu yapılmaz. Gerekçe: workflow transition, oy verme, rol atama ve doküman upload gibi işlemler güvenlik-kritiktir; backend reddi durumunda geçici yanlış state göstermek audit tutarsızlığı ve kullanıcı güven kaybı yaratır.

---

## Loading ve Error UX

### Skeleton vs spinner seçim kuralı

| Durum | Bileşen | Ne zaman |
|---|---|---|
| Skeleton | `DataTableSkeleton`, satır bazlı | Sayfa ilk yükleme, liste endpoint bekleme |
| Spinner | `LoadingSpinner`, küçük inline | Buton submit, mutation pending, dosya yükleme progress |
| Overlay spinner | Tam sayfa overlay | Workflow transition (UI'ı kilitlemek gerekir) |

### Toast kullanımı

| Durum | Toast tipi | Örnek |
|---|---|---|
| Mutation başarılı | Success (yeşil) | "Vaka gündeme alındı." |
| Recoverable error | Error (kırmızı) | "İşlem başarısız. Tekrar deneyin." |
| Uyarı / bilgilendirme | Warning / Info | "Oturumunuz sona erecek." / "Çift onay bekleniyor." |
| Validation hatası | — | Toast yok; inline field error gösterilir |

Toast süresi: success 3 saniye auto-dismiss, error 5 saniye auto-dismiss + manual close, warning/info 4 saniye.

### Error boundary yerleşimi

Her layout bileşeni kendi `ErrorBoundary`'sine sahiptir (page-level zorunlu). Feature-level error boundary opsiyoneldir; kritik bileşenlerde (dashboard chart, dosya listesi) ek error boundary kullanılır.

Error boundary çıktısı: kullanıcıya "Bir hata oluştu" mesajı + "Tekrar Dene" butonu + correlation ID. Stack trace veya teknik detay kullanıcıya gösterilmez.

### Empty state tasarım kuralı

Boş listeler sessiz bırakılmaz. Her boş durum için:

| Durum | Bileşen | İçerik |
|---|---|---|
| İlk yükleme boş | `EmptyState` | İllüstrasyon + açıklama mesajı + CTA buton (varsa) |
| Filtre sonrası boş | `EmptyState` | "Filtre kriterlerine uygun kayıt bulunamadı." + "Filtreleri Temizle" butonu |
| Yetkisiz (deny-by-default) | `EmptyState` | "Görüntülenecek kayıt bulunmamıyor." (yetki eksikliği ifşa edilmez) |

---

## Modal ve Dialog Konvansiyonu

### State-modal yaklaşımı

Modal'lar URL routing ile değil, React state (Zustand veya local useState) ile yönetilir. Modal açık/kapalı durumu URL'e yansımaz. Gerekçe: SPA yapısında modal'ı URL'e bağlamak browser history karmaşıklığı yaratır ve deep-link ihtiyacı bu projede yoktur.

### Confirmation dialog pattern

Tüm destructive veya kritik işlemler (workflow transition, rol revoke, ayar değişikliği, dosya silme) `ConfirmDialog` bileşeni ile onaylanır.

```tsx
<ConfirmDialog
  open={showConfirm}
  title="Vakayı Gündeme Al"
  message="Bu vaka kurul gündemine alınacaktır. Devam etmek istiyor musunuz?"
  confirmLabel="Gündeme Al"
  cancelLabel="İptal"
  confirmColor="primary"         // Destructive işlemlerde "error"
  onConfirm={handleConfirm}
  onCancel={() => setShowConfirm(false)}
  loading={mutation.isPending}
/>
```

Destructive işlemlerde (kapatma, red, veto, revoke) confirm butonu kırmızı (`error` color) olur; yapıcı işlemlerde (onay, atama, gündeme alma) primary color kullanılır.

### Stacked modal yasağı

Bir modal açıkken üzerine ikinci modal açılmaz. Confirmation dialog + action modal birleşmesi gerekiyorsa, akış sıralı yapılır: önce action modal kapatılır, sonra confirmation açılır.

### Modal boyutları

| Boyut | Kullanım |
|---|---|
| `sm` (400px) | Basit confirmation, tek alan dialog |
| `md` (600px) | Form dialog (oy verme, mesaj gönderme, ayar düzenleme) |
| `lg` (800px) | Detaylı form (dosya upload, rol atama + gerekçe + maker-checker) |

Close davranışı: ESC tuşu ile kapatılır (form dirty ise confirmation istenir). Backdrop click ile kapatma: confirmation dialog'larda devre dışı; diğer modal'larda aktif.

---

## Accessibility

### Hedef

WCAG 2.1 Level AA uyumu zorunludur. Dış bildirim formu özellikle erişilebilir olmalıdır — etik bildirimi engelli kullanıcılar da yapabilmelidir.

### Klavye navigasyonu

Tüm interaktif elementler (buton, link, form alanı, dropdown, tab, modal) Tab tuşu ile erişilebilir olmalıdır. Focus sırası görsel sırayla uyumludur. Modal açıldığında focus modal içine kilitlenir (focus trap); modal kapandığında focus tetikleyen elemente döner.

### ARIA label kuralları

| Element | Kural |
|---|---|
| İkon butonları | `aria-label` zorunlu (örn: "Bildirimi indir", "Menüyü aç") |
| Form alanları | `<label>` veya `aria-labelledby` ile bağlı |
| Status badge'leri | `aria-label` ile durum metni (örn: "Vaka durumu: İnceleniyor") |
| DataTable | `aria-label` ile tablo açıklaması; sıralama butonlarında `aria-sort` |
| Modal | `aria-modal="true"`, `role="dialog"`, `aria-labelledby` ile başlık |
| Toast | `role="alert"`, `aria-live="polite"` |

### Color contrast

Minimum contrast ratio: normal metin 4.5:1, büyük metin 3:1. MUI theme'de tüm primary, secondary, error, warning, success renkleri bu orana uygun seçilir. Renk tek başına anlam taşımaz — status badge'leri renk + ikon + metin ile gösterilir.

### Screen reader test

Development sürecinde axe-core (eslint-plugin-jsx-a11y) ile otomatik kontrol yapılır. CI pipeline'da a11y lint kuralları zorunludur.

---

## Web Vitals Hedefleri

| Metric | Hedef | Ölçüm noktası |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5 sn | Bildirim formu ilk adım, vaka listesi |
| CLS (Cumulative Layout Shift) | < 0.1 | Tüm sayfalar |
| INP (Interaction to Next Paint) | < 200 ms | Buton tıklama, form submit, tab geçişi |
| Initial JS bundle (gzipped) | < 200 KB | Ana bundle (vendor hariç) |
| Total JS (gzipped, lazy dahil) | < 500 KB | Tüm route'lar yüklendikten sonra |

### Bundle optimization stratejisi

Route bazlı code splitting zorunludur: her layout grubu (`public-intake`, `anonymous-followup`, `internal`, `admin`) ayrı chunk olarak lazy load edilir. Admin ekranları iç kullanıcı bundle'ına dahil olmaz; ayrı chunk'ta yüklenir. Dış form bundle'ı mümkün olan en küçük boyutta tutulur — admin ve internal bileşenleri bu bundle'a sızmaz.

```tsx
// Route-level lazy loading
const ReportFormPage = lazy(() => import('./features/public-intake/pages/ReportFormPage'));
const CaseListPage = lazy(() => import('./features/internal/cases/pages/CaseListPage'));
const AdminUserListPage = lazy(() => import('./features/admin/users/pages/AdminUserListPage'));
```

### Performance izleme

Üçüncü taraf analytics/tracking script'leri public form ve anonim takip yüzeylerinde kullanılmaz. Web Vitals ölçümü self-hosted, içeriksiz server-side telemetry ile yapılır — `web-vitals` kütüphanesi kullanılabilir ancak veri gönderimi IP minimizasyonlu, anonim ve internal endpoint'e yapılır.

---

## Tarayıcı Desteği

| Tarayıcı | Minimum versiyon | Not |
|---|---|---|
| Chrome | Son 2 major | Evergreen, auto-update |
| Firefox | Son 2 major | Evergreen |
| Safari | 16+ | macOS ve iOS |
| Edge | Son 2 major | Chromium tabanlı |
| IE | Desteklenmez | Kullanılmaz |
| Samsung Internet | Son 2 major | Mobil responsive |

Polyfill stratejisi: `@vitejs/plugin-legacy` kullanılmaz — modern browser hedeflendiği için ES2020+ syntax ve API'ler doğrudan kullanılır. `browserslist` config: `"> 0.5%, last 2 versions, not dead, not IE 11"`.

---

## i18n

MVP'de uygulama dili yalnızca Türkçe'dir. Çok dilli yapı MVP kapsamına alınmaz.

Ancak string'ler i18n-ready pattern'de tutulur: kullanıcıya gösterilen tüm metin `const` veya enum dosyasından gelir, component içine hardcoded Türkçe metin yazılmaz. Bu yaklaşım ileride i18n kütüphanesi (react-intl, react-i18next) eklenmesini kolaylaştırır.

```typescript
// Doğru — merkezi string tanımı
export const LABELS = {
  caseList: {
    title: 'Vaka Listesi',
    emptyState: 'Görüntülenecek vaka bulunmuyor.',
    filterClear: 'Filtreleri Temizle',
  },
  // ...
} as const;

// Yanlış — hardcoded string
<Typography>Vaka Listesi</Typography>  // ❌
```

Error mesajları API'den döner (`error.message`); frontend bunları doğrudan gösterir. Frontend kendi error mesajı üretmez — tutarsızlık riski.

---

## Güvenlik Kuralları (Frontend Özeti)

Bu kurallar frontend kodunda zorunludur; ihlali code review'da reddedilir.

1. **localStorage / sessionStorage yasak.** Hiçbir uygulama verisi browser storage'a yazılmaz.

2. **Token frontend'de tutulmaz.** OIDC access token, refresh token veya session secret JavaScript ile erişilebilir alanda saklanmaz. Oturum yalnızca `HttpOnly` cookie ile korunur.

3. **CSRF token zorunlu.** Tüm mutating API çağrılarında `X-CSRF-Token` header gönderilir; API client interceptor bu header'ı otomatik ekler.

4. **Güvenlik yüzeyleri ayrı bundle.** Public intake, anonymous followup, internal operations ve admin console route'ları ayrı chunk'larda lazy load edilir. Admin bileşenleri public bundle'a sızmaz.

5. **Console.log'da PII yasak.** Development modunda bile bildirim metni, kişi bilgisi, tracking code parolası veya vaka içeriği console'a yazılmaz.

6. **Dış script yasak.** Google Analytics, Hotjar, Facebook Pixel veya herhangi bir üçüncü taraf tracking/analytics script'i public form ve anonim takip yüzeylerinde kullanılmaz. Internal yüzeylerde de yalnızca self-hosted telemetry kullanılır.

7. **Clipboard / download kontrolü.** Hassas vaka içeriği clipboard'a kopyalandığında veya dosya indirildiğinde backend audit event üretilir (signed URL TTL ve download audit).

8. **Auto-complete kapatma.** Tracking code parola alanı ve hassas form alanlarında `autocomplete="off"` set edilir.
