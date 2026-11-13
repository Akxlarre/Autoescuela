import { chileToday, diffDaysIso, toChileDate } from '../_shared/chile-time.ts';
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
//   sendInvite        : boolean (opcional, default true) — false durante el piloto del portal
//                        de instructores (fix-214-b): crea la cuenta sin mandar el correo.
//
// Respuesta 201: { success, email, instructorId, inviteEmailSent } — inviteEmailSent=false si
// no se pidió el correo o si el envío falló (fix-214-b, C29).
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
import { loadSchoolSender, withSchool } from '../_shared/school-email.ts';
import { createSmtpTransport, platformAddress, sendSchoolMail } from '../_shared/school-mailer.ts';
import { loadSchoolTheme } from '../_shared/school-theme.ts';
import {
  INSTRUCTOR_INVITE_SUBJECT,
  buildInstructorInviteEmailHtml,
} from '../_shared/instructor-invite-email.ts';
import { authorizeInstructorCreate, editCallerFrom } from '../_shared/user-edit-authz.ts';
import { requireStaff } from '../_shared/staff-auth.ts';
import {
  duplicateUserMessage,
  EMAIL_TAKEN_MESSAGE,
  isEmailTakenError,
  isUniqueViolation,
} from '../_shared/email-errors.ts';

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

async function sendInstructorInviteEmail(
  // deno-lint-ignore no-explicit-any
  service: any,
  branchId: number | null,
  name: string,
  email: string,
  actionLink: string,
): Promise<void> {
  // spec 0061-b (AC4): a nombre de la escuela del instructor (users.branch_id; con both_branches,
  // su escuela principal). Plantilla compartida en _shared/instructor-invite-email.ts.
  const sender = await loadSchoolSender(service, branchId, platformAddress());
  await sendSchoolMail(createSmtpTransport(), sender, {
    to: email,
    subject: withSchool(INSTRUCTOR_INVITE_SUBJECT, sender),
    html: buildInstructorInviteEmailHtml(
      name,
      actionLink,
      sender,
      await loadSchoolTheme(service, branchId),
    ),
  });
}

function computeLicenseStatus(expiryDateStr: string): string {
  // Días de calendario hasta el vencimiento, contados desde el hoy de Chile.
  const diffDays = diffDaysIso(chileToday(), toChileDate(expiryDateStr));

  if (diffDays < 0) return 'expired';
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

    // ── Validar que el llamador es admin o secretary (fix-235-b: helper compartido) ──
    const access = await requireStaff(req, ['admin', 'secretary']);
    if (!access.ok) {
      return errorResponse(
        access.status === 403
          ? 'Solo administradores y secretarias pueden crear instructores'
          : access.error,
        access.status,
      );
    }
    const callerRole = access.role;

    // Cliente con header de auditoría — propaga el user_id del caller al trigger
    const supabaseAudit = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { 'x-audit-user-id': String(access.userId) } } },
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
      // fix-214-b (H06): false durante el piloto del portal de instructores. Sin el campo
      // (llamadores viejos) se envía, como antes.
      sendInvite = true,
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

    // fix-198-b: la sede del body no se toma tal cual — una secretaria sin grant, solo la suya.
    const authz = authorizeInstructorCreate(editCallerFrom(access), Number(branchId));
    if (!authz.ok) return errorResponse(authz.message, authz.status);

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
      // fix-199-b: Supabase hoy responde "…has already been registered" (code email_exists).
      if (isEmailTakenError(authError)) return errorResponse(EMAIL_TAKEN_MESSAGE, 409);
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
      if (isUniqueViolation(insertUserError))
        return errorResponse(duplicateUserMessage(insertUserError), 409);
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
        registration_date: chileToday(),
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
    // Con supabaseAudit (fix-218-b): con supabaseAdmin la asignación quedaba en la auditoría sin autor.
    if (vehicleId) {
      const { error: assignError } = await supabaseAudit.from('vehicle_assignments').insert({
        instructor_id: instructorRow.id,
        vehicle_id: vehicleId,
        start_date: chileToday(),
        assigned_by: access.userId,
      });

      if (assignError) {
        // No hacemos rollback completo por error de asignación,
        // el instructor ya fue creado exitosamente
        console.error('Error al asignar vehículo:', assignError.message);
      }
    }

    // ── Enviar correo de invitación (setea su propia contraseña) ────────────
    // fix-214-b: se omite durante el piloto (sendInvite=false) y se informa si no salió (C29).
    let inviteEmailSent = false;
    if (sendInvite !== false) {
      try {
        await sendInstructorInviteEmail(supabaseAdmin, branchId, fullName, email, actionLink);
        inviteEmailSent = true;
      } catch (emailError) {
        // No hacemos rollback: el instructor ya fue creado exitosamente.
        // Un admin puede reenviar el link manualmente (generateLink es idempotente).
        console.error('Error al enviar correo de invitación:', emailError?.message ?? emailError);
      }
    }

    return jsonResponse(
      { success: true, email, instructorId: instructorRow.id, inviteEmailSent },
      201,
    );
  } catch (err) {
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
