// supabase/functions/create-instructor/index.ts
//
// Edge Function: create-instructor
//
// Crea un nuevo instructor en Supabase Auth + tabla users + tabla instructors.
// Requiere SERVICE_ROLE_KEY para bypassear RLS y usar Admin Auth API.
//
// Body esperado:
//   firstNames        : string  — nombre(s) del instructor
//   paternalLastName  : string  — apellido paterno
//   maternalLastName  : string  — apellido materno (opcional)
//   rut               : string  — RUT chileno formateado
//   email             : string  — correo de acceso
//   phone             : string  — teléfono de contacto
//   type              : string  — 'theory' | 'practice' | 'both'
//   licenseNumber     : string  — número de licencia
//   licenseClass      : string  — clase de licencia (ej: 'B', 'A2', 'A3')
//   licenseExpiry     : string  — fecha de vencimiento ISO (YYYY-MM-DD)
//   vehicleId         : number | null — ID del vehículo a asignar (opcional)
//   bothBranches      : boolean — instructor dicta clases en las dos sedes (spec 0004-m).
//                        Solo admin puede pedirlo — se fuerza false para secretary.
//
// Flujo:
//   1. Valida que el llamador sea admin o secretary
//   2. Crea la cuenta en Supabase Auth vía auth.admin.generateLink({ type: 'invite' })
//      (crea el usuario y devuelve el link de activación SIN enviar correo nativo —
//      ese template es exclusivo del flujo de alumno)
//   3. Inserta en public.users con role_id = instructor
//   4. Inserta en public.instructors
//   5. Si vehicleId, inserta en vehicle_assignments
//   6. Envía correo de invitación propio vía SMTP (mismo patrón que send-zoom-email /
//      send-certificate-email) con el link de activación — el instructor setea su
//      propia contraseña al hacer clic
//   7. Rollback en cascada si algo falla en los pasos 3-4 (el correo, paso 6, es
//      best-effort y no dispara rollback)
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

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function buildInviteEmailHtml(name: string, actionLink: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activa tu cuenta de instructor</title>
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
    .cta-section { text-align: center; margin: 28px 0 20px; }
    .cta-label { font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); color: #ffffff !important; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; box-shadow: 0 4px 20px rgba(14,165,233,0.35); }
    .expiry-note { font-size: 13px; color: #94a3b8; margin-top: 14px; }
    .fallback-label { font-size: 12px; color: #94a3b8; margin: 20px 0 8px; text-align: center; }
    .fallback-link { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #475569; word-break: break-all; }
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
    <p class="greeting">Cuenta de instructor</p>
    <h1 class="title">Tu cuenta está<br>lista para activar</h1>
    <p class="subtitle">Hola <strong>${name}</strong>, se ha creado tu cuenta de instructor. Activa tu acceso para entrar a tu portal, donde podrás ver tu agenda de clases y gestionar tus alumnos.</p>
    <div class="divider"></div>
    <div class="cta-section">
      <p class="cta-label">Paso único</p>
      <a href="${actionLink}" class="cta-button">Activar mi cuenta</a>
      <p class="expiry-note">Al hacer clic podrás crear tu contraseña personal.</p>
    </div>
    <p class="fallback-label">O copia este enlace en tu navegador:</p>
    <p class="fallback-link">${actionLink}</p>
  </div>
  <div class="email-footer">
    <div class="footer-divider"></div>
    <p class="footer-brand">Conductores Chillán</p>
    <p class="footer-text">Este correo fue enviado automáticamente tras crear tu cuenta de instructor.<br>Si no esperabas este correo, puedes ignorarlo con seguridad.</p>
  </div>
</div>
</body>
</html>`;
}

async function sendInstructorInviteEmail(
  name: string,
  email: string,
  actionLink: string,
): Promise<void> {
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

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Activa tu cuenta de instructor',
    html: buildInviteEmailHtml(name, actionLink),
  });
}

function computeLicenseStatus(expiryDateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);

  if (expiry < today) return 'expired';

  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) return 'expiring_soon';
  return 'valid';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Cliente con service role (bypasea RLS) ────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Validar que el llamador es admin o secretary ────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('No autorizado', 401);

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user: caller },
    } = await supabaseUser.auth.getUser();
    if (!caller) return errorResponse('No autorizado', 401);

    const { data: callerRow } = await supabaseAdmin
      .from('users')
      .select('id, roles ( name )')
      .eq('supabase_uid', caller.id)
      .maybeSingle();

    const callerRole = callerRow?.roles?.name;
    if (callerRole !== 'admin' && callerRole !== 'secretary') {
      return errorResponse('Solo administradores y secretarias pueden crear instructores', 403);
    }

    // Cliente con header de auditoría — propaga el user_id del caller al trigger
    const supabaseAudit = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { 'x-audit-user-id': String(callerRow.id) } } },
    );

    // ── Leer body ─────────────────────────────────────────────────────────────
    const {
      firstNames,
      paternalLastName,
      maternalLastName,
      rut,
      email,
      phone,
      type,
      licenseNumber,
      licenseClass,
      licenseExpiry,
      vehicleId,
      branchId,
      bothBranches,
    } = await req.json();

    // Defensa en profundidad: solo admin puede crear un instructor "Ambas sedes"
    // (no confiar solo en que el front lo deshabilite para secretary).
    const effectiveBothBranches = callerRole === 'admin' ? Boolean(bothBranches) : false;

    if (
      !firstNames ||
      !paternalLastName ||
      !rut ||
      !email ||
      !type ||
      !licenseClass ||
      !licenseExpiry ||
      !branchId
    ) {
      return errorResponse(
        'Faltan campos requeridos: firstNames, paternalLastName, rut, email, type, licenseClass, licenseExpiry, branchId',
      );
    }

    // ── Validar licencia no vencida ─────────────────────────────────────────
    const licenseStatus = computeLicenseStatus(licenseExpiry);
    if (licenseStatus === 'expired') {
      return errorResponse('No se puede registrar un instructor con licencia vencida', 400);
    }

    // ── Obtener role_id de instructor ──────────────────────────────────────
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', 'instructor')
      .single();

    if (roleError || !roleRow) {
      return errorResponse('Rol "instructor" no encontrado en la BD', 500);
    }

    // ── Crear cuenta de instructor en Auth (sin password, invita por correo propio) ──
    // No usamos auth.admin.inviteUserByEmail: ese método dispara el correo nativo de
    // Supabase con el template invite-user.html, que es exclusivo del flujo de alumno
    // (copy de "matrícula", branding por sede). generateLink crea la cuenta y devuelve
    // el link de activación SIN enviar correo — el envío lo hacemos nosotros con SMTP
    // propio, igual que send-zoom-email / send-certificate-email.
    const fullName = `${firstNames} ${paternalLastName}${maternalLastName ? ' ' + maternalLastName : ''}`;
    const siteUrl = Deno.env.get('SITE_URL') ?? '';

    const { data: linkData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: siteUrl,
        data: { role: 'instructor', full_name: fullName },
      },
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes('already registered')) {
        return errorResponse('Ya existe un usuario con ese correo electrónico', 409);
      }
      return errorResponse(`Error al crear usuario en Auth: ${authError.message}`, 500);
    }

    const supabaseUid = linkData.user.id;
    const actionLink = linkData.properties.action_link;

    // ── Insertar en public.users ────────────────────────────────────────────
    const { data: userRow, error: insertUserError } = await supabaseAudit
      .from('users')
      .insert({
        supabase_uid: supabaseUid,
        rut,
        first_names: firstNames,
        paternal_last_name: paternalLastName,
        maternal_last_name: maternalLastName || null,
        email,
        phone: phone || null,
        role_id: roleRow.id,
        branch_id: branchId,
        active: true,
        first_login: true,
      })
      .select('id')
      .single();

    if (insertUserError) {
      await supabaseAdmin.auth.admin.deleteUser(supabaseUid);
      return errorResponse(`Error al registrar el usuario: ${insertUserError.message}`, 500);
    }

    // ── Insertar en public.instructors ───────────────────────────────────────
    const { data: instructorRow, error: insertInstructorError } = await supabaseAudit
      .from('instructors')
      .insert({
        user_id: userRow.id,
        type,
        license_number: licenseNumber || null,
        license_class: licenseClass,
        license_expiry: licenseExpiry,
        license_status: licenseStatus,
        active: true,
        registration_date: new Date().toISOString().split('T')[0],
        both_branches: effectiveBothBranches,
      })
      .select('id')
      .single();

    if (insertInstructorError) {
      // Rollback: eliminar user + auth
      await supabaseAdmin.from('users').delete().eq('id', userRow.id);
      await supabaseAdmin.auth.admin.deleteUser(supabaseUid);
      return errorResponse(
        `Error al registrar el instructor: ${insertInstructorError.message}`,
        500,
      );
    }

    // ── Asignar vehículo (opcional) ─────────────────────────────────────────
    if (vehicleId) {
      const { error: assignError } = await supabaseAdmin.from('vehicle_assignments').insert({
        instructor_id: instructorRow.id,
        vehicle_id: vehicleId,
        start_date: new Date().toISOString().split('T')[0],
        assigned_by: callerRow.id,
      });

      if (assignError) {
        // No hacemos rollback completo por error de asignación,
        // el instructor ya fue creado exitosamente
        console.error('Error al asignar vehículo:', assignError.message);
      }
    }

    // ── Enviar correo de invitación (setea su propia contraseña) ────────────
    try {
      await sendInstructorInviteEmail(fullName, email, actionLink);
    } catch (emailError) {
      // No hacemos rollback: el instructor ya fue creado exitosamente.
      // Un admin puede reenviar el link manualmente (generateLink es idempotente).
      console.error('Error al enviar correo de invitación:', emailError?.message ?? emailError);
    }

    return jsonResponse({ success: true, email, instructorId: instructorRow.id }, 201);
  } catch (err) {
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
