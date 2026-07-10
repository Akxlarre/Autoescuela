/**
 * Ficha Técnica printable report — Functional Core
 *
 * Construye (función pura, sin efectos) un documento HTML imprimible del
 * detalle de clases prácticas de un alumno Clase B. Se usa en el botón
 * "Imprimir Informe" de `AdminFichaTecnicaComponent`.
 *
 * El efecto de abrir la ventana e imprimir vive en `FichaTecnicaPrintService`.
 */
import type { ClasePracticaUI } from '@core/models/ui/alumno-detalle.model';

export interface FichaTecnicaPrintOptions {
  /** Nombre completo del alumno (opcional — si falta, se deja una línea en blanco). */
  studentName?: string | null;
  /** Matrícula del alumno (opcional). */
  matricula?: string | null;
}

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

function estadoBadge(clase: ClasePracticaUI): string {
  if (clase.ausente) {
    return clase.justificada
      ? '<span class="badge badge-ok">Inasistencia justificada</span>'
      : '<span class="badge badge-error">Inasistencia</span>';
  }
  if (clase.cancelada) {
    return '<span class="badge badge-warning">Cancelada — pendiente reagendar</span>';
  }
  return '';
}

function observacionesTexto(clase: ClasePracticaUI): string {
  const texto =
    clase.observaciones ||
    clase.justificacion ||
    (clase.ausente || clase.cancelada ? '' : 'Pendiente de sesión');
  return texto ? escapeHtml(texto) : '';
}

function kilometrajeTexto(clase: ClasePracticaUI): string {
  if (clase.kmInicio === null) return '-';
  const fin = clase.kmFin !== null ? clase.kmFin.toLocaleString('es-CL') : '?';
  return `${clase.kmInicio.toLocaleString('es-CL')} km &rarr; ${fin} km`;
}

function validacionTexto(clase: ClasePracticaUI): string {
  const alumno = clase.alumnoFirmo ? '&#9745;' : '&#9744;';
  const instructor = clase.instructorFirmo ? '&#9745;' : '&#9744;';
  return `${alumno} Alumno &nbsp; ${instructor} Instructor`;
}

/**
 * Devuelve el HTML completo (documento) del informe de Ficha Técnica listo
 * para imprimir. Pura: misma entrada → misma salida, sin tocar el DOM ni
 * `window`.
 */
export function buildFichaTecnicaPrintHtml(
  clases: ClasePracticaUI[],
  opts: FichaTecnicaPrintOptions = {},
): string {
  const rows = clases
    .map(
      (clase) => `
      <tr>
        <td class="num">#${clase.numero}</td>
        <td>${escapeHtml(clase.fecha ?? '-')}<br/><span class="muted">${escapeHtml(clase.hora ?? '-')}</span></td>
        <td>${escapeHtml(clase.instructor ?? 'Sin asignar')}</td>
        <td>${kilometrajeTexto(clase)}</td>
        <td>${estadoBadge(clase)}${estadoBadge(clase) ? '<br/>' : ''}${observacionesTexto(clase)}</td>
        <td class="center">${validacionTexto(clase)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ficha Técnica</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .subtitle { font-size: 12px; color: #444; margin: 0 0 16px; }
    .header { border: 1px solid #999; border-radius: 6px; padding: 12px 14px; margin-bottom: 16px; }
    .header .line { margin-bottom: 6px; }
    .header label { font-weight: bold; margin-right: 6px; }
    .blank { display: inline-block; min-width: 220px; border-bottom: 1px solid #333; height: 1em; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; vertical-align: top; border-bottom: 1px solid #ddd; text-align: left; font-size: 11px; }
    th { background: #f4f4f4; font-weight: bold; }
    td.num { font-weight: bold; }
    td.center { text-align: center; }
    .muted { color: #777; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
    .badge-error { background: #fde2e2; color: #a11; }
    .badge-warning { background: #fdf0d5; color: #a66a00; }
    .badge-ok { background: #e2f5e2; color: #1a7d1a; }
    @media print {
      @page { margin: 12mm; }
      body { margin: 0; padding-top: 6mm; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Ficha Técnica — Clases Prácticas</h1>
  <p class="subtitle">Desempeño en clases prácticas</p>

  <div class="header">
    <div class="line"><label>Alumno:</label> ${field(opts.studentName)}</div>
    <div class="line"><label>Matrícula:</label> ${field(opts.matricula)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>N°</th>
        <th>Fecha / Hora</th>
        <th>Instructor</th>
        <th>Kilometraje</th>
        <th>Observaciones</th>
        <th>Validación</th>
      </tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>

</body>
</html>`;
}
