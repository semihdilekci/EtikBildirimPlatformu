import { PrismaClient } from '@prisma/client';
import { PERMISSION_CODE_VALUES, ROLE_VALUES, Role } from '@ethics/policy';

const prisma = new PrismaClient();

const SUPERADMIN_EMAIL = 'superadmin@ethics.local';
const SUPERADMIN_DISPLAY_NAME = 'Platform Superadmin';
const SUPERADMIN_OIDC_SUB = process.env['SEED_SUPERADMIN_OIDC_SUB'] ?? 'seed-superadmin-oidc-sub';

const KVKK_VERSION_CODE = '1.0';

const DEFAULT_SYSTEM_SETTINGS = [
  {
    key: 'brute_force_max_attempts',
    value: 5,
    category: 'brute_force',
  },
  {
    key: 'brute_force_lockout_minutes',
    value: 15,
    category: 'brute_force',
  },
  {
    key: 'session_idle_timeout_minutes',
    value: 30,
    category: 'session',
  },
  {
    key: 'session_absolute_timeout_hours',
    value: 8,
    category: 'session',
  },
  {
    key: 'rate_limit_login_per_minute',
    value: 5,
    category: 'rate_limit',
  },
  {
    key: 'rate_limit_intake_per_minute',
    value: 10,
    category: 'rate_limit',
  },
  {
    key: 'rate_limit_tracking_per_minute',
    value: 20,
    category: 'rate_limit',
  },
  {
    key: 'rate_limit_upload_per_minute',
    value: 30,
    category: 'rate_limit',
  },
  {
    key: 'role_catalog',
    value: { roles: ROLE_VALUES },
    category: 'auth_cache',
  },
  {
    key: 'permission_catalog',
    value: { permissions: PERMISSION_CODE_VALUES },
    category: 'auth_cache',
  },
] as const;

async function seedKvkkConsentVersion(): Promise<void> {
  await prisma.kvkkConsentVersion.upsert({
    where: { versionCode: KVKK_VERSION_CODE },
    create: {
      versionCode: KVKK_VERSION_CODE,
      contentText:
        "Bu metin sentetik KVKK aydınlatma metni placeholder'ıdır (v1.0). " +
        'Gerçek hukuki metin Faz 10 admin ekranından yayınlanacaktır.',
      publishedAt: new Date(),
      isActive: true,
    },
    update: {
      isActive: true,
    },
  });
}

async function seedSystemSettings(): Promise<void> {
  for (const setting of DEFAULT_SYSTEM_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      create: {
        key: setting.key,
        value: setting.value,
        category: setting.category,
      },
      update: {
        value: setting.value,
        category: setting.category,
        isActive: true,
      },
    });
  }
}

async function seedSuperadmin(): Promise<void> {
  const superadmin = await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    create: {
      email: SUPERADMIN_EMAIL,
      displayName: SUPERADMIN_DISPLAY_NAME,
      oidcSubjectId: SUPERADMIN_OIDC_SUB,
      clearanceLevel: 'STRICTLY_CONFIDENTIAL',
      isGeneralSecretary: true,
      provisionedAt: new Date(),
      lastLoginAt: null,
    },
    update: {
      displayName: SUPERADMIN_DISPLAY_NAME,
      oidcSubjectId: SUPERADMIN_OIDC_SUB,
      isActive: true,
      clearanceLevel: 'STRICTLY_CONFIDENTIAL',
      isGeneralSecretary: true,
    },
  });

  const existingAdminRole = await prisma.userRole.findFirst({
    where: {
      userId: superadmin.id,
      roleCode: Role.ADMIN,
      isActive: true,
    },
  });

  if (!existingAdminRole) {
    await prisma.userRole.create({
      data: {
        userId: superadmin.id,
        roleCode: Role.ADMIN,
        assignedBy: superadmin.id,
        reason: 'Initial seed — platform superadmin bootstrap',
      },
    });
  }
}

async function main(): Promise<void> {
  await seedKvkkConsentVersion();
  await seedSystemSettings();
  await seedSuperadmin();
}

main()
  .then(() => {
    console.warn('[seed] Faz 1 seed tamamlandı (superadmin, KVKK v1, system_settings).');
  })
  .catch((error: unknown) => {
    console.error('[seed] Seed başarısız:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
