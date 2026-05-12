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
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { escapePdfWinAnsi, textWidth, loadPngForPdf, assemblePdf, wrapLines as wrap } from '../_shared/pdf-utils.ts';


// ─── CORS ───
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Constantes de la escuela ───
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
    const { enrollment_id } = await req.json();
    if (!enrollment_id || typeof enrollment_id !== 'number') {
      return jsonRes({ error: 'enrollment_id (number) is required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

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

    // 3. Logo
    const logo = await loadPngForPdf(LOGO_URL);

    // 4. Build PDF
    const pdfBytes = buildCertificatePdf({
      fullName,
      rut,
      courseLabel,
      startDate,
      endDate,
      todayText: todayInSpanish(),
      logo,
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

  const headerRightX = ML + logoW + 20;
  const headerCenterX = Math.round((headerRightX + (W - MR)) / 2);
  const headerTop = y - 18;

  ops += `0 0 0.55 rg\n`;
  const l1 = SCHOOL.nameTop;
  const l1W = textWidth(l1, 11, true);
  T(headerCenterX - l1W / 2, headerTop, l1, 'F2', 11);
  ops += `0.6 w 0 0 0.55 RG ${Math.round(headerCenterX - l1W / 2)} ${Math.round(headerTop - 2)} m ${Math.round(headerCenterX + l1W / 2)} ${Math.round(headerTop - 2)} l S\n`;

  const l2 = SCHOOL.subtitle;
  const l2W = textWidth(l2, 10, true);
  T(headerCenterX - l2W / 2, headerTop - 14, l2, 'F2', 10);
  ops += `0.6 w ${Math.round(headerCenterX - l2W / 2)} ${Math.round(headerTop - 16)} m ${Math.round(headerCenterX + l2W / 2)} ${Math.round(headerTop - 16)} l S\n`;

  const l3W = textWidth(SCHOOL.address, 8, false);
  T(headerCenterX - l3W / 2, headerTop - 28, SCHOOL.address, 'F1', 8);
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
  const intro =
    `${SCHOOL.legalRepFullName} representante legal, de ${SCHOOL.legalRepShort} ` +
    `Escuela de Conductores Profesionales Rut: ${SCHOOL.legalRepRut}, mediante el presente ` +
    `documento certifica que:`;
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
  const body =
    `Realiz\xF3 el Curso de ${d.courseLabel} en Nuestra Escuela entre los d\xEDas ` +
    `${startTxt} al ${endTxt} aprobando satisfactoriamente.`;
  y = paragraph(y, body, 'F1', 11, 82, 16, 'left');

  // ── Cierre ──
  y -= 24;
  TC(y, 'Se extiende el presente certificado para acreditar curso.', 'F1', 11);

  // ── Firma ──
  y -= 70;
  TC(y, SCHOOL.secretariaName, 'F2', 11);
  y -= 14;
  TC(y, SCHOOL.secretariaRole, 'F2', 10);

  // ── Fecha ciudad ──
  y -= 50;
  T(ML, y, d.todayText, 'F1', 10);

  return assemblePdf([ops], W, H, logo ?? undefined);
}
