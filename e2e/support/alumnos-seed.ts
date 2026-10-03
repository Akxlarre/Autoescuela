/**
 * Siembra de alumnos de prueba para los tests del módulo Alumnos B (fix-264-m, ASG-i-024).
 *
 * Los casos que cambian estado (archivar, restaurar, marcar ex-alumno…) nunca usan alumnos del
 * seed de 0008-i: crean el suyo con prefijo E2E- y lo borran al terminar.
 *
 * Crea por API (sesión admin, RLS activa) las filas mínimas que la Base de Alumnos necesita:
 * `users` → `students` → `enrollments` (opcional). Cada fila queda registrada en `cleanup`.
 */
import { calculateRutDv, formatRut } from '../../src/app/core/utils/rut.utils';
import { E2E_PREFIX, type Cleanup } from './fixtures';
import { getAdminClient } from './supabase-admin';

/** `roles.id` del rol alumno (el mismo que usa `enrollment.facade.ts` al descartar borradores). */
const STUDENT_ROLE_ID = 4;

export interface E2eEnrollmentSpec {
  /** Nombre exacto del curso en `courses` para la sede (por defecto "Clase B"). */
  courseName?: string;
  status?: 'active' | 'completed' | 'withdrawn' | 'draft' | 'cancelled' | 'pending_payment';
  paymentStatus?: 'paid' | 'paid_full' | 'partial' | 'pending';
  pendingBalance?: number;
  totalPaid?: number;
  docsComplete?: boolean;
  /** ISO. Por defecto, ahora. */
  createdAt?: string;
  /** ISO. Por defecto, igual a `createdAt` (una matrícula antigua no se modificó hoy). */
  updatedAt?: string;
}

export interface E2eAlumnoSpec {
  /** Texto corto que distingue al alumno dentro del test; termina en el nombre. */
  label: string;
  branchId: number;
  paternalLastName?: string;
  maternalLastName?: string;
  studentStatus?: 'active' | 'inactive' | 'archived';
  /** Sin matrículas → alumno "Pre-inscrito" sin historial. */
  enrollments?: E2eEnrollmentSpec[];
}

export interface E2eAlumno {
  userId: number;
  studentId: number;
  enrollmentIds: number[];
  /** Nº de expediente de cada matrícula, en el mismo orden que `enrollmentIds`. */
  enrollmentNumbers: string[];
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  /** RUT como queda guardado (con puntos y guion). */
  rut: string;
  email: string;
}

/** RUT válido en el rango 99.xxx.xxx, que el seed de 0008-i (25.000.xxx) no usa. */
function randomE2eRut(): string {
  const body = String(99_000_000 + Math.floor(Math.random() * 999_999));
  return formatRut(body + calculateRutDv(body));
}

export async function createE2eAlumno(spec: E2eAlumnoSpec, cleanup: Cleanup): Promise<E2eAlumno> {
  const sb = await getAdminClient();
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const firstNames = `${E2E_PREFIX}${spec.label}`;
  const paternalLastName = spec.paternalLastName ?? `Prueba${stamp.slice(-6)}`;
  const maternalLastName = spec.maternalLastName ?? 'Automatizada';
  const rut = randomE2eRut();
  const email = `e2e-${spec.label.toLowerCase()}-${stamp}@test.com`;

  const { data: user, error: userErr } = await sb
    .from('users')
    .insert({
      rut,
      first_names: firstNames,
      paternal_last_name: paternalLastName,
      maternal_last_name: maternalLastName,
      email,
      phone: '+56900000000',
      role_id: STUDENT_ROLE_ID,
      branch_id: spec.branchId,
      active: true,
      first_login: true,
    })
    .select('id')
    .single();
  if (userErr) throw new Error(`[e2e] No se pudo crear el usuario de prueba: ${userErr.message}`);
  cleanup.track('users', user.id);

  const { data: student, error: studentErr } = await sb
    .from('students')
    .insert({
      user_id: user.id,
      birth_date: '1995-01-15',
      is_minor: false,
      has_notarial_auth: false,
      status: spec.studentStatus ?? 'active',
    })
    .select('id')
    .single();
  if (studentErr)
    throw new Error(`[e2e] No se pudo crear el alumno de prueba: ${studentErr.message}`);
  cleanup.track('students', student.id);

  const enrollmentIds: number[] = [];
  const enrollmentNumbers: string[] = [];
  for (const [index, e] of (spec.enrollments ?? []).entries()) {
    const courseName = e.courseName ?? 'Clase B';
    const { data: course, error: courseErr } = await sb
      .from('courses')
      .select('id, base_price')
      .eq('name', courseName)
      .eq('branch_id', spec.branchId)
      .single();
    if (courseErr)
      throw new Error(
        `[e2e] No existe el curso "${courseName}" en la sede ${spec.branchId}: ${courseErr.message}`,
      );

    const number = `${E2E_PREFIX}${stamp.slice(-7)}${index}`;
    const pendingBalance = e.pendingBalance ?? 0;
    const row: Record<string, unknown> = {
      number,
      student_id: student.id,
      course_id: course.id,
      branch_id: spec.branchId,
      base_price: course.base_price,
      discount: 0,
      total_paid: e.totalPaid ?? course.base_price - pendingBalance,
      pending_balance: pendingBalance,
      payment_status: e.paymentStatus ?? 'paid',
      status: e.status ?? 'active',
      docs_complete: e.docsComplete ?? true,
      contract_accepted: true,
      registration_channel: 'in_person',
      license_group: 'class_b',
    };
    if (e.createdAt) row['created_at'] = e.createdAt;
    if (e.updatedAt ?? e.createdAt) row['updated_at'] = e.updatedAt ?? e.createdAt;

    const { data: enrollment, error: enrollErr } = await sb
      .from('enrollments')
      .insert(row)
      .select('id')
      .single();
    if (enrollErr)
      throw new Error(`[e2e] No se pudo crear la matrícula de prueba: ${enrollErr.message}`);
    cleanup.track('enrollments', enrollment.id);
    enrollmentIds.push(enrollment.id);
    enrollmentNumbers.push(number);
  }

  return {
    userId: user.id,
    studentId: student.id,
    enrollmentIds,
    enrollmentNumbers,
    firstNames,
    paternalLastName,
    maternalLastName,
    rut,
    email,
  };
}

