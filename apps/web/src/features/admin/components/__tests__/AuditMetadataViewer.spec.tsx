import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AuditMetadataJsonViewer,
  AuditMetadataViewer,
} from '@/features/admin/components/AuditMetadataViewer';

describe('AuditMetadataViewer', () => {
  it('should display [REDACTED] for sensitive metadata fields', () => {
    render(
      <AuditMetadataViewer
        metadata={{
          resourceType: 'case',
          resourceId: 'case-123',
          reason_text: '[REDACTED]',
        }}
      />,
    );

    expect(screen.getByText('[REDACTED]')).toBeTruthy();
    expect(screen.queryByText('Gizli karar metni')).toBeNull();
  });

  it('should force [REDACTED] when sensitive field contains plaintext', () => {
    render(
      <AuditMetadataViewer
        metadata={{
          reason_text: 'Gizli karar metni',
          incident_description: 'Etik ihlal açıklaması',
        }}
      />,
    );

    const redactedNodes = screen.getAllByText('[REDACTED]');
    expect(redactedNodes.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Gizli karar metni')).toBeNull();
    expect(screen.queryByText('Etik ihlal açıklaması')).toBeNull();
  });
});

describe('AuditMetadataJsonViewer', () => {
  it('should sanitize plaintext ethical content in JSON output', () => {
    const { container } = render(
      <AuditMetadataJsonViewer
        metadata={{
          report_text: 'Hassas bildirim metni',
          policyDecisionId: 'pd-1',
        }}
      />,
    );

    const jsonText = container.textContent || '';
    expect(jsonText).toContain('[REDACTED]');
    expect(jsonText).not.toContain('Hassas bildirim metni');
    expect(jsonText).toContain('pd-1');
  });
});
