// supabase/functions/_shared/certificate-debt.ts
//
// Spec 0010-i (AC8) + fix-466-m: un certificado (Clase B o Profesional) de una matrícula con saldo
// pendiente solo se emite si existe una habilitación explícita con motivo
// (`enrollment_payment_overrides`, kind 'certificado'), que la secretaria o el admin registran al
// confirmar en la UI. Vale para todos los roles: el bypass `force` de clases incompletas de
// Clase B NO salta este gate (son dos decisiones distintas).

/** Cliente mínimo que usa el gate (permite testearlo sin Supabase). */
export interface OverrideCounter {
  countCertificateOverrides(enrollmentId: number): Promise<{ count: number; error: string | null }>;
}

export type CertificateDebtVerdict =
  | { ok: true }
  | { ok: false; status: number; body: { error: string; code?: string } };

export async function checkCertificateDebt(
  db: OverrideCounter,
  enrollmentId: number,
  pendingBalance: number | null | undefined,
): Promise<CertificateDebtVerdict> {
  const saldo = Number(pendingBalance ?? 0);
  if (!(saldo > 0)) return { ok: true };

  const { count, error } = await db.countCertificateOverrides(enrollmentId);
  if (error) {
    return { ok: false, status: 500, body: { error: `Error al validar el saldo: ${error}` } };
  }
  if (count > 0) return { ok: true };

  return {
    ok: false,
    status: 409,
    body: {
      error: `El alumno tiene un saldo pendiente de $${new Intl.NumberFormat('es-CL').format(saldo)}.`,
      // `code` permite a la UI pedir la confirmación con motivo en vez de mostrar un error.
      code: 'DEUDA_PENDIENTE',
    },
  };
}

/** Adaptador sobre el cliente de Supabase (service_role). */
// deno-lint-ignore no-explicit-any
export function overrideCounterFrom(supabase: any): OverrideCounter {
  return {
    async countCertificateOverrides(enrollmentId: number) {
      const { count, error } = await supabase
        .from('enrollment_payment_overrides')
        .select('id', { count: 'exact', head: true })
        .eq('enrollment_id', enrollmentId)
        .eq('kind', 'certificado');
      return { count: count ?? 0, error: error?.message ?? null };
    },
  };
}
