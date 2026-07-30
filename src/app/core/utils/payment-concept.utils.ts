export function mapConcepto(type: string | null | undefined): string | null {
  if (!type) return null;
  switch (type.toLowerCase()) {
    case 'enrollment':
      return 'Matrícula';
    case 'online':
      return 'Online';
    default:
      return type;
  }
}
