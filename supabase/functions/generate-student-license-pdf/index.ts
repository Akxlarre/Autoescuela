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
  tagline: 'U\xF3nete a nosotros... \xFAnete a la vida',
  address: 'CARRERA 74, FONO: 42- 2244030',
  email: 'conductorchillan@gmail.com',
  website: 'www.conductoreschillan.cl',
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
    const { enrollment_id } = await req.json();
    if (!enrollment_id || typeof enrollment_id !== 'number') {
      return jsonRes({ error: 'enrollment_id (number) is required' }, 400);
    }

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

    let instructorName = '';
    if (sesiones.length > 0) {
      const instRaw = sesiones[0].instructors as any;
      const inst = Array.isArray(instRaw) ? instRaw[0] : instRaw;
      const uInst = Array.isArray(inst?.users) ? inst.users[0] : inst?.users;
      if (uInst) {
        instructorName = `${uInst.first_names} ${uInst.paternal_last_name}`.trim().toUpperCase();
      }
    }

    const totalClases = sesiones.length <= 6 ? 6 : 12;

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
      logo,
      photo: photoImage,
    });

    const safeName = sanitize(`${lastNames}_${firstName}`);
    const fileName = `Carnet_${safeName}.pdf`;
    const storagePath = `student-licenses/${enrollment_id}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) return jsonRes({ error: `Upload failed: ${uploadErr.message}` }, 500);

    await supabase
      .from('enrollments')
      .update({ license_pdf_url: storagePath })
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
  logo: PngPdfImage | null;
  photo: AnyPdfImage | null;
}

function buildCarnetPdf(d: CarnetData): Uint8Array {
  // A5 landscape: más ancho y menos alto, igual que el carnet físico
  const W = 595,
    H = 421;

  // Columnas
  const LEFT_X = 10;
  const DIV_X = 293;
  const RIGHT_X = 300;
  const RIGHT_END = 585;
  const CX_R = Math.round((RIGHT_X + RIGHT_END) / 2); // 442

  // Tabla (columna izquierda)
  const TBL_L = LEFT_X;
  const TBL_R = 285;
  const COL_NRO = TBL_L + 22; // 32
  const COL_DIA = COL_NRO + 46; // 78
  const COL_HI = COL_DIA + 54; // 132
  const COL_HT = COL_HI + 54; // 186

  const HDR_H = 12;
  const ROW_H = 15;

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

  let y = H - 14; // y=407

  // "V.- CLASES PRÁCTICAS" (negrita, subrayado)
  const hdrTxt = 'V.- CLASES PR\xC1CTICAS';
  T(LEFT_X, y, hdrTxt, 'F2', 7);
  const hdrW = tw(hdrTxt, 7, true);
  ops += `0.4 w ${r(LEFT_X)} ${r(y - 1)} m ${r(LEFT_X + hdrW)} ${r(y - 1)} l S\n`;

  y -= 8; // y=399 = tblTopY

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

  const hdrY = tblTopY - HDR_H + 3;
  const colHeaders = [
    { text: 'N\xBA', cx: (TBL_L + COL_NRO) / 2 },
    { text: 'D\xEDa', cx: (COL_NRO + COL_DIA) / 2 },
    { text: 'Hora inicio', cx: (COL_DIA + COL_HI) / 2 },
    { text: 'Hora T\xE9rmino', cx: (COL_HI + COL_HT) / 2 },
    { text: 'Firma Instructor', cx: (COL_HT + TBL_R) / 2 },
  ];
  for (const h of colHeaders) {
    TC(h.cx, hdrY, h.text, 'F2', 5.5);
  }

  const sesMap = new Map<number, any>();
  for (const s of d.sesiones) sesMap.set(Number(s.class_number), s);

  for (let i = 0; i < d.totalClases; i++) {
    const rowTopY = dataStartY - i * ROW_H;
    const rowBotY = rowTopY - ROW_H;
    const textY = rowBotY + (ROW_H - 6) / 2 + 1;
    const ses = sesMap.get(i + 1);

    HLINE(TBL_L, TBL_R, rowBotY);
    TC((TBL_L + COL_NRO) / 2, textY, String(i + 1), 'F1', 6);

    if (ses?.scheduled_at) {
      TC((COL_NRO + COL_DIA) / 2, textY, fmtDaySantiago(ses.scheduled_at), 'F1', 6);
      TC((COL_DIA + COL_HI) / 2, textY, fmtTimeSantiago(ses.scheduled_at), 'F1', 6);
      TC((COL_HI + COL_HT) / 2, textY, addMinutes(ses.scheduled_at, 45), 'F1', 6);
    }
  }

  y = tblBotY - 8;

  if (d.totalClases === 6) {
    T(LEFT_X, y, 'APROBADO', 'F2', 6.5);
    RECT(LEFT_X + 50, y - 1, 10, 9);
    T(LEFT_X + 68, y, 'REPROBADO', 'F2', 6.5);
    RECT(LEFT_X + 115, y - 1, 10, 9);
    y -= 16;
  }

  y -= 6;
  T(LEFT_X, y, 'P\xC1GINAS WEB PARA PRACTICAR EXAMEN TE\xD3RICO:', 'F2', 5.5);
  y -= 9;
  for (const url of WEB_URLS) {
    T(LEFT_X, y, url, 'F1', 5);
    y -= 8;
  }

  // ════════════════════════════════════════════════
  // LÍNEA DIVISORIA
  // ════════════════════════════════════════════════
  VLINE(DIV_X, 13, H - 11, 0.6);

  // ════════════════════════════════════════════════
  // COLUMNA DERECHA
  // ════════════════════════════════════════════════

  // Centros de columna derecha
  const CX_SCHOOL = 502; // texto del colegio más a la derecha
  const CX_PHOTO_MATRIC = 512; // foto + matrícula más a la derecha

  let ry = H - 14; // 407

  // Logo en la esquina superior izquierda de la mitad derecha
  const logoH = 52;
  const logo = d.logo;
  if (logo) {
    const logoW = Math.round((logo.width / logo.height) * logoH);
    const logoX = RIGHT_X + 4; // 304 — esquina izquierda de la mitad derecha
    const logoY = ry - logoH; // 421-14-52 = 355
    ops += `q ${r(logoW)} 0 0 ${r(logoH)} ${r(logoX)} ${r(logoY)} cm /Im1 Do Q\n`;
  }

  // Texto del colegio centrado más a la derecha, al lado del logo
  TC(CX_SCHOOL, ry, SCHOOL.name, 'F2', 9);
  ry -= 12;

  TC(CX_SCHOOL, ry, SCHOOL.tagline, 'F1', 6.5);
  ry -= 10;

  TC(CX_SCHOOL, ry, SCHOOL.address, 'F1', 6.5);
  ry -= 9;

  TC(CX_SCHOOL, ry, SCHOOL.email, 'F1', 6.5);
  ry -= 9;

  TC(CX_SCHOOL, ry, SCHOOL.website, 'F1', 6.5);

  // Reposicionar debajo del logo (más alto que el texto del colegio)
  ry = H - 14 - logoH - 8; // 421 - 14 - 52 - 8 = 347

  // Foto del alumno (más a la derecha)
  const photoW = 54,
    photoH = 66;
  const photoX = CX_PHOTO_MATRIC - photoW / 2;
  const photoY = ry - photoH; // 347 - 66 = 281

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
  ry = photoY - 12; // mayor separación entre foto y etiqueta MATRICULA

  // MATRICULA (más a la derecha)
  TC(CX_PHOTO_MATRIC, ry, 'MATRICULA', 'F2', 8);
  ry -= 4;

  const boxW = 66,
    boxH = 20;
  const boxX = CX_PHOTO_MATRIC - boxW / 2;
  const boxY = ry - boxH;
  RECT(boxX, boxY, boxW, boxH, 1.0);
  TC(CX_PHOTO_MATRIC, boxY + (boxH - 13) / 2 + 1, d.matriculaNum, 'F2', 13);
  ry = boxY - 10;

  // Datos del alumno (más arriba por el nuevo layout)
  const infoX = RIGHT_X + 5;
  const infoSize = 7;
  const infoLead = 11;
  T(infoX, ry, `Nombres: ${d.firstName.toUpperCase()}`, 'F2', infoSize);
  ry -= infoLead;
  T(infoX, ry, `Apellidos: ${d.lastNames.toUpperCase()}`, 'F2', infoSize);
  ry -= infoLead;
  T(infoX, ry, `C. Identidad: ${d.rut}`, 'F2', infoSize);
  ry -= infoLead;
  T(infoX, ry, `INSTRUCTOR: ${d.instructorName}`, 'F2', infoSize);
  ry -= 14;

  // Nota + CURSO CLASE B en azul (más arriba por el nuevo layout)
  ops += `0 0 0.8 rg\n`;

  const noteLine1 = 'No olvide llevar consigo este carnet durante';
  const noteLine2 = 'las clases pr\xE1cticas';
  ops += `BT /F1 6.5 Tf 1 0 0.2 1 ${r(CX_R - tw(noteLine1, 6.5, false) / 2)} ${r(ry)} Tm (${esc(noteLine1)}) Tj ET\n`;
  ry -= 9;
  ops += `BT /F1 6.5 Tf 1 0 0.2 1 ${r(CX_R - tw(noteLine2, 6.5, false) / 2)} ${r(ry)} Tm (${esc(noteLine2)}) Tj ET\n`;
  ry -= 13;

  TC(CX_R, ry, 'CURSO CLASE B', 'F2', 11);

  ops += `0 g\n`; // reset a negro

  return assemblePdf([ops], W, H, d.logo ?? undefined, d.photo ?? undefined);
}
