// supabase/functions/generate-student-license-pdf/index.ts
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  escapePdfWinAnsi as esc,
  textWidth as tw,
  loadImageForPdf,
  loadPngForPdf,
  assemblePdf,
} from '../_shared/pdf-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCHOOL = {
  name: 'CONDUCTORES CHILL\xC1N',
  tagline: '\xDAnete a nosotros... \xFAnete a la vida',
  address: 'CARRERA 74, FONO: 42- 2244030',
  email: 'conductorchillan@gmail.com',
};

const LOGO_URL =
  'https://skvekggejikzxhzsjmkz.supabase.co/storage/v1/object/public/assets/chillan_capacita.png';

const WEB_URLS = [
  '*https://www.educacionvial.cl/examen-interactivo.html',
  '*https://www.conaset.cl/programa/prepara-examen-conducir/',
  '*http://www.crosan.cl/pagina/examen/carpeta_1/478.htm',
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { enrollment_id, variant: rawVariant } = await req.json();
    if (!enrollment_id || typeof enrollment_id !== 'number') {
      return jsonRes({ error: 'enrollment_id (number) is required' }, 400);
    }
    // 'initial' → carnet de 6 clases; 'full' → carnet de 12 clases.
    const variant: 'initial' | 'full' = rawVariant === 'full' ? 'full' : 'initial';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: enrollment, error: enrollErr } = await supabase
      .from('enrollments')
      .select(
        `id, number, license_group,
        students!inner(
          id,
          users!inner(first_names, paternal_last_name, maternal_last_name, rut)
        )`,
      )
      .eq('id', enrollment_id)
      .single();

    if (enrollErr || !enrollment) {
      return jsonRes({ error: `Enrollment ${enrollment_id} no encontrado` }, 404);
    }

    if (enrollment.license_group !== 'class_b') {
      return jsonRes({ error: 'Solo disponible para alumnos Clase B' }, 400);
    }

    const u = enrollment.students.users;
    const firstName = u.first_names ?? '';
    const lastNames = [u.paternal_last_name, u.maternal_last_name].filter(Boolean).join(' ');
    const rut = u.rut ?? '';
    const matriculaNum = enrollment.number ?? enrollment_id;

    const { data: sessions } = await supabase
      .from('class_b_sessions')
      .select(
        `class_number, scheduled_at, start_time, end_time,
        instructors!class_b_sessions_instructor_id_fkey(
          users(first_names, paternal_last_name)
        )`,
      )
      .eq('enrollment_id', enrollment_id)
      .order('class_number', { ascending: true });

    const sesiones = sessions ?? [];

    // Instructor mayoritario: el que tiene más clases en la sesión.
    // En caso de empate, gana el que tiene la clase de menor número (sesiones ya ordenadas asc).
    let instructorName = '';
    if (sesiones.length > 0) {
      // Contar clases por instructor manteniendo el índice de primera aparición
      const countMap = new Map<string, { name: string; count: number; firstIndex: number }>();
      sesiones.forEach((s: any, idx: number) => {
        const instRaw = s.instructors as any;
        const inst = Array.isArray(instRaw) ? instRaw[0] : instRaw;
        const uInst = Array.isArray(inst?.users) ? inst.users[0] : inst?.users;
        if (!uInst) return;
        const name = `${uInst.first_names} ${uInst.paternal_last_name}`.trim().toUpperCase();
        const entry = countMap.get(name);
        if (entry) {
          entry.count++;
        } else {
          countMap.set(name, { name, count: 1, firstIndex: idx });
        }
      });

      // Ordenar: mayor cantidad primero; en empate, menor firstIndex primero
      const sorted = [...countMap.values()].sort(
        (a, b) => b.count - a.count || a.firstIndex - b.firstIndex,
      );
      instructorName = sorted[0]?.name ?? '';
    }

    // El agendamiento siempre crea 12 sesiones (fix-017); la cantidad de filas
    // del carnet la define la variante solicitada, no cuántas sesiones existen.
    const totalClases = variant === 'full' ? 12 : 6;

    let photoImage: AnyPdfImage | null = null;
    const { data: photoDoc } = await supabase
      .from('student_documents')
      .select('storage_url')
      .eq('enrollment_id', enrollment_id)
      .eq('type', 'id_photo')
      .maybeSingle();

    if (photoDoc?.storage_url) {
      const { data: photoSigned } = await supabase.storage
        .from('documents')
        .createSignedUrl(photoDoc.storage_url, 120);
      if (photoSigned?.signedUrl) {
        photoImage = await loadImageForPdf(photoSigned.signedUrl, 300, 375);
      }
    }

    const logo = await loadPngForPdf(LOGO_URL);

    const pdfBytes = buildCarnetPdf({
      firstName,
      lastNames,
      rut,
      matriculaNum: String(matriculaNum),
      instructorName,
      sesiones,
      totalClases,
      variant,
      logo,
      photo: photoImage,
    });

    const safeName = sanitize(`${lastNames}_${firstName}`);
    const suffix = variant === 'full' ? '12' : '6';
    const fileName = `Carnet_${safeName}_${suffix}.pdf`;
    const storagePath = `student-licenses/${enrollment_id}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) return jsonRes({ error: `Upload failed: ${uploadErr.message}` }, 500);

    // Persistir en la columna de la variante correspondiente. Ambos carnets
    // coexisten: generar uno nunca pisa al otro (fix-019).
    const urlColumn = variant === 'full' ? 'license_full_url' : 'license_initial_url';
    await supabase
      .from('enrollments')
      .update({ [urlColumn]: storagePath })
      .eq('id', enrollment_id);

    const { data: signedData, error: signErr } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600);

    if (signErr || !signedData) {
      return jsonRes({ error: `Signed URL failed: ${signErr?.message}` }, 500);
    }

    return jsonRes({ pdfUrl: signedData.signedUrl, pdfPath: storagePath });
  } catch (err) {
    console.error('generate-student-license-pdf error:', err);
    return jsonRes({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});

// ── Helpers generales ─────────────────────────────────────────────────────────

function jsonRes(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60);
}

function fmtTimeSantiago(ts: string | null | undefined): string {
  if (!ts) return '';
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ts));
}

function fmtDaySantiago(ts: string | null | undefined): string {
  if (!ts) return '';
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ts));
  const parts = local.split('-');
  return `${parts[2]}-${parts[1]}`;
}

function addMinutes(ts: string, minutes: number): string {
  const d = new Date(ts);
  d.setMinutes(d.getMinutes() + minutes);
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

// ── Constructor del PDF del carnet ────────────────────────────────────────────

interface CarnetData {
  firstName: string;
  lastNames: string;
  rut: string;
  matriculaNum: string;
  instructorName: string;
  sesiones: any[];
  totalClases: number;
  variant: 'initial' | 'full';
  logo: PngPdfImage | null;
  photo: AnyPdfImage | null;
}

function buildCarnetPdf(d: CarnetData): Uint8Array {
  // 8.50 × 5.90 in landscape (igual al carnet físico impreso): 612 × 425 pt
  const W = 612,
    H = 425;

  // Columnas
  const LEFT_X = 14;
  const RIGHT_X = 315;
  const RIGHT_END = 600;
  const CX_R = Math.round((RIGHT_X + RIGHT_END) / 2); // 458

  // Tabla (columna izquierda) — más angosta que antes; columnas de horario y
  // "Firma Instructor" con anchos parejos, como el carnet físico (ahí la
  // columna de firma NO es mucho más ancha que las de hora).
  const TBL_L = LEFT_X;
  const TBL_R = 270;
  const COL_NRO = TBL_L + 33; // 47
  const COL_DIA = COL_NRO + 44; // 91
  const COL_HI = COL_DIA + 59; // 150
  const COL_HT = COL_HI + 59; // 209

  // Encabezado con más aire debajo del texto; filas de datos grandes y en
  // negrita, apretadas contra los bordes de la celda como en el carnet físico.
  const HDR_H = 20;
  const ROW_H = 16;

  let ops = '';

  const T = (x: number, y: number, text: string, f: 'F1' | 'F2', size: number) => {
    ops += `BT /${f} ${size} Tf ${r(x)} ${r(y)} Td (${esc(text)}) Tj ET\n`;
  };

  const TC = (cx: number, y: number, text: string, f: 'F1' | 'F2', size: number) => {
    const w = tw(text, size, f === 'F2');
    T(cx - w / 2, y, text, f, size);
  };

  const RECT = (x: number, y: number, w: number, h: number, lineW = 0.5) => {
    ops += `${lineW} w ${r(x)} ${r(y)} ${r(w)} ${r(h)} re S\n`;
  };

  const VLINE = (x: number, y1: number, y2: number, lineW = 0.5) => {
    ops += `${lineW} w ${r(x)} ${r(y1)} m ${r(x)} ${r(y2)} l S\n`;
  };

  const HLINE = (x1: number, x2: number, y: number, lineW = 0.5) => {
    ops += `${lineW} w ${r(x1)} ${r(y)} m ${r(x2)} ${r(y)} l S\n`;
  };

  function r(n: number) {
    return Math.round(n);
  }

  // ════════════════════════════════════════════════
  // COLUMNA IZQUIERDA
  // ════════════════════════════════════════════════

  let y = H - 16; // y=409

  // "V.- CLASES PRÁCTICAS" (negrita, subrayado)
  const hdrTxt = 'V.- CLASES PR\xC1CTICAS';
  T(LEFT_X, y, hdrTxt, 'F2', 9);
  // +2pt de margen: los anchos de Helvetica-Bold son un estimado, así que se
  // agranda un poco el trazo para asegurar que cubra el texto completo.
  const hdrW = tw(hdrTxt, 9, true) + 2;
  ops += `0.4 w ${r(LEFT_X)} ${r(y - 2)} m ${r(LEFT_X + hdrW)} ${r(y - 2)} l S\n`;

  y -= 10; // y=399 = tblTopY

  const tblTopY = y;
  const dataStartY = y - HDR_H;
  const tblH = HDR_H + d.totalClases * ROW_H;
  const tblBotY = tblTopY - tblH;

  RECT(TBL_L, tblBotY, TBL_R - TBL_L, tblH);
  VLINE(COL_NRO, tblBotY, tblTopY);
  VLINE(COL_DIA, tblBotY, tblTopY);
  VLINE(COL_HI, tblBotY, tblTopY);
  VLINE(COL_HT, tblBotY, tblTopY);
  HLINE(TBL_L, TBL_R, tblTopY - HDR_H, 0.8);

  // Encabezados de columna centrados vertical y horizontalmente dentro de la
  // celda de header; los que no caben en una línea se parten en dos, igual
  // que en el carnet físico ("Hora" / "inicio", "Firma" / "Instructor").
  const HDR_FONT = 6.5;
  const HDR_LINE_H = HDR_FONT + 2.5;
  const cellMidY = tblTopY - HDR_H / 2;

  const drawHeaderCell = (cx: number, lines: string[]) => {
    const blockH = lines.length * HDR_LINE_H;
    let lineY = cellMidY + blockH / 2 - HDR_LINE_H / 2 - HDR_FONT * 0.3;
    for (const line of lines) {
      TC(cx, lineY, line, 'F2', HDR_FONT);
      lineY -= HDR_LINE_H;
    }
  };

  const colHeaders = [
    { lines: ['N\xBA'], cx: (TBL_L + COL_NRO) / 2 },
    { lines: ['D\xEDa'], cx: (COL_NRO + COL_DIA) / 2 },
    { lines: ['Hora', 'inicio'], cx: (COL_DIA + COL_HI) / 2 },
    { lines: ['Hora', 'T\xE9rmino'], cx: (COL_HI + COL_HT) / 2 },
    { lines: ['Firma', 'Instructor'], cx: (COL_HT + TBL_R) / 2 },
  ];
  for (const h of colHeaders) {
    drawHeaderCell(h.cx, h.lines);
  }

  const sesMap = new Map<number, any>();
  for (const s of d.sesiones) sesMap.set(Number(s.class_number), s);

  // Contenido de fila grande y en negrita, apretado contra la celda — igual
  // que el carnet físico.
  const ROW_FONT = 9.5;
  for (let i = 0; i < d.totalClases; i++) {
    const rowTopY = dataStartY - i * ROW_H;
    const rowBotY = rowTopY - ROW_H;
    const textY = rowBotY + (ROW_H - ROW_FONT) / 2 + 1;
    const ses = sesMap.get(i + 1);

    HLINE(TBL_L, TBL_R, rowBotY);
    TC((TBL_L + COL_NRO) / 2, textY, String(i + 1), 'F2', ROW_FONT);

    if (ses?.scheduled_at) {
      TC((COL_NRO + COL_DIA) / 2, textY, fmtDaySantiago(ses.scheduled_at), 'F2', ROW_FONT);
      TC((COL_DIA + COL_HI) / 2, textY, fmtTimeSantiago(ses.scheduled_at), 'F2', ROW_FONT);
      TC((COL_HI + COL_HT) / 2, textY, addMinutes(ses.scheduled_at, 45), 'F2', ROW_FONT);
    }

    // La columna "Firma Instructor" queda siempre en blanco para que el
    // instructor la firme a mano — incluso en las clases 1-6 del carnet
    // completo (12 clases), que ya fueron firmadas en el carnet inicial
    // físico pero no llevan marca impresa aquí.
  }

  y = tblBotY - 20; // separado de la tabla, no pegado al borde

  if (d.totalClases === 6) {
    const aprobadoTxt = 'APROBADO';
    T(LEFT_X, y, aprobadoTxt, 'F2', 8);
    const aprobadoW = tw(aprobadoTxt, 8, true);
    const box1X = LEFT_X + aprobadoW + 8;
    RECT(box1X, y - 2, 13, 12);

    const reprobadoTxt = 'REPROBADO';
    const reprobadoX = box1X + 13 + 14;
    T(reprobadoX, y, reprobadoTxt, 'F2', 8);
    const reprobadoW = tw(reprobadoTxt, 8, true);
    const box2X = reprobadoX + reprobadoW + 8;
    RECT(box2X, y - 2, 13, 12);

    y -= 22;
  }

  y -= 8;
  T(LEFT_X, y, 'P\xC1GINAS WEB PARA PRACTICAR EXAMEN TE\xD3RICO:', 'F2', 9.5);
  y -= 15;
  for (const url of WEB_URLS) {
    T(LEFT_X, y, url, 'F1', 8.5);
    y -= 12;
  }

  // ════════════════════════════════════════════════
  // COLUMNA DERECHA
  // ════════════════════════════════════════════════

  // Centros de columna derecha
  const CX_SCHOOL = 517; // texto del colegio más a la derecha
  const CX_PHOTO_MATRIC = 515; // foto + matrícula, levemente más a la izquierda

  const TOP_R_Y = H - 34; // más margen respecto al borde superior que antes
  let ry = TOP_R_Y;

  // Logo en la esquina superior izquierda de la mitad derecha
  const logoH = 60;
  const logo = d.logo;
  if (logo) {
    const logoW = Math.round((logo.width / logo.height) * logoH);
    const logoX = RIGHT_X + 4; // esquina izquierda de la mitad derecha
    const logoY = ry - logoH;
    ops += `q ${r(logoW)} 0 0 ${r(logoH)} ${r(logoX)} ${r(logoY)} cm /Im1 Do Q\n`;
  }

  // Texto del colegio centrado más a la derecha, al lado del logo
  TC(CX_SCHOOL, ry, SCHOOL.name, 'F2', 11);
  ry -= 14;

  TC(CX_SCHOOL, ry, SCHOOL.tagline, 'F2', 8);
  ry -= 12;

  TC(CX_SCHOOL, ry, SCHOOL.address, 'F1', 8);
  ry -= 12;

  TC(CX_SCHOOL, ry, SCHOOL.email, 'F2', 8);

  // Reposicionar debajo del logo (más alto que el texto del colegio)
  ry = TOP_R_Y - logoH - 10;

  // Foto del alumno (más a la derecha)
  const photoW = 64,
    photoH = 78;
  const photoX = CX_PHOTO_MATRIC - photoW / 2;
  const photoY = ry - photoH;

  if (d.photo) {
    // Center-fill: scale image so the shorter side fits the box, clip the overflow.
    const imgRatio = d.photo.width / d.photo.height;
    const boxRatio = photoW / photoH;
    let drawW: number, drawH: number;
    if (imgRatio > boxRatio) {
      drawH = photoH;
      drawW = photoH * imgRatio;
    } else {
      drawW = photoW;
      drawH = photoW / imgRatio;
    }
    const drawX = photoX + (photoW - drawW) / 2;
    const drawY = photoY + (photoH - drawH) / 2;
    ops += `q ${r(photoX)} ${r(photoY)} ${r(photoW)} ${r(photoH)} re W n `;
    ops += `${r(drawW)} 0 0 ${r(drawH)} ${r(drawX)} ${r(drawY)} cm /Im2 Do Q\n`;
  } else {
    RECT(photoX, photoY, photoW, photoH, 0.4);
  }
  ry = photoY - 14; // mayor separación entre foto y etiqueta MATRICULA

  // MATRICULA (más a la derecha)
  TC(CX_PHOTO_MATRIC, ry, 'MATRICULA', 'F2', 10);
  ry -= 5;

  const boxW = 78,
    boxH = 24;
  const boxX = CX_PHOTO_MATRIC - boxW / 2;
  const boxY = ry - boxH;
  RECT(boxX, boxY, boxW, boxH, 1.0);
  TC(CX_PHOTO_MATRIC, boxY + (boxH - 16) / 2 + 1, d.matriculaNum, 'F2', 16);
  ry = boxY - 12;

  // Datos del alumno (más arriba por el nuevo layout)
  const infoX = RIGHT_X + 6;
  const infoSize = 9;
  const infoLead = 14;
  T(infoX, ry, `Nombres: ${d.firstName.toUpperCase()}`, 'F2', infoSize);
  ry -= infoLead;
  T(infoX, ry, `Apellidos: ${d.lastNames.toUpperCase()}`, 'F2', infoSize);
  ry -= infoLead;
  T(infoX, ry, `C. Identidad: ${d.rut}`, 'F2', infoSize);
  ry -= infoLead;
  T(infoX, ry, `INSTRUCTOR: ${d.instructorName}`, 'F2', infoSize);
  ry -= 16;

  // Nota + CURSO CLASE B en azul (más arriba por el nuevo layout)
  ops += `0 0 0.8 rg\n`;

  const noteLine1 = 'No olvide llevar consigo este carnet durante';
  const noteLine2 = 'las clases pr\xE1cticas';
  ops += `BT /F2 9.5 Tf 1 0 0.2 1 ${r(CX_R - tw(noteLine1, 9.5, true) / 2)} ${r(ry)} Tm (${esc(noteLine1)}) Tj ET\n`;
  ry -= 13;
  ops += `BT /F2 9.5 Tf 1 0 0.2 1 ${r(CX_R - tw(noteLine2, 9.5, true) / 2)} ${r(ry)} Tm (${esc(noteLine2)}) Tj ET\n`;
  ry -= 17;

  TC(CX_R, ry, 'CURSO CLASE B', 'F2', 14);

  ops += `0 g\n`; // reset a negro

  return assemblePdf([ops], W, H, d.logo ?? undefined, d.photo ?? undefined);
}
