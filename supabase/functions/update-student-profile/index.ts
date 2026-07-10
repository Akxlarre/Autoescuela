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
//   1. Valida que el llamador sea admin o secretary
//   2. Si el email cambió → actualiza primero en auth.users via Admin API.
//      Si Auth rechaza el cambio (ej. email ya registrado), se corta aquí y
//      public.users NO se toca — evita la desincronización que originó este fix.
//   3. Actualiza campos en public.users (incluyendo email si cambió)
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
    // ── Cliente admin (bypasea RLS) ───────────────────────────────────────────
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
      return errorResponse('Solo administradores y secretarias pueden editar alumnos', 403);
    }

    // Cliente con header de auditoría — propaga el user_id del caller al trigger
    // log_change() lee 'x-audit-user-id' desde request.headers (PostgREST GUC)
    const supabaseAudit = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { 'x-audit-user-id': String(callerRow.id) } } },
    );

    // ── Leer body ─────────────────────────────────────────────────────────────
    const { userId, firstNames, paternalLastName, maternalLastName, phone, email, currentEmail } =
      await req.json();

    if (!userId || !firstNames || !paternalLastName || email === undefined) {
      return errorResponse('Faltan campos requeridos: userId, firstNames, paternalLastName, email');
    }

    // ── Si el email cambió → actualizar en Supabase Auth PRIMERO ─────────────
    const emailChanged = email.trim().toLowerCase() !== currentEmail?.trim().toLowerCase();

    if (emailChanged) {
      const { data: targetUser, error: findError } = await supabaseAdmin
        .from('users')
        .select('supabase_uid')
        .eq('id', userId)
        .maybeSingle();

      if (findError || !targetUser?.supabase_uid) {
        return errorResponse('No se encontró al alumno en la BD', 404);
      }

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUser.supabase_uid,
        { email: email.trim().toLowerCase() },
      );

      if (authUpdateError) {
        // Auth rechazó el cambio → NO se toca public.users, evita la desincronización.
        if (authUpdateError.message?.toLowerCase().includes('already registered')) {
          return errorResponse('Ya existe un usuario con ese correo electrónico', 409);
        }
        return errorResponse(`Error al actualizar email en Auth: ${authUpdateError.message}`, 500);
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
      return errorResponse(`Error al actualizar el alumno: ${updateError.message}`, 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
