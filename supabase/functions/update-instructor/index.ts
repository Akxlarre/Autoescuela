// supabase/functions/update-instructor/index.ts
//
// Edge Function: update-instructor
//
// Actualiza los datos de un instructor existente.
// Requiere SERVICE_ROLE_KEY para poder usar la Admin Auth API (cambio de email).
//
// Body esperado:
//   instructorId      : number  — ID en public.instructors
//   userId            : number  — ID en public.users
//   firstNames        : string  — nombre(s)
//   paternalLastName  : string  — apellido paterno
//   maternalLastName  : string  — apellido materno (opcional)
//   phone             : string  — teléfono (vacío = null)
//   email             : string  — nuevo email
//   currentEmail      : string  — email actual para detectar cambios
//   type              : string  — 'theory' | 'practice' | 'both'
//   licenseNumber     : string  — número de licencia
//   licenseClass      : string  — clase de licencia
//   licenseExpiry     : string  — fecha de vencimiento ISO
//   active            : boolean — estado activo/inactivo
//   vehicleId         : number | null — nuevo vehículo asignado
//   currentVehicleId  : number | null — vehículo actual para detectar cambios
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
      return errorResponse('Solo administradores y secretarias pueden editar instructores', 403);
    }

    // Cliente con header de auditoría — propaga el user_id del caller al trigger
    // log_change() lee 'x-audit-user-id' desde request.headers (PostgREST GUC)
    const supabaseAudit = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { 'x-audit-user-id': String(callerRow.id) } } },
    );

    // ── Leer body ─────────────────────────────────────────────────────────────
    const {
      instructorId,
      userId,
      firstNames,
      paternalLastName,
      maternalLastName,
      phone,
      email,
      currentEmail,
      type,
      licenseNumber,
      licenseClass,
      licenseExpiry,
      active,
      vehicleId,
      currentVehicleId,
      branchId,
    } = await req.json();

    if (
      !instructorId ||
      !userId ||
      !firstNames ||
      !paternalLastName ||
      !type ||
      !licenseClass ||
      !licenseExpiry ||
      email === undefined ||
      active === undefined
    ) {
      return errorResponse(
        'Faltan campos requeridos: instructorId, userId, firstNames, paternalLastName, type, licenseClass, licenseExpiry, email, active',
      );
    }

    // ── Si el email cambió → actualizar en Supabase Auth ─────────────────────
    const emailChanged = email.trim().toLowerCase() !== currentEmail?.trim().toLowerCase();

    if (emailChanged) {
      const { data: targetUser, error: findError } = await supabaseAdmin
        .from('users')
        .select('supabase_uid')
        .eq('id', userId)
        .maybeSingle();

      if (findError || !targetUser?.supabase_uid) {
        return errorResponse('No se encontró el usuario en la BD', 404);
      }

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUser.supabase_uid,
        { email: email.trim().toLowerCase() },
      );

      if (authUpdateError) {
        if (authUpdateError.message?.toLowerCase().includes('already registered')) {
          return errorResponse('Ya existe un usuario con ese correo electrónico', 409);
        }
        return errorResponse(`Error al actualizar email en Auth: ${authUpdateError.message}`, 500);
      }
    }

    // ── Actualizar public.users ─────────────────────────────────────────────
    const userPayload: Record<string, unknown> = {
      first_names: firstNames.trim(),
      paternal_last_name: paternalLastName.trim(),
      maternal_last_name: maternalLastName?.trim() || null,
      phone: phone?.trim() || null,
      branch_id: branchId ?? null,
      active,
    };

    if (emailChanged) {
      userPayload['email'] = email.trim().toLowerCase();
    }

    const { error: updateUserError } = await supabaseAudit
      .from('users')
      .update(userPayload)
      .eq('id', userId);

    if (updateUserError) {
      return errorResponse(`Error al actualizar usuario: ${updateUserError.message}`, 500);
    }

    // ── Actualizar public.instructors ────────────────────────────────────────
    const licenseStatus = computeLicenseStatus(licenseExpiry);

    const { error: updateInstructorError } = await supabaseAudit
      .from('instructors')
      .update({
        type,
        license_number: licenseNumber || null,
        license_class: licenseClass,
        license_expiry: licenseExpiry,
        license_status: licenseStatus,
        active,
      })
      .eq('id', instructorId);

    if (updateInstructorError) {
      return errorResponse(`Error al actualizar instructor: ${updateInstructorError.message}`, 500);
    }

    // ── Gestionar cambio de vehículo ────────────────────────────────────────
    const vehicleChanged = vehicleId !== currentVehicleId;

    if (vehicleChanged) {
      // Cerrar asignación actual (si existe)
      if (currentVehicleId) {
        await supabaseAdmin
          .from('vehicle_assignments')
          .update({ end_date: new Date().toISOString().split('T')[0] })
          .eq('instructor_id', instructorId)
          .eq('vehicle_id', currentVehicleId)
          .is('end_date', null);
      }

      // Crear nueva asignación (si se seleccionó un vehículo)
      if (vehicleId) {
        await supabaseAdmin.from('vehicle_assignments').insert({
          instructor_id: instructorId,
          vehicle_id: vehicleId,
          start_date: new Date().toISOString().split('T')[0],
          assigned_by: callerRow.id,
        });
      }
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
