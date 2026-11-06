/**
 * fix-070-i: texto de ayuda junto a "Continuar" en el paso 3 de la matrícula. Antes decía siempre
 * "Sube la foto carnet para continuar", también cuando lo que faltaba era la autorización
 * notarial del menor.
 *
 * @param hasCarnet       la foto carnet está lista (subida y confirmada)
 * @param pendingRequired documentos obligatorios que faltan, en el orden en que se muestran
 */
export function missingDocumentHint(
  hasCarnet: boolean,
  pendingRequired: readonly { label: string }[],
): string | null {
  if (!hasCarnet) return 'Sube la foto carnet para continuar';
  const first = pendingRequired[0];
  return first ? `Sube la ${first.label} para continuar` : null;
}
