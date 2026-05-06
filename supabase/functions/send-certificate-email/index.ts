// supabase/functions/send-certificate-email/index.ts
//
// Edge Function: send-certificate-email
//
// Envía el certificado de finalización (Clase B o Profesional) por correo al alumno.
// El PDF se descarga desde Supabase Storage y se adjunta al email.
// Registra la acción en certificate_issuance_log.
//
// Body esperado:
//   enrollment_id : number  — ID del enrollment cuyo certificado se enviará
//   type          : string  — 'class_b' (default) | 'professional'
//
// Respuestas:
//   200  { success: true; recipientEmail: string }
//   400  { error: '...' }
//   401  { error: 'No autorizado' }
//   404  { error: '...' }
//   500  { error: '...' }
//
// Secrets requeridos (Supabase Dashboard → Edge Functions → Secrets):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';

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

function buildEmailHtml(nombre: string, folio: string, tipo: 'class_b' | 'professional'): string {
  const tipoLabel = tipo === 'professional' ? 'Clase Profesional' : 'Clase B';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu Certificado de Finalización — ${tipoLabel}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif; background-color: #f1f5f9; line-height: 1.6; }
    .email-wrapper { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .email-header { background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 60%, #8b5cf6 100%); padding: 44px 36px 40px; text-align: center; position: relative; overflow: hidden; }
    .email-header::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px); background-size: 36px 36px; }
    .logo-badge { width: 60px; height: 60px; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; backdrop-filter: blur(8px); }
    .logo-badge span { color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .company-name { color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .email-body { padding: 44px 36px 36px; }
    .greeting { font-size: 13px; font-weight: 600; color: #0ea5e9; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
    .title { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-bottom: 12px; }
    .subtitle { font-size: 15px; color: #64748b; margin-bottom: 28px; line-height: 1.7; }
    .divider { height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent); margin: 24px 0; }
    .info-box { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 3px solid #0ea5e9; padding: 18px 20px; border-radius: 10px; margin-bottom: 28px; }
    .info-box-label { font-size: 11px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
    .info-box-value { font-size: 16px; font-weight: 700; color: #0c4a6e; }
    .attachment-note { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: flex-start; gap: 12px; }
    .attachment-note-text { font-size: 14px; color: #475569; line-height: 1.6; }
    .attachment-note-text strong { color: #0f172a; }
    .email-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 28px 36px; text-align: center; }
    .footer-divider { width: 40px; height: 2px; background: linear-gradient(to right, #0ea5e9, #6366f1); border-radius: 2px; margin: 0 auto 14px; }
    .footer-brand { font-size: 14px; font-weight: 700; color: #334155; margin-bottom: 6px; }
    .footer-text { font-size: 12px; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-header">
    <div class="logo-badge"><span>CC</span></div>
    <p class="company-name">Conductores Chillán</p>
  </div>
  <div class="email-body">
    <p class="greeting">${tipoLabel} · Finalización de Curso</p>
    <h1 class="title">¡Felicidades,<br>${nombre}!</h1>
    <p class="subtitle">Has completado exitosamente tu curso de ${tipoLabel}. Adjunto encontrarás tu certificado oficial de finalización.</p>
    <div class="info-box">
      <p class="info-box-label">N° de Certificado</p>
      <p class="info-box-value">${folio}</p>
    </div>
    <div class="divider"></div>
    <div class="attachment-note">
      <div class="attachment-note-text">
        <strong>Certificado adjunto</strong><br>
        Tu certificado en formato PDF está adjunto a este correo. Guárdalo en un lugar seguro, ya que es tu comprobante oficial de finalización del curso de ${tipoLabel}.
      </div>
    </div>
    <p style="font-size: 13px; color: #94a3b8; text-align: center;">Si tienes alguna consulta, contáctanos directamente en nuestra escuela.</p>
  </div>
  <div class="email-footer">
    <div class="footer-divider"></div>
    <p class="footer-brand">Conductores Chillán</p>
    <p class="footer-text">Este correo fue enviado automáticamente. Por favor no responder.<br>© 2026 Conductores Chillán. Todos los derechos reservados.</p>
  </div>
</div>
</body>
</html>`;
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

    // Validar que el solicitante está autenticado como admin/secretaria
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) return jsonResponse({ error: 'No autorizado' }, 401);

    // Service role para operaciones de BD (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener user_id del admin/secretaria para el log
    const { data: adminUser } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_uid', user.id)
      .maybeSingle();

    // ── Validar body ─────────────────────────────────────────────────────────
    const body = await req.json();
    const { enrollment_id } = body;
    const tipo: 'class_b' | 'professional' =
      body.type === 'professional' ? 'professional' : 'class_b';
    const pdfField =
      tipo === 'professional' ? 'certificate_professional_pdf_url' : 'certificate_b_pdf_url';

    if (!enrollment_id || typeof enrollment_id !== 'number') {
      return jsonResponse({ error: 'enrollment_id (number) es requerido' }, 400);
    }

    // ── 1. Obtener datos del enrollment + alumno ─────────────────────────────
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(
        `
        id,
        certificate_b_pdf_url,
        certificate_professional_pdf_url,
        certificates(id, folio, created_at),
        students!inner(
          users!inner(first_names, paternal_last_name, email)
        )
      `,
      )
      .eq('id', enrollment_id)
      .maybeSingle();

    if (enrollmentError || !enrollment) {
      return jsonResponse({ error: 'Matrícula no encontrada' }, 404);
    }

    const pdfUrl = enrollment[pdfField];
    if (!pdfUrl) {
      return jsonResponse({ error: 'El certificado aún no ha sido generado' }, 400);
    }

    const cert = Array.isArray(enrollment.certificates)
      ? enrollment.certificates[0]
      : enrollment.certificates;

    if (!cert) {
      return jsonResponse({ error: 'No se encontró el registro del certificado' }, 404);
    }

    const studentUser = (enrollment.students as any)?.users;
    if (!studentUser?.email) {
      return jsonResponse({ error: 'El alumno no tiene email registrado' }, 400);
    }

    const firstName = studentUser.first_names ?? '';
    const lastName = studentUser.paternal_last_name ?? '';
    const nombre = `${firstName} ${lastName}`.trim();
    const email = studentUser.email as string;

    const certYear = cert.created_at
      ? new Date(cert.created_at).getFullYear()
      : new Date().getFullYear();
    const folioPrefix = tipo === 'professional' ? 'CERT-PROF' : 'CERT';
    const folio = `${folioPrefix}-${certYear}-${String(cert.folio).padStart(4, '0')}`;

    // ── 2. Descargar el PDF desde Storage ────────────────────────────────────
    const { data: signedData, error: signedError } = await supabase.storage
      .from('documents')
      .createSignedUrl(pdfUrl, 300);

    if (signedError || !signedData?.signedUrl) {
      console.error('Error generando signed URL:', signedError);
      return jsonResponse({ error: 'No se pudo acceder al archivo del certificado' }, 500);
    }

    const pdfResponse = await fetch(signedData.signedUrl);
    if (!pdfResponse.ok) {
      return jsonResponse({ error: 'No se pudo descargar el PDF del certificado' }, 500);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    // ── 3. Configurar transporte SMTP y enviar ───────────────────────────────
    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST'),
      port: Number(Deno.env.get('SMTP_PORT') ?? 465),
      secure: Number(Deno.env.get('SMTP_PORT') ?? 465) === 465,
      auth: {
        user: Deno.env.get('SMTP_USER'),
        pass: Deno.env.get('SMTP_PASS'),
      },
    });

    const from = Deno.env.get('SMTP_FROM') ?? Deno.env.get('SMTP_USER');

    const tipoLabel = tipo === 'professional' ? 'Clase Profesional' : 'Clase B';
    const safeNombre = nombre.replace(/\s+/g, '_').toUpperCase();
    await transporter.sendMail({
      from,
      to: email,
      subject: `Tu Certificado de Finalización — ${tipoLabel} · ${folio}`,
      html: buildEmailHtml(nombre, folio, tipo),
      attachments: [
        {
          filename: `Certificado_${safeNombre}.pdf`,
          content: new Uint8Array(pdfBuffer),
          contentType: 'application/pdf',
        },
      ],
    });

    // ── 4. Registrar en el log ───────────────────────────────────────────────
    await supabase.from('certificate_issuance_log').insert({
      certificate_id: cert.id,
      action: 'email_sent',
      user_id: adminUser?.id ?? null,
    });

    return jsonResponse({ success: true, recipientEmail: email });
  } catch (err) {
    console.error('send-certificate-email error:', err);
    return jsonResponse({ error: `Error interno: ${err?.message ?? 'desconocido'}` }, 500);
  }
});
