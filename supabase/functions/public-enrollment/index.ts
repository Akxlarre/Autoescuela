// supabase/functions/public-enrollment/index.ts
//
// Edge Function: public-enrollment
//
// Maneja las operaciones de matrícula pública que requieren SERVICE_ROLE_KEY
// para bypasear RLS (usuarios anónimos no pueden insertar en tablas protegidas).
//
// Acciones:
//   - load-instructors: Instructores con vehículo activo por sede
//   - load-schedule: Disponibilidad horaria por instructor
//   - submit-clase-b: Matrícula completa Clase B
//   - submit-pre-inscription: Pre-inscripción profesional
//
// Invocación desde el frontend:
//   await supabase.functions.invoke('public-enrollment', {
//     body: { action: 'load-instructors', branchId: 1 }
//   })
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
      case 'submit-clase-b':
        return await handleSubmitClaseB(supabase, body);
      case 'submit-pre-inscription':
        return await handleSubmitPreInscription(supabase, body);
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

  // Instructores que tienen un vehículo asignado activo (end_date IS NULL)
  const { data, error } = await supabase
    .from('instructors')
    .select(
      `
      id,
      user:users!inner(first_names, paternal_last_name),
      vehicle_assignments!inner(
        vehicle:vehicles!inner(description, license_plate)
      )
    `,
    )
    .eq('branch_id', branchId)
    .is('vehicle_assignments.end_date', null);

  if (error) {
    console.error('load-instructors error:', error);
    return errorResponse('Error loading instructors', 500);
  }

  const instructors = (data ?? []).map((row: any) => {
    const va = row.vehicle_assignments?.[0];
    return {
      id: row.id,
      name: `${row.user?.first_names ?? ''} ${row.user?.paternal_last_name ?? ''}`.trim(),
      vehicleDescription: va?.vehicle?.description ?? '',
      plate: va?.vehicle?.license_plate ?? '',
    };
  });

  return jsonResponse({ instructors });
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: load-schedule
// Retorna la grilla de disponibilidad horaria para un instructor.
// Usa la vista v_class_b_schedule_availability.
// ══════════════════════════════════════════════════════════════════════════════

async function handleLoadSchedule(supabase: any, body: any) {
  const { instructorId } = body;
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

  // Transform raw view rows into a ScheduleGrid structure
  const grid = buildScheduleGrid(data ?? []);
  return jsonResponse({ grid });
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
      id: row.slot_start, // TIMESTAMPTZ as unique ID
      date: dateStr,
      startTime,
      endTime,
      status: row.slot_status === 'occupied' ? 'occupied' : 'available',
    });
  }

  const sortedDays = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Determine week range
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

// ══════════════════════════════════════════════════════════════════════════════
// Action: submit-clase-b
// Crea user/student/enrollment/class_b_sessions en una transacción lógica.
// ══════════════════════════════════════════════════════════════════════════════

async function handleSubmitClaseB(supabase: any, body: any) {
  const { branchId, personalData, paymentMode, instructorId, selectedSlotIds } = body;

  if (!branchId || !personalData || !paymentMode || !instructorId || !selectedSlotIds?.length) {
    return errorResponse('Missing required fields for Clase B enrollment');
  }

  try {
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
      scheduled_at: slotId, // slotId IS the TIMESTAMPTZ
      duration_min: 45,
      status: 'scheduled',
    }));

    const { error: sessionsError } = await supabase.from('class_b_sessions').insert(sessions);

    if (sessionsError) {
      console.error('sessions insert error:', sessionsError);
      // Don't fail entirely — enrollment is created
    }

    // 7. Generate enrollment number
    const { data: numData } = await supabase.rpc('get_next_enrollment_number', {
      p_course_id: course.id,
    });

    if (numData) {
      await supabase.from('enrollments').update({ number: numData }).eq('id', enrollment.id);
    }

    return jsonResponse({
      success: true,
      enrollmentId: enrollment.id,
      enrollmentNumber: numData ?? null,
    });
  } catch (err) {
    console.error('submit-clase-b error:', err);
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
// Shared helpers
// ══════════════════════════════════════════════════════════════════════════════

async function findOrCreateUser(supabase: any, personalData: any, branchId: number) {
  const { rut, firstNames, paternalLastName, maternalLastName, email, phone } = personalData;

  // Try to find existing user by RUT
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('rut', rut)
    .limit(1)
    .maybeSingle();

  if (existingUser) return existingUser.id;

  // Get the student role ID
  const { data: studentRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'alumno')
    .single();

  // Create new user
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      rut,
      first_names: firstNames,
      paternal_last_name: paternalLastName,
      maternal_last_name: maternalLastName ?? '',
      email,
      phone: phone ?? null,
      role_id: studentRole?.id ?? null,
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

  const { data: newStudent, error } = await supabase
    .from('students')
    .insert({
      user_id: userId,
      birth_date: personalData.birthDate ?? null,
      gender: personalData.gender ?? null,
      address: personalData.address ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('student creation error:', error);
    throw new Error('Failed to create student: ' + error.message);
  }

  return newStudent.id;
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
