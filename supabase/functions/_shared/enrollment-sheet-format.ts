// supabase/functions/_shared/enrollment-sheet-format.ts
//
// Textos de la Ficha de Matrícula (generate-enrollment-sheet) que dependen de un dato de la base.
// Funciones puras, para probarlas con `deno test` (fix-293-m).
// @ts-nocheck

/**
 * Concepto de un pago como lo ve el usuario. Mismo criterio que `mapConcepto()` de
 * `core/utils/payment-concept.utils.ts` (Deno no puede importar `src/app/`): antes el PDF
 * escribía el valor crudo de `payments.type` ("enrollment").
 */
export function conceptoPago(type: string | null | undefined): string {
  const value = type?.trim();
  if (!value) return 'Pago';
  switch (value.toLowerCase()) {
    case 'enrollment':
      return 'Matrícula';
    case 'online':
      return 'Online';
    default:
      return value;
  }
}

/**
 * Fecha de un pago, `dd-mm-aaaa`. `payments.payment_date` es una fecha sin hora ("2026-09-22"):
 * se reordena tal cual. Pasarla por `new Date()` la toma como medianoche UTC y, al mostrarla en
 * hora de Chile, retrocede un día (el pago del 22 salía como 21).
 */
export function fechaPago(date: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '-';
}

const PARTES = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Santiago',
});

/**
 * Fecha y hora del pie del documento, en hora de Chile: "04-10-2026, 00:10". Se arma por partes:
 * `toLocaleString('es-CL')` usa el reloj de 12 horas y separa "a. m." con un espacio que la fuente
 * del PDF no tiene (salía "12:10 a.?m.").
 */
export function fechaHoraGeneracion(iso: string): string {
  const parts = Object.fromEntries(
    PARTES.formatToParts(new Date(iso)).map((p) => [p.type, p.value.padStart(2, '0')]),
  );
  return `${parts.day}-${parts.month}-${parts.year}, ${parts.hour}:${parts.minute}`;
}
