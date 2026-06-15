import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApprovalDecideDialog } from '@/features/tasks/components/ApprovalDecideDialog';

describe('ApprovalDecideDialog', () => {
  it('should submit approve decision with required reason', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ApprovalDecideDialog
        open
        mode="approve"
        isSubmitting={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /Onay gerekçesi/i }), {
      target: { value: 'Uygun bulundu.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Onayla' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        approved: true,
        reason: 'Uygun bulundu.',
      });
    });
  });

  it('should submit reject decision with required reason', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <ApprovalDecideDialog
        open
        mode="reject"
        isSubmitting={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /Red gerekçesi/i }), {
      target: { value: 'Eksik bilgi var.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reddet' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        approved: false,
        reason: 'Eksik bilgi var.',
      });
    });
  });
});
