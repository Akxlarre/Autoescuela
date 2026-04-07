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
//
// Flujo:
//   1. Valida que el llamador sea admin o secretary
//   2. Crea el usuario en Supabase Auth (password = RUT sin dígito verificador)
//   3. Inserta en public.users con role_id = instructor
//   4. Inserta en public.instructors
//   5. Si vehicleId, inserta en vehicle_assignments
//   6. Rollback en cascada si algo falla
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
    } = await req.json();

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

    // ── Derivar contraseña inicial desde el RUT ─────────────────────────────
    const initialPassword = rut.replace(/\./g, '').split('-')[0];

    // ── Crear usuario en Supabase Auth ──────────────────────────────────────
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: initialPassword,
      email_confirm: true,
      user_metadata: {
        full_name: `${firstNames} ${paternalLastName}${maternalLastName ? ' ' + maternalLastName : ''}`,
      },
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes('already registered')) {
        return errorResponse('Ya existe un usuario con ese correo electrónico', 409);
      }
      return errorResponse(`Error al crear usuario en Auth: ${authError.message}`, 500);
    }

    const supabaseUid = authData.user.id;

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

    return jsonResponse({ success: true, email, instructorId: instructorRow.id }, 201);
  } catch (err) {
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
