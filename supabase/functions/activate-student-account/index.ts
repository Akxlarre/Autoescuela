// supabase/functions/activate-student-account/index.ts
//
// Edge Function: activate-student-account
//
// Crea la cuenta Supabase Auth para un alumno matriculado y le envía un
// correo de invitación para que establezca su contraseña.
// También sirve como "reenviar invitación" si el alumno no activó su cuenta.
//
// Body esperado:
//   userId   : number  — ID numérico en public.users (requerido)
//   email    : string  — correo del alumno (requerido, debe coincidir con users.email)
//   enrollmentId : number — opcional: matrícula que originó la activación (spec 0061-b, AC4).
//                           El correo sale a nombre de SU escuela si la matrícula es de este
//                           alumno; si no viene o no corresponde, se usa users.branch_id.
//
// Respuestas:
//   201  { success: true, status: 'invited' }          — cuenta creada y correo enviado
//   200  { success: true, status: 'reinvited' }        — reenvío de invitación exitoso
//   409  { error: '...' }                              — alumno ya activó su cuenta
//   400 / 401 / 403 / 404 / 500                        — errores estándar
//
// Flujo primera vez (supabase_uid IS NULL) — spec 0061-b, AC6:
//   1. auth.admin.generateLink({ type: 'invite' }) → crea el usuario de Auth SIN enviar correo.
//      Antes se usaba inviteUserByEmail, que manda el correo desde Supabase Auth con su
//      remitente y la plantilla del panel; ahora sale con el remitente de la escuela.
//   2. UPDATE users SET supabase_uid = authUser.id  (antes del correo: si el envío falla, el
//      siguiente intento entra por el reenvío en vez de chocar con DG-068)
//   3. Correo por SMTP propio (_shared/student-invite-email.ts + school-mailer.ts)
//
// Flujo reenvío (supabase_uid NOT NULL y first_login = true):
//   1. auth.admin.generateLink({ type: 'magiclink' }) — 'invite' FALLA con "already registered"
//      si el usuario de Auth ya existe (DG-068). generateLink() no envía correo (fix-254-m).
//   2. Mismo correo por SMTP propio.
//
// Secrets: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (ver _shared/school-mailer.ts)
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requireStaff } from '../_shared/staff-auth.ts';
import { loadSchoolSender, withSchool } from '../_shared/school-email.ts';
import { createSmtpTransport, platformAddress, sendSchoolMail } from '../_shared/school-mailer.ts';
import {
  STUDENT_INVITE_SUBJECT,
  buildStudentInviteEmailHtml,
  resolveStudentInviteBrand,
} from '../_shared/student-invite-email.ts';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Cliente admin (bypasea RLS, puede llamar auth.admin.*) ────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Validar que el llamador es admin o secretaria (fix-235-b: helper compartido) ──
    const access = await requireStaff(req, ['admin', 'secretary']);
    if (!access.ok) {
      return errorResponse(
        access.status === 403
          ? 'Solo administradores y secretarias pueden realizar esta acción'
          : access.error,
        access.status,
      );
    }

    // ── Leer y validar body ───────────────────────────────────────────────────
    const { userId, email, enrollmentId } = await req.json();

    if (!userId || !email) {
      return errorResponse('Se requieren userId y email');
    }

    // ── Buscar el usuario en la tabla users ───────────────────────────────────
    const { data: targetUser, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, email, supabase_uid, first_login, branch_id, roles(name)')
      .eq('id', userId)
      .maybeSingle();

    if (findError || !targetUser) {
      return errorResponse('Usuario no encontrado en la base de datos', 404);
    }

    // Verificar que el email coincide (evita activar la cuenta equivocada)
    if (targetUser.email?.toLowerCase() !== email.toLowerCase()) {
      return errorResponse('El email no coincide con el registrado para este usuario', 400);
    }

    // Verificar que sea alumno (nombre del rol en BD: 'student')
    if (targetUser.roles?.name !== 'student') {
      return errorResponse('Esta acción solo aplica a usuarios con rol alumno', 400);
    }

    // ── Caso: ya activó su cuenta (no reenviar) ───────────────────────────────
    if (targetUser.supabase_uid && !targetUser.first_login) {
      return errorResponse(
        'Este alumno ya activó su cuenta. Si necesita recuperar su contraseña, use la opción de recuperación.',
        409,
      );
    }

    // ── Escuela del correo (spec 0061-b, AC4): la de la matrícula que originó la activación ──
    // Un alumno con matrícula en las dos escuelas tiene un solo users.branch_id; si quien llama
    // dice de qué matrícula viene, se usa la escuela de esa matrícula, solo si es de este alumno.
    let mailBranchId = targetUser.branch_id;
    if (Number.isInteger(Number(enrollmentId))) {
      const { data: enrollment, error: enrollmentError } = await supabaseAdmin
        .from('enrollments')
        .select('branch_id, students!inner(user_id)')
        .eq('id', Number(enrollmentId))
        .eq('students.user_id', userId)
        .maybeSingle();
      if (enrollmentError) {
        console.error('activate-student-account: no se pudo leer la matrícula', enrollmentError);
      } else if (enrollment?.branch_id) {
        mailBranchId = enrollment.branch_id;
      }
    }

    // ── Marca de la cabecera (website_config) y remitente (branches) ──────────
    const { data: websiteConfig, error: configError } = await supabaseAdmin
      .from('website_config')
      .select('config')
      .eq('branch_id', mailBranchId)
      .maybeSingle();
    if (configError) {
      // Sin marca el correo sale igual con el tema por defecto: no se bloquea una activación.
      console.error('activate-student-account: no se pudo leer website_config', configError);
    }
    const fromAddress = platformAddress();
    const sender = await loadSchoolSender(supabaseAdmin, mailBranchId, fromAddress);
    const brand = resolveStudentInviteBrand(websiteConfig?.config, sender.schoolName);

    const siteUrl =
      Deno.env.get('SITE_URL') ?? Deno.env.get('SUPABASE_URL')!.replace('.supabase.co', '');
    const linkMetadata = { role: 'student', schoolName: brand.schoolName };

    const sendInvite = (actionLink: string) =>
      sendSchoolMail(createSmtpTransport(), sender, {
        to: email,
        subject: withSchool(STUDENT_INVITE_SUBJECT, sender),
        html: buildStudentInviteEmailHtml(
          actionLink,
          brand.colors,
          brand.schoolName,
          brand.initials,
          sender,
        ),
      });

    // ── Reenvío: el usuario de Auth ya existe → magiclink (DG-068) ────────────
    if (targetUser.supabase_uid) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: siteUrl, data: linkMetadata },
      });

      if (linkError) {
        console.error('generateLink (magiclink) error:', linkError);
        return errorResponse(`Error al generar el link de activación: ${linkError.message}`, 500);
      }

      try {
        await sendInvite(linkData.properties.action_link);
      } catch (emailError) {
        console.error('Error al enviar correo de reenvío:', emailError?.message ?? emailError);
        return errorResponse('No se pudo enviar el correo de invitación. Intente nuevamente.', 500);
      }

      return jsonResponse({ success: true, status: 'reinvited' });
    }

    // ── Primera vez: generateLink('invite') crea la cuenta sin enviar correo (AC6) ──
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: siteUrl, data: linkMetadata },
    });

    if (inviteError) {
      console.error('generateLink (invite) error:', inviteError);
      return errorResponse(`Error al crear la cuenta: ${inviteError.message}`, 500);
    }

    const authUserId = inviteData.user?.id;
    if (!authUserId) {
      return errorResponse('No se pudo obtener el ID del usuario de Auth', 500);
    }

    // ── Vincular supabase_uid ANTES del correo ────────────────────────────────
    // Si el correo falla, el siguiente intento entra por el reenvío (magiclink). Al revés, la
    // cuenta de Auth quedaría creada y sin vincular, y un nuevo 'invite' chocaría con DG-068.
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ supabase_uid: authUserId })
      .eq('id', userId);

    if (updateError) {
      console.error('Error vinculando supabase_uid:', updateError);
      return errorResponse('Se creó la cuenta pero no se pudo vincular. Reintente.', 500);
    }

    try {
      await sendInvite(inviteData.properties.action_link);
    } catch (emailError) {
      console.error('Error al enviar correo de invitación:', emailError?.message ?? emailError);
      return errorResponse(
        'Se creó la cuenta pero no se pudo enviar el correo. Use "Reenviar invitación".',
        500,
      );
    }

    // Notificar bienvenida al alumno (Spec 0025, AC6). Solo en la PRIMERA invitación
    // — el reenvío (rama de arriba) no debe duplicar esta notificación.
    // Try/catch propio: un fallo del INSERT jamás afecta la respuesta de la invitación.
    try {
      const { error: notifyError } = await supabaseAdmin.from('notifications').insert({
        recipient_id: userId,
        type: 'system',
        subject: 'Bienvenido al portal',
        message: 'Tu cuenta ya está lista. Revisa tu correo para activar tu contraseña.',
        reference_type: null, // sin subtipo — mapea a severidad 'info' por defecto en el panel
        read: false,
        sent_ok: true,
      });
      if (notifyError) {
        console.error('[activate-student-account] notification insert error:', notifyError);
      }
    } catch (notifyErr) {
      console.error('[activate-student-account] notification dispatch error:', notifyErr);
    }

    return jsonResponse({ success: true, status: 'invited' }, 201);
  } catch (err) {
    console.error('activate-student-account error:', err);
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
