// supabase/functions/export-certificates-zip/index.ts
//
// Edge Function: export-certificates-zip
//
// Descarga todos los certificados PDF generados de Clase B, los empaqueta
// en un archivo ZIP y lo retorna como respuesta binaria para descarga directa.
//
// Body esperado (todos opcionales):
//   branch_id : number | null — filtrar por sede; null = todas las sedes
//   type      : 'class_b' | 'professional' — tipo de certificado (default: 'class_b')
//
// Respuestas:
//   200  application/zip — archivo ZIP con los PDFs
//   401  { error: 'No autorizado' }
//   404  { error: 'No hay certificados generados para exportar' }
//   500  { error: '...' }
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import JSZip from 'npm:jszip@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Elimina tildes y caracteres especiales para nombres de archivo seguros. */
function sanitizeFilename(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Validar autenticación ────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'No autorizado' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) return jsonResponse({ error: 'No autorizado' }, 401);

    // Service role para bypass RLS y acceso a Storage
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Leer parámetros del body (todos opcionales) ──────────────────────────
    let branchId: number | null = null;
    let tipo: 'class_b' | 'professional' = 'class_b';
    try {
      const body = await req.json();
      branchId = typeof body.branch_id === 'number' ? body.branch_id : null;
      tipo = body.type === 'professional' ? 'professional' : 'class_b';
    } catch {
      // Sin body — usar defaults
    }

    const licenseGroup = tipo === 'professional' ? 'professional' : 'class_b';
    const pdfField =
      tipo === 'professional' ? 'certificate_professional_pdf_url' : 'certificate_b_pdf_url';

    // ── Consultar enrollments con PDF generado ───────────────────────────────
    let query = supabase
      .from('enrollments')
      .select(
        `
        id,
        certificate_b_pdf_url,
        certificate_professional_pdf_url,
        students!inner(
          users!inner(first_names, paternal_last_name, maternal_last_name)
        ),
        certificates(folio, created_at)
      `,
      )
      .eq('license_group', licenseGroup)
      .in('status', ['active', 'completed'])
      .not(pdfField, 'is', null);

    if (branchId !== null) {
      query = query.eq('branch_id', branchId);
    }

    const { data: enrollments, error: queryError } = await query;
    if (queryError) throw queryError;

    if (!enrollments || enrollments.length === 0) {
      return jsonResponse({ error: 'No hay certificados generados para exportar' }, 404);
    }

    // ── Construir ZIP ────────────────────────────────────────────────────────
    const zip = new JSZip();
    const usedFilenames = new Set<string>();

    const folioPrefix = tipo === 'professional' ? 'CERT-PROF' : 'CERT';

    for (const enrollment of enrollments) {
      const path = (enrollment as any)[pdfField] as string;
      const studentUser = (enrollment.students as any)?.users;
      const cert = Array.isArray(enrollment.certificates)
        ? enrollment.certificates[0]
        : enrollment.certificates;

      // Nombre de archivo: CERT[-PROF]-YYYY-NNNN_APELLIDOS_NOMBRES.pdf
      const year = cert?.created_at
        ? new Date(cert.created_at).getFullYear()
        : new Date().getFullYear();
      const folio = cert?.folio ? String(cert.folio).padStart(4, '0') : '0000';
      const apellidos = sanitizeFilename(
        [studentUser?.paternal_last_name, studentUser?.maternal_last_name]
          .filter(Boolean)
          .join(' '),
      );
      const nombres = sanitizeFilename(studentUser?.first_names ?? '');
      let filename = `${folioPrefix}-${year}-${folio}_${apellidos}_${nombres}.pdf`;

      // Evitar colisiones de nombre (poco probable pero posible)
      if (usedFilenames.has(filename)) {
        filename = `${folioPrefix}-${year}-${folio}_${apellidos}_${nombres}_${enrollment.id}.pdf`;
      }
      usedFilenames.add(filename);

      // Obtener signed URL y descargar PDF
      const { data: signedData, error: signedError } = await supabase.storage
        .from('documents')
        .createSignedUrl(path, 300);

      if (signedError || !signedData?.signedUrl) {
        console.warn(`[export-zip] Skipping ${filename}: no signed URL`);
        continue;
      }

      const pdfResponse = await fetch(signedData.signedUrl);
      if (!pdfResponse.ok) {
        console.warn(`[export-zip] Skipping ${filename}: fetch failed ${pdfResponse.status}`);
        continue;
      }

      const pdfBuffer = await pdfResponse.arrayBuffer();
      zip.file(filename, pdfBuffer);
    }

    if (zip.files && Object.keys(zip.files).length === 0) {
      return jsonResponse({ error: 'No se pudo descargar ningún certificado' }, 500);
    }

    // ── Generar y retornar ZIP ───────────────────────────────────────────────
    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
    const dateStr = new Date().toISOString().split('T')[0];
    const tipoSlug = tipo === 'professional' ? 'profesional' : 'clase-b';
    const zipFilename = `certificados-${tipoSlug}-${dateStr}.zip`;

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
      },
    });
  } catch (err) {
    console.error('export-certificates-zip error:', err);
    return jsonResponse({ error: `Error interno: ${err?.message ?? 'desconocido'}` }, 500);
  }
});
