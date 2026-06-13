/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'auth',
        'authz',
        'workflow',
        'task',
        'document',
        'audit',
        'notification',
        'intake',
        'tracking',
        'admin',
        'crypto',
        'integration',
        'api',
        'ui',
        'db',
        'infra',
        'deps',
      ],
    ],
  },
};
