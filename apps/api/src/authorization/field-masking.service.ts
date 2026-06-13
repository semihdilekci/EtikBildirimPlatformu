import { CaseField, FieldVisibility, resolveFieldVisibilityForRoles } from '@ethics/policy';
import { Injectable } from '@nestjs/common';

import type { AuthenticatedUser } from '../common/types/authenticated-user.type.js';
import {
  CASE_CONTENT_FIELDS,
  CASE_FIELD_PROPERTY_MAP,
  CASE_MASKING_CONTEXT_PROPERTIES,
  CASE_METADATA_PROPERTIES,
} from './field-masking.constants.js';
import type { MaskableCaseData } from './field-masking.types.js';

@Injectable()
export class FieldMaskingService {
  private readonly managedPropertyKeys: ReadonlySet<string>;
  private readonly contextPropertyKeys: ReadonlySet<string>;

  constructor() {
    const managed = new Set<string>(CASE_MASKING_CONTEXT_PROPERTIES);
    for (const properties of Object.values(CASE_FIELD_PROPERTY_MAP)) {
      for (const property of properties) {
        managed.add(property);
      }
    }
    this.managedPropertyKeys = managed;
    this.contextPropertyKeys = new Set<string>(CASE_MASKING_CONTEXT_PROPERTIES);
  }

  /**
   * Vaka detay/liste yanıtında rol bazlı alan maskeleme uygular.
   * Yetkisiz alanlar yanıttan tamamen çıkarılır — null dönülmez.
   */
  applyCaseFieldPolicy<T extends MaskableCaseData>(user: AuthenticatedUser, data: T): T {
    const allowedManagedKeys = this.resolveAllowedManagedKeys(user, data);

    const result = {} as T;
    for (const [key, value] of Object.entries(data) as Array<[keyof T & string, T[keyof T]]>) {
      if (this.contextPropertyKeys.has(key)) {
        continue;
      }

      if (this.managedPropertyKeys.has(key) && !allowedManagedKeys.has(key)) {
        continue;
      }

      (result as Record<string, unknown>)[key] = value;
    }

    return result;
  }

  applyCaseFieldPolicyList<T extends MaskableCaseData>(
    user: AuthenticatedUser,
    items: readonly T[],
  ): T[] {
    return items.map((item) => this.applyCaseFieldPolicy(user, item));
  }

  private resolveAllowedManagedKeys(
    user: AuthenticatedUser,
    source: MaskableCaseData,
  ): ReadonlySet<string> {
    if (user.roles.length === 0) {
      return new Set<string>();
    }

    const allowed = new Set<string>();

    if (this.isMetadataAllowed(user)) {
      for (const property of CASE_METADATA_PROPERTIES) {
        allowed.add(property);
      }
    }

    for (const caseField of CASE_CONTENT_FIELDS) {
      if (!this.isContentFieldAllowed(user, caseField, source)) {
        continue;
      }

      for (const property of CASE_FIELD_PROPERTY_MAP[caseField]) {
        allowed.add(property);
      }
    }

    return allowed;
  }

  private isMetadataAllowed(user: AuthenticatedUser): boolean {
    const visibility = resolveFieldVisibilityForRoles(user.roles, CaseField.CASE_METADATA);
    return visibility === FieldVisibility.VISIBLE || visibility === FieldVisibility.METADATA_ONLY;
  }

  private isContentFieldAllowed(
    user: AuthenticatedUser,
    caseField: CaseField,
    source: MaskableCaseData,
  ): boolean {
    const visibility = resolveFieldVisibilityForRoles(user.roles, caseField);

    switch (visibility) {
      case FieldVisibility.VISIBLE:
        return true;
      case FieldVisibility.OWN_ONLY:
        return this.isOwnContentField(user, caseField, source);
      case FieldVisibility.METADATA_ONLY:
      case FieldVisibility.HIDDEN:
      default:
        return false;
    }
  }

  private isOwnContentField(
    user: AuthenticatedUser,
    caseField: CaseField,
    source: MaskableCaseData,
  ): boolean {
    switch (caseField) {
      case CaseField.RAPPORTEUR_REPORT:
        return source.assigned_rapporteur_id === user.id;
      case CaseField.ACTION_LETTER:
      case CaseField.ACTION_RESPONSE:
        return source.assigned_action_owner_id === user.id;
      default:
        return false;
    }
  }
}
