/**
 * Hoja de Ruta printable sheet — Functional Core
 *
 * Construye (función pura, sin efectos) el documento HTML imprimible de la
 * Hoja de Ruta Diaria de un vehículo (RF-091): grilla horaria 08:00–18:00
 * para que alumno/instructor registren rutina, kilometraje y firma en papel.
 *
 * El efecto de abrir la ventana e imprimir vive en `RouteSheetPrintService`.
 */

export interface RouteSheetPrintOptions {
  /** Patente del vehículo (opcional — si falta, se deja una línea en blanco). */
  licensePlate?: string | null;
  /** Marca/modelo/año del vehículo, mostrado entre paréntesis junto a la patente. */
  vehicleLabel?: string | null;
  /** Nombre del instructor a cargo (opcional). */
  instructorName?: string | null;
  /** Nombre de la sede, ya resuelto por el llamador (no un branchId crudo). */
  branchLabel?: string | null;
}

const ROUTE_HOURS = Array.from({ length: 11 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`);

/** Escapa caracteres especiales para evitar romper el HTML / inyección. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Campo del encabezado: valor escapado o línea en blanco para llenar a mano. */
function field(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return v ? escapeHtml(v) : '<span class="blank"></span>';
}

/**
 * Devuelve el HTML completo (documento) de la Hoja de Ruta lista para
 * imprimir. Pura: misma entrada → misma salida, sin tocar el DOM ni `window`.
 */
export function buildRouteSheetHtml(opts: RouteSheetPrintOptions = {}): string {
  const rows = ROUTE_HOURS.map(
    (hora) => `
      <tr class="sheet-row">
        <td class="col-hora center bold">${hora}</td>
        <td class="col-alumno"></td>
        <td class="col-actividad"></td>
        <td class="col-km"></td>
        <td class="col-firma"></td>
      </tr>`,
  ).join('');

  const plate = (opts.licensePlate ?? '').trim();
  const vehicleValue = plate
    ? `${escapeHtml(plate)}${opts.vehicleLabel ? ` (${escapeHtml(opts.vehicleLabel)})` : ''}`
    : '<span class="blank"></span>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Hoja de Ruta Diaria</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
    .sheet-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; border-bottom: 2px solid #000; padding-bottom: 1rem; }
    .sheet-logo { font-size: 1.4rem; font-weight: bold; }
    .sheet-header-right { text-align: right; font-size: 11px; line-height: 1.8; }
    .sheet-title { text-align: center; font-size: 1.1rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.25rem; }
    .sheet-info { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1.5rem; margin-bottom: 1.5rem; }
    .sheet-info-item { display: flex; gap: 0.5rem; align-items: baseline; }
    .sheet-label { font-weight: bold; white-space: nowrap; }
    .sheet-value, .sheet-value-empty { border-bottom: 1px dotted #000; flex: 1; min-height: 1.2em; }
    .blank { display: inline-block; min-width: 220px; border-bottom: 1px dotted #333; height: 1em; }
    .sheet-table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
    .sheet-table th, .sheet-table td { border: 1px solid #000; padding: 0.35rem 0.5rem; text-align: left; vertical-align: middle; }
    .sheet-table th { background: #f0f0f0; font-weight: bold; text-align: center; font-size: 11px; }
    .sheet-row { height: 40px; }
    .col-hora { width: 60px; }
    .col-alumno { width: 22%; }
    .col-km { width: 70px; }
    .col-firma { width: 14%; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .sheet-footer { border: 1px solid #000; padding: 0.75rem; min-height: 90px; }
    .sheet-footer-title { font-weight: bold; margin-bottom: 0.5rem; border-bottom: 1px solid #000; display: inline-block; padding-bottom: 0.25rem; }
    @media print {
      @page { margin: 1cm; size: A4; }
      body { margin: 0; padding: 1cm; }
      .sheet-row { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet-header">
    <div class="sheet-logo">Autoescuela Chillán</div>
    <div class="sheet-header-right">
      <div><strong>Sede:</strong> ${field(opts.branchLabel)}</div>
      <div><strong>Fecha:</strong> ____/____/______</div>
    </div>
  </div>

  <div class="sheet-title">HOJA DE RUTA DIARIA</div>

  <div class="sheet-info">
    <div class="sheet-info-item">
      <span class="sheet-label">Vehículo / Patente:</span>
      <span class="sheet-value">${vehicleValue}</span>
    </div>
    <div class="sheet-info-item">
      <span class="sheet-label">Kilometraje Inicial:</span>
      <span class="sheet-value-empty"></span>
    </div>
    <div class="sheet-info-item">
      <span class="sheet-label">Instructor a cargo:</span>
      <span class="sheet-value">${field(opts.instructorName)}</span>
    </div>
    <div class="sheet-info-item">
      <span class="sheet-label">Kilometraje Final:</span>
      <span class="sheet-value-empty"></span>
    </div>
  </div>

  <table class="sheet-table">
    <thead>
      <tr>
        <th class="col-hora">HORA</th>
        <th class="col-alumno">ALUMNO</th>
        <th>RUTINA / ACTIVIDAD</th>
        <th class="col-km">KM FINAL</th>
        <th class="col-firma">FIRMA ALUMNO</th>
      </tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>

  <div class="sheet-footer">
    <div class="sheet-footer-title">OBSERVACIONES / FALLAS MECÁNICAS DETECTADAS:</div>
  </div>
</body>
</html>`;
}
