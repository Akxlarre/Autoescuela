// supabase/functions/activate-student-account/index.ts
//
// Edge Function: activate-student-account
//
// Crea la cuenta Supabase Auth para un alumno matriculado y le envía un
// correo de invitación para que establezca su contraseña.
// También sirve como "reenviar invitación" si el alumno no activó su cuenta.
//
// Body esperado:
//   userId : number  — ID numérico en public.users (requerido)
//   email  : string  — correo del alumno (requerido, debe coincidir con users.email)
//
// Respuestas:
//   201  { success: true, status: 'invited' }          — cuenta creada y correo enviado
//   200  { success: true, status: 'reinvited' }        — reenvío de invitación exitoso
//   409  { error: '...' }                              — alumno ya activó su cuenta
//   400 / 401 / 403 / 404 / 500                        — errores estándar
//
// Flujo primera vez (supabase_uid IS NULL):
//   1. auth.admin.inviteUserByEmail → crea auth user + envía email
//   2. UPDATE users SET supabase_uid = authUser.id
//
// Flujo reenvío (supabase_uid NOT NULL y first_login = true):
//   1. auth.admin.inviteUserByEmail → Supabase reenvía al usuario no confirmado
//   (supabase_uid ya estaba seteado, no se modifica)
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

    // ── Validar que el llamador es admin o secretaria ─────────────────────────
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
      .select('id, roles(name)')
      .eq('supabase_uid', caller.id)
      .maybeSingle();

    const callerRole = callerRow?.roles?.name;
    if (callerRole !== 'admin' && callerRole !== 'secretary') {
      return errorResponse('Solo administradores y secretarias pueden realizar esta acción', 403);
    }

    // ── Leer y validar body ───────────────────────────────────────────────────
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return errorResponse('Se requieren userId y email');
    }

    // ── Buscar el usuario en la tabla users ───────────────────────────────────
    const { data: targetUser, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, email, supabase_uid, first_login, roles(name)')
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

    // ── Enviar invitación (primera vez o reenvío) ─────────────────────────────
    const siteUrl =
      Deno.env.get('SITE_URL') ?? Deno.env.get('SUPABASE_URL')!.replace('.supabase.co', '');

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: siteUrl,
        data: { role: 'student' },
      });

    if (inviteError) {
      console.error('inviteUserByEmail error:', inviteError);
      return errorResponse(`Error al enviar la invitación: ${inviteError.message}`, 500);
    }

    const authUserId = inviteData.user?.id;
    if (!authUserId) {
      return errorResponse('No se pudo obtener el ID del usuario de Auth', 500);
    }

    // ── Primera vez: vincular supabase_uid en users ───────────────────────────
    if (!targetUser.supabase_uid) {
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ supabase_uid: authUserId })
        .eq('id', userId);

      if (updateError) {
        console.error('Error vinculando supabase_uid:', updateError);
        // No es fatal: la cuenta existe en Auth, pero el vínculo falló.
        // El admin puede reintentar (la función es idempotente en el reenvío).
        return errorResponse(
          'Invitación enviada pero no se pudo vincular la cuenta. Reintente.',
          500,
        );
      }

      return jsonResponse({ success: true, status: 'invited' }, 201);
    }

    // ── Reenvío: supabase_uid ya existía (first_login = true) ────────────────
    return jsonResponse({ success: true, status: 'reinvited' });
  } catch (err) {
    console.error('activate-student-account error:', err);
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
