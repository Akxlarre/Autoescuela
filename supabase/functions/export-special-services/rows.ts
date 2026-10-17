// supabase/functions/export-special-services/rows.ts
//
// Núcleo puro del export del Historial de ventas (fix-440-m): columnas, filas y total. Lo usan el
// Excel y el PDF, así los dos salen iguales.

export const EXPORT_HEADERS = [
  'Fecha',
  'Cliente',
  'RUT',
  'Servicio',
  'N° boleta',
  'Medio de pago',
  'Monto',
  'Sede',
  'Anulación',
] as const;

export interface VentaExport {
  sale_date: string | null;
  client_name: string | null;
  client_rut: string | null;
  /** Nombre guardado al vender (fix-024-i): sobrevive a renombrar o borrar el servicio. */
  service_name: string | null;
  service_catalog?: { name: string | null } | null;
  document_number: string | null;
  payment_method: string | null;
  price: number;
  branches?: { name: string | null } | null;
  /** fix-443-m: 'anulado' si la venta se anuló; sale en el export, fuera del total. */
  status?: string | null;
  void_reason?: string | null;
}

/** fix-443-m: mismo token que un pago anulado. */
const ANULADO = 'anulado';

/** Texto de la columna Anulación: vacío si la venta está vigente. */
function textoAnulacion(v: VentaExport): string {
  if (v.status !== ANULADO) return '';
  const motivo = v.void_reason?.trim();
  return motivo ? `Anulada: ${motivo}` : 'Anulada';
}

const MEDIOS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

/** 'YYYY-MM-DD' → 'DD-MM-YYYY' (fecha pura, sin zona). */
function fechaCorta(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? '';
  return `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
}

/**
 * Filas y total del export. Una venta anulada (fix-443-m) se lista con su motivo en la columna
 * Anulación, pero no suma en el total ni cuenta en `vigentes`.
 */
export function exportRows(ventas: readonly VentaExport[]): {
  rows: (string | number)[][];
  total: number;
  vigentes: number;
} {
  const rows = ventas.map((v) => [
    fechaCorta(v.sale_date),
    v.client_name ?? '',
    v.client_rut ?? '',
    v.service_name ?? v.service_catalog?.name ?? '',
    v.document_number ?? '',
    MEDIOS[v.payment_method ?? ''] ?? '',
    v.price,
    v.branches?.name ?? '',
    textoAnulacion(v),
  ]);
  const cuentan = ventas.filter((v) => v.status !== ANULADO);
  const total = cuentan.reduce((sum, v) => sum + v.price, 0);
  return { rows, total, vigentes: cuentan.length };
}

/**
 * Ids de las ventas que muestra la pantalla. null si el body no trae una lista válida (la función
 * responde 400): sin ids no se exporta "todo", que era el comportamiento que se quiso quitar.
 */
export function parseSaleIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((id) => Number.isInteger(id) && (id as number) > 0)) return null;
  return [...new Set(value as number[])];
}