/**
 * Agenda una clase práctica a futuro para una matrícula de prueba (fix-277-m). Usa el instructor y
 * el vehículo de cualquier clase existente, y una fecha a más de un año de hoy a las 03:15, para
 * no chocar con la agenda real ni con otros tests.
 */
export async function addFutureClass(enrollmentId: number, cleanup: Cleanup): Promise<void> {
  const sb = await getAdminClient();
  const { data: sample, error: sampleErr } = await sb
    .from('class_b_sessions')
    .select('instructor_id, vehicle_id')
    .limit(1)
    .single();
  if (sampleErr)
    throw new Error(
      `[e2e] No hay ninguna clase de la que copiar instructor y vehículo: ${sampleErr.message}`,
    );

  const when = new Date(Date.now() + (400 + Math.floor(Math.random() * 300)) * 24 * 60 * 60 * 1000);
  when.setUTCHours(6, 15, Math.floor(Math.random() * 60), 0);
  const { data: session, error: sessionErr } = await sb
    .from('class_b_sessions')
    .insert({
      enrollment_id: enrollmentId,
      instructor_id: sample.instructor_id,
      vehicle_id: sample.vehicle_id,
      class_number: 1,
      scheduled_at: when.toISOString(),
      status: 'scheduled',
    })
    .select('id')
    .single();
  if (sessionErr)
    throw new Error(`[e2e] No se pudo agendar la clase de prueba: ${sessionErr.message}`);
  cleanup.track('class_b_sessions', session.id);
}

/**
 * Deja la clase #1 de una matrícula de prueba como inasistencia (fix-279-m): una sesión pasada en
 * `no_show` con su fila de asistencia `absent` vigente. Devuelve el id de la sesión.
 */
export async function addMissedClass(
  alumno: Pick<E2eAlumno, 'studentId'>,
  enrollmentId: number,
  cleanup: Cleanup,
): Promise<number> {
  const sb = await getAdminClient();
  const { data: sample, error: sampleErr } = await sb
    .from('class_b_sessions')
    .select('instructor_id, vehicle_id')
    .limit(1)
    .single();
  if (sampleErr)
    throw new Error(
      `[e2e] No hay ninguna clase de la que copiar instructor y vehículo: ${sampleErr.message}`,
    );

  // Entre 3 y 200 días atrás, a las 03:15 (hora de Chile): una hora sin clases reales. El día
  // varía para que dos tests en paralelo no le dejen al mismo instructor clases solapadas, que
  // la BD rechaza.
  const when = new Date(Date.now() - (3 + Math.floor(Math.random() * 197)) * 24 * 60 * 60 * 1000);
  when.setUTCHours(6, 15, Math.floor(Math.random() * 60), 0);
  const { data: session, error: sessionErr } = await sb
    .from('class_b_sessions')
    .insert({
      enrollment_id: enrollmentId,
      instructor_id: sample.instructor_id,
      vehicle_id: sample.vehicle_id,
      class_number: 1,
      scheduled_at: when.toISOString(),
      status: 'no_show',
    })
    .select('id')
    .single();
  if (sessionErr)
    throw new Error(`[e2e] No se pudo crear la clase con inasistencia: ${sessionErr.message}`);
  cleanup.track('class_b_sessions', session.id);

  const { data: attendance, error: attendanceErr } = await sb
    .from('class_b_practice_attendance')
    .insert({ class_b_session_id: session.id, student_id: alumno.studentId, status: 'absent' })
    .select('id')
    .single();
  if (attendanceErr)
    throw new Error(`[e2e] No se pudo registrar la inasistencia: ${attendanceErr.message}`);
  cleanup.track('class_b_practice_attendance', attendance.id);

  return session.id;
}

