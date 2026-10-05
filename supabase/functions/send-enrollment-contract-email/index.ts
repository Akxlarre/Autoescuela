// supabase/functions/send-enrollment-contract-email/index.ts
//
// Edge Function: send-enrollment-contract-email (fix-318-m)
//
// Envía al alumno una copia de su contrato de matrícula firmado, como adjunto. Se llama al
// confirmar la matrícula en el wizard. Va en un correo propio y no dentro de la invitación de
// activate-student-account porque (a) la primera invitación la envía Supabase Auth, que no admite
// adjuntos, y (b) en una re-matrícula el alumno ya tiene cuenta y no recibe ninguna invitación.
//
// Body esperado:
//   enrollment_id : number — matrícula cuyo contrato firmado se envía
//
// Respuestas:
//   200  { success: true, recipientEmail: string }
//   400  { error: '...' }   — body inválido, matrícula sin contrato firmado o alumno sin correo
//   401 / 403               — sin sesión, o rol distinto de admin/secretaria
//   404  { error: '...' }   — la matrícula no existe
//   500  { error: '...' }   — no se pudo leer el archivo o enviar el correo
//
// Secrets requeridos (los mismos de activate-student-account y send-certificate-email):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';
import { authErrorResponse, requireStaff } from '../_shared/staff-auth.ts';
import {
  buildContractEmailHtml,
  contractAttachment,
  contractEmailSubject,
  resolveContractEmailTheme,
} from '../_shared/contract-email.ts';

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

/** PostgREST entrega una relación to-one como objeto o como arreglo de un elemento. */
function one<T>(value: T | T[] | null | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const access = await requireStaff(req, ['admin', 'secretary']);
    if (!access.ok) return authErrorResponse(access, corsHeaders);

    const { enrollment_id } = await req.json();
    if (!enrollment_id || typeof enrollment_id !== 'number') {
      return jsonResponse({ error: 'enrollment_id (number) es requerido' }, 400);
    }

    // Clave de servicio: la función ya comprobó que quien llama es admin o secretaria.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 1. Matrícula, alumno, curso y contrato ───────────────────────────────
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(
        `
        id, number, branch_id,
        courses ( name ),
        digital_contracts ( file_url ),
        students!inner ( users!inner ( first_names, paternal_last_name, email ) )
      `,
      )
      .eq('id', enrollment_id)
      .maybeSingle();

    if (enrollmentError) {
      console.error('send-enrollment-contract-email: error leyendo la matrícula', enrollmentError);
      return jsonResponse({ error: 'No se pudo leer la matrícula' }, 500);
    }
    if (!enrollment) return jsonResponse({ error: 'Matrícula no encontrada' }, 404);

    const studentUser = one(one(enrollment.students)?.users);
    const email = studentUser?.email as string | undefined;
    if (!email) return jsonResponse({ error: 'El alumno no tiene email registrado' }, 400);

    const contractPath = one(enrollment.digital_contracts)?.file_url as string | undefined;
    if (!contractPath) {
      return jsonResponse({ error: 'La matrícula no tiene un contrato firmado' }, 400);
    }
    const attachment = contractAttachment(contractPath, enrollment.number ?? null);
    if (!attachment) {
      return jsonResponse(
        { error: 'El contrato firmado tiene un formato que no se puede enviar' },
        400,
      );
    }

    // ── 2. Descargar el contrato firmado (bucket privado) ────────────────────
    const { data: file, error: fileError } = await supabase.storage
      .from('documents')
      .download(contractPath);
    if (fileError || !file) {
      console.error('send-enrollment-contract-email: error descargando el contrato', fileError);
      return jsonResponse({ error: 'No se pudo acceder al contrato firmado' }, 500);
    }

    // ── 3. Marca de la sede ─────────────────────────────────────────────
    const { data: websiteConfig } = await supabase
      .from('website_config')
      .select('config')
      .eq('branch_id', enrollment.branch_id)
      .maybeSingle();
    const brand = websiteConfig?.config?.brand;

    const emailData = {
      studentName:
        `${studentUser.first_names ?? ''} ${studentUser.paternal_last_name ?? ''}`.trim() ||
        'alumno(a)',
      schoolName: (brand?.name ?? 'Autoescuela').normalize('NFC'),
      courseName: one(enrollment.courses)?.name ?? 'Curso',
      enrollmentNumber: enrollment.number ?? null,
    };

    // ── 4. Enviar ───────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST'),
      port: Number(Deno.env.get('SMTP_PORT') ?? 465),
      secure: Number(Deno.env.get('SMTP_PORT') ?? 465) === 465,
      auth: {
        user: Deno.env.get('SMTP_USER'),
        pass: Deno.env.get('SMTP_PASS'),
      },
    });

    const info = await transporter.sendMail({
      from: Deno.env.get('SMTP_FROM') ?? Deno.env.get('SMTP_USER'),
      to: email,
      subject: contractEmailSubject(emailData),
      html: buildContractEmailHtml(emailData, resolveContractEmailTheme(brand?.theme)),
      attachments: [
        {
          filename: attachment.filename,
          content: new Uint8Array(await file.arrayBuffer()),
          contentType: attachment.contentType,
        },
      ],
    });

    // Lo que contestó el servidor de correo: "aceptado" no es "entregado", pero permite saber si
    // el mensaje salió de acá. Queda en los logs de la función y vuelve en la respuesta.
    const delivery = {
      accepted: info?.accepted?.length ?? 0,
      rejected: info?.rejected?.length ?? 0,
      response: info?.response ?? null,
      messageId: info?.messageId ?? null,
      attachmentBytes: file.size ?? null,
    };
    console.log('send-enrollment-contract-email enviado', { enrollment_id, ...delivery });

    return jsonResponse({ success: true, recipientEmail: email, delivery });
  } catch (err) {
    console.error('send-enrollment-contract-email error:', err);
    return jsonResponse({ error: `Error interno: ${err?.message ?? 'desconocido'}` }, 500);
  }
});
