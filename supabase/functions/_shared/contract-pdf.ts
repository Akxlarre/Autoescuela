// supabase/functions/_shared/contract-pdf.ts
//
// Shared PDF generation utilities for contract documents.
// Used by: generate-contract-pdf, public-enrollment (preview action).

import { escapePdfWinAnsi, assemblePdf } from './pdf-utils.ts';

// ─── Types ───

export interface EnrollmentData {
  id: number;
  number: string | null;
  base_price: number | null;
  discount: number;
  /** `enrollments.total_paid` — mantenido por trigger. Para la cláusula QUINTA real ("paga en
   * este acto la cantidad de..."). */
  total_paid?: number | null;
  /** `enrollments.pending_balance` — mantenido por trigger. Para "quedando un saldo de...". */
  pending_balance?: number | null;
  /** `enrollments.payment_mode` — elegido en el paso 2, antes de que exista el pago real (que
   * recién llega después del paso 5/contrato). "partial" = 50% ahora, "total" = 100% ahora. Sirve
   * para prever el monto de la cláusula QUINTA cuando `total_paid` todavía es 0 porque el pago no
   * se ha registrado — sin esto, un contrato generado antes de pagar mostraba literalmente $0. */
  payment_mode?: 'total' | 'partial' | null;
  created_at: string;
  student: {
    birth_date: string | null;
    address: string | null;
    user: {
      rut: string;
      first_names: string;
      paternal_last_name: string;
      maternal_last_name: string | null;
      email: string;
      phone: string | null;
    };
  };
  course: {
    name: string;
    license_class: string;
    duration_weeks: number | null;
    practical_hours: number | null;
    theory_hours: number | null;
  };
  branch: {
    name: string;
    address: string | null;
    /** `branches.slug` — arma el enlace a la política de privacidad de ESA sociedad. */
    slug?: string | null;
    /** Canal de ejercicio de derechos (Art. 14 ter). */
    email?: string | null;
    /** Fono del membrete (`branches.phone`). */
    phone?: string | null;
  };
  convalidation: {
    convalidated_license: 'A4' | 'A3';
    reduced_hours: number;
  } | null;
}

/**
 * Identidad legal y sitio comercial por sede. Se imprimen en el contrato firmado, así que el
 * alumno los lee en papel: corregirlos después NO arregla los contratos ya emitidos.
 *
 * `legalName`/`rut` replican los mismos valores de `PRIVACY_POLICIES` en
 * `core/models/ui/privacy-policy.model.ts` (Angular no es accesible desde este runtime Deno).
 * Si se corrige uno, corregir el otro. `website` (para el membrete, "WWW.___") confirmado contra
 * `website_config.config.brand.domain` (`20260522000000_create_website_config.sql`): branch_id 1 =
 * autoescuelachillan.cl, branch_id 2 = conductoreschillan.cl. **No es** el dominio donde vive la app
 * ni la ruta `/politica-privacidad` — ver `APP_BASE_URL`.
 */
const BRANCH_LEGAL: Record<string, { legalName: string; rut: string; website: string }> = {
  'conductores-chillan': {
    legalName: 'Sociedad Comercial Chillán Capacita Ltda.',
    rut: '77.940.120-0',
    website: 'www.conductoreschillan.cl',
  },
  'autoescuela-chillan': {
    legalName: 'Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL',
    rut: '76.007.217-6',
    website: 'www.autoescuelachillan.cl',
  },
};

/**
 * Dominio donde vive la app (Angular SPA), distinto de los sitios comerciales estáticos de
 * `BRANCH_LEGAL.website`. Se imprime como enlace a la Política de Privacidad.
 *
 * ⚠️ **PENDIENTE DE CONFIRMAR (18-08-2026).** Valor deducido, no confirmado por el negocio. Fijar
 * antes de emitir el primer contrato real — después no arregla los ya emitidos.
 */
const APP_BASE_URL = 'https://autoescuelachillan.cl';

/**
 * Representante legal de ambas sociedades (mismo Sr. en los dos contratos físicos reales de
 * Conductores Chillán usados de referencia — folio 3564 Clase B y folio 4686 Profesional A4 — y
 * coincide con que la razón social de Autoescuela Chillán lleva su nombre). No se guarda en
 * `branches`: no hay otro representante hoy.
 */
const LEGAL_REPRESENTATIVE = { name: 'Jorge Pérez Godoy', rut: '7.271.517-9' };

