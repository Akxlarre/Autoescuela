// supabase/functions/generate-certificate-professional-pdf/index.ts
//
// Edge Function: generate-certificate-professional-pdf
//
// Genera el Certificado de finalización del Curso de Licencia Profesional a partir
// de un enrollment_id, lo sube al bucket 'documents' y devuelve su signed URL.
//
// Invocación desde el frontend:
//   await supabase.functions.invoke('generate-certificate-professional-pdf', {
//     body: { enrollment_id: 42 }
//   })
//
// Respuesta: { pdfUrl: "https://.../documents/...", pdfPath: "certificates_prof/42/Cert.pdf" }
//
// Spec 0016-m — modos adicionales para el editor de plantillas (`document_templates`), ninguno
// persiste (Storage/`certificates`/`certificate_issuance_log`), ambos usan un alumno ficticio:
//   mode: 'sample'  → { branch_id } — contenido REAL de document_templates
//   mode: 'preview' → { branch_id, content } — contenido en BORRADOR sin guardar
// Ambos responden { pdfBase64 } en vez de { pdfUrl, pdfPath }.
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  escapePdfWinAnsi,
  textWidth,
  loadPngForPdf,
  assemblePdf,
  wrapLines as wrap,
} from '../_shared/pdf-utils.ts';
import { substituteTokens } from '../_shared/template-tokens.ts';

// ─── CORS ───
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Constantes de la escuela (fallback si `document_templates` no tiene fila para la sede) ───
const SCHOOL = {
  nameTop: 'CONDUCTORES CHILLAN',
  subtitle: 'ESCUELA DE CONDUCTORES PROFESIONALES',
  address: 'CARRERA 74 FONO 2244030 WWW.CONDUCTORESCHILLAN.CL',
  legalRepFullName: 'JORGE ENRIQUE PEREZ GODOY',
  legalRepShort: 'CONDUCTORES CHILLAN',
  legalRepRut: '77.940.120-0',
  secretariaName: 'VICTORIA NAVARRETE UTRERAS',
  secretariaRole: 'ENCARGADA DE MATRICULA',
  city: 'Chillán',
};

/** Alumno ficticio para preview/vista default — nunca corresponde a un enrollment real
 * (confirmado con el owner, 2026-09-16). */
const SAMPLE_STUDENT = {
  fullName: 'ALUMNO DE PRUEBA EJEMPLO',
  rut: '11.111.111-1',
  courseLabel: 'Licencia Profesional Clase A4',
  startDate: '01-01-2026',
  endDate: '30-06-2026',
};

const LOGO_URL =
  'https://skvekggejikzxhzsjmkz.supabase.co/storage/v1/object/public/assets/chillan_capacita.png';

// ─── Nombre del curso según clase de licencia ───
function getCourseLabel(licenseClass: string): string {
  const map: Record<string, string> = {
    A2: 'Licencia Profesional Clase A2',
    A3: 'Licencia Profesional Clase A3',
    A4: 'Licencia Profesional Clase A4',
    A5: 'Licencia Profesional Clase A5',
  };
  return map[licenseClass?.toUpperCase()] ?? 'Licencia Profesional';
}

