// supabase/functions/public-enrollment/index.ts
//
// Edge Function: public-enrollment
//
// Maneja las operaciones de matrícula pública que requieren SERVICE_ROLE_KEY
// para bypasear RLS (usuarios anónimos no pueden insertar en tablas protegidas).
//
// Acciones:
//   - load-instructors      : Instructores con vehículo activo por sede
//   - load-schedule         : Disponibilidad horaria por instructor
//                             (filtra slot_holds de otras sesiones como ocupados)
//   - reserve-slots         : Reserva temporal de slots (TTL 20 min) para una sesión
//   - release-slots         : Libera los holds de una sesión (back navigation)
//   - submit-clase-b        : Matrícula completa Clase B (idempotente vía session_token)
//   - submit-pre-inscription: Pre-inscripción profesional
//   - initiate-payment      : Crea enrollment pending_payment e inicia transacción Webpay
//   - confirm-payment       : Confirma el pago tras retorno desde Webpay (commit)
//
// Tarjetas de prueba Transbank (entorno integración):
// Número: 4051 8856 0044 6623 (VISA - Genera transacciones aprobadas)
// Número: 5186 0595 5959 0568 (MasterCard - Genera transacciones rechazadas)
// CVV: 123
// RUT autenticación: 11.111.111-1
// Contraseña: 123
//
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ─── CORS headers ───

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

// ══════════════════════════════════════════════════════════════════════════════
// Transbank Webpay Plus — REST client (sin SDK, compatible con Deno)
//
// Entorno se controla con la variable de entorno TRANSBANK_ENV:
//   'integration' (default) → https://webpay3gint.transbank.cl  (credenciales de prueba)
//   'production'            → https://webpay3g.transbank.cl     (credenciales reales)
//
// Variables de entorno requeridas en producción:
//   TRANSBANK_COMMERCE_CODE  (Tbk-Api-Key-Id)
//   TRANSBANK_API_KEY        (Tbk-Api-Key-Secret)
//   APP_URL                  (ej: https://autoescuela.cl)
// ══════════════════════════════════════════════════════════════════════════════

// Credenciales de integración predefinidas por Transbank (públicas, solo para pruebas)
const INTEGRATION_COMMERCE_CODE = '597055555532';
const INTEGRATION_API_KEY = '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';

function getWebpayConfig() {
  const env = Deno.env.get('TRANSBANK_ENV') ?? 'integration';
  const isProduction = env === 'production';

  return {
    baseUrl: isProduction ? 'https://webpay3g.transbank.cl' : 'https://webpay3gint.transbank.cl',
    commerceCode: isProduction
      ? Deno.env.get('TRANSBANK_COMMERCE_CODE')!
      : INTEGRATION_COMMERCE_CODE,
    apiKey: isProduction ? Deno.env.get('TRANSBANK_API_KEY')! : INTEGRATION_API_KEY,
  };
}

interface WebpayCreateResponse {
  token: string;
  url: string;
}

interface WebpayCommitResponse {
  vci: string;
  amount: number;
  status: string;
  buy_order: string;
  session_id: string;
  card_detail: { card_number: string };
  accounting_date: string;
  transaction_date: string;
  authorization_code: string;
  payment_type_code: string;
  response_code: number;
  installments_number: number;
}

/**
 * Inicia una transacción Webpay Plus.
 * Retorna { token, url } — el frontend redirige a url con el token incluido.
 */