/**
 * Sube documentos "de mentira" al expediente de una matrícula (fix-264-m, 2ª pasada): solo las
 * filas de `student_documents`, sin archivo en Storage. La lista solo mira el `type`.
 */
export async function addStudentDocuments(
  enrollmentId: number,
  types: string[],
  cleanup: Cleanup,
): Promise<void> {
  const sb = await getAdminClient();
  for (const type of types) {
    const { data, error } = await sb
      .from('student_documents')
      .insert({
        enrollment_id: enrollmentId,
        type,
        file_name: `${E2E_PREFIX}${type}.jpg`,
        storage_url: `e2e/${enrollmentId}/${type}.jpg`,
        status: 'approved',
      })
      .select('id')
      .single();
    if (error) throw new Error(`[e2e] No se pudo crear el documento ${type}: ${error.message}`);
    cleanup.track('student_documents', data.id);
  }
}

/**
 * Deja `count` clases prácticas cerradas (`completed`) en el pasado para una matrícula de
 * prueba (fix-264-m, 2ª pasada). Con 12 + `markCertificateSent()` el alumno queda con el curso
 * completo y pendiente de pasar a ex-alumno.
 */
export async function addCompletedPractices(
  enrollmentId: number,
  count: number,
  cleanup: Cleanup,
): Promise<void> {
  const sb = await getAdminClient();
  const { data: sample, error: sampleErr } = await sb
    .from('class_b_sessions')
    .select('instructor_id, vehicle_id')
    .limit(1)
    .single();
  if (sampleErr)
    throw new Error(
      `[e2e] No hay ninguna clase de la que copiar instructor y vehículo: ${sampleErr.message}`,
    );

  // Una clase por día hacia atrás desde hace 30 días, a las 03:15 UTC: horas sin clases reales.
  const rowsToInsert = Array.from({ length: count }, (_, i) => {
    const when = new Date(Date.now() - (30 + i) * 24 * 60 * 60 * 1000);
    when.setUTCHours(6, 15, Math.floor(Math.random() * 60), 0);
    return {
      enrollment_id: enrollmentId,
      instructor_id: sample.instructor_id,
      vehicle_id: sample.vehicle_id,
      class_number: i + 1,
      scheduled_at: when.toISOString(),
      status: 'completed',
    };
  });
  const { data, error } = await sb.from('class_b_sessions').insert(rowsToInsert).select('id');
  if (error) throw new Error(`[e2e] No se pudieron crear las clases cerradas: ${error.message}`);
  for (const row of data) cleanup.track('class_b_sessions', row.id);
}

/**
 * Deja una matrícula con "certificado Clase B ya enviado por email": la condición que habilita
 * "Marcar como Ex-Alumno" en la ficha (fix-012-i). Inserta el certificado y su registro de
 * envío; no genera ningún PDF ni manda correos.
 */
export async function markCertificateSent(
  alumno: Pick<E2eAlumno, 'studentId'>,
  enrollmentId: number,
  cleanup: Cleanup,
): Promise<void> {
  const sb = await getAdminClient();
  const { data: cert, error: certErr } = await sb
    .from('certificates')
    .insert({
      // Folio en un rango que los certificados reales no alcanzan.
      folio: 900_000_000 + Math.floor(Math.random() * 99_999_999),
      enrollment_id: enrollmentId,
      student_id: alumno.studentId,
      type: 'class_b',
      status: 'issued',
      issued_date: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single();
  if (certErr)
    throw new Error(`[e2e] No se pudo crear el certificado de prueba: ${certErr.message}`);
  cleanup.track('certificates', cert.id);

  const { data: log, error: logErr } = await sb
    .from('certificate_issuance_log')
    .insert({ certificate_id: cert.id, action: 'email_sent' })
    .select('id')
    .single();
  if (logErr)
    throw new Error(`[e2e] No se pudo registrar el envío del certificado: ${logErr.message}`);
  cleanup.track('certificate_issuance_log', log.id);
}