// ─── Main ───
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const mode: 'real' | 'preview' | 'sample' = body.mode ?? 'real';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (mode === 'preview' || mode === 'sample') {
      return await handlePreviewOrSample(supabase, mode, body);
    }

    // ── mode: 'real' (comportamiento existente, sin cambios de contrato público) ──
    const { enrollment_id } = body;
    if (!enrollment_id || typeof enrollment_id !== 'number') {
      return jsonRes({ error: 'enrollment_id (number) is required' }, 400);
    }

    // 0. Obtener user_id interno del caller (para auditoría)
    let callerUserId: number | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const {
        data: { user: caller },
      } = await userClient.auth.getUser();
      if (caller) {
        const { data: callerRow } = await supabase
          .from('users')
          .select('id')
          .eq('supabase_uid', caller.id)
          .maybeSingle();
        callerUserId = callerRow?.id ?? null;
      }
    }

    // 1. Enrollment + student + user + course (para license_class)
    const { data: enrollment, error: enrollmentErr } = await supabase
      .from('enrollments')
      .select(
        `
        id,
        branch_id,
        students!inner(
          id,
          users!inner(first_names, paternal_last_name, maternal_last_name, rut)
        ),
        courses!inner(license_class),
        promotion_courses!inner(
          professional_promotions!inner(name, start_date, end_date)
        )
      `,
      )
      .eq('id', enrollment_id)
      .single();

    if (enrollmentErr || !enrollment) {
      return jsonRes({ error: `Enrollment ${enrollment_id} no encontrado` }, 404);
    }

    const u = enrollment.students.users;
    const fullName = [u.paternal_last_name, u.maternal_last_name, u.first_names]
      .filter(Boolean)
      .join(' ')
      .toUpperCase();
    const rut = u.rut ?? '';

    const licenseClass = enrollment.courses?.license_class ?? 'A4';
    const courseLabel = getCourseLabel(licenseClass);

    const promo = enrollment.promotion_courses?.professional_promotions;
    const startDate = promo?.start_date ? fmtDateShort(promo.start_date) : '';
    const endDate = promo?.end_date ? fmtDateShort(promo.end_date) : '';

    // 3. Logo + contenido editable de la sede real del enrollment
    const [logo, content] = await Promise.all([
      loadPngForPdf(LOGO_URL),
      fetchDocumentContent(supabase, enrollment.branch_id, 'certificate_professional'),
    ]);

    // 4. Build PDF
    const pdfBytes = buildCertificatePdf({
      fullName,
      rut,
      courseLabel,
      startDate,
      endDate,
      todayText: todayInSpanish(),
      logo,
      content,
    });

    // 5. Upload en bucket 'documents', carpeta 'certificates_prof/'
    const fileName = `Certificado_Prof_${sanitize(fullName)}.pdf`;
    const storagePath = `certificates_prof/${enrollment_id}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) {
      return jsonRes({ error: `Upload failed: ${uploadErr.message}` }, 500);
    }

    // 6. Persistir path relativo en enrollments
    await supabase
      .from('enrollments')
      .update({ certificate_professional_pdf_url: storagePath })
      .eq('id', enrollment_id);

    // 7. Upsert registro en `certificates` y registrar en `certificate_issuance_log`
    const studentId: number = enrollment.students.id;
    let certId: number | null = null;

    const { data: existingCert } = await supabase
      .from('certificates')
      .select('id')
      .eq('enrollment_id', enrollment_id)
      .eq('type', 'professional')
      .maybeSingle();

    if (existingCert) {
      certId = existingCert.id;
    } else {
      const { data: maxFolioRes } = await supabase
        .from('certificates')
        .select('folio')
        .order('folio', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextFolio = (maxFolioRes?.folio ?? 0) + 1;

      const { data: newCert, error: certErr } = await supabase
        .from('certificates')
        .insert({
          folio: nextFolio,
          enrollment_id,
          student_id: studentId,
          type: 'professional',
          status: 'issued',
          issued_date: new Date().toISOString().split('T')[0],
          issued_by: callerUserId,
        })
        .select('id')
        .single();

      if (!certErr && newCert) certId = newCert.id;
    }

    if (certId !== null) {
      await supabase.from('certificate_issuance_log').insert({
        certificate_id: certId,
        action: 'generated',
        user_id: callerUserId,
      });
    }

    // 8. Signed URL de corta vida (1 hora)
    const { data: signedData, error: signErr } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600);

    if (signErr || !signedData) {
      return jsonRes({ error: `Signed URL failed: ${signErr?.message}` }, 500);
    }

    return jsonRes({ pdfUrl: signedData.signedUrl, pdfPath: storagePath });
  } catch (err) {
    console.error('generate-certificate-professional-pdf error:', err);
    return jsonRes({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

function jsonRes(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fetchDocumentContent(
  supabase: any,
  branchId: number,
  documentType: 'certificate_professional',
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('document_templates')
    .select('content')
    .eq('branch_id', branchId)
    .eq('document_type', documentType)
    .maybeSingle();
  return (data?.content as Record<string, string>) ?? {};
}

/** `btoa` no acepta `Uint8Array` directo — convierte byte a byte a un string binario primero. */
function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function handlePreviewOrSample(
  supabase: any,
  mode: 'preview' | 'sample',
  body: any,
): Promise<Response> {
  const { branch_id, content: draftContent } = body;

  if (!branch_id || typeof branch_id !== 'number') {
    return jsonRes({ error: 'branch_id (number) is required for preview/sample' }, 400);
  }

  const { data: branchExists } = await supabase
    .from('branches')
    .select('id')
    .eq('id', branch_id)
    .maybeSingle();
  if (!branchExists) {
    return jsonRes({ error: `Branch ${branch_id} not found` }, 404);
  }

  // 'preview' = borrador sin guardar. 'sample' = contenido REAL ya publicado.
  const content =
    mode === 'preview'
      ? ((draftContent as Record<string, string>) ?? {})
      : await fetchDocumentContent(supabase, branch_id, 'certificate_professional');

  const logo = await loadPngForPdf(LOGO_URL);
  const pdfBytes = buildCertificatePdf({
    fullName: SAMPLE_STUDENT.fullName,
    rut: SAMPLE_STUDENT.rut,
    courseLabel: SAMPLE_STUDENT.courseLabel,
    startDate: SAMPLE_STUDENT.startDate,
    endDate: SAMPLE_STUDENT.endDate,
    todayText: todayInSpanish(),
    logo,
    content,
  });

  return jsonRes({ pdfBase64: encodeBase64(pdfBytes) });
}

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

function fmtDateShort(ts: string): string {
  const d = new Date(ts);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function todayInSpanish(): string {
  const meses = [
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE',
  ];
  const d = new Date();
  return `${SCHOOL.city}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF Builder — Certificado Clase Profesional (una sola página, Carta)
