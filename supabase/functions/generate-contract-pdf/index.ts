// supabase/functions/generate-contract-pdf/index.ts
//
// Edge Function: generate-contract-pdf
//
// Genera un PDF de contrato de matrícula a partir de los datos del enrollment,
// lo sube a Supabase Storage y registra/actualiza el registro en digital_contracts.
//
// Invocación desde el frontend:
//   await supabase.functions.invoke('generate-contract-pdf', {
//     body: { enrollment_id: 42 }
//   })
//
// Respuesta exitosa: { pdfUrl: "https://...storage.../contracts/42/Contrato_..." }
// @ts-nocheck

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  type EnrollmentData,
  buildStructuredPdf,
  formatDate,
  formatCurrency,
  escapePdfWinAnsi,
  wrapTextToLines,
  assemblePdf,
} from '../_shared/contract-pdf.ts';

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
    const { enrollment_id } = await req.json();

    if (!enrollment_id || typeof enrollment_id !== 'number') {
      return new Response(JSON.stringify({ error: 'enrollment_id (number) is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Create Supabase admin client (service_role for full access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Fetch enrollment with related data
    const { data: enrollment, error: fetchError } = await supabase
      .from('enrollments')
      .select(
        `
        id,
        student_id,
        number,
        base_price,
        discount,
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
          address
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

    // 3b. Fetch license_validations por separado para evitar dependencia del caché FK de PostgREST.
    const { data: licenseValidation } = await supabase
      .from('license_validations')
      .select('convalidated_license, reduced_hours')
      .eq('enrollment_id', enrollment_id)
      .maybeSingle();

    // Flatten nested relations
    const data = flattenEnrollment(enrollment, licenseValidation);

    // 4. Generate structured PDF directly from enrollment data
    const pdfBytes = buildStructuredPdf(data);

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

function flattenEnrollment(
  raw: any,
  licenseValidation?: { convalidated_license: 'A4' | 'A3'; reduced_hours: number } | null,
): EnrollmentData {
  return {
    id: raw.id,
    number: raw.number,
    base_price: raw.base_price,
    discount: raw.discount,
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
    },
    convalidation: licenseValidation ?? null,
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