async function webpayCreate(
  buyOrder: string,
  sessionId: string,
  amount: number,
  returnUrl: string,
): Promise<WebpayCreateResponse> {
  const { baseUrl, commerceCode, apiKey } = getWebpayConfig();

  const res = await fetch(`${baseUrl}/rswebpaytransaction/api/webpay/v1.2/transactions`, {
    method: 'POST',
    headers: {
      'Tbk-Api-Key-Id': commerceCode,
      'Tbk-Api-Key-Secret': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      buy_order: buyOrder,
      session_id: sessionId,
      amount,
      return_url: returnUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webpay create failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Confirma (commit) una transacción Webpay Plus con el token recibido en el return_url.
 * Retorna el resultado completo — verificar response_code === 0 && status === 'AUTHORIZED'.
 */
async function webpayCommit(token: string): Promise<WebpayCommitResponse> {
  const { baseUrl, commerceCode, apiKey } = getWebpayConfig();

  const res = await fetch(`${baseUrl}/rswebpaytransaction/api/webpay/v1.2/transactions/${token}`, {
    method: 'PUT',
    headers: {
      'Tbk-Api-Key-Id': commerceCode,
      'Tbk-Api-Key-Secret': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webpay commit failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ─── Main handler ───

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (!action || typeof action !== 'string') {
      return errorResponse('action (string) is required');
    }

    // Admin client (SERVICE_ROLE_KEY bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case 'load-instructors':
        return await handleLoadInstructors(supabase, body);
      case 'load-schedule':
        return await handleLoadSchedule(supabase, body);
      case 'reserve-slots':
        return await handleReserveSlots(supabase, body);
      case 'release-slots':
        return await handleReleaseSlots(supabase, body);
      case 'submit-clase-b':
        return await handleSubmitClaseB(supabase, body);
      case 'submit-pre-inscription':
        return await handleSubmitPreInscription(supabase, body);
      case 'initiate-payment':
        return await handleInitiatePayment(supabase, body);
      case 'confirm-payment':
        return await handleConfirmPayment(supabase, body);
      default:
        return errorResponse(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error('public-enrollment error:', err);
    return errorResponse('Internal server error', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Action: load-instructors
// Retorna instructores con vehículo activo asignado para la sede dada.
// ══════════════════════════════════════════════════════════════════════════════

async function handleLoadInstructors(supabase: any, body: any) {
  const { branchId } = body;
  if (!branchId) return errorResponse('branchId is required');

  const { data, error } = await supabase
    .from('instructors')
    .select(
      `
      id,
      users!inner(first_names, paternal_last_name),
      vehicle_assignments!inner(
        vehicles!inner(brand, model, license_plate)
      )
    `,
    )
    .eq('active', true)
    .eq('users.branch_id', branchId)
    .is('vehicle_assignments.end_date', null);

  if (error) {
    console.error('load-instructors error:', error);
    return errorResponse('Error loading instructors', 500);
  }

  const instructors = (data ?? []).map((row: any) => {
    const va = row.vehicle_assignments?.[0];
    const vehicle = va?.vehicles;
    return {
      id: row.id,
      name: `${row.users?.first_names ?? ''} ${row.users?.paternal_last_name ?? ''}`.trim(),
      vehicleDescription: vehicle ? `${vehicle.brand ?? ''} ${vehicle.model ?? ''}`.trim() : '',
      plate: vehicle?.license_plate ?? '',
    };
  });

  return jsonResponse({ instructors });
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: load-schedule
// Retorna la grilla de disponibilidad horaria para un instructor.
// Superpone slot_holds activos de OTRAS sesiones como 'occupied' para evitar
// que dos alumnos seleccionen el mismo horario simultáneamente.
// ══════════════════════════════════════════════════════════════════════════════

async function handleLoadSchedule(supabase: any, body: any) {
  const { instructorId, sessionToken } = body;
  if (!instructorId) return errorResponse('instructorId is required');

  const { data, error } = await supabase
    .from('v_class_b_schedule_availability')
    .select('*')
    .eq('instructor_id', instructorId)
    .order('slot_start', { ascending: true });

  if (error) {
    console.error('load-schedule error:', error);
    return errorResponse('Error loading schedule', 500);
  }

  const grid = buildScheduleGrid(data ?? []);

  // Superponer holds activos de OTRAS sesiones como ocupados
  if (grid) {
    const { data: holds } = await supabase
      .from('slot_holds')
      .select('slot_start, session_token')
      .eq('instructor_id', instructorId)
      .gt('expires_at', new Date().toISOString());

    if (holds?.length) {
      // Solo marcar como ocupados los holds que NO pertenecen a esta sesión
      const heldByOthers = new Set(
        holds
          .filter((h: any) => h.session_token !== (sessionToken ?? ''))
          .map((h: any) => new Date(h.slot_start).toISOString()),
      );

      if (heldByOthers.size > 0) {
        grid.slots = grid.slots.map((slot: any) => {
          const slotIso = new Date(slot.id).toISOString();
          return heldByOthers.has(slotIso) ? { ...slot, status: 'occupied' } : slot;
        });
      }
    }
  }

  return jsonResponse({ grid });
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: reserve-slots
// Crea (o reemplaza) los slot_holds para una sesión cuando el alumno confirma
// la selección de horario. Verifica conflictos con otras sesiones activas antes
// de insertar. Retorna { success: true } o { success: false, conflictingSlots }.
// ══════════════════════════════════════════════════════════════════════════════

async function handleReserveSlots(supabase: any, body: any) {
  const { sessionToken, instructorId, slotIds } = body;

  if (!sessionToken || !instructorId || !slotIds?.length) {
    return errorResponse('sessionToken, instructorId and slotIds are required');
  }

  // 1. Limpiar holds expirados de todas las sesiones y los anteriores de esta sesión
  await supabase
    .from('slot_holds')
    .delete()
    .or(`session_token.eq.${sessionToken},expires_at.lt.${new Date().toISOString()}`);

  // 2. Verificar conflictos con otras sesiones activas
  const { data: conflicts } = await supabase
    .from('slot_holds')
    .select('slot_start')
    .eq('instructor_id', instructorId)
    .in('slot_start', slotIds)
    .gt('expires_at', new Date().toISOString());

  if (conflicts?.length) {
    return jsonResponse({
      success: false,
      conflictingSlots: conflicts.map((c: any) => c.slot_start),
    });
  }

  // 3. Insertar nuevos holds
  const holds = slotIds.map((slotId: string) => ({
    session_token: sessionToken,
    instructor_id: instructorId,
    slot_start: slotId,
  }));

  const { error } = await supabase.from('slot_holds').insert(holds);

  if (error) {
    console.error('reserve-slots error:', error);
    return errorResponse('Error reserving slots: ' + error.message, 500);
  }

  return jsonResponse({ success: true });
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: release-slots
// Libera todos los slot_holds de una sesión (back navigation al paso de horario).
// ══════════════════════════════════════════════════════════════════════════════

async function handleReleaseSlots(supabase: any, body: any) {
  const { sessionToken } = body;
  if (!sessionToken) return errorResponse('sessionToken is required');

  await supabase.from('slot_holds').delete().eq('session_token', sessionToken);

  return jsonResponse({ success: true });
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: submit-clase-b
// Crea user/student/enrollment/class_b_sessions en una transacción lógica.
// Idempotente: si session_token ya tiene un payment_attempt 'confirmed',
// retorna el enrollment existente sin crear duplicados.
// ══════════════════════════════════════════════════════════════════════════════

async function handleSubmitClaseB(supabase: any, body: any) {
  const { branchId, personalData, paymentMode, instructorId, selectedSlotIds, sessionToken } = body;

  if (!branchId || !personalData || !paymentMode || !instructorId || !selectedSlotIds?.length) {
    return errorResponse('Missing required fields for Clase B enrollment');
  }

  try {
    // ── Idempotencia: verificar si ya se procesó esta sesión ──────────────────
    if (sessionToken) {
      const { data: existing } = await supabase
        .from('payment_attempts')
        .select('status, enrollment_id')
        .eq('session_token', sessionToken)
        .maybeSingle();

      if (existing?.status === 'confirmed' && existing.enrollment_id) {
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('number')
          .eq('id', existing.enrollment_id)
          .single();

        return jsonResponse({
          success: true,
          enrollmentId: existing.enrollment_id,
          enrollmentNumber: enrollment?.number ?? null,
          idempotent: true,
        });
      }

      // Registrar intento pendiente (upsert en caso de retry)
      await supabase.from('payment_attempts').upsert(
        {
          session_token: sessionToken,
          status: 'pending',
          draft_snapshot: {
            branchId,
            paymentMode,
            instructorId,
            slotCount: selectedSlotIds.length,
          },
        },
        { onConflict: 'session_token' },
      );
    }

    // 1. Find or create user by RUT
    const userId = await findOrCreateUser(supabase, personalData, branchId);

    // 2. Find or create student
    const studentId = await findOrCreateStudent(supabase, userId, personalData);

    // 3. Find the Clase B course for this branch
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('branch_id', branchId)
      .eq('license_class', 'B')
      .eq('active', true)
      .or('is_convalidation.is.null,is_convalidation.eq.false')
      .not('type', 'ilike', '%sence%')
      .limit(1)
      .single();

    if (!course) return errorResponse('No se encontró curso Clase B activo para esta sede', 404);

    // 4. Create enrollment
    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .insert({
        student_id: studentId,
        course_id: course.id,
        branch_id: branchId,
        status: 'active',
        current_step: 6,
        payment_mode: paymentMode === 'partial' ? 'partial' : 'total',
        registration_channel: 'online',
      })
      .select('id')
      .single();

    if (enrollError) {
      console.error('enrollment insert error:', enrollError);
      if (sessionToken) {
        await supabase
          .from('payment_attempts')
          .update({ status: 'failed' })
          .eq('session_token', sessionToken);
      }
      return errorResponse('Error al crear matrícula: ' + enrollError.message, 500);
    }

    // 5. Get vehicle assignment for instructor
    const { data: va } = await supabase
      .from('vehicle_assignments')
      .select('vehicle_id')
      .eq('instructor_id', instructorId)
      .is('end_date', null)
      .limit(1)
      .single();

    // 6. Create class_b_sessions from selected slots
    const sessions = selectedSlotIds.map((slotId: string) => ({
      enrollment_id: enrollment.id,
      instructor_id: instructorId,
      vehicle_id: va?.vehicle_id ?? null,
      scheduled_at: slotId,
      duration_min: 45,
      status: 'scheduled',
    }));

    const { error: sessionsError } = await supabase.from('class_b_sessions').insert(sessions);

    if (sessionsError) {
      console.error('sessions insert error:', sessionsError);
      // No abortar — enrollment creado, se pueden añadir sesiones manualmente
    }

    // 7. Generate enrollment number
    const { data: numData } = await supabase.rpc('get_next_enrollment_number', {
      p_course_id: course.id,
    });

    if (numData) {
      await supabase.from('enrollments').update({ number: numData }).eq('id', enrollment.id);
    }

    // 8. Confirmar payment_attempt + liberar slot_holds
    if (sessionToken) {
      await supabase
        .from('payment_attempts')
        .update({ status: 'confirmed', enrollment_id: enrollment.id })
        .eq('session_token', sessionToken);

      await supabase.from('slot_holds').delete().eq('session_token', sessionToken);
    }

    // 9. Mover foto de carnet de ruta temporal a destino final en Storage
    if (body.carnetStoragePath) {
      await moveCarnetPhoto(supabase, body.carnetStoragePath, enrollment.id);
    }

    return jsonResponse({
      success: true,
      enrollmentId: enrollment.id,
      enrollmentNumber: numData ?? null,
    });
  } catch (err) {
    console.error('submit-clase-b error:', err);
    if (sessionToken) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      await adminClient
        .from('payment_attempts')
        .update({ status: 'failed' })
        .eq('session_token', sessionToken);
    }
    return errorResponse('Error interno al procesar matrícula', 500);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: submit-pre-inscription
// Crea user + professional_pre_registrations.
// ══════════════════════════════════════════════════════════════════════════════

async function handleSubmitPreInscription(supabase: any, body: any) {
  const { branchId, personalData, courseType, convalidatesSimultaneously } = body;

  if (!branchId || !personalData || !courseType) {
    return errorResponse('Missing required fields for pre-inscription');
  }

  try {
    // 1. Find or create user
    const userId = await findOrCreateUser(supabase, personalData, branchId);

    // 2. Create pre-registration
    const { data: preReg, error: preRegError } = await supabase
      .from('professional_pre_registrations')
      .insert({
        temp_user_id: userId,
        branch_id: branchId,
        requested_license_class: courseTypeToLicenseClass(courseType),
        convalidates_simultaneously: convalidatesSimultaneously ?? false,
        registration_channel: 'online',
        status: 'pending',
        notes: `Pre-inscripción online — ${courseType}${convalidatesSimultaneously ? ' (con convalidación simultánea)' : ''}`,
      })
      .select('id')
      .single();

    if (preRegError) {
      console.error('pre-registration insert error:', preRegError);
      return errorResponse('Error al crear pre-inscripción: ' + preRegError.message, 500);
    }

    return jsonResponse({
      success: true,
      preRegistrationId: preReg.id,
      message: 'Tu pre-inscripción ha sido recibida. Un ejecutivo se pondrá en contacto contigo.',
    });
  } catch (err) {
    console.error('submit-pre-inscription error:', err);
    return errorResponse('Error interno al procesar pre-inscripción', 500);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: initiate-payment
// Crea user/student/enrollment(pending_payment)/class_b_sessions y registra el
// intento de pago en payment_attempts con el draft_snapshot completo.
// Idempotente: si session_token ya tiene enrollment asignado, retorna ese id.
//
// TODO (integración Transbank):
//   1. Importar la SDK de Transbank WebpayPlus para Deno.
//   2. Llamar webpay.create(buyOrder, sessionId, amount, returnUrl) para obtener
//      { url, token } y almacenar el token en payment_attempts.transbank_token.
//   3. Retornar webpayUrl y webpayToken en la respuesta.
// ══════════════════════════════════════════════════════════════════════════════

async function handleInitiatePayment(supabase: any, body: any) {
  const {
    branchId,
    personalData,
    paymentMode,
    instructorId,
    selectedSlotIds,
    sessionToken,
    amount,
  } = body;

  if (
    !branchId ||
    !personalData ||
    !paymentMode ||
    !instructorId ||
    !selectedSlotIds?.length ||
    !sessionToken
  ) {
    return errorResponse('Missing required fields for initiate-payment');
  }

  try {
    // ── Idempotencia: verificar si ya existe un intento para esta sesión ──────
    const { data: existing } = await supabase
      .from('payment_attempts')
      .select('status, enrollment_id')
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (existing?.status === 'confirmed' && existing.enrollment_id) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('number')
        .eq('id', existing.enrollment_id)
        .single();
      return jsonResponse({
        success: true,
        enrollmentId: existing.enrollment_id,
        enrollmentNumber: enrollment?.number ?? null,
        webpayUrl: null,
        webpayToken: null,
        idempotent: true,
      });
    }

    if (existing?.status === 'pending' && existing.enrollment_id) {
      // Intento ya iniciado — devolver el enrollment existente para reintentar
      // el redirect a Webpay desde el frontend sin crear duplicados.
      return jsonResponse({
        success: true,
        enrollmentId: existing.enrollment_id,
        webpayUrl: null, // TODO: re-obtener URL de Webpay si venció el token anterior
        webpayToken: null,
        idempotent: true,
      });
    }

    // 1. Find or create user/student
    const userId = await findOrCreateUser(supabase, personalData, branchId);
    const studentId = await findOrCreateStudent(supabase, userId, personalData);

    // 2. Find Clase B course for this branch
    const { data: course } = await supabase
      .from('courses')
      .select('id, base_price')
      .eq('branch_id', branchId)
      .eq('license_class', 'B')
      .eq('active', true)
      .or('is_convalidation.is.null,is_convalidation.eq.false')
      .not('type', 'ilike', '%sence%')
      .limit(1)
      .single();

    if (!course) return errorResponse('No se encontró curso Clase B activo para esta sede', 404);

    const courseBasePrice = course.base_price ?? 0;
    const isPartial = paymentMode === 'partial';

    // 3. Create enrollment as pending_payment (sin número — se asigna al confirmar)
    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .insert({
        student_id: studentId,
        course_id: course.id,
        branch_id: branchId,
        status: 'pending_payment',
        current_step: 6,
        payment_mode: isPartial ? 'partial' : 'total',
        registration_channel: 'online',
        base_price: courseBasePrice,
        pending_balance: courseBasePrice,
        total_paid: 0,
        payment_status: 'pending',
      })
      .select('id')
      .single();

    if (enrollError) {
      console.error('enrollment insert error:', enrollError);
      return errorResponse('Error al crear matrícula: ' + enrollError.message, 500);
    }

    // 4. Get vehicle assignment for instructor
    const { data: va } = await supabase
      .from('vehicle_assignments')
      .select('vehicle_id')
      .eq('instructor_id', instructorId)
      .is('end_date', null)
      .limit(1)
      .single();

    // 5. Create class_b_sessions as 'reserved' (se activan al confirmar el pago)
    const sessions = selectedSlotIds.map((slotId: string) => ({
      enrollment_id: enrollment.id,
      instructor_id: instructorId,
      vehicle_id: va?.vehicle_id ?? null,
      scheduled_at: slotId,
      duration_min: 45,
      status: 'reserved',
    }));

    const { error: sessionsError } = await supabase.from('class_b_sessions').insert(sessions);

    if (sessionsError) {
      console.error('sessions insert error:', sessionsError);
      // No abortar — el enrollment existe, las sesiones se pueden corregir manualmente
    }

    // 6. Registrar payment_attempt con draft_snapshot completo
    // carnetStoragePath se incluye para que confirm-payment pueda mover la foto
    await supabase.from('payment_attempts').upsert(
      {
        session_token: sessionToken,
        status: 'pending',
        draft_snapshot: {
          branchId,
          personalData,
          paymentMode,
          instructorId,
          selectedSlotIds,
          amount,
          carnetStoragePath: body.carnetStoragePath ?? null,
        },
        enrollment_id: enrollment.id,
      },
      { onConflict: 'session_token' },
    );

    // 7. Iniciar transacción Webpay Plus
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:4200';
    const returnUrl = `${appUrl}/inscripcion/retorno`;
    const buyOrder = `PAY-${enrollment.id}`;

    const wpResponse = await webpayCreate(buyOrder, sessionToken, amount ?? 0, returnUrl);

    // Guardar transbank_token para poder hacer el commit en confirm-payment
    await supabase
      .from('payment_attempts')
      .update({ transbank_token: wpResponse.token })
      .eq('session_token', sessionToken);

    return jsonResponse({
      success: true,
      enrollmentId: enrollment.id,
      webpayUrl: wpResponse.url,
      webpayToken: wpResponse.token,
    });
  } catch (err) {
    console.error('initiate-payment error:', err);
    return errorResponse('Error interno al iniciar el pago', 500);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: confirm-payment
// Confirma el pago tras el retorno desde Webpay. Busca el payment_attempt por
// transbank_token, valida el resultado con Webpay y activa la matrícula.
// Idempotente: si el intento ya está confirmado, retorna el enrollment existente.
//
// TODO (integración Transbank):
//   1. Llamar webpay.commit(tokenWs) para obtener el resultado de la transacción.
//   2. Verificar commitResponse.response_code === 0 antes de activar la matrícula.
//   3. Si response_code !== 0: marcar 'failed', retornar { success: false, rejected: true }.
// ══════════════════════════════════════════════════════════════════════════════

async function handleConfirmPayment(supabase: any, body: any) {
  const { tokenWs } = body;

  if (!tokenWs) return errorResponse('tokenWs is required');

  try {
    // 1. Buscar payment_attempt por transbank_token
    const { data: attempt } = await supabase
      .from('payment_attempts')
      .select('id, session_token, status, enrollment_id, draft_snapshot')
      .eq('transbank_token', tokenWs)
      .maybeSingle();

    if (!attempt) {
      return errorResponse('Intento de pago no encontrado para este token', 404);
    }

    if (attempt.status === 'confirmed') {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('number, total_paid, pending_balance, payment_status, course_id, branch_id')
        .eq('id', attempt.enrollment_id)
        .single();
      const snap = (attempt.draft_snapshot ?? {}) as any;
      const [{ data: cd }, { data: bd }] = await Promise.all([
        supabase.from('courses').select('name').eq('id', enrollment?.course_id).maybeSingle(),
        supabase
          .from('branches')
          .select('name, address')
          .eq('id', enrollment?.branch_id)
          .maybeSingle(),
      ]);
      return jsonResponse({
        success: true,
        enrollmentId: attempt.enrollment_id,
        enrollmentNumber: enrollment?.number ?? null,
        branchName: bd?.name ?? null,
        branchAddress: bd?.address ?? null,
        courseName: cd?.name ?? null,
        amountPaid: Number(enrollment?.total_paid ?? snap.amount ?? 0),
        courseBasePrice: Number(snap.amount ?? 0) + Number(enrollment?.pending_balance ?? 0),
        pendingBalance: Number(enrollment?.pending_balance ?? 0),
        sessionCount: Array.isArray(snap.selectedSlotIds) ? snap.selectedSlotIds.length : 0,
        paymentMode: snap.paymentMode ?? null,
        studentName: snap.personalData
          ? `${snap.personalData.firstNames ?? ''} ${snap.personalData.paternalLastName ?? ''}`.trim()
          : null,
        idempotent: true,
      });
    }

    if (attempt.status === 'failed') {
      return jsonResponse({ success: false, rejected: true, message: 'El pago fue rechazado.' });
    }

    // 2. Confirmar transacción con Webpay (commit)
    const commitResponse = await webpayCommit(tokenWs);

    if (commitResponse.response_code !== 0 || commitResponse.status !== 'AUTHORIZED') {
      await supabase.from('payment_attempts').update({ status: 'failed' }).eq('id', attempt.id);
      await supabase
        .from('enrollments')
        .update({ status: 'cancelled' })
        .eq('id', attempt.enrollment_id);
      return jsonResponse({
        success: false,
        rejected: true,
        message: `Pago rechazado por Webpay (código ${commitResponse.response_code}).`,
      });
    }

    // 3. Extraer datos del snapshot para operaciones financieras
    const snapshot = (attempt.draft_snapshot ?? {}) as any;
    const amountPaid = Number(snapshot.amount ?? 0);
    const payMode = (snapshot.paymentMode ?? 'total') as string;
    const sessionCount = Array.isArray(snapshot.selectedSlotIds)
      ? snapshot.selectedSlotIds.length
      : 0;
    const carnetStoragePath = (snapshot.carnetStoragePath ?? null) as string | null;

    // Obtener base_price del enrollment para calcular pending_balance
    const { data: enrollmentRow } = await supabase
      .from('enrollments')
      .select('course_id, base_price, branch_id')
      .eq('id', attempt.enrollment_id)
      .single();

    const basePrice = Number(enrollmentRow?.base_price ?? 0);

    // 4. Activar sesiones reservadas
    await supabase
      .from('class_b_sessions')
      .update({ status: 'scheduled' })
      .eq('enrollment_id', attempt.enrollment_id)
      .eq('status', 'reserved');

    // 5. Generar número de matrícula primero — la constraint chk_enrollment_number
    //    exige que number IS NOT NULL cuando status = 'active', por lo que ambos
    //    deben actualizarse en el mismo UPDATE.
    const { data: enrollmentNumber } = await supabase.rpc('get_next_enrollment_number', {
      p_course_id: enrollmentRow?.course_id,
    });

    // 6. Activar matrícula + asignar número en un solo UPDATE.
    //    Los campos financieros (total_paid, pending_balance, payment_status) los
    //    recalcula automáticamente el trigger trg_update_balance al insertar el pago.
    await supabase
      .from('enrollments')
      .update({
        status: 'active',
        number: enrollmentNumber ?? undefined,
      })
      .eq('id', attempt.enrollment_id);

    // 7. Registrar pago en tabla payments con status='paid'.
    //    El trigger trg_update_balance recalcula total_paid / pending_balance /
    //    payment_status del enrollment automáticamente (solo suma pagos con status='paid').
    await supabase.from('payments').insert({
      enrollment_id: attempt.enrollment_id,
      type: 'online',
      total_amount: amountPaid,
      cash_amount: 0,
      transfer_amount: 0,
      card_amount: amountPaid,
      voucher_amount: 0,
      status: 'paid',
      payment_date: new Date().toISOString(),
      requires_receipt: false,
    });

    // 8. Confirmar payment_attempt y liberar slot_holds
    await supabase.from('payment_attempts').update({ status: 'confirmed' }).eq('id', attempt.id);
    await supabase.from('slot_holds').delete().eq('session_token', attempt.session_token);

    // 9. Mover foto de carnet al destino final (guardada temporalmente en initiate-payment)
    if (carnetStoragePath) {
      await moveCarnetPhoto(supabase, carnetStoragePath, attempt.enrollment_id);
    }

    // 10. Obtener nombres de sede y curso para la respuesta enriquecida
    const [{ data: courseData }, { data: branchData }] = await Promise.all([
      supabase.from('courses').select('name').eq('id', enrollmentRow?.course_id).maybeSingle(),
      supabase
        .from('branches')
        .select('name, address')
        .eq('id', enrollmentRow?.branch_id)
        .maybeSingle(),
    ]);

    const studentName = snapshot.personalData
      ? `${snapshot.personalData.firstNames ?? ''} ${snapshot.personalData.paternalLastName ?? ''}`.trim()
      : null;

    return jsonResponse({
      success: true,
      enrollmentId: attempt.enrollment_id,
      enrollmentNumber: enrollmentNumber ?? null,
      branchName: branchData?.name ?? null,
      branchAddress: branchData?.address ?? null,
      courseName: courseData?.name ?? null,
      amountPaid,
      courseBasePrice: basePrice,
      pendingBalance: Math.max(0, basePrice - amountPaid),
      sessionCount,
      paymentMode: payMode,
      studentName,
    });
  } catch (err) {
    console.error('confirm-payment error:', err);
    return errorResponse('Error interno al confirmar el pago', 500);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared helpers
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Mueve la foto de carnet desde la ruta temporal anónima al destino final del
 * alumno y registra el documento en student_documents.
 *
 * Flujo de 2 etapas de la foto:
 *   Etapa 1 (wizard público): cliente sube a documents/public-uploads/carnet/{sessionToken}
 *   Etapa 2 (esta función):  move → documents/students/{enrollmentId}/id_photo
 *                            + INSERT en student_documents (tipo: id_photo, status: approved)
 *
 * Falla silenciosamente para no bloquear la creación del enrollment.
 */
async function moveCarnetPhoto(
  supabase: any,
  tempPath: string,
  enrollmentId: number,
): Promise<void> {
  const finalPath = `students/${enrollmentId}/id_photo`;

  const { error: moveError } = await supabase.storage.from('documents').move(tempPath, finalPath);

  if (moveError) {
    console.error('carnet photo move error:', moveError);
    return;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('documents').getPublicUrl(finalPath);

  const { error: dbError } = await supabase.from('student_documents').upsert(
    {
      enrollment_id: enrollmentId,
      type: 'id_photo',
      file_name: 'foto-carnet.jpg',
      storage_url: publicUrl,
      status: 'approved',
      uploaded_at: new Date().toISOString(),
    },
    { onConflict: 'enrollment_id,type' },
  );

  if (dbError) {
    console.error('carnet photo student_documents error:', dbError);
  }
}

async function findOrCreateUser(supabase: any, personalData: any, branchId: number) {
  const { rut, firstNames, paternalLastName, maternalLastName, email, phone } = personalData;

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('rut', rut)
    .limit(1)
    .maybeSingle();

  if (existingUser) return existingUser.id;

  const { data: studentRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'alumno')
    .single();

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      rut,
      first_names: firstNames,
      paternal_last_name: paternalLastName,
      maternal_last_name: maternalLastName ?? '',
      email,
      phone: phone ?? null,
      role_id: studentRole?.id ?? 4,
      branch_id: branchId,
      first_login: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('user creation error:', error);
    throw new Error('Failed to create user: ' + error.message);
  }

  return newUser.id;
}

async function findOrCreateStudent(supabase: any, userId: number, personalData: any) {
  const { data: existingStudent } = await supabase
    .from('students')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (existingStudent) return existingStudent.id;

  // Calcular is_minor a partir de birthDate
  const birthDate = personalData.birthDate ?? null;
  let isMinor: boolean | null = null;
  if (birthDate) {
    const birth = new Date(birthDate);
    if (!isNaN(birth.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      isMinor = age < 18;
    }
  }

  const { data: newStudent, error } = await supabase
    .from('students')
    .insert({
      user_id: userId,
      birth_date: birthDate,
      gender: personalData.gender ?? null,
      address: personalData.address ?? null,
      is_minor: isMinor,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    console.error('student creation error:', error);
    throw new Error('Failed to create student: ' + error.message);
  }

  return newStudent.id;
}

function buildScheduleGrid(rows: any[]) {
  if (rows.length === 0) return null;

  const days = new Map<string, { date: string; dayOfWeek: string; label: string }>();
  const timeRowsSet = new Set<string>();
  const slots: any[] = [];

  for (const row of rows) {
    const slotStart = new Date(row.slot_start);
    const slotEnd = new Date(row.slot_end ?? slotStart.getTime() + 45 * 60 * 1000);

    const dateStr = slotStart.toISOString().split('T')[0];
    const startTime = slotStart.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Santiago',
    });
    const endTime = slotEnd.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Santiago',
    });

    timeRowsSet.add(`${startTime}-${endTime}`);

    if (!days.has(dateStr)) {
      const dayName = slotStart.toLocaleDateString('es-CL', {
        weekday: 'short',
        timeZone: 'America/Santiago',
      });
      const dayLabel = slotStart.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'America/Santiago',
      });
      days.set(dateStr, { date: dateStr, dayOfWeek: dayName, label: `${dayName} ${dayLabel}` });
    }

    slots.push({
      id: row.slot_start,
      date: dateStr,
      startTime,
      endTime,
      status: row.slot_status === 'occupied' ? 'occupied' : 'available',
    });
  }

  const sortedDays = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = sortedDays[0]?.date ?? '';
  const lastDate = sortedDays[sortedDays.length - 1]?.date ?? '';

  return {
    week: {
      startDate: firstDate,
      endDate: lastDate,
      label: `${firstDate} — ${lastDate}`,
      days: sortedDays,
    },
    timeRows: [...timeRowsSet].sort(),
    slots,
  };
}

function courseTypeToLicenseClass(courseType: string): string {
  const map: Record<string, string> = {
    professional_a2: 'A2',
    professional_a3: 'A3',
    professional_a4: 'A4',
    professional_a5: 'A5',
    class_b: 'B',
  };
  return map[courseType] ?? courseType;
}
