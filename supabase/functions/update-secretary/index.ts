// supabase/functions/update-secretary/index.ts
//
// Edge Function: update-secretary
//
// Actualiza los datos de una secretaria existente.
// Requiere SERVICE_ROLE_KEY para poder usar la Admin Auth API (cambio de email).
//
// Body esperado:
//   userId           : number  — ID numérico en public.users
//   firstNames       : string  — nombre(s)
//   paternalLastName : string  — apellido paterno
//   maternalLastName : string  — apellido materno (opcional)
//   phone            : string  — teléfono (vacío = null)
//   branchId         : number  — ID de la sede
//   active           : boolean — estado de la cuenta
//   email            : string  — nuevo email (si cambió, se actualiza en Auth también)
//   currentEmail     : string  — email actual, para detectar si cambió
//   canAccessBothBranches : boolean (opcional) — grant multi-sede (spec 0017). Si se omite,
//                                                no se toca; false = revocar.
//
// Flujo:
//   1. Valida que el llamador sea admin
//   2. Si email cambió → actualiza en auth.users via Admin API
//   3. Actualiza campos en public.users (incluyendo email si cambió)
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { EMAIL_TAKEN_MESSAGE, isEmailTakenError, isUniqueViolation } from '../_shared/email-errors.ts';

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

    // ── Validar que el llamador es admin ──────────────────────────────────────
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

    if (callerRow?.roles?.name !== 'admin') {
      return errorResponse('Solo los administradores pueden editar secretarias', 403);
    }

    // Cliente con header de auditoría — propaga el user_id del caller al trigger
    const supabaseAudit = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { 'x-audit-user-id': String(callerRow.id) } } },
    );

    // ── Leer body ─────────────────────────────────────────────────────────────
    const {
      userId,
      firstNames,
      paternalLastName,
      maternalLastName,
      phone,
      branchId,
      active,
      email,
      currentEmail,
      canAccessBothBranches,
    } = await req.json();

    if (
      !userId ||
      !firstNames ||
      !paternalLastName ||
      !maternalLastName ||
      !branchId ||
      email === undefined ||
      active === undefined
    ) {
      return errorResponse(
        'Faltan campos requeridos: userId, firstNames, paternalLastName, maternalLastName, branchId, active, email',
      );
    }

    // Con el ban de fix-180-b, desactivarse a uno mismo dejaría al admin sin acceso.
    if (!active && Number(userId) === callerRow.id) {
      return errorResponse('No puedes desactivar tu propia cuenta', 400);
    }

    // ── Si el email cambió → actualizar en Supabase Auth ─────────────────────
    const emailChanged = email.trim().toLowerCase() !== currentEmail?.trim().toLowerCase();

    // fix-199-b: uid y correo anterior salen de la BD (para revertir Auth si falla public.users).
    let emailTarget: { supabase_uid: string; email: string | null } | null = null;
    if (emailChanged) {
      // Buscar el supabase_uid de la secretaria
      const { data: targetUser, error: findError } = await supabaseAdmin
        .from('users')
        .select('supabase_uid, email')
        .eq('id', userId)
        .maybeSingle();

      if (findError || !targetUser?.supabase_uid) {
        return errorResponse('No se encontró la secretaria en la BD', 404);
      }

      // fix-199-b: un correo de otro usuario en public.users se rechaza ANTES de tocar Auth.
      const { data: emailOwner } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .neq('id', userId)
        .maybeSingle();
      if (emailOwner) return errorResponse(EMAIL_TAKEN_MESSAGE, 409);

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUser.supabase_uid,
        { email: email.trim().toLowerCase() },
      );

      if (authUpdateError) {
        if (isEmailTakenError(authUpdateError)) return errorResponse(EMAIL_TAKEN_MESSAGE, 409);
        return errorResponse(`Error al actualizar email en Auth: ${authUpdateError.message}`, 500);
      }
      emailTarget = targetUser;
    }

    // ── Actualizar public.users ───────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      first_names: firstNames.trim(),
      paternal_last_name: paternalLastName.trim(),
      maternal_last_name: maternalLastName.trim(),
      phone: phone?.trim() || null,
      branch_id: branchId,
      active,
    };

    // Solo incluir email en la tabla si cambió (para mantener sincronía con Auth)
    if (emailChanged) {
      updatePayload['email'] = email.trim().toLowerCase();
    }

    // Grant multi-sede (spec 0017): opcional. Solo se escribe si viene en el body
    // (las llamadas que no lo envían no lo tocan); false = revocar el grant.
    if (canAccessBothBranches !== undefined) {
      updatePayload['can_access_both_branches'] = !!canAccessBothBranches;
    }

    const { error: updateError } = await supabaseAudit
      .from('users')
      .update(updatePayload)
      .eq('id', userId);

    if (updateError) {
      // fix-199-b: Auth ya tiene el correo nuevo → revertirlo para no dejarlos desincronizados.
      if (emailTarget?.email) {
        const { error: revertError } = await supabaseAdmin.auth.admin.updateUserById(
          emailTarget.supabase_uid,
          { email: emailTarget.email.trim().toLowerCase() },
        );
        if (revertError) console.error('No se pudo revertir el email en Auth:', revertError.message);
      }
      if (isUniqueViolation(updateError)) return errorResponse(EMAIL_TAKEN_MESSAGE, 409);
      return errorResponse(`Error al actualizar la secretaria: ${updateError.message}`, 500);
    }

    const { data: authLink } = await supabaseAdmin
      .from('users')
      .select('supabase_uid')
      .eq('id', userId)
      .maybeSingle();

    // ── Desactivar = banear en Auth (fix-180-b) ──────────────────────────────
    // users.active por sí solo no impedía el login ni la renovación del token. Con ban, la
    // cuenta desactivada no puede entrar; reactivar lo quita. Idempotente ('none' = sin ban).
    if (authLink?.supabase_uid) {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(authLink?.supabase_uid, {
        ban_duration: active ? 'none' : '876000h',
      });
      if (banError) {
        return errorResponse(
          `La secretaria se guardó, pero no se pudo ${active ? 'reactivar' : 'bloquear'} su acceso: ${banError.message}`,
          500,
        );
      }
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
