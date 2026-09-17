// supabase/functions/generate-contract-pdf/index.ts
//
// Edge Function: generate-contract-pdf
//
// Genera un PDF de contrato de matrícula a partir de los datos del enrollment,
// lo sube a Supabase Storage y registra/actualiza el registro en digital_contracts.
//
// Invocación desde el frontend (mode 'real', default):
//   await supabase.functions.invoke('generate-contract-pdf', {
//     body: { enrollment_id: 42 }
//   })
//
// Spec 0016-m — modos adicionales para el editor de plantillas (`document_templates`), ninguno
// persiste en Storage/digital_contracts, ambos usan un alumno ficticio (nunca datos reales):
//   mode: 'sample'  → { branch_id, document_type } — contenido REAL de document_templates
//   mode: 'preview' → { branch_id, document_type, content } — contenido en BORRADOR sin guardar
// Ambos responden { pdfBase64 } en vez de { pdfUrl, pdfPath }.
//
// Respuesta exitosa (mode 'real'): { pdfUrl: "https://...storage.../contracts/42/Contrato_..." }
// @ts-nocheck

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  type EnrollmentData,
  buildStructuredPdf,
  tryLoadIdPhoto,
} from '../_shared/contract-pdf.ts';
import { loadPngForPdf } from '../_shared/pdf-utils.ts';

// Mismo logo que generate-certificate-b-pdf / generate-certificate-professional-pdf /
// generate-student-license-pdf — bucket público `assets` de Storage, no un archivo del repo.
const LOGO_URL =
  'https://skvekggejikzxhzsjmkz.supabase.co/storage/v1/object/public/assets/chillan_capacita.png';

