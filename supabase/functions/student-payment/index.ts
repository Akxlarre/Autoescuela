// supabase/functions/student-payment/index.ts
//
// Edge Function: student-payment
//
// Maneja el pago de la segunda mitad de la matrícula Clase B para alumnos
// autenticados. A diferencia de public-enrollment, valida el JWT del alumno
// y opera sobre su enrollment existente (no crea uno nuevo).
//
// Acciones:
//   - load-enrollment-status   : Estado del enrollment (saldo pendiente + instructor asignado)
//   - load-instructor-schedule : Disponibilidad del instructor asignado
//   - reserve-slots            : Reserva temporal de 6 slots (TTL 20 min)
//   - release-slots            : Libera los holds al retroceder en el wizard
//   - initiate-payment         : Crea 6 class_b_sessions 'reserved' + inicia Webpay
//   - confirm-payment          : Confirma el pago tras retorno de Webpay (commit)
//
// Tarjetas de prueba Transbank (entorno integración):
// Número: 4051 8856 0044 6623 (VISA — Genera transacciones aprobadas)
// Número: 5186 0595 5959 0568 (MasterCard — Genera transacciones rechazadas)
// CVV: 123 | RUT autenticación: 11.111.111-1 | Contraseña: 123
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

// ════════════════════════════════════
// Transbank Webpay Plus — REST client
// ════════════════════════════════════

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

