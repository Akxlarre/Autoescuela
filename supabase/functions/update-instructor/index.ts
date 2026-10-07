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
//   bothBranches      : boolean — instructor dicta clases en las dos sedes (spec 0004-m).
//                        Solo admin puede cambiarlo — si el caller es secretary, el campo
//                        se ignora silenciosamente (no se toca su valor actual).
//
// fix-179-b: se valida el OBJETIVO antes de tocar Auth o la BD — userId debe ser el usuario del
// instructorId, con rol instructor, y una secretaria sin grant solo edita instructores de su sede
// (o "ambas sedes") sin cambiarles la sede. Antes se aceptaba el userId de cualquiera (un admin).
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authorizeInstructorEdit } from '../_shared/user-edit-authz.ts';
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
      .select('id, branch_id, can_access_both_branches, roles ( name )')
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
      bothBranches,
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

    // ── Validar el OBJETIVO (fix-179-b) ──────────────────────────────────────
    const { data: targetInstructor, error: findInstructorError } = await supabaseAdmin
      .from('instructors')
      .select('id, user_id, both_branches, users!inner ( supabase_uid, email, branch_id, roles ( name ) )')
      .eq('id', instructorId)
      .maybeSingle();

    if (findInstructorError) {
      return errorResponse(`Error al buscar el instructor: ${findInstructorError.message}`, 500);
    }

    const authz = authorizeInstructorEdit(
      {
        role: callerRole,
        branchId: callerRow.branch_id ?? null,
        bothBranches: !!callerRow.can_access_both_branches,
      },
      targetInstructor
        ? {
            instructorUserId: targetInstructor.user_id,
            role: targetInstructor.users?.roles?.name,
            branchId: targetInstructor.users?.branch_id ?? null,
            bothBranches: !!targetInstructor.both_branches,
          }
        : null,
      Number(userId),
      branchId,
    );
    if (!authz.ok) return errorResponse(authz.message, authz.status);

    // ── Si el email cambió → actualizar en Supabase Auth ─────────────────────
    const emailChanged = email.trim().toLowerCase() !== currentEmail?.trim().toLowerCase();

    const targetUid = targetInstructor.users?.supabase_uid;
    if (emailChanged) {
      if (!targetUid) {
        return errorResponse('No se encontró el usuario en la BD', 404);
      }

      // fix-199-b: un correo de otro usuario en public.users se rechaza ANTES de tocar Auth.
      const { data: emailOwner } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .neq('id', userId)
        .maybeSingle();
      if (emailOwner) return errorResponse(EMAIL_TAKEN_MESSAGE, 409);

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(targetUid, {
        email: email.trim().toLowerCase(),
      });

      if (authUpdateError) {
        if (isEmailTakenError(authUpdateError)) return errorResponse(EMAIL_TAKEN_MESSAGE, 409);
        return errorResponse(`Error al actualizar email en Auth: ${authUpdateError.message}`, 500);
      }
    }

    // ── Actualizar public.users ─────────────────────────────────────────────
    const userPayload: Record<string, unknown> = {
      first_names: firstNames.trim(),
      paternal_last_name: paternalLastName.trim(),
      maternal_last_name: maternalLastName?.trim() || null,
      phone: phone?.trim() || null,
      active,
    };

    // La sede solo se escribe si viene en el body (la autorización ya rechazó que una secretaria
    // sin grant la cambie). Antes un body sin branchId dejaba al instructor sin sede.
    if (branchId !== undefined) {
      userPayload['branch_id'] = branchId ?? null;
    }

    if (emailChanged) {
      userPayload['email'] = email.trim().toLowerCase();
    }

    const { error: updateUserError } = await supabaseAudit
      .from('users')
      .update(userPayload)
      .eq('id', userId);

    if (updateUserError) {
      // fix-199-b: Auth ya tiene el correo nuevo → revertirlo para no dejarlos desincronizados.
      // El correo anterior sale de la BD, no del body (lo manda el navegador).
      const previousEmail = targetInstructor.users?.email;
      if (emailChanged && targetUid && previousEmail) {
        const { error: revertError } = await supabaseAdmin.auth.admin.updateUserById(targetUid, {
          email: previousEmail.trim().toLowerCase(),
        });
        if (revertError)
          console.error('No se pudo revertir el email en Auth:', revertError.message);
      }
      if (isUniqueViolation(updateUserError)) return errorResponse(EMAIL_TAKEN_MESSAGE, 409);
      return errorResponse(`Error al actualizar usuario: ${updateUserError.message}`, 500);
    }

    // ── Actualizar public.instructors ────────────────────────────────────────
    const licenseStatus = computeLicenseStatus(licenseExpiry);

    const instructorPayload: Record<string, unknown> = {
      type,
      license_number: licenseNumber || null,
      license_class: licenseClass,
      license_expiry: licenseExpiry,
      license_status: licenseStatus,
      active,
    };

    // Defensa en profundidad: solo admin puede cambiar el scope "Ambas sedes"
    // (no confiar solo en que el front lo deshabilite para secretary).
    if (callerRole === 'admin' && bothBranches !== undefined) {
      instructorPayload['both_branches'] = Boolean(bothBranches);
    }

    const { error: updateInstructorError } = await supabaseAudit
      .from('instructors')
      .update(instructorPayload)
      .eq('id', instructorId);

    if (updateInstructorError) {
      return errorResponse(`Error al actualizar instructor: ${updateInstructorError.message}`, 500);
    }

    // ── Desactivar = banear en Auth (fix-180-b) ──────────────────────────────
    // users.active por sí solo no impedía el login ni la renovación del token. Con ban, la
    // cuenta desactivada no puede entrar; reactivar lo quita. Idempotente ('none' = sin ban).
    if (targetInstructor.users?.supabase_uid) {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
        targetInstructor.users?.supabase_uid,
        {
          ban_duration: active ? 'none' : '876000h',
        },
      );
      if (banError) {
        return errorResponse(
          `El instructor se guardó, pero no se pudo ${active ? 'reactivar' : 'bloquear'} su acceso: ${banError.message}`,
          500,
        );
      }
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