// ─── CORS headers ───

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Main handler ───

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Parse request body
    const body = await req.json();
    const mode: 'real' | 'preview' | 'sample' = body.mode ?? 'real';

    // 2. Create Supabase admin client (service_role for full access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (mode === 'preview' || mode === 'sample') {
      return await handlePreviewOrSample(supabase, mode, body);
    }

    // ── mode: 'real' (comportamiento existente, sin cambios de contrato público) ──
    const { enrollment_id } = body;

    if (!enrollment_id || typeof enrollment_id !== 'number') {
      return new Response(JSON.stringify({ error: 'enrollment_id (number) is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch enrollment with related data
    const { data: enrollment, error: fetchError } = await supabase
      .from('enrollments')
      .select(
        `
        id,
        student_id,
        course_id,
        branch_id,
        number,
        base_price,
        discount,
        total_paid,
        pending_balance,
        payment_mode,
        created_at,
        students!inner (
          birth_date,
          address,
          users!inner (
            rut,
            first_names,
            paternal_last_name,
            maternal_last_name,
            email,
            phone
          )
        ),
        courses!inner (
          name,
          license_class,
          duration_weeks,
          practical_hours,
          theory_hours
        ),
        branches!inner (
          name,
          address,
          slug,
          email,
          phone
        )
      `,
      )
      .eq('id', enrollment_id)
      .single();

    if (fetchError || !enrollment) {
      return new Response(
        JSON.stringify({ error: `Enrollment ${enrollment_id} not found: ${fetchError?.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Flatten nested relations
    const data = flattenEnrollment(enrollment);

    // 3c. Número previsto para drafts sin confirmar aún (secretaría genera/previsualiza el
    // contrato en el paso 5 del wizard, ANTES de la confirmación final — que es donde recién se
    // asigna `enrollments.number`, ver `EnrollmentFacade.generateEnrollmentNumber()`). Sin esto el
    // contrato imprime "N° -" hasta confirmar, aunque el alumno ya lo esté firmando en ese paso.
    // Misma función de solo lectura que usa la confirmación real y el preview público — no reserva
    // ni consume nada, así que llamarla acá es seguro.
    if (!data.number && enrollment.course_id) {
      const { data: previewNumber, error: previewNumberErr } = await supabase.rpc(
        'get_next_enrollment_number',
        { p_course_id: enrollment.course_id },
      );
      if (previewNumberErr) {
        console.error('generate-contract-pdf: get_next_enrollment_number failed', {
          enrollmentId: enrollment_id,
          courseId: enrollment.course_id,
          error: previewNumberErr,
        });
      }
      data.number = previewNumber ?? null;
    }

    // 4. Generate structured PDF directly from enrollment data
    const documentType: DocumentType =
      data.course.license_class === 'B' ? 'contract_b' : 'contract_professional';
    const [idPhoto, logo, content] = await Promise.all([
      tryLoadIdPhoto(supabase, enrollment_id),
      loadPngForPdf(LOGO_URL),
      fetchDocumentContent(supabase, enrollment.branch_id, documentType),
    ]);
    const pdfBytes = buildStructuredPdf(data, null, idPhoto, logo, content);

    // 5. Build filename and upload to Storage
    const studentName = sanitizeFilename(
      `${data.student.user.first_names}_${data.student.user.paternal_last_name}`,
    );
    const year = new Date().getFullYear();
    const fileName = `Contrato_${studentName}_${year}.pdf`;
    const storagePath = `contracts/${enrollment_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: `Storage upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 6. Upsert digital_contracts — guardamos el path relativo (bucket privado).
    const { error: contractError } = await supabase.from('digital_contracts').upsert(
      {
        enrollment_id,
        file_name: fileName,
        file_url: storagePath,
        content_hash: await computeHash(pdfBytes),
      },
      { onConflict: 'enrollment_id' },
    );

    if (contractError) {
      console.error('digital_contracts upsert error:', contractError);
      // Non-fatal: the PDF was uploaded, just the DB record failed
    }

    // 7. Generar signed URL (TTL 1h) para visualización inmediata en el cliente.
    const { data: signedData, error: signErr } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600);
    const pdfUrl = signErr ? null : signedData?.signedUrl;

    return new Response(JSON.stringify({ pdfUrl, pdfPath: storagePath }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-contract-pdf error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Helper functions
// ══════════════════════════════════════════════════════════════════════════════

function flattenEnrollment(raw: any): EnrollmentData {
  return {
    id: raw.id,
    number: raw.number,
    base_price: raw.base_price,
    discount: raw.discount,
    total_paid: raw.total_paid ?? null,
    pending_balance: raw.pending_balance ?? null,
    payment_mode: raw.payment_mode ?? null,
    created_at: raw.created_at,
    student: {
      birth_date: raw.students.birth_date,
      address: raw.students.address,
      user: {
        rut: raw.students.users.rut,
        first_names: raw.students.users.first_names,
        paternal_last_name: raw.students.users.paternal_last_name,
        maternal_last_name: raw.students.users.maternal_last_name,
        email: raw.students.users.email,
        phone: raw.students.users.phone,
      },
    },
    course: {
      name: raw.courses.name,
      license_class: raw.courses.license_class,
      duration_weeks: raw.courses.duration_weeks,
      practical_hours: raw.courses.practical_hours,
      theory_hours: raw.courses.theory_hours,
    },
    branch: {
      name: raw.branches.name,
      address: raw.branches.address,
      slug: raw.branches.slug ?? null,
      email: raw.branches.email ?? null,
      phone: raw.branches.phone ?? null,
    },
  };
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

async function computeHash(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// PDF generation functions are imported from ../_shared/contract-pdf.ts

// ══════════════════════════════════════════════════════════════════════════════
// Spec 0016-m — modos 'preview'/'sample' (editor de plantillas, sin persistencia)
// ══════════════════════════════════════════════════════════════════════════════

type DocumentType = 'contract_b' | 'contract_professional';

/** Alumno ficticio para preview/vista default — nunca corresponde a un enrollment real
 * (confirmado con el owner, 2026-09-16). */
const SAMPLE_STUDENT = {
  rut: '11.111.111-1',
  first_names: 'Alumno',
  paternal_last_name: 'De Prueba',
  maternal_last_name: 'Ejemplo',
  email: 'alumno.prueba@ejemplo.cl',
  phone: '+56 9 1111 1111',
};

/** `courses.base_price` real de la sede para el tipo de curso de la muestra — evita mostrarle a
 * quien edita un precio inventado que podría confundirse con un valor vigente (fix post-0016-m,
 * hallazgo del owner). Si la sede no tiene ese curso sembrado, cae a un valor fijo razonable. */
async function fetchSampleBasePrice(
  supabase: any,
  branchId: number,
  licenseClass: string,
): Promise<number> {
  const { data } = await supabase
    .from('courses')
    .select('base_price')
    .eq('branch_id', branchId)
    .eq('license_class', licenseClass)
    .eq('active', true)
    .not('base_price', 'is', null)
    .limit(1)
    .maybeSingle();
  return data?.base_price ?? 500000;
}

function buildSampleEnrollmentData(
  branch: {
    name: string;
    address: string | null;
    slug: string | null;
    email: string | null;
    phone: string | null;
  },
  documentType: DocumentType,
  basePrice: number,
): EnrollmentData {
  const isClassB = documentType === 'contract_b';
  return {
    id: 0,
    number: 'MUESTRA',
    base_price: basePrice,
    discount: 0,
    total_paid: null,
    pending_balance: null,
    payment_mode: 'total',
    created_at: new Date().toISOString(),
    student: {
      birth_date: '2000-01-01',
      address: 'Direcci\xF3n de ejemplo 123',
      user: SAMPLE_STUDENT,
    },
    course: {
      name: isClassB ? 'Curso Clase B' : 'Curso Profesional A4',
      license_class: isClassB ? 'B' : 'A4',
      duration_weeks: null,
      practical_hours: isClassB ? 9 : null,
      theory_hours: isClassB ? 12 : null,
    },
    branch: {
      name: branch.name,
      address: branch.address,
      slug: branch.slug,
      email: branch.email,
      phone: branch.phone,
    },
  };
}

async function fetchDocumentContent(
  supabase: any,
  branchId: number,
  documentType: DocumentType,
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('document_templates')
    .select('content')
    .eq('branch_id', branchId)
    .eq('document_type', documentType)
    .maybeSingle();
  return (data?.content as Record<string, string>) ?? {};
}

function jsonRes(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
  const { branch_id, document_type, content: draftContent } = body;

  if (!branch_id || typeof branch_id !== 'number') {
    return jsonRes({ error: 'branch_id (number) is required for preview/sample' }, 400);
  }
  if (document_type !== 'contract_b' && document_type !== 'contract_professional') {
    return jsonRes({ error: "document_type must be 'contract_b' or 'contract_professional'" }, 400);
  }

  const { data: branch, error: branchErr } = await supabase
    .from('branches')
    .select('name, address, slug, email, phone')
    .eq('id', branch_id)
    .single();
  if (branchErr || !branch) {
    return jsonRes({ error: `Branch ${branch_id} not found` }, 404);
  }

  // 'preview' = borrador sin guardar (nunca toca document_templates). 'sample' = contenido REAL
  // ya publicado, para la vista de solo lectura del documento default.
  const content =
    mode === 'preview'
      ? ((draftContent as Record<string, string>) ?? {})
      : await fetchDocumentContent(supabase, branch_id, document_type);

  const licenseClass = document_type === 'contract_b' ? 'B' : 'A4';
  const basePrice = await fetchSampleBasePrice(supabase, branch_id, licenseClass);
  const data = buildSampleEnrollmentData(branch, document_type, basePrice);
  const logo = await loadPngForPdf(LOGO_URL);
  const pdfBytes = buildStructuredPdf(data, null, null, logo, content);

  return jsonRes({ pdfBase64: encodeBase64(pdfBytes) });
}