async function webpayCreate(
  buyOrder: string,
  sessionId: string,
  amount: number,
  returnUrl: string,
) {
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
  if (!res.ok) throw new Error(`Webpay create failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function webpayCommit(token: string) {
  const { baseUrl, commerceCode, apiKey } = getWebpayConfig();
  const res = await fetch(`${baseUrl}/rswebpaytransaction/api/webpay/v1.2/transactions/${token}`, {
    method: 'PUT',
    headers: {
      'Tbk-Api-Key-Id': commerceCode,
      'Tbk-Api-Key-Secret': apiKey,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Webpay commit failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// ══════════════════════════════════════════════════════════════════════════════
// JWT validation — decodifica el payload localmente sin llamada HTTP.
//
// El ownership real se valida en cada query de BD (e.g. enrollment.student_id),
// por lo que extraer el `sub` del JWT es suficiente para autenticar al alumno.
// Esto elimina la llamada HTTP a /auth/v1/user que añadía ~300-500ms de latencia.
// ══════════════════════════════════════════════════════════════════════════════

function getSupabaseUidFromJwt(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Decodificar el payload (segunda parte del JWT)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Service role para operaciones de BD (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // confirm-payment es llamado desde la página de retorno de Webpay donde el
    // alumno ya está autenticado, pero no necesitamos validar JWT aquí porque
    // el tokenWs de Webpay actúa como prueba de autoría de la transacción.
    let supabaseUid: string | null = null;
    if (action !== 'confirm-payment') {
      supabaseUid = getSupabaseUidFromJwt(req);
      if (!supabaseUid) return errorResponse('No autorizado', 401);
    }

    switch (action) {
      case 'load-enrollment-status':
        return await handleLoadEnrollmentStatus(supabase, supabaseUid!);
      case 'load-instructor-schedule':
        return await handleLoadInstructorSchedule(supabase, body);
      case 'reserve-slots':
        return await handleReserveSlots(supabase, body);
      case 'release-slots':
        return await handleReleaseSlots(supabase, body);
      case 'initiate-payment':
        return await handleInitiatePayment(supabase, body, supabaseUid!);
      case 'confirm-payment':
        return await handleConfirmPayment(supabase, body);
      default:
        return errorResponse(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error('student-payment error:', err);
    return errorResponse('Internal server error', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Action: load-enrollment-status
// Delega a la RPC get_student_payment_status que ejecuta todo en una sola
// transacción PostgreSQL (5 round-trips → 1 llamada RPC).
// ══════════════════════════════════════════════════════════════════════════════

async function handleLoadEnrollmentStatus(supabase: any, supabaseUid: string) {
  const { data, error } = await supabase.rpc('get_student_payment_status', {
    p_supabase_uid: supabaseUid,
  });

  if (error) {
    console.error('get_student_payment_status error:', error);
    return errorResponse('Error al cargar el estado del pago', 500);
  }

  // La función retorna un objeto de error explícito si no encuentra usuario/alumno
  if (data?.error) {
    return errorResponse(data.error, data.status ?? 400);
  }

  return jsonResponse(data);
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: load-instructor-schedule
// Retorna la grilla de disponibilidad del instructor asignado al alumno.
// Superpone slot_holds activos de otras sesiones como 'occupied'.
// ══════════════════════════════════════════════════════════════════════════════

async function handleLoadInstructorSchedule(supabase: any, body: any) {
  const { instructorId, sessionToken } = body;
  if (!instructorId) return errorResponse('instructorId is required');

  const { data, error } = await supabase
    .from('v_class_b_schedule_availability')
    .select('*')
    .eq('instructor_id', instructorId)
    .order('slot_start', { ascending: true });

  if (error) {
    console.error('load-instructor-schedule error:', error);
    return errorResponse('Error loading schedule', 500);
  }

  const grid = buildScheduleGrid(data ?? []);

  // Superponer holds activos: los de OTRAS sesiones se marcan como ocupados,
  // los de ESTA sesión se devuelven para pre-seleccionarlos en la UI.
  let myHeldSlotIds: string[] = [];

  if (grid) {
    const { data: holds } = await supabase
      .from('slot_holds')
      .select('slot_start, session_token')
      .eq('instructor_id', instructorId)
      .gt('expires_at', new Date().toISOString());

    if (holds?.length) {
      const heldByOthers = new Set<string>();

      for (const h of holds) {
        const iso = new Date(h.slot_start).toISOString();
        if (h.session_token === (sessionToken ?? '')) {
          // Hold propio — devolver para pre-selección
          myHeldSlotIds.push(h.slot_start);
        } else {
          // Hold ajeno — marcar como ocupado en la grilla
          heldByOthers.add(iso);
        }
      }

      if (heldByOthers.size > 0) {
        grid.slots = grid.slots.map((slot: any) => {
          const slotIso = new Date(slot.id).toISOString();
          return heldByOthers.has(slotIso) ? { ...slot, status: 'occupied' } : slot;
        });
      }
    }
  }

  return jsonResponse({ grid, myHeldSlotIds });
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: reserve-slots
// Crea (o reemplaza) los slot_holds para una sesión. Limitado a 6 slots.
// ══════════════════════════════════════════════════════════════════════════════

const MAX_SLOTS_SECOND_PAYMENT = 6;

async function handleReserveSlots(supabase: any, body: any) {
  const { sessionToken, instructorId, slotIds } = body;

  if (!sessionToken || !instructorId || !slotIds?.length) {
    return errorResponse('sessionToken, instructorId y slotIds son requeridos');
  }

  if (slotIds.length > MAX_SLOTS_SECOND_PAYMENT) {
    return errorResponse(`Máximo ${MAX_SLOTS_SECOND_PAYMENT} slots por sesión`, 400);
  }

  // 1. Limpiar holds expirados y los anteriores de esta sesión
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
    return errorResponse('Error al reservar slots: ' + error.message, 500);
  }

  return jsonResponse({ success: true });
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: release-slots
// Libera los slot_holds de una sesión (back navigation).
// ══════════════════════════════════════════════════════════════════════════════

async function handleReleaseSlots(supabase: any, body: any) {
  const { sessionToken } = body;
  if (!sessionToken) return errorResponse('sessionToken is required');

  await supabase.from('slot_holds').delete().eq('session_token', sessionToken);

  return jsonResponse({ success: true });
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: initiate-payment
// Valida ownership del enrollment, crea 6 class_b_sessions 'reserved',
// registra payment_attempt e inicia transacción Webpay Plus.
// Idempotente vía session_token.
// ══════════════════════════════════════════════════════════════════════════════

async function handleInitiatePayment(supabase: any, body: any, supabaseUid: string) {
  const { enrollmentId, instructorId, selectedSlotIds, sessionToken } = body;

  if (!enrollmentId || !instructorId || !selectedSlotIds?.length || !sessionToken) {
    return errorResponse(
      'enrollmentId, instructorId, selectedSlotIds y sessionToken son requeridos',
    );
  }

  try {
    // 1. Obtener usuario
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_uid', supabaseUid)
      .maybeSingle();

    if (!user) return errorResponse('Usuario no encontrado', 404);

    // 2. Obtener alumno
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!student) return errorResponse('Alumno no encontrado', 404);

    // 3. Verificar ownership y saldo pendiente (OWASP A01 — IDOR prevention)
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, pending_balance, course_id, branch_id')
      .eq('id', enrollmentId)
      .eq('student_id', student.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!enrollment) return errorResponse('Matrícula no encontrada o no autorizada', 403);

    const pendingBalance = Number(enrollment.pending_balance ?? 0);
    if (pendingBalance <= 0) return errorResponse('Esta matrícula no tiene saldo pendiente', 400);

    // 4. Idempotencia: si ya hay un intento confirmado, retornar éxito
    const { data: existing } = await supabase
      .from('payment_attempts')
      .select('status, enrollment_id')
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (existing?.status === 'confirmed') {
      return jsonResponse({ success: true, idempotent: true, webpayUrl: null, webpayToken: null });
    }

    // 5. Obtener vehículo del instructor (guardado en snapshot para usarlo en confirm-payment)
    const { data: va } = await supabase
      .from('vehicle_assignments')
      .select('vehicle_id')
      .eq('instructor_id', instructorId)
      .is('end_date', null)
      .limit(1)
      .maybeSingle();

    // 6. Registrar payment_attempt
    const tokenSuffix = sessionToken.replace(/-/g, '').slice(0, 8).toUpperCase();
    const buyOrder = `BAL-${enrollmentId}-${tokenSuffix}`;

    await supabase.from('payment_attempts').upsert(
      {
        session_token: sessionToken,
        status: 'pending',
        draft_snapshot: {
          enrollmentId,
          instructorId,
          selectedSlotIds,
          vehicleId: va?.vehicle_id ?? null,
          amount: pendingBalance,
          userId: user.id,
        },
        enrollment_id: enrollmentId,
      },
      { onConflict: 'session_token' },
    );

    // 8. Iniciar transacción Webpay Plus
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:4200';
    const returnUrl = `${appUrl}/app/alumno/pagar/retorno`;

    const wpResponse = await webpayCreate(buyOrder, sessionToken, pendingBalance, returnUrl);

    await supabase
      .from('payment_attempts')
      .update({ transbank_token: wpResponse.token })
      .eq('session_token', sessionToken);

    return jsonResponse({
      success: true,
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
// Confirma el pago tras retorno de Webpay. Activa sesiones, registra el pago
// (el trigger trg_update_balance recalcula totales del enrollment).
// Idempotente.
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

    if (!attempt) return errorResponse('Intento de pago no encontrado para este token', 404);

    // Idempotente: si ya está confirmado, devolver datos del enrollment
    if (attempt.status === 'confirmed') {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select(
          `
          number, total_paid, pending_balance,
          courses!inner(name),
          branches!inner(name)
        `,
        )
        .eq('id', attempt.enrollment_id)
        .maybeSingle();

      const snap = (attempt.draft_snapshot ?? {}) as any;
      return jsonResponse({
        success: true,
        idempotent: true,
        enrollmentNumber: enrollment?.number ?? null,
        courseName: enrollment?.courses?.name ?? null,
        branchName: enrollment?.branches?.name ?? null,
        amountPaid: Number(snap.amount ?? 0),
        pendingBalance: Number(enrollment?.pending_balance ?? 0),
        sessionCount: Array.isArray(snap.selectedSlotIds) ? snap.selectedSlotIds.length : 0,
      });
    }

    if (attempt.status === 'failed') {
      return jsonResponse({ success: false, rejected: true, message: 'El pago fue rechazado.' });
    }

    // 2. Confirmar transacción con Webpay (commit)
    const commitResponse = await webpayCommit(tokenWs);

    if (commitResponse.response_code !== 0 || commitResponse.status !== 'AUTHORIZED') {
      await supabase.from('payment_attempts').update({ status: 'failed' }).eq('id', attempt.id);
      await supabase.from('slot_holds').delete().eq('session_token', attempt.session_token);
      return jsonResponse({
        success: false,
        rejected: true,
        message: `Pago rechazado por Webpay (código ${commitResponse.response_code}).`,
      });
    }

    const snapshot = (attempt.draft_snapshot ?? {}) as any;
    const amountPaid = Number(snapshot.amount ?? 0);

    // 3. Crear class_b_sessions como 'scheduled' directamente (pago ya confirmado)
    // Se crean aquí y no en initiate-payment para evitar sesiones huérfanas si el
    // alumno abandona Transbank sin completar el pago.
    // Segunda mitad del pago parcial → siempre clases 7-12.
    const sortedSlotIds = [...(snapshot.selectedSlotIds ?? [])].sort();
    const sessions = sortedSlotIds.map((slotId: string, i: number) => ({
      enrollment_id: attempt.enrollment_id,
      instructor_id: snapshot.instructorId,
      vehicle_id: snapshot.vehicleId ?? null,
      scheduled_at: slotId,
      duration_min: 45,
      status: 'scheduled',
      class_number: i + 7,
    }));

    if (sessions.length > 0) {
      const { error: sessionsError } = await supabase.from('class_b_sessions').insert(sessions);
      if (sessionsError) {
        console.error('sessions insert error on confirm:', sessionsError);
        return errorResponse('Error al crear sesiones: ' + sessionsError.message, 500);
      }
    }

    // 4. Registrar pago — el trigger trg_update_balance recalcula totales del enrollment
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

    // 5. Confirmar attempt + liberar slot_holds
    await supabase.from('payment_attempts').update({ status: 'confirmed' }).eq('id', attempt.id);
    await supabase.from('slot_holds').delete().eq('session_token', attempt.session_token);

    // 6. Obtener datos enriquecidos para la respuesta
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select(
        `
        number, total_paid, pending_balance,
        courses!inner(name),
        branches!inner(name)
      `,
      )
      .eq('id', attempt.enrollment_id)
      .maybeSingle();

    return jsonResponse({
      success: true,
      enrollmentNumber: enrollment?.number ?? null,
      courseName: enrollment?.courses?.name ?? null,
      branchName: enrollment?.branches?.name ?? null,
      amountPaid,
      pendingBalance: Number(enrollment?.pending_balance ?? 0),
      sessionCount: Array.isArray(snapshot.selectedSlotIds) ? snapshot.selectedSlotIds.length : 0,
    });
  } catch (err) {
    console.error('confirm-payment error:', err);
    return errorResponse('Error interno al confirmar el pago', 500);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers compartidos
// ══════════════════════════════════════════════════════════════════════════════

function buildScheduleGrid(rows: any[]) {
  if (rows.length === 0) return null;

  // Excluir slots del día presente y anteriores — no es posible coordinar una
  // clase con tan poca antelación. La fecha de referencia usa America/Santiago.
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const futureRows = rows.filter((row) => {
    const slotDate = new Date(row.slot_start).toLocaleDateString('en-CA', {
      timeZone: 'America/Santiago',
    });
    return slotDate > todayStr;
  });

  if (futureRows.length === 0) return null;

  const days = new Map<string, { date: string; dayOfWeek: string; label: string }>();
  const timeRowsSet = new Set<string>();
  const slots: any[] = [];

  for (const row of futureRows) {
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
