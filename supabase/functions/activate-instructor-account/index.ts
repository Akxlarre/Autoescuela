// supabase/functions/activate-instructor-account/index.ts
//
// Edge Function: activate-instructor-account
//
// (Re)envía la invitación de activación de cuenta a un instructor que todavía no
// seteó su contraseña. Cubre DOS casos con la misma función (fix-169-m):
//   - Reenvío normal: el instructor ya tiene cuenta de Auth (creada por
//     `create-instructor`) pero `first_login = true` — nunca activó, o el correo
//     original no llegó.
//   - Primera activación tardía: el instructor NO tiene cuenta de Auth
//     (`supabase_uid IS NULL`) porque su fila se insertó fuera del flujo normal
//     (seed, SQL directo) — `create-instructor` es la única vía que garantiza
//     `supabase_uid` seteado desde la creación; una fila insertada por fuera de
//     ese camino no tiene esa garantía.
//
// Body esperado:
//   userId : number  — ID numérico en public.users (requerido)
//   email  : string  — correo del instructor (requerido, debe coincidir con users.email)
//
// Respuestas:
//   200  { success: true, status: 'reinvited' }  — (re)envío exitoso
//   409  { error: '...' }                        — el instructor ya activó su cuenta
//   400 / 401 / 403 / 404 / 500                  — errores estándar
//
// Flujo:
//   1. Valida que el llamador sea admin o secretaria
//   2. Busca el instructor en public.users, valida rol
//   3. Solo rechaza (409) si REALMENTE ya activó: tiene `supabase_uid` Y ya cambió
//      su contraseña (`first_login = false`). `first_login = false` sin
//      `supabase_uid` es dato inconsistente de una fila que nunca tuvo cuenta, no
//      de una ya activada — no debe bloquear.
//   4. auth.admin.generateLink({ type: 'magiclink' }) → crea la cuenta de Auth si
//      no existía, o genera un link para la existente si ya la tenía (a diferencia
//      de `type: 'invite'`, que falla con "already registered" para un usuario
//      existente — ver DG-066 en indices/DOMAIN-GOTCHAS.md)
//   5. Sincroniza `public.users.supabase_uid`/`first_login` con el resultado —
//      necesario para el caso de "cuenta recién creada", inocuo para el reenvío
//   6. Envía el correo con el mismo copy que create-instructor vía SMTP propio
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
import { authorizeInstructorReinvite, editCallerFrom } from '../_shared/user-edit-authz.ts';
import { requireStaff } from '../_shared/staff-auth.ts';

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

// Copy idéntico al de create-instructor (buildInviteEmailHtml) — mismo template,
// mismo asunto, para que el instructor no note diferencia entre la primera
// invitación y un reenvío.
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
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return errorResponse('Se requieren userId y email');
    }

    // ── Buscar el instructor en la tabla users ────────────────────────────────
    const { data: targetUser, error: findError } = await supabaseAdmin
      .from('users')
      .select(
        'id, email, first_names, paternal_last_name, maternal_last_name, first_login, supabase_uid, branch_id, roles(name), instructors(both_branches)',
      )
      .eq('id', userId)
      .maybeSingle();

    if (findError || !targetUser) {
      return errorResponse('Usuario no encontrado en la base de datos', 404);
    }

    // fix-198-b: una secretaria sin grant solo reenvía invitaciones de instructores de su sede.
    const instructorRow = Array.isArray(targetUser.instructors)
      ? targetUser.instructors[0]
      : targetUser.instructors;
    const authz = authorizeInstructorReinvite(editCallerFrom(access), {
      role: targetUser.roles?.name,
      branchId: targetUser.branch_id ?? null,
      bothBranches: !!instructorRow?.both_branches,
    });
    if (!authz.ok) return errorResponse(authz.message, authz.status);

    // Verificar que el email coincide (evita reenviar la invitación equivocada)
    if (targetUser.email?.toLowerCase() !== email.toLowerCase()) {
      return errorResponse('El email no coincide con el registrado para este usuario', 400);
    }

    // Verificar que sea instructor (nombre del rol en BD: 'instructor')
    if (targetUser.roles?.name !== 'instructor') {
      return errorResponse('Esta acción solo aplica a usuarios con rol instructor', 400);
    }

    // ── Caso: ya activó su cuenta (no reenviar) ───────────────────────────────
    // OJO: `first_login` solo, sin `supabase_uid`, no basta (fix-169-m) — un
    // instructor insertado directo por SQL/seed puede tener `first_login = false`
    // sin haber tenido nunca una cuenta de Auth. Solo se rechaza cuando REALMENTE
    // ya activó su cuenta: tiene `supabase_uid` Y ya cambió su contraseña.
    if (targetUser.supabase_uid && !targetUser.first_login) {
      return errorResponse('Este instructor ya activó su cuenta.', 409);
    }

    // ── Generar nuevo link de activación (no envía correo nativo) ─────────────
    const fullName = [
      targetUser.first_names,
      targetUser.paternal_last_name,
      targetUser.maternal_last_name,
    ]
      .filter(Boolean)
      .join(' ');
    const siteUrl = Deno.env.get('SITE_URL') ?? '';

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: siteUrl,
        data: { role: 'instructor', full_name: fullName },
      },
    });

    if (linkError) {
      return errorResponse(`Error al generar el link de activación: ${linkError.message}`, 500);
    }

    const actionLink = linkData.properties.action_link;
    const authUserId = linkData.user?.id;

    // ── Sincronizar public.users con el usuario de Auth (fix-169-m) ──────────
    // `generateLink({ type: 'magiclink' })` crea la cuenta de Auth si no existía
    // (instructor sin cuenta previa: `supabase_uid IS NULL`), o reutiliza la
    // existente (reenvío normal). En ambos casos hay que dejar `public.users`
    // apuntando al `id` de Auth vigente — si no, `AuthFacade.buildUserFromDb()`
    // no encuentra la fila al hacer clic en el link, resuelve `role: 'unknown'`
    // y `roleRedirectGuard` fuerza logout de vuelta a /login. Idempotente: si ya
    // coincidía, el UPDATE no cambia nada.
    if (authUserId) {
      const { error: linkUpdateError } = await supabaseAdmin
        .from('users')
        .update({ supabase_uid: authUserId, first_login: true })
        .eq('id', userId);

      if (linkUpdateError) {
        console.error('Error vinculando supabase_uid:', linkUpdateError);
        return errorResponse(
          'Invitación generada pero no se pudo vincular la cuenta. Reintente.',
          500,
        );
      }
    }

    // ── Enviar correo de invitación ───────────────────────────────────────────
    try {
      await sendInstructorInviteEmail(
        supabaseAdmin,
        targetUser.branch_id ?? null,
        fullName,
        email,
        actionLink,
      );
    } catch (emailError) {
      console.error('Error al enviar correo de invitación:', emailError?.message ?? emailError);
      return errorResponse('No se pudo enviar el correo de invitación. Intente nuevamente.', 500);
    }

    return jsonResponse({ success: true, status: 'reinvited' });
  } catch (err) {
    console.error('activate-instructor-account error:', err);
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
