// Filtrado y selección masiva de destinatarios (spec 0043-b).
//
// LA REGLA QUE ORDENA TODO ESTO: **FILTRAR NO ES EXCLUIR.**
//
// El buscador cambia QUÉ SE VE; a quién le llega el comunicado lo deciden las exclusiones
// manuales, que son otra cosa. Si el alcance bajara al escribir en el buscador, la
// secretaria mandaría de menos sin darse cuenta. Mismo criterio que `ex-alumnos-content`,
// donde buscar ignora el filtro de período a propósito: un filtro que esconde lo que estás
// buscando se siente roto.

import type { RecipientPreview } from '@core/models/ui/announcement.model';

export type BulkAction = 'quitar' | 'incluir';

/** Sin acentos y en minúsculas, para que buscar "benjamin" encuentre "Benjamín". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Filtra por nombre. Solo afecta la vista: el resultado NUNCA se usa para calcular el
 * alcance del envío.
 */
export function filterRecipients(
  recipients: readonly RecipientPreview[],
  term: string,
): RecipientPreview[] {
  const needle = normalize(term.trim());
  if (needle.length === 0) return [...recipients];

  return recipients.filter((r) => normalize(r.name).includes(needle));
}

/**
 * Cuántos van a recibir el comunicado. Se calcula SIEMPRE sobre la lista completa, nunca
 * sobre la filtrada (AC-E1).
 */
export function includedCount(recipients: readonly RecipientPreview[]): number {
  return recipients.filter((r) => r.included).length;
}

/**
 * Aplica una acción masiva y devuelve la nueva lista de excluidos manualmente.
 *
 * `visible` es el subconjunto sobre el que la acción opera de verdad: con un filtro activo,
 * "quitar" toca solo lo que la persona está viendo (AC-E3). Un botón que dice "todos" y
 * afecta a 185 cuando en pantalla hay 12 es una trampa; por eso la UI nombra el número.
 *
 * Quien está fuera por falta de consentimiento no vuelve con un botón: esa exclusión no la
 * decide la secretaria, la decide el alumno.
 */
export function applyBulkAction(
  all: readonly RecipientPreview[],
  visible: readonly RecipientPreview[],
  action: BulkAction,
  currentlyExcluded: readonly number[],
): number[] {
  const excluded = new Set(currentlyExcluded);
  const elegibles = visible.filter((r) => r.exclusionReason !== 'sin_consentimiento');

  for (const recipient of elegibles) {
    if (action === 'quitar') excluded.add(recipient.userId);
    else excluded.delete(recipient.userId);
  }

  // Nunca se agrega a la lista manual a quien ya está fuera por consentimiento: duplicaría
  // el motivo y confundiría el conteo de exclusiones.
  const porConsentimiento = new Set(
    all.filter((r) => r.exclusionReason === 'sin_consentimiento').map((r) => r.userId),
  );

  return [...excluded].filter((id) => !porConsentimiento.has(id));
}

/**
 * Los que NO van a recibir el comunicado, con su motivo. Existe para poder revisar las
 * exclusiones sin recorrer una lista de cientos (AC5).
 */
export function onlyExcluded(
  recipients: readonly RecipientPreview[],
  excludedUserIds: readonly number[],
): RecipientPreview[] {
  const manual = new Set(excludedUserIds);

  return recipients
    .filter((r) => manual.has(r.userId) || r.exclusionReason === 'sin_consentimiento')
    .map((r) =>
      r.exclusionReason === 'sin_consentimiento'
        ? r
        : { ...r, included: false, exclusionReason: 'excluido_manualmente' as const },
    );
}
