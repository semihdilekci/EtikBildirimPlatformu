export function formatCaseDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

export function formatCaseDate(isoDate: string): string {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(isoDate));
}

export function formatShortCaseId(caseId: string): string {
  return caseId.slice(0, 8).toUpperCase();
}

export function dateInputToStartIso(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

export function dateInputToEndIso(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

export function isoToDateInput(isoDate: string | undefined): string {
  if (!isoDate) {
    return '';
  }
  return isoDate.slice(0, 10);
}
