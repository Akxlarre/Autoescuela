// supabase/functions/create-secretary/index.ts
//
// Edge Function: create-secretary
//
// Crea una nueva secretaria en Supabase Auth + tabla users.
// Requiere SERVICE_ROLE_KEY para bypassear RLS y usar Admin Auth API.
//
// Body esperado:
//   firstNames        : string  — nombre(s) de la secretaria
//   paternalLastName  : string  — apellido paterno
//   maternalLastName  : string  — apellido materno (opcional)
//   rut               : string  — RUT chileno formateado
//   email             : string  — correo de acceso
//   telefono          : string  — teléfono de contacto
//   branchId          : number  — ID de la sede asignada
//
// Flujo:
//   1. Valida que el email no exista ya en auth.users
//   2. Crea el usuario en Supabase Auth (sin password → recibirá email de invite)
//   3. Inserta la fila en public.users con role_id = secretary
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
    // ── Cliente con service role (bypasea RLS) ────────────────────────────────
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
      .select('roles ( name )')
      .eq('supabase_uid', caller.id)
      .maybeSingle();

    const callerRole = callerRow?.roles?.name;
    if (callerRole !== 'admin') {
      return errorResponse('Solo los administradores pueden crear secretarias', 403);
    }

    // ── Leer body ─────────────────────────────────────────────────────────────
    const { firstNames, paternalLastName, maternalLastName, rut, email, telefono, branchId } =
      await req.json();

    if (!firstNames || !paternalLastName || !maternalLastName || !rut || !email || !branchId) {
      return errorResponse(
        'Faltan campos requeridos: firstNames, paternalLastName, maternalLastName, rut, email, branchId',
      );
    }

    // ── Obtener role_id de secretary ──────────────────────────────────────────
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', 'secretary')
      .single();

    if (roleError || !roleRow) {
      return errorResponse('Rol "secretary" no encontrado en la BD', 500);
    }

    // ── Derivar contraseña inicial desde el RUT ───────────────────────────────
    // Contraseña = cuerpo del RUT sin puntos ni dígito verificador.
    // Ej: "15.206.231-3" → "15206231"
    // En el primer login, force-password-change obliga al cambio (firstLogin=true).
    const initialPassword = rut.replace(/\./g, '').split('-')[0];

    // ── Crear usuario en Supabase Auth ────────────────────────────────────────
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

    // ── Insertar en public.users ──────────────────────────────────────────────
    const { error: insertError } = await supabaseAdmin.from('users').insert({
      supabase_uid: supabaseUid,
      rut,
      first_names: firstNames,
      paternal_last_name: paternalLastName,
      maternal_last_name: maternalLastName,
      email,
      phone: telefono || null,
      role_id: roleRow.id,
      branch_id: branchId,
      active: true,
      first_login: true,
    });

    if (insertError) {
      // Rollback: eliminar el usuario de Auth si falló el INSERT
      await supabaseAdmin.auth.admin.deleteUser(supabaseUid);
      return errorResponse(`Error al registrar la secretaria: ${insertError.message}`, 500);
    }

    return jsonResponse({ success: true, email }, 201);
  } catch (err) {
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
