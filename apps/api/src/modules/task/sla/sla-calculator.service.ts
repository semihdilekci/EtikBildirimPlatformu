import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode, SlaUnit, type SlaUnitCode, type TaskTypeCode } from '@ethics/shared';
import type { Prisma } from '@prisma/client';

import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { BusinessCalendarService } from './business-calendar.service.js';

export type SlaDueCalculation = {
  dueAt: Date;
  slaPolicyId: string;
};

type SlaPolicyRecord = {
  id: string;
  slaDuration: number;
  slaUnit: string;
};

@Injectable()
export class SlaCalculatorService {
  constructor(private readonly businessCalendar: BusinessCalendarService) {}

  async calculateDueAt(
    client: Prisma.TransactionClient,
    taskType: TaskTypeCode,
    assignedAt: Date,
  ): Promise<SlaDueCalculation> {
    const policy = await this.findActivePolicy(client, taskType);

    const dueAt = await this.computeDueAt(client, policy, assignedAt);

    return {
      dueAt,
      slaPolicyId: policy.id,
    };
  }

  private async findActivePolicy(
    client: Prisma.TransactionClient,
    taskType: TaskTypeCode,
  ): Promise<SlaPolicyRecord> {
    const policy = await client.slaPolicyConfig.findFirst({
      where: {
        taskType,
        isActive: true,
      },
      select: {
        id: true,
        slaDuration: true,
        slaUnit: true,
      },
    });

    if (!policy) {
      throw new DomainException(
        ErrorCode.SLA_POLICY_NOT_FOUND,
        'Görev tipi için aktif SLA politikası bulunamadı.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return policy;
  }

  private async computeDueAt(
    client: Prisma.TransactionClient,
    policy: SlaPolicyRecord,
    assignedAt: Date,
  ): Promise<Date> {
    const slaUnit = policy.slaUnit as SlaUnitCode;

    if (slaUnit === SlaUnit.CALENDAR_HOURS) {
      return new Date(assignedAt.getTime() + policy.slaDuration * 60 * 60 * 1000);
    }

    const lookup = await this.businessCalendar.buildLookupForBusinessDaySpan(
      assignedAt,
      policy.slaDuration,
      client,
    );

    return this.businessCalendar.addBusinessDays(assignedAt, policy.slaDuration, lookup);
  }
}