// ══════════════════════════════════════════════════════════════════════════════

interface CertificateData {
  fullName: string;
  rut: string;
  courseLabel: string;
  startDate: string;
  endDate: string;
  todayText: string;
  logo: PdfImage | null;
  /** Contenido editable de `document_templates` (spec 0016-m) — claves: `encabezado_nombre`,
   * `encabezado_subtitulo`, `encabezado_direccion`, `intro`, `cuerpo`, `cierre`, `firma_nombre`,
   * `firma_cargo`. Una clave faltante usa el texto de `SCHOOL` como fallback (AC-E1). */
  content: Record<string, string>;
}

function buildCertificatePdf(d: CertificateData): Uint8Array {
  const W = 612,
    H = 792;
  const ML = 60,
    MR = 60;
  const cx = Math.round(W / 2);

  let ops = '';

  const T = (x: number, y: number, text: string, f: 'F1' | 'F2', size: number) => {
    ops += `BT /${f} ${size} Tf ${Math.round(x)} ${Math.round(y)} Td (${escapePdfWinAnsi(text)}) Tj ET\n`;
  };

  const TC = (y: number, text: string, f: 'F1' | 'F2', size: number) => {
    const w = textWidth(text, size, f === 'F2');
    T(cx - w / 2, y, text, f, size);
  };

  const paragraph = (
    yStart: number,
    text: string,
    f: 'F1' | 'F2',
    size: number,
    maxChars: number,
    leading: number,
    align: 'left' | 'center' = 'left',
  ): number => {
    const lines = wrap(text, maxChars);
    let y = yStart;
    for (const line of lines) {
      if (align === 'center') TC(y, line, f, size);
      else T(ML, y, line, f, size);
      y -= leading;
    }
    return y;
  };

  // ── ENCABEZADO ──
  const logo = d.logo;
  const logoH = 70;
  const logoW = logo ? Math.round((logo.width / logo.height) * logoH) : 0;
  let y = H - 60;

  if (logo) {
    ops += `q ${logoW} 0 0 ${logoH} ${ML} ${Math.round(y - logoH)} cm /Im1 Do Q\n`;
  }

  // Texto editable (spec 0016-m) — cada clave con fallback al `SCHOOL` histórico si la sede no
  // tiene fila sembrada en `document_templates` (AC-E1).
  const content = d.content;
  const encabezadoNombre = content['encabezado_nombre'] ?? SCHOOL.nameTop;
  const encabezadoSubtitulo = content['encabezado_subtitulo'] ?? SCHOOL.subtitle;
  const encabezadoDireccion = content['encabezado_direccion'] ?? SCHOOL.address;
  const introFallback =
    `${SCHOOL.legalRepFullName} representante legal, de ${SCHOOL.legalRepShort} ` +
    `Escuela de Conductores Profesionales Rut: ${SCHOOL.legalRepRut}, mediante el presente ` +
    `documento certifica que:`;
  const intro = content['intro'] ?? introFallback;
  const cierre = content['cierre'] ?? 'Se extiende el presente certificado para acreditar curso.';
  const firmaNombre = content['firma_nombre'] ?? SCHOOL.secretariaName;
  const firmaCargo = content['firma_cargo'] ?? SCHOOL.secretariaRole;

  const headerRightX = ML + logoW + 20;
  const headerCenterX = Math.round((headerRightX + (W - MR)) / 2);
  const headerTop = y - 18;

  ops += `0 0 0.55 rg\n`;
  const l1 = encabezadoNombre;
  const l1W = textWidth(l1, 11, true);
  T(headerCenterX - l1W / 2, headerTop, l1, 'F2', 11);
  ops += `0.6 w 0 0 0.55 RG ${Math.round(headerCenterX - l1W / 2)} ${Math.round(headerTop - 2)} m ${Math.round(headerCenterX + l1W / 2)} ${Math.round(headerTop - 2)} l S\n`;

  const l2 = encabezadoSubtitulo;
  const l2W = textWidth(l2, 10, true);
  T(headerCenterX - l2W / 2, headerTop - 14, l2, 'F2', 10);
  ops += `0.6 w ${Math.round(headerCenterX - l2W / 2)} ${Math.round(headerTop - 16)} m ${Math.round(headerCenterX + l2W / 2)} ${Math.round(headerTop - 16)} l S\n`;

  const l3W = textWidth(encabezadoDireccion, 8, false);
  T(headerCenterX - l3W / 2, headerTop - 28, encabezadoDireccion, 'F1', 8);
  ops += `0 0 0 rg 0 0 0 RG\n`;

  // ── Título ──
  y = H - 60 - logoH - 30;
  ops += `0 0 0.55 rg\n`;
  const titleTxt = 'Certificado';
  const titleSize = 18;
  const titleW = textWidth(titleTxt, titleSize, true);
  T(cx - titleW / 2, y, titleTxt, 'F2', titleSize);
  ops += `1.0 w 0 0 0.55 RG ${Math.round(cx - titleW / 2)} ${Math.round(y - 3)} m ${Math.round(cx + titleW / 2)} ${Math.round(y - 3)} l S\n`;
  ops += `0 0 0 rg 0 0 0 RG\n`;

  // ── Párrafo introductorio ──
  y -= 55;
  y = paragraph(y, intro, 'F1', 11, 78, 16, 'left');

  // ── Nombre y RUT ──
  y -= 24;
  TC(y, `El Sr.(a) ${d.fullName}`, 'F2', 11);
  y -= 16;
  TC(y, `RUT ${d.rut}`, 'F2', 11);

  // ── Párrafo del curso ──
  y -= 32;
  const startTxt = d.startDate || '__________';
  const endTxt = d.endDate || '__________';
  const cuerpoFallback =
    `Realiz\xF3 el Curso de {{cursoLabel}} en Nuestra Escuela entre los d\xEDas ` +
    `{{fechaInicio}} al {{fechaFin}} aprobando satisfactoriamente.`;
  const cuerpo = substituteTokens(content['cuerpo'] ?? cuerpoFallback, {
    cursoLabel: d.courseLabel,
    fechaInicio: startTxt,
    fechaFin: endTxt,
  });
  y = paragraph(y, cuerpo, 'F1', 11, 82, 16, 'left');

  // ── Cierre ──
  y -= 24;
  TC(y, cierre, 'F1', 11);

  // ── Firma ──
  y -= 70;
  TC(y, firmaNombre, 'F2', 11);
  y -= 14;
  TC(y, firmaCargo, 'F2', 10);

  // ── Fecha ciudad ──
  y -= 50;
  T(ML, y, d.todayText, 'F1', 10);

  return assemblePdf([ops], W, H, logo ?? undefined);
}
