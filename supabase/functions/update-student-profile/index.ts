// supabase/functions/update-student-profile/index.ts
//
// Edge Function: update-student-profile
//
// Actualiza el perfil de un alumno existente (public.users).
// Requiere SERVICE_ROLE_KEY para poder usar la Admin Auth API (cambio de email).
//
// Body esperado:
//   userId           : number  — ID en public.users
//   firstNames       : string  — nombre(s)
//   paternalLastName : string  — apellido paterno
//   maternalLastName : string  — apellido materno (opcional)
//   phone            : string  — teléfono (vacío = null)
//   email            : string  — nuevo email
//   currentEmail     : string  — email actual, para detectar si cambió
//
// Flujo:
//   1. Valida que el llamador sea admin o secretary, y que el objetivo sea un alumno de su
//      alcance (fix-179-b: antes se aceptaba cualquier userId, incluido el de un admin)
//   2. Si el email cambió → actualiza primero en auth.users via Admin API.
//      Si Auth rechaza el cambio (ej. email ya registrado), se corta aquí y
//      public.users NO se toca — evita la desincronización que originó este fix.
//   3. Actualiza campos en public.users (incluyendo email si cambió)
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authorizeStudentProfileEdit, editCallerFrom } from '../_shared/user-edit-authz.ts';
import { requireStaff } from '../_shared/staff-auth.ts';
import {
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Cliente admin (bypasea RLS) ───────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Validar que el llamador es admin o secretary (fix-235-b: helper compartido) ──
    const access = await requireStaff(req, ['admin', 'secretary']);
    if (!access.ok) {
      return errorResponse(
        access.status === 403
          ? 'Solo administradores y secretarias pueden editar alumnos'
          : access.error,
        access.status,
      );
    }

    // Cliente con header de auditoría — propaga el user_id del caller al trigger
    // log_change() lee 'x-audit-user-id' desde request.headers (PostgREST GUC)
    const supabaseAudit = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { 'x-audit-user-id': String(access.userId) } } },
    );

    // ── Leer body ─────────────────────────────────────────────────────────────
    const { userId, firstNames, paternalLastName, maternalLastName, phone, email, currentEmail } =
      await req.json();

    if (!userId || !firstNames || !paternalLastName || email === undefined) {
      return errorResponse('Faltan campos requeridos: userId, firstNames, paternalLastName, email');
    }

    // ── Validar el OBJETIVO (fix-179-b) ──────────────────────────────────────
    // Esta función usa la clave de servicio: sin esto, cualquier userId (un admin) era editable.
    const { data: targetUser, error: findError } = await supabaseAdmin
      .from('users')
      .select('supabase_uid, email, branch_id, roles ( name )')
      .eq('id', userId)
      .maybeSingle();

    if (findError) {
      return errorResponse(`Error al buscar al alumno: ${findError.message}`, 500);
    }

    const authz = authorizeStudentProfileEdit(
      editCallerFrom(access),
      targetUser ? { role: targetUser.roles?.name, branchId: targetUser.branch_id ?? null } : null,
    );
    if (!authz.ok) return errorResponse(authz.message, authz.status);

    // ── Si el email cambió → actualizar en Supabase Auth PRIMERO ─────────────
    const emailChanged = email.trim().toLowerCase() !== currentEmail?.trim().toLowerCase();

    let authEmailChanged = false;
    if (emailChanged) {
      // fix-199-b: un correo de otro usuario en public.users se rechaza ANTES de tocar Auth.
      const { data: emailOwner } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .neq('id', userId)
        .maybeSingle();
      if (emailOwner) return errorResponse(EMAIL_TAKEN_MESSAGE, 409);

      // El alumno nunca tuvo cuenta Auth creada (ej. la invitación falló al matricularlo,
      // fix-157-m) → no hay nada que sincronizar en Auth, se guarda el email directo en
      // public.users más abajo. Cuando se le envíe la invitación (botón "Enviar invitación"),
      // se usará este email ya corregido.
      if (targetUser.supabase_uid) {
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          targetUser.supabase_uid,
          { email: email.trim().toLowerCase() },
        );

        if (authUpdateError) {
          // Auth rechazó el cambio → NO se toca public.users, evita la desincronización.
          if (isEmailTakenError(authUpdateError)) return errorResponse(EMAIL_TAKEN_MESSAGE, 409);
          return errorResponse(
            `Error al actualizar email en Auth: ${authUpdateError.message}`,
            500,
          );
        }
        authEmailChanged = true;
      }
    }

    // ── Actualizar public.users ───────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      first_names: firstNames.trim(),
      paternal_last_name: paternalLastName.trim(),
      maternal_last_name: maternalLastName?.trim() || null,
      phone: phone?.trim() || null,
    };

    // Solo incluir email en la tabla si cambió (para mantener sincronía con Auth)
    if (emailChanged) {
      updatePayload['email'] = email.trim().toLowerCase();
    }

    const { error: updateError } = await supabaseAudit
      .from('users')
      .update(updatePayload)
      .eq('id', userId);

    if (updateError) {
      // fix-199-b: Auth ya tiene el correo nuevo → revertirlo para no dejarlos desincronizados.
      if (authEmailChanged && targetUser.email) {
        const { error: revertError } = await supabaseAdmin.auth.admin.updateUserById(
          targetUser.supabase_uid,
          { email: targetUser.email.trim().toLowerCase() },
        );
        if (revertError)
          console.error('No se pudo revertir el email en Auth:', revertError.message);
      }
      if (isUniqueViolation(updateError)) return errorResponse(EMAIL_TAKEN_MESSAGE, 409);
      return errorResponse(`Error al actualizar el alumno: ${updateError.message}`, 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
