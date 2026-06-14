import { type AdminActionCodeValue, type Role as RoleCode } from '@ethics/shared';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service.js';
import { DEFAULT_ACTION_MATRIX, type ActionMatrixEntry } from './default-action-matrix.js';

@Injectable()
export class ActionMatrixConfigService implements OnModuleInit {
  private entries = new Map<AdminActionCodeValue, ActionMatrixEntry>(
    DEFAULT_ACTION_MATRIX.map((entry) => [entry.actionCode, entry]),
  );

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    const configs = await this.prisma.actionMatrixConfig.findMany({
      where: { isActive: true },
    });

    if (configs.length === 0) {
      this.entries = new Map(DEFAULT_ACTION_MATRIX.map((entry) => [entry.actionCode, entry]));
      return;
    }

    const merged = new Map<AdminActionCodeValue, ActionMatrixEntry>(
      DEFAULT_ACTION_MATRIX.map((entry) => [entry.actionCode, entry]),
    );

    for (const config of configs) {
      merged.set(config.actionCode as AdminActionCodeValue, {
        actionCode: config.actionCode as AdminActionCodeValue,
        makerRole: config.makerRole as RoleCode,
        checkerRole: config.checkerRole as RoleCode,
      });
    }

    this.entries = merged;
  }

  listEntries(): readonly ActionMatrixEntry[] {
    return [...this.entries.values()];
  }

  getEntry(actionCode: AdminActionCodeValue): ActionMatrixEntry {
    const entry = this.entries.get(actionCode);
    if (!entry) {
      throw new Error(`Unknown admin action code: ${actionCode}`);
    }

    return entry;
  }
}

/** Test ortamı için DB'siz varsayılan matris servisi */
export function createDefaultActionMatrixConfigService(): ActionMatrixConfigService {
  return new ActionMatrixConfigService(null as unknown as PrismaService);
}
