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
//   canAccessBothBranches : boolean (opcional) — grant multi-sede (spec 0017); default false
//
// Flujo:
//   1. Crea la cuenta de Auth SIN contraseña con generateLink('invite') — fix-182-b
//   2. Inserta la fila en public.users con role_id = secretary (rollback de Auth si falla)
//   3. Envía por SMTP propio el correo con el link para crear su contraseña. Si el envío falla,
//      la cuenta queda creada y puede activarse con "recuperar contraseña".
//
// Secrets: SITE_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (los mismos que
// create-instructor).
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';
import { buildStaffInviteEmail } from '../_shared/staff-invite-email.ts';

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
      .select('id, roles ( name )')
      .eq('supabase_uid', caller.id)
      .maybeSingle();

    const callerRole = callerRow?.roles?.name;
    if (callerRole !== 'admin') {
      return errorResponse('Solo los administradores pueden crear secretarias', 403);
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
      telefono,
      branchId,
      canAccessBothBranches,
    } = await req.json();

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

    // ── Crear la cuenta de Auth SIN contraseña (fix-182-b) ──────────────────────
    // Antes la clave inicial era el cuerpo del RUT, un dato que no es secreto. generateLink
    // ('invite') crea el usuario y devuelve el link de activación sin enviar el correo nativo de
    // Supabase (su plantilla es la del flujo de alumnos); el correo lo enviamos abajo, como
    // create-instructor.
    const fullName = `${firstNames} ${paternalLastName}${maternalLastName ? ' ' + maternalLastName : ''}`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: Deno.env.get('SITE_URL') ?? '',
        data: { role: 'secretary', full_name: fullName },
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
    const { error: insertError } = await supabaseAudit.from('users').insert({
      supabase_uid: supabaseUid,
      rut,
      first_names: firstNames,
      paternal_last_name: paternalLastName,
      maternal_last_name: maternalLastName,
      email,
      phone: telefono || null,
      role_id: roleRow.id,
      branch_id: branchId,
      can_access_both_branches: !!canAccessBothBranches,
      active: true,
      first_login: true,
    });

    if (insertError) {
      // Rollback: eliminar el usuario de Auth si falló el INSERT
      await supabaseAdmin.auth.admin.deleteUser(supabaseUid);
      return errorResponse(`Error al registrar la secretaria: ${insertError.message}`, 500);
    }

    // ── Correo de activación ─────────────────────────────────────────────────
    // Un fallo acá no deshace la cuenta: puede activarse con "recuperar contraseña".
    let inviteSent = true;
    try {
      const { subject, html } = buildStaffInviteEmail({
        name: fullName,
        roleLabel: 'secretaria',
        actionLink: authData.properties.action_link,
      });
      const port = Number(Deno.env.get('SMTP_PORT') ?? 465);
      const transporter = nodemailer.createTransport({
        host: Deno.env.get('SMTP_HOST'),
        port,
        secure: port === 465,
        auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASS') },
      });
      await transporter.sendMail({
        from: Deno.env.get('SMTP_FROM') ?? Deno.env.get('SMTP_USER'),
        to: email,
        subject,
        html,
      });
    } catch (emailError) {
      inviteSent = false;
      console.error('Error al enviar correo de activación:', emailError?.message ?? emailError);
    }

    return jsonResponse({ success: true, email, inviteSent }, 201);
  } catch (err) {
    return errorResponse(`Error interno: ${err?.message ?? 'desconocido'}`, 500);
  }
});