function branchLegal(slug: string | null | undefined) {
  return slug && BRANCH_LEGAL[slug] ? BRANCH_LEGAL[slug] : { legalName: '', rut: '', website: '' };
}

// ─── Helpers ───

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** "viernes, 24 de julio de 2026" — formato usado en la identificación de partes del contrato real. */
export function formatDateWeekday(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const weekday = d.toLocaleDateString('es-CL', { weekday: 'long' });
  return `${weekday}, ${formatDate(dateStr)}`;
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '$0';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

/** "Carrera 74, Chillán" → "Carrera 74" — el membrete y la identificación de partes del físico
 * nunca repiten la ciudad ahí (la ciudad va aparte, en "de la ciudad de Chillán"). */
function streetOnly(address: string | null | undefined): string {
  return (address ?? '').split(',')[0].trim();
}

/** "+56 42 224 4030" → "422244030" — el membrete físico imprime el fono en dígitos corridos,
 * sin el código de país ni espacios (`branches.phone` en BD sí los trae, ver fix-190-m). */
function localPhoneDigits(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.startsWith('56') && digits.length > 9 ? digits.slice(2) : digits;
}

import type { AnyPdfImage } from './pdf-utils.ts';
import { textWidth, loadImageForPdf } from './pdf-utils.ts';

/**
 * Intenta obtener la foto carnet del alumno (subida en un paso previo del wizard — ver
 * `moveCarnetPhoto` en `public-enrollment/index.ts` — a `students/{enrollmentId}/id_photo`) para
 * estampar en la esquina superior derecha del contrato, igual que el físico. Best-effort: si no
 * existe (aún no se subió, u otro flujo que no la genera) o el signed URL falla, retorna `null` y
 * el contrato se genera igual sin la foto — nunca bloquea la emisión.
 */
export async function tryLoadIdPhoto(
  supabase: any,
  enrollmentId: number,
): Promise<AnyPdfImage | null> {
  try {
    const { data: signed } = await supabase.storage
      .from('documents')
      .createSignedUrl(`students/${enrollmentId}/id_photo`, 60);
    if (!signed?.signedUrl) return null;
    return await loadImageForPdf(signed.signedUrl, 300, 400);
  } catch {
    return null;
  }
}

/**
 * Builds the contract PDF replicando el layout y el texto del contrato físico real que la
 * escuela hace firmar en papel (fix-192-m). Dos variantes según `course.license_class`:
 *
 * - **Clase B**: referencia = folio 3564, Conductores Chillán, 24-07-2026.
 * - **Profesional (A2/A4)**: referencia = folio 4686, Conductores Chillán, 28-05-2026. Para A3/A5
 *   solo cambia la duración del curso (160 h en vez de 150 h, cláusula SEGUNDA) — confirmado por
 *   el dueño; el resto del texto profesional se asume igual hasta que se confirme lo contrario.
 *
 * Huecos de datos conocidos (el físico trae campos que `EnrollmentData` no modela hoy — no se
 * fabrican, se omiten de la prosa en vez de inventar un valor):
 * - Nº de boleta y monto abonado al firmar (cláusula económica usa precio total/neto en su lugar).
 * - Nivel educacional del alumno (Clase B) y licencia previa + fecha de otorgamiento (Profesional).
 * - Funcionario responsable de caja (cláusula QUINTA profesional real).
 *
 * **Logo del sello "Ch"** (esquina superior izquierda): se reutiliza el mismo asset que ya usan
 * `generate-certificate-b-pdf`, `generate-certificate-professional-pdf` y
 * `generate-student-license-pdf` — `LOGO_URL` en cada uno de esos archivos, apuntando al bucket
 * público `assets` de Storage (`chillan_capacita.png`). No estaba en el repo como archivo local;
 * estaba en Storage, usado por 3 Edge Functions más. El caller debe hacer
 * `await loadPngForPdf(LOGO_URL)` y pasarlo acá — este módulo no conoce esa URL para no duplicar
 * la constante una cuarta vez (si cambia, hoy hay que tocar 3 archivos; no se agrega un cuarto).
 */
export function buildStructuredPdf(
  data: EnrollmentData,
  signature?: AnyPdfImage | null,
  /** Foto carnet del alumno (`students/{enrollmentId}/id_photo`), esquina superior derecha —
   * mismo lugar que el físico. Best-effort: si no llega, el layout no reserva un hueco vacío. */
  idPhoto?: AnyPdfImage | null,
  /** Logo/sello de la escuela, esquina superior izquierda — ver `LOGO_URL` en el docblock. */
  logo?: AnyPdfImage | null,
): Uint8Array {
  const u = data.student.user;
  // Orden real del físico (folio 3564: "VENEGAS ESPINOSA VANESSA BELÉN"): apellido paterno,
  // apellido materno, nombres — no "nombres + apellidos" como va en el resto de la UI del sistema.
  const fullName =
    `${u.paternal_last_name}${u.maternal_last_name ? ' ' + u.maternal_last_name : ''} ${u.first_names}`.trim();
  const netPrice = (data.base_price ?? 0) - data.discount;
  const isClassB = data.course.license_class === 'B';
  const legal = branchLegal(data.branch.slug);
  const brandName = data.branch.name;
  const repFull = `el Sr. ${LEGAL_REPRESENTATIVE.name}`;

  const W = 595,
    H = 842;
  const ML = 55,
    MR = 55,
    MB = 38;

  const pages: string[] = [];
  let ops = '';
  let y = H - 50;

  const NP = () => {
    pages.push(ops);
    ops = '';
    y = H - 50;
  };
  const need = (h: number) => {
    if (y - h < MB) NP();
  };

  const T = (x: number, yp: number, text: string, f: 'F1' | 'F2', size: number) => {
    ops += `BT /${f} ${size} Tf ${x} ${Math.round(yp)} Td (${escapePdfWinAnsi(text)}) Tj ET\n`;
  };

  /** Dibuja una línea justificada posicionando CADA PALABRA a mano (Td relativo palabra a
   * palabra) en vez de usar el operador `Tw` (word-spacing). `Tw` es PDF estándar, pero no todos
   * los pipelines que rasterizan un PDF a imagen lo respetan (algunos generadores de miniatura
   * simplificados lo ignoran) — posicionar cada palabra explícitamente no depende de que el lector
   * interprete `Tw`, así que el resultado es idéntico en cualquier visor/rasterizador. */
  const TJustifiedLine = (
    x: number,
    yp: number,
    line: string,
    size: number,
    targetWidth: number,
  ) => {
    const words = line.split(' ');
    if (words.length < 2) {
      T(x, yp, line, 'F1', size);
      return;
    }
    const wordWidths = words.map((w) => textWidth(w, size, false));
    const totalWordsWidth = wordWidths.reduce((a, b) => a + b, 0);
    const gap = (targetWidth - totalWordsWidth) / (words.length - 1);
    let block = `BT /F1 ${size} Tf ${x} ${Math.round(yp)} Td (${escapePdfWinAnsi(words[0])}) Tj`;
    for (let i = 1; i < words.length; i++) {
      const dx = wordWidths[i - 1] + gap;
      block += ` ${dx.toFixed(3)} 0 Td (${escapePdfWinAnsi(words[i])}) Tj`;
    }
    ops += block + ' ET\n';
  };

  /** Texto centrado horizontalmente entre los márgenes (el membrete real está centrado). */
  const TC = (yp: number, text: string, f: 'F1' | 'F2', size: number) => {
    const w = textWidth(text, size, f === 'F2');
    T((W - w) / 2, yp, text, f, size);
    return w;
  };

  const HL = (yp: number, lw = 0.4, x1 = ML, x2 = W - MR) => {
    ops += `${lw} w ${x1} ${Math.round(yp)} m ${x2} ${Math.round(yp)} l S\n`;
  };

  /** Texto centrado + subrayado ajustado a SU ancho (no al ancho de la página) — así se ven el
   * nombre de la escuela y el subtítulo en el físico, cada uno con su propia línea. */
  const TCU = (yp: number, text: string, f: 'F1' | 'F2', size: number) => {
    const w = TC(yp, text, f, size);
    HL(yp - 2, 0.5, (W - w) / 2, (W + w) / 2);
  };

  /** Ancho imprimible entre márgenes — el objetivo al que se ajusta y justifica cada línea. */
  const TEXT_WIDTH = W - ML - MR;

  /** Envuelve por ANCHO REAL en puntos (`textWidth`), no por conteo de caracteres. El wrap por
   * caracteres (`wrapLines` de `pdf-utils.ts`) deja líneas con un ancho renderizado muy variable
   * —Helvetica no es monoespaciada, una línea de "iiiii" y otra de "WWWWW" con el mismo conteo de
   * caracteres pesan pixeles muy distintos— así que la mayoría de las líneas necesitaban estirarse
   * mucho más de lo razonable para justificar, y el tope de seguridad las dejaba sin justificar.
   * Envolviendo por ancho real, cada línea ya llega casi llena: el `Tw` que hace falta después es
   * chico y parejo. */
  const wrapToWidth = (text: string, maxWidth: number, size: number): string[] => {
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (line && textWidth(candidate, size, false) > maxWidth) {
        lines.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  /** Dibuja un bloque de líneas ya envueltas, justificado a ambos márgenes (como el físico) salvo
   * la última línea del bloque, que queda alineada a la izquierda por convención tipográfica —
   * igual que el propio documento físico: la última línea de cada cláusula también es corta ahí. */
  const drawJustified = (lines: string[], size: number, LH: number) => {
    lines.forEach((line, i) => {
      need(LH);
      const isLast = i === lines.length - 1;
      if (isLast) T(ML, y, line, 'F1', size);
      else TJustifiedLine(ML, y, line, size, TEXT_WIDTH);
      y -= LH;
    });
  };

  /** Párrafo corrido justificado (identificación de partes, no es una cláusula). */
  const paragraph = (text: string, size = 10) => {
    drawJustified(wrapToWidth(text, TEXT_WIDTH, size), size, 12.5);
    y -= 5;
  };

  const clause = (title: string, body: string) => {
    const LH = 12.5;
    need(LH * 2 + 5);
    T(ML, y, title, 'F2', 10);
    y -= LH;
    drawJustified(wrapToWidth(body, TEXT_WIDTH, 10), 10, LH);
    y -= 5;
  };

  /** Encaja `img` dentro de una caja `maxW×maxH` preservando su proporción original (nunca la
   * deforma) — el bug que hac\xEDa ver estirada/aplastada cualquier foto o el logo. */
  const fitContain = (img: AnyPdfImage, maxW: number, maxH: number) => {
    const ratio = img.width / img.height || 1;
    let w = maxW,
      h = maxW / ratio;
    if (h > maxH) {
      h = maxH;
      w = maxH * ratio;
    }
    return { w, h };
  };

  /** Dibuja `img` dentro de una caja ancla en la esquina superior (top-left o top-right), sin
   * invadir nunca el alto de la caja — retorna el Y donde termina (para reservar espacio real). */
  const drawImageTopAnchored = (
    name: 'Im1' | 'Im3',
    img: AnyPdfImage,
    boxX: number,
    boxTopY: number,
    maxW: number,
    maxH: number,
    align: 'left' | 'right',
  ): number => {
    const { w, h } = fitContain(img, maxW, maxH);
    const x = align === 'left' ? boxX : boxX + (maxW - w);
    const drawY = boxTopY - h;
    ops += `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${drawY.toFixed(2)} cm /${name} Do Q\n`;
    return drawY;
  };

  // ─── Membrete (todo en MAYÚSCULAS y subrayado, como el físico) ───
  // Tres columnas independientes (logo | nombre/subtítulo/contacto | foto+folio), cada una con su
  // propio alto. La regla y el título recién se dibujan bajo la MÁS BAJA de las tres — así ninguna
  // imagen invade nunca el párrafo de identificación de partes que viene después.
  need(155);
  const headerTop = y + 6;
  let headerBottom = y;

  // Columna izquierda: logo/sello. Alto fijo (como en los otros generadores que ya usan este
  // mismo logo — `generate-certificate-b-pdf` usa logoH=70) y ancho libre según su proporción real
  // (~2.18:1, landscape) — limitarlo también en ancho lo dejaba "enano" (una franja de 62×28).
  if (logo) {
    const logoBottom = drawImageTopAnchored('Im1', logo, ML, headerTop, 150, 52, 'left');
    headerBottom = Math.min(headerBottom, logoBottom);
  }

  // Columna central: nombre + subtítulo + contacto (angosta para no chocar con logo/foto).
  TCU(y, brandName.toUpperCase(), 'F2', 13);
  y -= 22;
  TCU(
    y,
    isClassB ? 'ESCUELA DE CONDUCTORES NO PROFESIONALES' : 'ESCUELA DE CONDUCTORES PROFESIONALES',
    'F2',
    10,
  );
  y -= 18;
  const contactLine = [
    streetOnly(data.branch.address).toUpperCase(),
    data.branch.phone && `FONO ${localPhoneDigits(data.branch.phone)}`,
    legal.website.toUpperCase(),
  ]
    .filter(Boolean)
    .join('   ');
  TC(y, contactLine, 'F1', 8);
  y -= 10;
  headerBottom = Math.min(headerBottom, y);

  // Columna derecha: foto carnet, y el folio (Nº de matrícula) DEBAJO de ella — igual que el
  // físico (folio 3564: el número va bajo la foto, no encima).
  let rightColY = headerTop;
  if (idPhoto) {
    rightColY = drawImageTopAnchored('Im3', idPhoto, W - MR - 55, headerTop, 55, 68, 'right') - 4;
  }
  const folioLabel = `N\xB0 ${data.number ?? '-'}`;
  T(W - MR - textWidth(folioLabel, 12, true), rightColY - 12, folioLabel, 'F2', 12);
  headerBottom = Math.min(headerBottom, rightColY - 12);

  // El físico NO tiene una regla horizontal aparte entre el membrete y el título — lo que se leía
  // como "una línea de más" era esa regla sumada al subrayado del título mismo, casi del mismo
  // ancho y pegados uno al otro. El título SÍ va subrayado (confirmado); lo que sobraba era la
  // regla, no el subrayado. Se quita la regla, se mantiene el subrayado del título (`TCU`).
  y = headerBottom - 14;
  const title = isClassB
    ? 'PRESTACIÓN DE SERVICIOS CURSO DE CONDUCCIÓN CLASE B'
    : 'CONTRATO PRESTACIÓN DE SERVICIOS CURSO PROFESIONAL';
  TCU(y, title, 'F2', 11);
  y -= 24;

  // ─── Identificación de partes (párrafo corrido, como el documento físico) ───
  paragraph(
    `En Chillán, ${formatDateWeekday(data.created_at)}, entre ${legal.legalName || brandName}, ` +
      `en adelante ${brandName}, Rut: ${legal.rut || '—'}, representada legalmente por ${repFull}, ` +
      `C. Identidad N\xB0 ${LEGAL_REPRESENTATIVE.rut}, con domicilio en ${streetOnly(data.branch.address)} ` +
      `de la ciudad de Chillán, y el Sr.(a) ${fullName.toUpperCase()}, C. Identidad N\xB0 ${u.rut}, ` +
      `en adelante el Alumno, fecha de nacimiento el ${formatDateWeekday(data.student.birth_date)}, ` +
      `domiciliado en ${data.student.address || '—'} de la Regi\xF3n de \xD1uble, Tel\xE9fono/Celular ` +
      `${u.phone ?? '—'}, se conviene en celebrar el siguiente contrato de matr\xEDcula:`,
  );

  // ─── Cláusulas ───
  if (isClassB) {
    // Fijo en 12, como el físico (folio 3564): son 12 CLASES normadas por el Decreto 39/1985, no
    // el valor de `practical_hours` (que mide horas totales, no cantidad de clases — cada clase
    // dura 45 min, así que 9 horas prácticas = 12 clases; usar el campo tal cual fue el bug).
    const practicalClasses = 12;
    const theoryClasses = data.course.theory_hours ?? 0;
    clause(
      'PRIMERO:',
      `El Alumno se compromete por este acto a asistir al 100% de las ${practicalClasses} clases ` +
        'pr\xE1cticas de conducci\xF3n (una hora pedag\xF3gica cada clase, normado por Decreto 39/1985) ' +
        'con el objetivo de adquirir las habilidades necesarias para optar a obtener Licencia Clase B. ' +
        'Si el alumno falta a dos clases seguidas, estas horas se perder\xE1n y se desprogramar\xE1 el ' +
        'calendario siguiente pactado. Para recuperar las clases perdidas, se deber\xE1 cancelar $9.000 ' +
        'por cada una.',
    );
    clause(
      'SEGUNDO:',
      `Las ${theoryClasses} clases te\xF3ricas ser\xE1n v\xEDa Zoom desde las 19:00 a 21:00 hrs. En caso ` +
        'de no poder estar presente en la clase, esta se debe solicitar v\xEDa correo electr\xF3nico, y se ' +
        'podr\xE1 acceder al taller de psicot\xE9cnico las veces que necesite.',
    );
    clause(
      'TERCERO:',
      `${brandName} proporcionar\xE1 el veh\xEDculo para rendir el examen pr\xE1ctico s\xF3lo en la ` +
        'Direcci\xF3n de Tr\xE1nsito de Chill\xE1n, para la fecha y hora solicitada por \xE9sta, no ' +
        'pudi\xE9ndose repetir este proceso ante un fracaso en el examen pr\xE1ctico.',
    );
    clause(
      'CUARTO:',
      `${brandName} se reserva el derecho de cambio del instructor o veh\xEDculo, si concurren para ` +
        'ello motivos que lo avalen. De igual manera el Alumno podr\xE1 solicitar cambio de instructor, ' +
        'quedando sujeto a la aprobaci\xF3n del director de la Escuela.',
    );
  } else {
    const courseHours =
      data.course.license_class === 'A3' || data.course.license_class === 'A5' ? 160 : 150;
    clause(
      'PRIMERO:',
      `El Sr(a). ${fullName.toUpperCase()} se matricula en este acto en ${brandName}, en el Curso de ` +
        `Conducci\xF3n para optar a la Licencia Profesional Clase ${data.course.license_class} tal como ` +
        'lo determina el Art\xEDculo N\xB016, Inciso N\xB07, del Decreto N\xB0251/98.',
    );
    clause(
      'SEGUNDO:',
      `El alumno se compromete a asistir al curso enunciado precedentemente, que tiene una duraci\xF3n ` +
        `de ${courseHours} horas, seg\xFAn consta en Resoluci\xF3n N\xB0467 de fecha 27/12/2013 del ` +
        'Ministerio de Transporte y Telecomunicaciones, Art\xEDculo N\xB07 del Decreto N\xB0251/98. La ' +
        'concurrencia no puede ser inferior a un 80% de las clases te\xF3ricas y un 100% a las clases ' +
        'pr\xE1cticas. El curso se aprobar\xE1 con un 75% de calificaci\xF3n general como m\xEDnimo.',
    );
    clause(
      'TERCERO:',
      'En este acto el Alumno presenta en ORIGINAL los siguientes documentos, dejando una copia de ' +
        'cada uno: Certificado de Antecedentes y Hoja de Vida del Conductor. En FOTOCOPIA, C\xE9dula de ' +
        'Identidad y Licencia de Conducir por ambos lados. Adem\xE1s, debe haber aprobado el examen ' +
        'sicol\xF3gico (Test EPQ-R) previamente realizado.',
    );
    clause(
      'CUARTO:',
      'Al t\xE9rmino del curso, previa aprobaci\xF3n de todos los m\xF3dulos (m\xEDnimo un 75%) y ' +
        'cumplimiento de los porcentajes de asistencia se\xF1alados en la cl\xE1usula SEGUNDO, se le ' +
        'otorgar\xE1 por \xDANICA VEZ un certificado nominativo e intransferible, foliado y emitido por ' +
        'la Casa de Moneda de Chile. En caso de extrav\xEDo deber\xE1 dar aviso al Ministerio de ' +
        'Transporte y Telecomunicaciones, mediante carta certificada explicando los motivos de la ' +
        'p\xE9rdida. Paralelamente deber\xE1 comunicar el extrav\xEDo en un diario de la regi\xF3n.',
    );
  }

  // `total_paid`/`pending_balance` vienen de `enrollments` (mantenidos por trigger), pero el
  // contrato se genera en el paso 5 del wizard — el pago real recién se registra DESPUÉS de eso,
  // así que en la práctica `total_paid` casi siempre llega en 0 acá, aunque `payment_mode` (paso
  // 2: "paga todo" / "paga el 50%") ya se conoce. Sin esto el contrato imprimía literalmente "paga
  // $0, saldo $X" para una matrícula que sí va a pagar algo en el acto. Se usa el pago real si ya
  // existe (>0); si no, se prevé según `payment_mode`. Único dato del físico que de verdad no se
  // puede reconstruir es el Nº de boleta — se omite esa frase puntual, el resto se mantiene íntegro.
  const hasRealPayment = data.total_paid != null && data.total_paid > 0;
  const expectedPaid = data.payment_mode === 'partial' ? Math.round(netPrice / 2) : netPrice;
  const paid = hasRealPayment ? (data.total_paid as number) : expectedPaid;
  // El saldo real de la BD solo es consistente con `paid` cuando `paid` también es el pago real —
  // si se está usando la previsión por `payment_mode`, el saldo se deriva del mismo cálculo
  // (nunca mezclar un saldo real de "nada pagado" con un pago previsto de "la mitad").
  const balance = hasRealPayment
    ? (data.pending_balance ?? Math.max(netPrice - paid, 0))
    : Math.max(netPrice - paid, 0);
  clause(
    'QUINTO:',
    `El valor acordado del curso es de ${formatCurrency(netPrice)}` +
      (data.discount > 0
        ? ` (precio base ${formatCurrency(data.base_price)}, con un descuento de ${formatCurrency(data.discount)})`
        : '') +
      `, que el Alumno paga en este acto la cantidad de ${formatCurrency(paid)}, quedando un ` +
      'saldo de ' +
      `${formatCurrency(balance)}, que se deber\xE1 pagar en la SEXTA CLASE. Si se llegase a poner ` +
      't\xE9rmino anticipado a este contrato, de lo abonado se descontar\xE1n las clases realizadas ' +
      `($10.000 por clase pr\xE1ctica). Ante cualquier retraso o pago fuera de los plazos, ` +
      `facultar\xE1 a ${brandName} para ejercer los derechos de cobranza que estime conveniente.`,
  );

  const policyUrl = data.branch.slug
    ? `${APP_BASE_URL}/politica-privacidad/${data.branch.slug}`
    : APP_BASE_URL;
  clause(
    'SEXTO: Protecci\xF3n de datos personales (Ley N\xB0 21.719).',
    `Los datos personales del Alumno ser\xE1n tratados por ${legal.legalName || brandName} conforme a ` +
      'la Ley N\xB0 21.719 sobre protecci\xF3n de datos personales, con la finalidad de ejecutar este ' +
      'contrato de matr\xEDcula y cumplir las obligaciones legales asociadas (libro de registro de ' +
      'alumnos, acreditaci\xF3n de horas e informes a la autoridad). Se conservar\xE1n por 5 a\xF1os ' +
      'desde el egreso o baja del Alumno. El Alumno puede ejercer sus derechos de acceso, ' +
      `rectificaci\xF3n, cancelaci\xF3n, oposici\xF3n y portabilidad escribiendo a ` +
      `${data.branch.email ?? 'la Escuela'}. El detalle completo del tratamiento est\xE1 en la Pol\xEDtica ` +
      `de Privacidad, disponible en ${policyUrl}.`,
  );

  if (data.convalidation) {
    clause(
      `S\xC9PTIMO: Convalidaci\xF3n simult\xE1nea de Licencia ${data.convalidation.convalidated_license}.`,
      `El Alumno se matricula en el curso ${data.course.license_class} con convalidaci\xF3n ` +
        `simult\xE1nea de la Licencia ${data.convalidation.convalidated_license}, la que se cursar\xE1 ` +
        'dentro de la misma promoci\xF3n bajo un libro de clases independiente. Las ' +
        `${data.convalidation.reduced_hours} horas convalidadas quedan cubiertas por el valor \xFAnico ` +
        'de esta matr\xEDcula. La apertura del libro de clases de la licencia convalidada ser\xE1 ' +
        'informada al Alumno por la administraci\xF3n.',
    );
  }

  // ─── Firmas ───
  // Más aire antes de la línea que antes: la firma física va sobre esa línea, y pegada al
  // párrafo anterior no queda espacio real para firmar a mano.
  need(56);
  y -= 40;
  const col2X = ML + 260;
  HL(y, 0.5, ML, ML + 180);
  HL(y, 0.5, col2X, col2X + 180);

  if (signature) {
    const sigW = 140;
    const sigH = 50;
    const sigX = col2X + 20;
    const sigY = y + 5;
    ops += `q ${sigW} 0 0 ${sigH} ${sigX} ${Math.round(sigY)} cm /Im2 Do Q\n`;
  }

  y -= 16;
  T(ML, y, brandName.toUpperCase(), 'F2', 12);
  T(col2X, y, fullName.toUpperCase(), 'F2', 12);

  pages.push(ops);
  return assemblePdf(pages, W, H, logo ?? null, signature, idPhoto ?? null);
}
