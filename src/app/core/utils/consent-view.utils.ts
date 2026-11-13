// Reglas puras para MOSTRAR consentimientos (spec 0061-b).
//
// Cada escuela es una razón social distinta y un responsable de datos separado: el titular le da
// (o le niega, o le revoca) cada consentimiento a una escuela en particular (`consents.branch_id`).
// Por eso el portal muestra uno por escuela y no "el primero que aparece", que era lo que hacía
// antes y dejaba sin control el consentimiento ante la otra escuela.

import type { ConsentRow, ConsentType } from '@core/models/ui/consent.model';

/**
 * El consentimiento más reciente de `type` ante cada escuela, ordenado por escuela. Vale la última
 * expresión de voluntad ante cada responsable (spec 0040-b).
 */
export function latestConsentPerBranch(
  rows: readonly ConsentRow[],
  type: ConsentType,
): ConsentRow[] {
  const latest = new Map<number, ConsentRow>();
  for (const r of rows) {
    if (r.consentType !== type) continue;
    const current = latest.get(r.branchId);
    if (!current || Date.parse(r.grantedAt) > Date.parse(current.grantedAt)) {
      latest.set(r.branchId, r);
    }
  }
  return [...latest.values()].sort((a, b) => a.branchId - b.branchId);
}
