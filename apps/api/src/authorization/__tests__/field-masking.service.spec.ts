import { ClearanceLevel, Role } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { FieldMaskingService } from '../field-masking.service.js';
import type { MaskableCaseData } from '../field-masking.types.js';

describe('[AUTH-006] FieldMaskingPolicy', () => {
  const service = new FieldMaskingService();

  function buildUser(
    overrides: Partial<AuthenticatedUser> & Pick<AuthenticatedUser, 'roles'>,
  ): AuthenticatedUser {
    return {
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'Test User',
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
      companyId: 'company-1',
      companyName: 'Test Company',
      functionId: 'function-1',
      locationId: 'location-1',
      isGeneralSecretary: false,
      ...overrides,
    };
  }

  function buildMockCase(overrides: Partial<MaskableCaseData> = {}): MaskableCaseData {
    return {
      id: 'case-1',
      case_number: 'EB-2026-0001',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      company_id: 'company-1',
      company_name: 'Yıldız Holding',
      category: 'corruption',
      status: 'pre_review',
      workflow_state: 'PRE_REVIEW',
      confidentiality_level: ClearanceLevel.SENSITIVE,
      report_text: 'Bildirim metni — gizli içerik',
      incident_description: 'Olay açıklaması — gizli içerik',
      reporter_identity: { name: 'Anonim Bildirimci' },
      reporter_contact: { email: 'reporter@example.com' },
      incident_date: '2025-12-01',
      incident_location: 'İstanbul Merkez',
      involved_persons: [{ name: 'Kişi A' }],
      witnesses: [{ name: 'Tanık B' }],
      attachments: [{ id: 'doc-1', name: 'ek.pdf' }],
      pre_research_notes: 'Ön araştırma notu',
      rapporteur_report: 'Raportör raporu',
      council_decision_draft: 'Taslak karar',
      council_decision_final: 'Nihai karar',
      action_letter: 'Aksiyon mektubu',
      action_response: 'Aksiyon dönüşü',
      secure_messages: [{ id: 'msg-1', body: 'Güvenli mesaj' }],
      assigned_rapporteur_id: 'rapporteur-1',
      assigned_action_owner_id: 'owner-1',
      available_actions: ['case:pre_review'],
      ...overrides,
    };
  }

  it('[AUTH-006][R-007] admin rolü tüm içerik alanlarını yanıttan çıkarır', () => {
    const user = buildUser({ id: 'admin-1', roles: [Role.ADMIN] });
    const masked = service.applyCaseFieldPolicy(user, buildMockCase());

    expect(masked).toMatchObject({
      id: 'case-1',
      case_number: 'EB-2026-0001',
      category: 'corruption',
      status: 'pre_review',
      confidentiality_level: ClearanceLevel.SENSITIVE,
      available_actions: ['case:pre_review'],
    });

    expect(masked).not.toHaveProperty('report_text');
    expect(masked).not.toHaveProperty('incident_description');
    expect(masked).not.toHaveProperty('reporter_identity');
    expect(masked).not.toHaveProperty('rapporteur_report');
    expect(masked).not.toHaveProperty('action_letter');
    expect(masked).not.toHaveProperty('secure_messages');
    expect(masked).not.toHaveProperty('assigned_rapporteur_id');
    expect(masked).not.toHaveProperty('assigned_action_owner_id');
    expect(masked.report_text).toBeUndefined();
  });

  it('çoklu rolde operasyonel rol görünürlüğü admin kısıtını geçersiz kılar', () => {
    const user = buildUser({ roles: [Role.ADMIN, Role.COUNCIL_SECRETARY] });
    const source = buildMockCase();
    const masked = service.applyCaseFieldPolicy(user, source);

    expect(masked.report_text).toBe(source.report_text);
    expect(masked.secure_messages).toEqual(source.secure_messages);
  });

  it('council_secretary tüm vaka alanlarını görür', () => {
    const user = buildUser({ roles: [Role.COUNCIL_SECRETARY] });
    const source = buildMockCase();
    const masked = service.applyCaseFieldPolicy(user, source);

    expect(masked.report_text).toBe(source.report_text);
    expect(masked.incident_description).toBe(source.incident_description);
    expect(masked.reporter_identity).toEqual(source.reporter_identity);
    expect(masked.rapporteur_report).toBe(source.rapporteur_report);
    expect(masked.secure_messages).toEqual(source.secure_messages);
    expect(masked).not.toHaveProperty('assigned_rapporteur_id');
  });

  it('council_chair reporter_contact ve secure_messages alanlarını yanıta eklemez', () => {
    const user = buildUser({ roles: [Role.COUNCIL_CHAIR] });
    const source = buildMockCase();
    const masked = service.applyCaseFieldPolicy(user, source);

    expect(masked.report_text).toBe(source.report_text);
    expect(masked.reporter_identity).toEqual(source.reporter_identity);
    expect(masked).not.toHaveProperty('reporter_contact');
    expect(masked).not.toHaveProperty('secure_messages');
  });

  it('board_chair council_decision_draft alanını yanıta eklemez', () => {
    const user = buildUser({ roles: [Role.BOARD_CHAIR] });
    const source = buildMockCase();
    const masked = service.applyCaseFieldPolicy(user, source);

    expect(masked.council_decision_final).toBe(source.council_decision_final);
    expect(masked).not.toHaveProperty('council_decision_draft');
    expect(masked).not.toHaveProperty('reporter_identity');
    expect(masked).not.toHaveProperty('secure_messages');
  });

  it('council_member reporter_identity alanını yanıta eklemez', () => {
    const user = buildUser({ roles: [Role.COUNCIL_MEMBER] });
    const masked = service.applyCaseFieldPolicy(user, buildMockCase());

    expect(masked.report_text).toBeDefined();
    expect(masked).not.toHaveProperty('reporter_identity');
    expect(masked).not.toHaveProperty('reporter_contact');
    expect(masked).not.toHaveProperty('witnesses');
    expect(masked).not.toHaveProperty('pre_research_notes');
  });

  it('action_owner report_text alanını yanıta eklemez', () => {
    const user = buildUser({ id: 'owner-1', roles: [Role.ACTION_OWNER] });
    const masked = service.applyCaseFieldPolicy(user, buildMockCase());

    expect(masked).not.toHaveProperty('report_text');
    expect(masked).not.toHaveProperty('incident_description');
    expect(masked).not.toHaveProperty('involved_persons');
  });

  it('[AUTH-006][R-004] action_owner yalnızca atandığı vakada action_letter görür', () => {
    const assignedOwner = buildUser({ id: 'owner-1', roles: [Role.ACTION_OWNER] });
    const otherOwner = buildUser({ id: 'owner-2', roles: [Role.ACTION_OWNER] });
    const source = buildMockCase({ assigned_action_owner_id: 'owner-1' });

    const assignedMasked = service.applyCaseFieldPolicy(assignedOwner, source);
    const otherMasked = service.applyCaseFieldPolicy(otherOwner, source);

    expect(assignedMasked.action_letter).toBe(source.action_letter);
    expect(assignedMasked.action_response).toBe(source.action_response);
    expect(otherMasked).not.toHaveProperty('action_letter');
    expect(otherMasked).not.toHaveProperty('action_response');
  });

  it('rapporteur yalnızca atandığı vakada rapporteur_report görür', () => {
    const assignedRapporteur = buildUser({ id: 'rapporteur-1', roles: [Role.RAPPORTEUR] });
    const otherRapporteur = buildUser({ id: 'rapporteur-2', roles: [Role.RAPPORTEUR] });
    const source = buildMockCase({ assigned_rapporteur_id: 'rapporteur-1' });

    const assignedMasked = service.applyCaseFieldPolicy(assignedRapporteur, source);
    const otherMasked = service.applyCaseFieldPolicy(otherRapporteur, source);

    expect(assignedMasked.rapporteur_report).toBe(source.rapporteur_report);
    expect(assignedMasked).not.toHaveProperty('council_decision_draft');
    expect(assignedMasked).not.toHaveProperty('council_decision_final');
    expect(otherMasked).not.toHaveProperty('rapporteur_report');
  });

  it('rolsüz kullanıcı hiçbir vaka alanını görmez', () => {
    const user = buildUser({ roles: [] });
    const masked = service.applyCaseFieldPolicy(user, buildMockCase());

    expect(masked).not.toHaveProperty('id');
    expect(masked).not.toHaveProperty('case_number');
    expect(masked).not.toHaveProperty('report_text');
    expect(masked.available_actions).toEqual(['case:pre_review']);
  });

  it('applyCaseFieldPolicyList her öğeye maskeleme uygular', () => {
    const user = buildUser({ roles: [Role.ADMIN] });
    const items = [
      buildMockCase({ id: 'case-1' }),
      buildMockCase({ id: 'case-2', case_number: 'EB-2026-0002' }),
    ];

    const masked = service.applyCaseFieldPolicyList(user, items);

    expect(masked).toHaveLength(2);
    expect(masked[0]).not.toHaveProperty('report_text');
    expect(masked[1]).toMatchObject({ id: 'case-2', case_number: 'EB-2026-0002' });
    expect(masked[1]).not.toHaveProperty('report_text');
  });
});
