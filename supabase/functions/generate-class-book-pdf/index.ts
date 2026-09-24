// supabase/functions/generate-class-book-pdf/index.ts
//
// Edge Function: generate-class-book-pdf
//
// Genera el Libro de Clases Profesional como PDF a partir de un promotion_course_id.
// Incluye: cabecera, profesores, lista de alumnos, reglamento OTEC, asistencia semanal,
// calendario de clases, evaluaciones, resumen de asistencia.
//
// Invocación:
//   await supabase.functions.invoke('generate-class-book-pdf', {
//     body: { promotion_course_id: 42 }
//   })
//
// spec 0018-m: libro de convalidación (Conv. A-3 / Conv. A-4), armado al vuelo desde su curso
// madre (A5 / A2), sin promotion_course propio:
//   body: { promotion_course_id: <id del curso madre>, convalidation: 'A3' | 'A4' }
//
// Respuesta: { pdfUrl: "https://...storage.../class-books/42/LibroDeClases_A2_PROM-2026-01.pdf" }
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  escapePdfWinAnsi as esc,
  loadPngForPdf,
  assemblePdf,
  wrapLines,
  textWidth,
} from '../_shared/pdf-utils.ts';

// ─── CORS ───

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Main ───

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { promotion_course_id, convalidation = null } = await req.json();

    if (!promotion_course_id || typeof promotion_course_id !== 'number') {
      return jsonRes({ error: 'promotion_course_id (number) is required' }, 400);
    }
    if (convalidation !== null && !(convalidation in CONV_BOOKS)) {
      return jsonRes({ error: "convalidation must be 'A3', 'A4' or null" }, 400);
    }
    const convBook = convalidation ? CONV_BOOKS[convalidation as 'A3' | 'A4'] : null;

    // spec 0018-m: cada libro (normal o de convalidación) tiene su propia fila en class_book.
    const classBookQuery = (client) => {
      const q = client
        .from('class_book')
        .select('sence_code')
        .eq('promotion_course_id', promotion_course_id);
      return (
        convalidation
          ? q.eq('convalidation_license', convalidation)
          : q.is('convalidation_license', null)
      ).maybeSingle();
    };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Fetch all data in parallel ──
    // fix-250-m: el Libro de Clases (PDF incluido) es una plantilla imprimible, no un
    // reflejo de resultados ya registrados — no se leen professional_module_grades,
    // professional_theory_attendance, professional_practice_attendance ni
    // professional_weekly_signatures. Solo se precargan alumnos, profesores, sesiones
    // (para el layout de la grilla) y el Código SENCE del libro (el horario ya es fijo,
    // fix-258-m).
    const [courseRes, lecturersRes, enrollmentsRes, theoryRes, classBookRes] = await Promise.all([
      // 1. Course + promotion + branch
      supabase
        .from('promotion_courses')
        .select(
          `id, code, courses!inner(name, code, license_class),
             professional_promotions!inner(name, code, start_date, end_date, status, branches(name, address))`,
        )
        .eq('id', promotion_course_id)
        .single(),

      // 2. Lecturers
      supabase
        .from('promotion_course_lecturers')
        .select('role, lecturers!inner(first_names, paternal_last_name)')
        .eq('promotion_course_id', promotion_course_id),

      // 3. Enrolled students
      supabase
        .from('enrollments')
        .select(
          'id, students!inner(users!inner(first_names, paternal_last_name, maternal_last_name, rut, phone))',
        )
        .eq('promotion_course_id', promotion_course_id)
        .not('status', 'in', '("cancelled","draft")')
        .order('id'),

      // 4. Theory sessions — solo definen la grilla de columnas/semanas y el calendario.
      supabase
        .from('professional_theory_sessions')
        .select('id, date, status')
        .eq('promotion_course_id', promotion_course_id)
        .order('date'),

      // 5. Class book editable fields
      classBookQuery(supabase),
    ]);

    if (courseRes.error || !courseRes.data) {
      return jsonRes({ error: `Curso no encontrado: ${courseRes.error?.message}` }, 404);
    }

    const course = courseRes.data.courses;
    const promo = courseRes.data.professional_promotions;
    const branch = promo.branches;
    const licenseClass = course.license_class;
    const classBook = classBookRes.data;

    if (convBook && licenseClass !== convBook.motherLicense) {
      return jsonRes(
        {
          error: `El libro Conv. ${convalidation} cuelga del curso ${convBook.motherLicense}, no de ${licenseClass}`,
        },
        400,
      );
    }

    // spec 0018-m: en el libro de convalidación solo van los alumnos del curso madre que
    // convalidan esa licencia (license_validations). Siguen apareciendo también en el libro
    // de su curso madre (decisión del dueño 2026-09-24).
    let enrollmentRows = enrollmentsRes.data ?? [];
    if (convalidation && enrollmentRows.length > 0) {
      const { data: lv, error: lvError } = await supabase
        .from('license_validations')
        .select('enrollment_id')
        .eq('convalidated_license', convalidation)
        .in(
          'enrollment_id',
          enrollmentRows.map((e) => e.id),
        );
      if (lvError) {
        return jsonRes({ error: `Error leyendo convalidaciones: ${lvError.message}` }, 500);
      }
      const convIds = new Set((lv ?? []).map((r) => r.enrollment_id));
      enrollmentRows = enrollmentRows.filter((e) => convIds.has(e.id));
    }

    // spec 0018-m: el tramo de convalidación son las últimas N fechas activas del curso madre
    // (N = días de clase del libro real). Si hay menos, se usan todas y el Calendario imprime
    // el aviso de bloques sin fecha (AC-E3); nunca se inventan fechas.
    const allSessions = theoryRes.data ?? [];
    let bookSessions = allSessions;
    let courseStartDate = promo.start_date;
    let courseEndDate = promo.end_date;
    if (convBook) {
      const convDates = [
        ...new Set(allSessions.filter((s) => s.status !== 'cancelled').map((s) => s.date)),
      ]
        .sort()
        .slice(-convBook.sessionDays);
      if (convDates.length > 0) {
        courseStartDate = convDates[0];
        courseEndDate = convDates[convDates.length - 1];
        bookSessions = allSessions.filter(
          (s) => s.date >= courseStartDate && s.date <= courseEndDate,
        );
      } else {
        courseStartDate = null;
        courseEndDate = null;
        bookSessions = [];
      }
    }

    // Enrollments
    const enrollments = enrollmentRows.map((e, i) => {
      const u = e.students.users;
      return {
        id: e.id,
        numero: i + 1,
        nombre: [u.paternal_last_name, u.maternal_last_name, u.first_names]
          .filter(Boolean)
          .join(' '),
        rut: u.rut ?? '',
        telefono: u.phone ?? '',
      };
    });
    // Module names based on license class (spec 0018-m: 5 asignaturas en convalidación)
    const moduleNames = convalidation
      ? getConvalidationModuleNames(convalidation)
      : getModuleNames(licenseClass);

    // Lecturers
    const lecturers = (lecturersRes.data ?? []).map((l) => ({
      name: `${l.lecturers.first_names} ${l.lecturers.paternal_last_name}`,
      role: l.role,
    }));

    // ── Build PDF (with 40s safety timeout) ──
    const pdfBytes = await Promise.race([
      buildClassBookPdf({
        promo: {
          name: promo.name,
          code: promo.code,
          startDate: promo.start_date,
          endDate: promo.end_date,
        },
        course: {
          name: course.name,
          // spec 0018-m: ID del libro de convalidación = código de la promoción + sufijo
          // (156.6 / 156.7), igual que el real.
          code: convBook
            ? promo.code
              ? `${promo.code}.${convBook.idSuffix}`
              : ''
            : (courseRes.data.code ?? course.code),
          licenseClass,
        },
        convalidation,
        courseStartDate,
        courseEndDate,
        branch: { name: branch?.name ?? '', address: branch?.address ?? '' },
        senceCode: classBook?.sence_code ?? '',
        lecturers,
        moduleNames,
        enrollments,
        theorySessions: bookSessions,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PDF generation timeout after 40s')), 40_000),
      ),
    ]);

    // ── Upload to Storage ──
    // spec 0018-m: nombre distinto para el libro de convalidación — nunca pisa el PDF del
    // libro de su curso madre, que vive en la misma carpeta.
    const bookLabel = convalidation ? `Conv${convalidation}` : licenseClass;
    const fileName = `LibroDeClases_${bookLabel}_${promo.code ?? promotion_course_id}.pdf`;
    const storagePath = `class-books/${promotion_course_id}/${sanitize(fileName)}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      return jsonRes({ error: `Upload failed: ${uploadError.message}` }, 500);
    }

    // ── Update class_book record — guardamos el path relativo (bucket privado) ──
    await supabase.from('class_book').upsert(
      {
        promotion_course_id,
        branch_id: branch?.id ?? null,
        period: promo.code,
        pdf_url: storagePath,
        generated_at: new Date().toISOString(),
        status: 'active',
        convalidation_license: convalidation,
      },
      // spec 0018-m: unicidad (promotion_course_id, convalidation_license) NULLS NOT DISTINCT
      // — migración 20260924120000. Con 'promotion_course_id' solo, este upsert falla.
      { onConflict: 'promotion_course_id,convalidation_license' },
    );

    // Generar signed URL (TTL 1h) para visualización inmediata en el cliente.
    const { data: signedData } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600);

    return jsonRes({ pdfUrl: signedData?.signedUrl ?? null, pdfPath: storagePath });
  } catch (err) {
    console.error('generate-class-book-pdf error:', err);
    return jsonRes({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

function jsonRes(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function fmtDate(d: string | null): string {
  if (!d) return '\u2014';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtShort(d: string): string {
  const dt = new Date(d + 'T12:00:00');
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function getMondayForDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// spec 0018-m: libros de convalidaci\u00f3n. Espejo de CONVALIDATION_BOOKS en
// src/app/core/utils/convalidation-book.utils.ts (la Edge Function no puede importar c\u00f3digo
// de Angular) \u2014 mantener ambos en sincron\u00eda. Valores tomados de libroclasesconva3/4.pdf.
const CONV_BOOKS: Record<
  'A3' | 'A4',
  {
    motherLicense: 'A5' | 'A2';
    idSuffix: '6' | '7';
    sessionDays: number;
    moduleIndexes: number[];
    evaluationLicense: 'A3' | 'A4';
  }
> = {
  // Evaluaciones: Infraestructura, Mec\u00e1nica, Transporte de Pasajeros, Conducci\u00f3n, Aspectos Psic.
  A3: {
    motherLicense: 'A5',
    idSuffix: '6',
    sessionDays: 16,
    moduleIndexes: [2, 3, 4, 5, 6],
    evaluationLicense: 'A3',
  },
  // Evaluaciones: Prevenci\u00f3n de Riesgos, Mec\u00e1nica, Transporte de Carga, Conducci\u00f3n, Aspectos Psic.
  A4: {
    motherLicense: 'A2',
    idSuffix: '7',
    sessionDays: 13,
    moduleIndexes: [1, 3, 4, 5, 6],
    evaluationLicense: 'A4',
  },
};

function getConvalidationModuleNames(conv: 'A3' | 'A4'): string[] {
  const book = CONV_BOOKS[conv];
  const all = getModuleNames(book.evaluationLicense);
  return book.moduleIndexes.map((i) => all[i]);
}

const BASE_MODULES: Record<number, string> = {
  1: 'Ley del Tr\u00e1nsito, Resp. Civil y Penal',
  2: 'Prevenci\u00f3n de Riesgos',
  3: 'Infraestructura y Educ. Vial',
  4: 'Mec\u00e1nica',
  6: 'Conducci\u00f3n',
  7: 'Asp. Psicol\u00f3gicos y Comunicaci\u00f3n',
};

function getModuleNames(lc: string): string[] {
  const m5 = lc === 'A4' || lc === 'A5' ? 'Transporte de Carga' : 'Transporte de Pasajeros';
  return [
    BASE_MODULES[1],
    BASE_MODULES[2],
    BASE_MODULES[3],
    BASE_MODULES[4],
    m5,
    BASE_MODULES[6],
    BASE_MODULES[7],
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// Curriculum verbatim — Calendario de Clases (fuente, aún no conectado al render)
// ══════════════════════════════════════════════════════════════════════════════
//
// spec 0017-m: transcripción verbatim de `libroclases.pdf` (páginas 14-27, A2 —
// "Transporte de Pasajeros"), 71 filas reales (la estimación de tasks.md decía 72;
// la página 26 del PDF real es una tabla vacía sin datos, no una fila 72).
// Se transcribe sin resumir ni inventar contenido, por ser un documento fiscalizable,
// pero con la ortografía corregida (decisión del dueño 2026-09-24): las erratas del
// original ("compisiciones", "Catigo", "Refigeración", etc.) NO se replican. HORAS va
// siempre en minúscula ("horas", o "hora" si es 1).
//
// Conectado al Calendario de Clases (spec 0017-m; corrección del dueño 2026-09-23,
// segunda ronda): la `fecha` de cada fila es la del libro real 2022 -- se usa SOLO para
// agrupar filas del mismo día real en un "bloque de sesión" (`groupIntoSessionBlocks()`),
// nunca se imprime tal cual. Un offset fijo de días (lo que se probó primero) resultó
// incorrecto: no conocía los feriados reales del curso actual ni respetaba
// `promo.endDate` -- el dueño lo detectó en un caso real (una clase cayó el 12 de
// octubre, feriado, y el calendario se extendió hasta el 31/10 con la promoción
// terminando el 26/10). El fix correcto: las fechas reales que se imprimen salen de
// `professional_theory_sessions` (filtradas por `status !== 'cancelled'`, ya generadas
// acotadas a start/end date con los feriados reales marcados `cancelled` --
// `promociones.facade.ts crearPromocion()`), una por bloque, en orden. Las filas LIBRE
// del libro real ya no se imprimen: los días sin sesión real ahora los determina
// `professional_theory_sessions` (ausencia/cancelación), no una fila fija del libro 2022.
interface CurriculumRow {
  fecha: string;
  asignatura: string;
  materias: string;
  horas: string;
  profesor: string;
}

/**
 * Agrupa filas consecutivas que comparten la misma `fecha` del libro real en un
 * "bloque de sesión" -- cada bloque representa un día de clase real (puede tener 1-4
 * filas de materias distintas, igual que el libro real). Las filas LIBRE se descartan:
 * los días sin clase ahora los decide `professional_theory_sessions`, no el libro 2022.
 */
function groupIntoSessionBlocks(rows: CurriculumRow[]): CurriculumRow[][] {
  const blocks: CurriculumRow[][] = [];
  let current: CurriculumRow[] = [];
  let currentFecha: string | null = null;
  for (const r of rows) {
    if (r.asignatura === 'LIBRE') continue;
    if (r.fecha !== currentFecha) {
      if (current.length) blocks.push(current);
      current = [];
      currentFecha = r.fecha;
    }
    current.push(r);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function getA2Curriculum(): CurriculumRow[] {
  const TRANSPORTE_I =
    'I. REGLAMENTACIÓN DEL TRANSPORTE PÚBLICO DE PASAJEROS; Reglamento de los servicios nacionales de transporte público de pasajeros, privado remunerado de pasajeros, servicios especiales de transporte de pasajeros, transporte remunerado de pasajeros desde y hacia aeródromos y aeropuertos, publicidad en los vehículos de transporte público de pasajeros, dimensionales y funcionales, cinturones de seguridad, luces encendidas. Decreto N°122/91. Sobre redes viales básicas.';
  const TRANSPORTE_II =
    'II. OBLIGACIONES DEL CONDUCTOR; Mantener normas relativas a la atención de público. Conducir observando normas técnicas impartidas durante el proceso de instrucción. Seguro obligatorio de accidentes personales. La conducción en vehículos de transporte público y algunas indicaciones como: detención frente a colegios, precaución frente a los vehículos, uso de señales preventivas, disciplina de los pasajeros, los tiempos y velocidades.';
  const CONDUCCION_III =
    'III. PRECAUCIONES EN LA CONDUCCIÓN; Recomendaciones generales, El tráfico, Detención para subida y bajada de ocupantes del vehículo, Conducción en curvas, Conducción en bajada, Conducción en subida, Conducción en hielo, Uso de cadenas, El clima, Lluvia, Neblina. Empleo correcto de luces: Código de luces, Señalización, Uso de luces altas y bajas.';
  const INCENDIOS =
    'COMBATE Y PREVENCIÓN DE INCENDIOS; El fuego y sus composiciones. Tipos de fuegos y formas de extinción. Tipo de extintores. Procedimientos a seguir en caso de incendio de vehículos de transporte de pasajeros.';
  const AUXILIOS =
    'PRIMEROS AUXILIOS; Generalidades, definición de primeros auxilios, la importancia de un auxilio adecuado, requisitos que debe reunir un auxiliador, puntos básicos de los primeros auxilios. Paro cardiaco y respiratorio. Shock. Asfixia. Fractura.';
  const RELACIONES_HUMANAS =
    'RELACIONES HUMANAS; Ambiente laboral y su incidencia en las relaciones humanas. Motivación y frustración factores fundamentales, psicológicos en el actuar laboral y en las relaciones humanas. Los diversos tipos de relaciones de los conductores profesionales: con otros conductores, con los empresarios, con las autoridades.';
  const CHEQUEOS_BASICOS_CONDUCTOR =
    'CHEQUEOS BÁSICOS; Del conductor, cabina, exterior, chequeo de niveles, otros. Verificación de las condiciones del vehículo antes de poner en marcha el motor. Aplicar procedimientos para la revisión de: Presión de aire en los neumáticos, Tensión de correas, niveles de agua, lubricantes, combustible y otros. Chequeo general de todo el vehículo.';
  const OPERACION_VEHICULO =
    'OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. Generalidades sobre los sistemas del vehículo y su incidencia en la conducción. La caja de cambios: Simple, automática. La aceleración del motor y la contaminación. El freno motor. El freno de estacionamiento o freno de mano. El freno de servicio o freno de pie. Los espejos retrovisores.';
  const AUTOESTIMA =
    'LA AUTOESTIMA; Qué es la autoestima. Tipos de autoestimas. Formación de la autoestima. Elementos ligados a la autoestima. Factores importantes en el desarrollo de la autoestima. Componentes de la autoestima.';
  const RESP_CIVIL_XV =
    'RESPONSABILIDAD CIVIL Y PENAL; TÍTULO XV RESPONSABILIDAD POR LOS ACCIDENTES; Toda persona que conduzca Art. 165. El nuevo hecho de la infracción no determinada la responsabilidad Art. 166. Presunción de responsabilidad Art. 167. En todo accidente donde se produzca daños Art. 168. Art. 169, 170 y 171, relacionado con infracciones y mal estado de vehículos.';
  const REGISTRO_XVIII =
    'TÍTULO XVIII DEL REGISTRO NACIONAL DE CONDUCTORES DE VEHÍCULOS MOTORIZADOS; Registro nacional de conductores de vehículos motorizados Art. 210. Deberes del registro nacional de conductores Art. 211. Datos de los conductores que serán enrolados en el registro nacional de conductores Art. 212. Art. 214, 215, 216 y 217 relacionado con registro nacional.';
  const COMUNICACION =
    'LA COMUNICACIÓN; Conceptualización. Procesos de comunicación. Comunicación eficaz. Guía para escuchar eficientemente. Tipo de comunicación, palabras e imágenes, comunicación no verbal, acción y lenguaje corporal. Barreras en la comunicación, omisión, distorsión, generalización y rumor.';
  const CONDUCCION_SEGURA =
    'CONDUCCIÓN SEGURA; Conducción a la defensiva. Condiciones adversas para la conducción. Conducción nocturna. Condiciones ambientales. Las curvas. Pendientes. Características del conductor defensivo. Factores para la conducción defensiva. Colisiones.';
  const INFRAESTRUCTURA_VIAL =
    'INFRAESTRUCTURA VIAL; Disposiciones generales sobre uso de las vías: Prohibiciones en las vías públicas Art. 160, Normas del tránsito de peatones Art. 162. Los caminos públicos: Definiciones D.F.L 850/97. Redes Viales: Decretos.';
  const LIBRE: CurriculumRow = {
    fecha: '',
    asignatura: 'LIBRE',
    materias: 'LIBRE',
    horas: 'LIBRE',
    profesor: 'LIBRE',
  };

  const rows: CurriculumRow[] = [
    {
      fecha: '1/17/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias: TRANSPORTE_I,
      horas: '5 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/18/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias: TRANSPORTE_I,
      horas: '5 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/19/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias: TRANSPORTE_II,
      horas: '5 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/20/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'III. SERVICIO DE AMBULANCIAS; Disposiciones generales. Legislación vigente, antigüedad de las ambulancias, restricciones y tipos de conducción. Requerimientos solicitados por el servicio de Salud.',
      horas: '4 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/20/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias: TRANSPORTE_II,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/21/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CONDUCCION_III,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/22/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: INCENDIOS,
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/22/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: AUXILIOS,
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/24/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: RELACIONES_HUMANAS,
      horas: '1 hora',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '1/24/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'ATENCIÓN DE PÚBLICO; Las múltiples funciones de un conductor profesional y su efecto en su atención al cliente. Normas generales de un conductor eficiente, sus defectos a superar en la atención al cliente. La opinión pública del examinador y calificador del conductor.',
      horas: '4 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '1/25/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'REGLAMENTO DE LOS SERVICIOS DE TRANSPORTE POR CALLES Y CAMINOS 163/1984; Prohíbe circulación que expele humo por tubo de escape. Otras revisiones técnicas si es necesario. Profundidad de la banda de rodado. Portar extintores. Portar botiquín. Prestar servicio de alquiler. Colores de los taxis. Pérdida de la patente. Título II de los servicios locomoción colectiva. Art. 12 a 23 y Art. 34 al 51.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/25/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'LA CONDUCCIÓN Y LA JORNADA DE TRABAJO; Jornada ordinaria de trabajo del personal de choferes y auxiliares de la locomoción colectiva interurbana Art. Único modifica Art. 25 código del trabajo Art. 25 bis; Art. 26 bis Ley N° 20.271.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/25/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'REGLAMENTO DE LOS SERVICIOS NACIONALES D.S. 212; Transporte de pasajeros en taxis. Limpieza de los taxis. Transporte de escolares en taxis. Prohibición de voceros. Revisión técnica. Tubo de escapes. Profundidad de los surcos de los neumáticos. Neumáticos redibujados. Uso de extintores.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/25/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'ESTADO DE LOS VEHÍCULOS DE TRANSPORTE DE PASAJEROS D.S. 212; No otorgar revisión técnica Art. 36. Nueva revisión a los vehículos de transportes de pasajeros Art. 37. Prestar servicios sin revisión técnica Art. 38.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    { ...LIBRE, fecha: '1/26/2022' },
    {
      fecha: '1/27/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CHEQUEOS_BASICOS_CONDUCTOR,
      horas: '1 hora',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/27/2022',
      asignatura: 'CONDUCCIÓN',
      materias: OPERACION_VEHICULO,
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/27/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CONDUCCION_III,
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/28/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CONDUCCION_III,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    { ...LIBRE, fecha: '1/29/2022' },
    {
      fecha: '1/31/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'PROCESOS PSICOLÓGICO BÁSICOS; Percepción, definición, factores personales que influyen en la percepción y algunos aspectos básicos de la fisiología de la percepción. Atención. Memoria. Motivación, qué es la motivación, cuándo se está motivado y las motivaciones en el trabajo. Las Actitudes, qué es una actitud y las características.',
      horas: '3 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '1/31/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: AUTOESTIMA,
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY DE TRÁNSITO D.F.L. N°1 DE 2007; A quienes regula esta Ley Art. 1. Las municipalidades dictarán normas específicas Art. 3. Los encargados de supervigilar el cumplimiento de las disposiciones a que se refiere esta Ley Art. 4',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'TÍTULO III DEL DOMINIO Y REGISTRO DE LOS VEHÍCULOS MOTORIZADOS Y DE LA PATENTE ÚNICA Y CERTIFICADO DE INSCRIPCIÓN; El servicio de registro e identificación llevará un registro de vehículos motorizados. Art. 39, las variaciones de dominio. Art. 41, se presumirá propietario de un vehículo motorizado. Art. 44,45,48,51,52,53,55 y 56, relacionado con placa patente.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'TÍTULO VII DE LAS REVISIONES DE LOS VEHÍCULOS, DE SUS CONDICIONES DE SEGURIDAD Y DE LA HOMOLOGACIÓN; Las municipalidades no otorgarán permisos de circulación Art. 98. El ministerio de transporte y telecomunicaciones podrá licitar la función de homologación de vehículos Art. 90. Las revisiones que decreten los tribunales Art. 91. Los vehículos que hayan perdido sus condiciones de seguridad Art. 92',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: REGISTRO_XVIII,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: RESP_CIVIL_XV,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/2/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: AUTOESTIMA,
      horas: '1 hora',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/2/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'EL ESTRÉS; Qué es el estrés. Los peligros del estrés. Aparición de la ansiedad. Los síntomas del estrés: depresión, desconcentración, ansiedad, irritabilidad y baja autoestima. Los síntomas físicos: agotamiento, insomnio y trastornos psicosomáticos. Las causas del estrés.',
      horas: '4 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/3/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: COMUNICACION,
      horas: '3 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/3/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: INCENDIOS,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/3/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: AUXILIOS,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/4/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CHEQUEOS_BASICOS_CONDUCTOR,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    { ...LIBRE, fecha: '2/5/2022' },
    {
      fecha: '2/7/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: RESP_CIVIL_XV,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/7/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'RESPONSABILIDAD CIVIL Y PENAL; TÍTULO XVI DE LOS PROCEDIMIENTOS POLICIALES Y ADMINISTRATIVOS; Toda modificación que se hiciera al sentido del tránsito Art. 172. Los vehículos que hayan sufrido un desperfecto Art. 173. Los vehículos participantes en un accidente de tránsito Art. 174. Art. 175, 176, 177, 178, 179, 180, 184. Relacionados con procedimientos policiales.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/7/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'TÍTULO XVII, DE LOS DELITOS, CUASIDELITOS Y DE LA CONDUCCIÓN BAJO LA INFLUENCIA DEL ALCOHOL, EN ESTADO DE EBRIEDAD O BAJO LA INFLUENCIA DE SUSTANCIAS ESTUPEFACIENTES O SICOTRÓPICOS; Castigo a empleados públicos que abuse en su oficio Art. 190 A. Castigo a conductor hasta por 5 años Art. 192 B. En los accidentes, donde el conductor cause lesiones menos graves, lesiones graves o muerte Art. 193 C, 194 D. Art. 198 - 209 relacionado sobre licencias.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/8/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: COMUNICACION,
      horas: '1 hora',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/8/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: RELACIONES_HUMANAS,
      horas: '4 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/9/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: REGISTRO_XVIII,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/9/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY 18.287, ESTABLECE PROCEDIMIENTOS ANTE LOS JUZGADOS DE POLICÍA LOCAL; Conocimientos de los procesos Art. 1. Los delincuentes ante el juzgado Art. 3. La citación al juzgado y la carta certificada Art. 4. Denuncia motivada por infracciones alejadas del lugar de residencia Art. 5. Art. 6 - 40 relacionado con procedimientos ante los juzgados.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/9/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY DE DROGAS Y ESTUPEFACIENTES Y SUSTANCIAS SICOTRÓPICAS; Consumo y tráfico de drogas y estupefacientes, según Ley N° 20.000/05, y las sanciones de la D.F.L. N° 1 de 2007 Art. 16 N°1 y Art. N° 110.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/10/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: CONDUCCION_SEGURA,
      horas: '5 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/11/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'CHEQUEOS BÁSICOS; Carrocería. Limpieza. Verificaciones luego de poner en marcha el motor. Aplicar procedimientos para la revisión de: El puesto de trabajo del conductor, Posición de la palanca de cambio, Chapa de contacto: posición y efectos. Instrumentos del panel Luces de control interna y externas. Palancas e indicadores. Limpiadores de parabrisas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    { ...LIBRE, fecha: '2/12/2022' },
    {
      fecha: '2/14/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: 'DEFINICIÓN D.F.L. N° 1 DE 2007; Definición del D.F.L. N°1 de 2007 Art. 2.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'LOS CONDUCTORES Y LAS LICENCIAS; Ninguna persona podrá conducir sin poseer la licencia Art. 5. Los conductores deberán llevar consigo su licencia Art. 6. Se prohíbe al propietario facilitar su vehículo a una persona que no posea licencia Art. 7. Los propietarios de vehículos no podrán celebrar contratos Art. 8. Las licencias sólo podrán otorgarse por la municipalidad Art. 9. Art. 10-14, 17, 19, 22, 24 y 29. Relacionado con licencias y conductores.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'REDES VIALES BÁSICAS; Clasificación redes viales básicas: Autopistas, Autovía, Troncal, Servicio colector a Distribuidora D.S. 83/85. Peso por ejes y pesos máximos permitidos D.D. 158/80.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'MECÁNICA',
      materias:
        'CONCEPTO DE MOTOR; Elementos constitutivos de los sistemas. Piezas fundamentales. Tren alternativo de movimientos.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'MECÁNICA',
      materias:
        'PROCESOS FUNDAMENTALES; Ciclos de trabajo, 2 tiempos, 4 tiempos. Relación de compresión volumétrica. Calificación de motores y sus respectivos combustibles de acuerdo a la relación volumétrica que poseen.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE ALIMENTACIÓN; Combustible - Combustión. Carburación - Carburador. Bombas de combustible. Pruebas - Fallas - Reparación.',
      horas: '1 hora',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/16/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: CONDUCCION_SEGURA,
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/16/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: INCENDIOS,
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY DE ALCOHOLES; Idoneidad moral y sanciones de la D.F.L N° 1 de 2007 Art. 16 N° 1. Modificación por la ley N° 20.580 aumentando las sanciones por manejo en estado de ebriedad, bajo la influencia de sustancias estupefacientes o sicotrópicas, y bajo la influencia del alcohol. Cambio artículos 87, 88, 111, 183, 192, 193, 196, 197, 197 bis, 208 y 209.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEGISLACIÓN LABORAL; Definiciones del empleador, trabajador, trabajador independiente. Contrato de trabajo. Qué es un contrato de trabajo, tipo de contratos y sus estipulaciones. Disposiciones legales referentes a los conductores. Código del trabajo actualizado 26/08 del 2013. Modifica el código del trabajo, jornada de choferes Ley 20.271.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'MEDIO AMBIENTE. DISPOSICIONES ADUANERAS; Introducción ley 19.300 modificada 13/11/10 ley 20.473 medio ambiente. Concepto de medio ambiente (Elementos abióticos y bióticos). Constituyentes del medio ambiente. Problemas medioambientales producidos por: Dióxido de carbono, Acidificación, Destrucción del ozono, Hidrocarburos clorados.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/18/2022',
      asignatura: 'CONDUCCIÓN',
      materias: OPERACION_VEHICULO,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    { ...LIBRE, fecha: '2/19/2022' },
    {
      fecha: '2/21/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE ENCENDIDO; Función de los elementos. Circuito de alto y bajo voltaje. Prueba y fallas. Reparaciones. Puesta a punto y Puesta a tiempo.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE REFRIGERACIÓN; Elementos que lo componen y su respectiva función. Pruebas, fallas y reparaciones. Clasificación de los diferentes sistemas de refrigeración en uso. Refrigeración. Termosifón. Refrigeración forzada. Refrigeración por aire libre y forzada.',
      horas: '1 hora',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE LUBRICACIÓN; Lubricación por salpicado, lubricación por presión de la bomba, lubricación mixta, clasificación de los lubricantes, cualidades de un buen lubricante, diagnóstico de estado del motor según su presión de aceite.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/22/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE DISTRIBUCIÓN; Función, clasificación de los sistemas de distribución de acuerdo a: mando directo, mando indirecto, mando mixto. El motor diésel componentes principales del motor.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/22/2022',
      asignatura: 'MECÁNICA',
      materias:
        'MANTENCIÓN DE VEHÍCULOS DE TRANSPORTE DE PASAJEROS; Revisión del estado del vehículo: antes de poner en marcha el motor, con el motor en funcionamiento, después de estacionado y detenido el motor. Pruebas de funcionamiento. Normas de seguridad aplicada.',
      horas: '3 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/23/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: INFRAESTRUCTURA_VIAL,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/23/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: AUXILIOS,
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: INFRAESTRUCTURA_VIAL,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'VIII TAXIS COLECTIVOS TRANSPORTE DE PASAJEROS D.S.212; Permiso municipal para iniciar y terminar su servicio Art. 47 taxis colectivos no podrán variar sus trazados Art. 49 y 49 bis; Radios portátiles Art. 50; Colectivos rurales Art. 54; Modalidad de transporte en taxis Art. 72. Requisitos para ser taxis. Antigüedad para ser taxis. Cantidad de pasajeros del Taxi. Color de los taxis. Radios taxis. Distintivos especial. Uso de taxímetro. Control de taxímetro. Control real taxímetro. Art. 74 a 90.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'XI NORMATIVAS DEL TRANSPORTE DE PASAJEROS; Reglamento servicios nacionales D.S. N°212/92-MTT. Reglamenta y modifica el decreto 212 y deja sin efecto decreto que indica D.S. 80/04. Reglamento servicio especiales paseos giras D.S.237/92. Circulación con luces encendidas modifica decreto 22 de 2006 D.D181/06.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'VII.- ALCOHOLISMO Y DROGADICCIÓN; Alcoholismo, definición y los efectos que provoca en la conducción. Drogadicción, qué son las drogas, tolerancia, deseo y dependencia a las drogas, clasificación y efectos de las drogas, efectos que provocan las drogas en la conducción.',
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/25/2022',
      asignatura: 'CONDUCCIÓN',
      materias: `II. ${OPERACION_VEHICULO}`,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    { ...LIBRE, fecha: '2/26/2022' },
  ];

  return rows;
}

/**
 * spec 0017-m: transcripción verbatim de `libroclasesa3.pdf` (páginas 14-27, A3 --
 * "Transporte de Pasajeros"), 72 filas reales, 4 LIBRE (filas 6, 14, 15, 16). Igual criterio
 * que A2: sin resumir ni inventar contenido, con la ortografía corregida.
 */
function getA3Curriculum(): CurriculumRow[] {
  const CONDUCCION_III =
    'III. PRECAUCIONES EN LA CONDUCCIÓN; Recomendaciones generales, El tráfico, Detención para subida y bajada de ocupantes del vehículo, Conducción en curvas, Conducción en bajada, Conducción en subida, Conducción en hielo, Uso de cadenas, El clima, Lluvia, Neblina. Empleo correcto de luces: Código de luces, Señalización, Uso de luces altas y bajas.';
  const OPERACION_VEHICULO =
    'OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. Generalidades sobre los sistemas del vehículo y su incidencia en la conducción. La caja de cambios: Simple, automática. La aceleración del motor y la contaminación. El freno motor. El freno de estacionamiento o freno de mano. El freno de servicio o freno de pie. Los espejos retrovisores.';
  const INCENDIOS =
    'COMBATE Y PREVENCIÓN DE INCENDIOS; El fuego y sus composiciones. Tipos de fuegos y formas de extinción. Tipo de extintores. Procedimientos a seguir en caso de incendio de vehículos de transporte de pasajeros.';
  const AUXILIOS =
    'PRIMEROS AUXILIOS; Generalidades, definición de primeros auxilios, la importancia de un auxilio adecuado, requisitos que debe reunir un auxiliador, puntos básicos de los primeros auxilios. Paro cardiaco y respiratorio. Shock. Asfixia. Fractura.';
  const COMUNICACION =
    'LA COMUNICACIÓN; Conceptualización. Procesos de comunicación. Comunicación eficaz. Guía para escuchar eficientemente. Tipo de comunicación, palabras e imágenes, comunicación no verbal, acción y lenguaje corporal. Barreras en la comunicación, omisión, distorsión, generalización y rumor.';
  const RELACIONES_HUMANAS =
    'RELACIONES HUMANAS; Ambiente laboral y su incidencia en las relaciones humanas. Motivación y frustración factores fundamentales, psicológicos en el actuar laboral y en las relaciones humanas. Los diversos tipos de relaciones de los conductores profesionales: con otros conductores, con los empresarios, con las autoridades.';
  const AUTOESTIMA =
    'LA AUTOESTIMA; Qué es la autoestima. Tipos de autoestimas. Formación de la autoestima. Elementos ligados a la autoestima. Factores importantes en el desarrollo de la autoestima. Componentes de la autoestima.';
  const RESP_CIVIL_XV =
    'RESPONSABILIDAD CIVIL Y PENAL; TÍTULO XV RESPONSABILIDAD POR LOS ACCIDENTES; Toda persona que conduzca Art. 165. El nuevo hecho de la infracción no determinada la responsabilidad Art. 166. Presunción de responsabilidad Art. 167. En todo accidente donde se produzca daños Art. 168. Art. 169, 170 y 171, relacionado con infracciones y mal estado de vehículos.';
  const REGISTRO_XVIII =
    'TÍTULO XVIII DEL REGISTRO NACIONAL DE CONDUCTORES DE VEHÍCULOS MOTORIZADOS; Registro nacional de conductores de vehículos motorizados Art. 210. Deberes del registro nacional de conductores Art. 211. Datos de los conductores que serán enrolados en el registro nacional de conductores Art. 212. Art. 214, 215, 216 y 217 relacionado con registro nacional.';
  const CONDUCCION_SEGURA =
    'CONDUCCIÓN SEGURA; Conducción a la defensiva. Condiciones adversas para la conducción. Conducción nocturna. Condiciones ambientales. Las curvas. Pendientes. Características del conductor defensivo. Factores para la conducción defensiva. Colisiones.';
  const INFRAESTRUCTURA_VIAL =
    'INFRAESTRUCTURA VIAL; Disposiciones generales sobre uso de las vías: Prohibiciones en las vías públicas Art. 160, Normas del tránsito de peatones Art. 162. Los caminos públicos: Definiciones D.F.L 850/97. Redes Viales: Decretos.';
  const CONDUCTORES_LICENCIAS =
    'LOS CONDUCTORES Y LAS LICENCIAS; Ninguna persona podrá conducir sin poseer la licencia Art. 5. Los conductores deberán llevar consigo su licencia Art. 6. Se prohíbe al propietario facilitar su vehículo a una persona que no posea licencia Art. 7. Los propietarios de vehículos no podrán celebrar contratos Art. 8. Las licencias sólo podrán otorgarse por la municipalidad Art. 9. Art. 10-14, 17, 19, 22, 24 y 29. Relacionado con licencias y conductores.';
  const REDES_VIALES =
    'REDES VIALES BÁSICAS; Clasificación redes viales básicas: Autopistas, Autovía, Troncal, Servicio colector a Distribuidora D.S. 83/85. Peso por ejes y pesos máximos permitidos D.D. 158/80.';
  const TRANSPORTE_I =
    'I. REGLAMENTACIÓN DEL TRANSPORTE PÚBLICO DE PASAJEROS; Reglamento de los servicios nacionales de transporte público de pasajeros, privado remunerado de pasajeros, servicios especiales de transporte de pasajeros, transporte remunerado de pasajeros desde y hacia aeródromos y aeropuertos, publicidad en los vehículos de transporte público de pasajeros, dimensionales y funcionales, cinturones de seguridad, luces encendidas. Decreto N°122/91. Sobre redes viales básicas.';
  const TRANSPORTE_II =
    'II. OBLIGACIONES DEL CONDUCTOR; Mantener normas relativas a la atención de público. Conducir observando normas técnicas impartidas durante el proceso de instrucción. Seguro obligatorio de accidentes personales. La conducción en vehículos de transporte público y algunas indicaciones como: detención frente a colegios, precaución frente a los vehículos, uso de señales preventivas, disciplina de los pasajeros, los tiempos y velocidades.';
  const LIBRE: CurriculumRow = {
    fecha: '',
    asignatura: 'LIBRE',
    materias: 'LIBRE',
    horas: 'LIBRE',
    profesor: 'LIBRE',
  };

  const rows: CurriculumRow[] = [
    {
      fecha: '1/17/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'I. CHEQUEOS BÁSICOS; Carrocería. Limpieza. Verificaciones luego de poner en marcha el motor. Aplicar procedimientos para la revisión de: El puesto de trabajo del conductor, Posición de la palanca de cambio, Chapa de contacto: posición y efectos. Instrumentos del panel Luces de control interna y externas. Palancas e indicadores. Limpiadores de parabrisas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/18/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'II. OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. Generalidades sobre los sistemas del vehículo y su incidencia en la conducción. La caja de cambios: Simple, automática. La aceleración del motor y la contaminación. El freno motor. El freno de estacionamiento o freno de mano. El freno de servicio o freno de pie. Los espejos retrovisores.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/19/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'II. OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. Generalidades sobre los sistemas del vehículo y su incidencia en la conducción. La caja de cambios: Simple, Automática. La aceleración del motor y la contaminación. El freno motor. El freno de estacionamiento o freno de mano. El freno de servicio o freno de pie. Los espejos retrovisores.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/20/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CONDUCCION_III,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/21/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'VIII. PSICOLOGÍA DEL NIÑO Y ADOLESCENTE; Características del desarrollo emocional infantojuvenil. El concepto de desarrollo. El desarrollo emocional. ¿Qué importancia tienen las emociones? ¿Por qué se habla de desarrollo de las emociones? ¿Son diferentes las emociones en los niños y los adultos? ¿Muestran todos los niños las mismas características emocionales?. Patrones emocionales frecuentes en los niños. Miedo',
      horas: '5 horas',
      profesor: 'HORACIO LABBE',
    },
    { ...LIBRE, fecha: '1/22/2022' },
    {
      fecha: '1/24/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'CHEQUEOS BÁSICOS; Del conductor, cabina, exterior, chequeo de niveles, otros. Verificación de las condiciones del vehículo antes de poner en marcha el motor. Aplicar procedimientos para la revisión de: Presión de aire en los neumáticos, Tensión de correas, niveles de agua, lubricantes, combustible y otros. Chequeo general de todo el vehículo.',
      horas: '1 hora',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/24/2022',
      asignatura: 'CONDUCCIÓN',
      materias: OPERACION_VEHICULO,
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/24/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CONDUCCION_III,
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/25/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CONDUCCION_III,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/26/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: COMUNICACION,
      horas: '3 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '1/26/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: INCENDIOS,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/26/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: AUXILIOS,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    { ...LIBRE, fecha: '1/27/2022' },
    { ...LIBRE, fecha: '1/28/2022' },
    { ...LIBRE, fecha: '1/29/2022' },
    {
      fecha: '1/31/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'PROCESOS PSICOLÓGICO BÁSICOS; Percepción, definición, factores personales que influyen en la percepción y algunos aspectos básicos de la fisiología de la percepción. Atención. Memoria. Motivación, qué es la motivación, cuándo se está motivado y las motivaciones en el trabajo. Las Actitudes, qué es una actitud y las características.',
      horas: '3 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '1/31/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: AUTOESTIMA,
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY DE TRÁNSITO D.F.L. N°1 DE 2007; A quienes regula esta Ley Art. 1. Las municipalidades dictarán normas específicas Art. 3. Los encargados de supervigilar el cumplimiento de las disposiciones a que se refiere esta Ley Art. 4',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'TÍTULO III DEL DOMINIO Y REGISTRO DE LOS VEHÍCULOS MOTORIZADOS Y DE LA PATENTE ÚNICA Y CERTIFICADO DE INSCRIPCIÓN; El servicio de registro e identificación llevará un registro de vehículos motorizados. Art. 39, las variaciones de dominio. Art. 41, se presumirá propietario de un vehículo motorizado. Art. 44,45,48,51,52,53,55 y 56, relacionado con placa patente.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'TÍTULO VII DE LAS REVISIONES DE LOS VEHÍCULOS, DE SUS CONDICIONES DE SEGURIDAD Y DE LA HOMOLOGACIÓN; Las municipalidades no otorgarán permisos de circulación Art. 98. El ministerio de transporte y telecomunicaciones podrá licitar la función de homologación de vehículos Art. 90. Las revisiones que decreten los tribunales Art. 91. Los vehículos que hayan perdido sus condiciones de seguridad Art. 92',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: REGISTRO_XVIII,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: RESP_CIVIL_XV,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/2/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: AUTOESTIMA,
      horas: '1 hora',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/2/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'EL ESTRÉS; Qué es el estrés. Los peligros del estrés. Aparición de la ansiedad. Los síntomas del estrés: depresión, desconcentración, ansiedad, irritabilidad y baja autoestima. Los síntomas físicos: agotamiento, insomnio y trastornos psicosomáticos. Las causas del estrés.',
      horas: '4 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/3/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'CHEQUEOS BÁSICOS DEL BUS; Del conductor, cabina, exterior, chequeo de niveles, otros. Verificación de las condiciones del vehículo antes de poner en marcha el motor. Aplicar procedimientos para la revisión de: Presión de aire en los neumáticos, Tensión de correas, niveles de agua, lubricantes, combustible y otros. Chequeo general de todo el vehículo.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/4/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'REGLAMENTO DE LOS SERVICIOS DE TRANSPORTE POR CALLES Y CAMINOS 163/1984; Prohíbe circulación que expele humo por tubo de escape. Otras revisiones técnicas si es necesario. Profundidad de la banda de rodado. Portar extintores. Portar botiquín. Prestar servicio de alquiler. Colores de los taxis. Pérdida de la patente. Título II de los servicios locomoción colectiva. Art. 12 a 23 y Art. 34 al 51.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/4/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: CONDUCTORES_LICENCIAS,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/4/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: REDES_VIALES,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/5/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias: TRANSPORTE_I,
      horas: '5 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/7/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: RESP_CIVIL_XV,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/7/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'RESPONSABILIDAD CIVIL Y PENAL; TÍTULO XVI DE LOS PROCEDIMIENTOS POLICIALES Y ADMINISTRATIVOS; Toda modificación que se hiciera al sentido del tránsito Art. 172. Los vehículos que hayan sufrido un desperfecto Art. 173. Los vehículos participantes en un accidente de tránsito Art. 174. Art. 175, 176, 177, 178, 179, 180, 184. Relacionados con procedimientos policiales.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/7/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'TÍTULO XVII, DE LOS DELITOS, CUASIDELITOS Y DE LA CONDUCCIÓN BAJO LA INFLUENCIA DEL ALCOHOL, EN ESTADO DE EBRIEDAD O BAJO LA INFLUENCIA DE SUSTANCIAS ESTUPEFACIENTES O SICOTRÓPICOS; Castigo a empleados públicos que abuse en su oficio Art. 190 A. Castigo a conductor hasta por 5 años Art. 192 B. En los accidentes, donde el conductor cause lesiones menos graves, lesiones graves o muerte Art. 193 C, 194 D. Art. 198 - 209 relacionado sobre licencias.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/8/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: COMUNICACION,
      horas: '1 hora',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/8/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: RELACIONES_HUMANAS,
      horas: '4 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/9/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: REGISTRO_XVIII,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/9/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY 18.287, ESTABLECE PROCEDIMIENTOS ANTE LOS JUZGADOS DE POLICÍA LOCAL; Conocimientos de los procesos Art. 1. Los delincuentes ante el juzgado Art. 3. La citación al juzgado y la carta certificada Art. 4. Denuncia motivada por infracciones alejadas del lugar de residencia Art. 5. Art. 6 - 40 relacionado con procedimientos ante los juzgados.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/9/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY DE DROGAS Y ESTUPEFACIENTES Y SUSTANCIAS SICOTRÓPICAS; Consumo y tráfico de drogas y estupefacientes, según Ley N° 20.000/05, y las sanciones de la D.F.L. N° 1 de 2007 Art. 16 N°1 y Art. N° 110.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/10/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: CONDUCCION_SEGURA,
      horas: '5 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/11/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: RELACIONES_HUMANAS,
      horas: '1 hora',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/11/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'ATENCIÓN DE PÚBLICO; Las múltiples funciones de un conductor profesional y su efecto en su atención al cliente. Normas generales de un conductor eficiente, sus defectos a superar en la atención al cliente. La opinión pública del examinador y calificador del conductor.',
      horas: '4 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/12/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias: TRANSPORTE_I,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/12/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias: TRANSPORTE_II,
      horas: '3 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: 'DEFINICIÓN D.F.L. N° 1 DE 2007; Definición del D.F.L. N°1 de 2007 Art. 2.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: CONDUCTORES_LICENCIAS,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: REDES_VIALES,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'MECÁNICA',
      materias:
        'CONCEPTO DE MOTOR; Elementos constitutivos de los sistemas. Piezas fundamentales. Tren alternativo de movimientos.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'MECÁNICA',
      materias:
        'PROCESOS FUNDAMENTALES; Ciclos de trabajo, 2 tiempos, 4 tiempos. Relación de compresión volumétrica. Calificación de motores y sus respectivos combustibles de acuerdo a la relación volumétrica que poseen.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE ALIMENTACIÓN; Combustible - Combustión. Carburación - Carburador. Bombas de combustible. Pruebas - Fallas - Reparación.',
      horas: '1 hora',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/16/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: CONDUCCION_SEGURA,
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/16/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: INCENDIOS,
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY DE ALCOHOLES; Idoneidad moral y sanciones de la D.F.L N° 1 de 2007 Art. 16 N° 1. Modificación por la ley N° 20.580 aumentando las sanciones por manejo en estado de ebriedad, bajo la influencia de sustancias estupefacientes o sicotrópicas, y bajo la influencia del alcohol. Cambio artículos 87, 88, 111, 183, 192, 193, 196, 197, 197 bis, 208 y 209.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEGISLACIÓN LABORAL; Definiciones del empleador, trabajador, trabajador independiente. Contrato de trabajo. Qué es un contrato de trabajo, tipo de contratos y sus estipulaciones. Disposiciones legales referentes a los conductores. Código del trabajo actualizado 26/08 del 2013. Modifica el código del trabajo, jornada de choferes Ley 20.271.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'MEDIO AMBIENTE. DISPOSICIONES ADUANERAS; Introducción ley 19.300 modificada 13/11/10 ley 20.473 medio ambiente. Concepto de medio ambiente (Elementos abióticos y bióticos). Constituyentes del medio ambiente. Problemas medioambientales producidos por: Dióxido de carbono, Acidificación, Destrucción del ozono, Hidrocarburos clorados.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/18/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: INCENDIOS,
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/18/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: AUXILIOS,
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/19/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias: TRANSPORTE_II,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/19/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'III. SERVICIO DE AMBULANCIAS; Disposiciones generales. Legislación vigente, antigüedad de las ambulancias, restricciones y tipos de conducción. Requerimientos solicitados por el servicio de Salud.',
      horas: '3 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE ENCENDIDO; Función de los elementos. Circuito de alto y bajo voltaje. Prueba y fallas. Reparaciones. Puesta a punto y Puesta a tiempo.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE REFRIGERACIÓN; Elementos que lo componen y su respectiva función. Pruebas, fallas y reparaciones. Clasificación de los diferentes sistemas de refrigeración en uso. Refrigeración. Termosifón. Refrigeración forzada. Refrigeración por aire libre y forzada.',
      horas: '1 hora',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE LUBRICACIÓN; Lubricación por salpicado, lubricación por presión de la bomba, lubricación mixta, clasificación de los lubricantes, cualidades de un buen lubricante, diagnóstico de estado del motor según su presión de aceite.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/22/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE DISTRIBUCIÓN; Función, clasificación de los sistemas de distribución de acuerdo a: mando directo, mando indirecto, mando mixto. El motor diésel componentes principales del motor.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/22/2022',
      asignatura: 'MECÁNICA',
      materias:
        'MANTENCIÓN DE VEHÍCULOS DE TRANSPORTE DE PASAJEROS; Revisión del estado del vehículo: antes de poner en marcha el motor, con el motor en funcionamiento, después de estacionado y detenido el motor. Pruebas de funcionamiento. Normas de seguridad aplicada.',
      horas: '3 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/23/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: INFRAESTRUCTURA_VIAL,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/23/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: AUXILIOS,
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: INFRAESTRUCTURA_VIAL,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'VIII TAXIS COLECTIVOS TRANSPORTE DE PASAJEROS D.S.212; Permiso municipal para iniciar y terminar su servicio Art. 47 taxis colectivos no podrán variar sus trazados Art. 49 y 49 bis; Radios portátiles Art. 50; Colectivos rurales Art. 54; Modalidad de transporte en taxis Art. 72. Requisitos para ser taxis. Antigüedad para ser taxis. Cantidad de pasajeros del Taxi. Color de los taxis. Radios taxis. Distintivos especial. Uso de taxímetro. Control de taxímetro. Control real taxímetro. Art. 74 a 90.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'XI NORMATIVAS DEL TRANSPORTE DE PASAJEROS; Reglamento servicios nacionales D.S. N°212/92-MTT. Reglamenta y modifica el decreto 212 y deja sin efecto decreto que indica D.S. 80/04. Reglamento servicio especiales paseos giras D.S.237/92. Circulación con luces encendidas modifica decreto 22 de 2006 D.D181/06.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'VII.- ALCOHOLISMO Y DROGADICCIÓN; Alcoholismo, definición y los efectos que provoca en la conducción. Drogadicción, qué son las drogas, tolerancia, deseo y dependencia a las drogas, clasificación y efectos de las drogas, efectos que provocan las drogas en la conducción.',
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/25/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'II. SERVICIO DE AMBULANCIAS; Disposiciones generales. Legislación vigente, antigüedad de las ambulancias, restricciones y tipos de conducción. Requerimientos solicitados por el servicio de Salud.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/25/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'III. SERVICIO DE TAXIS; Inicio o término de sus servicios (Art. 47 Ds 212). Servicio de transporte público remunerado (Art. 20 Ds 212). Trazado y tarifa (Art. 48-49 Ds 212). Colores, letras y números. Modalidades (Art. 72 Ds 212). Número de personas (Art. 75 Ds 212). Prohibiciones de llevar acompañantes que no sean pasajeros (Art. 74 Ds 212). Requisitos (Art. 73 Ds 212). Taxímetro.',
      horas: '4 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/26/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'V. TRANSPORTE REMUNERADO DE ESCOLARES DECRETO 38/92; Condiciones generales, Qué se entiende por escolares. N° de escolares que se pueden transportar. De la identificación del conductor y del acompañante del conductor. Del uso de las luces destellantes en la subida y bajada de los escolares. Duración de los viajes. De los viajes especiales de carácter interurbano. De la contratación del seguro obligatorio, revisión técnica, requisitos de los vehículos (Art. 1 al 13)',
      horas: '5 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
  ];

  return rows;
}

/**
 * spec 0017-m: transcripción verbatim de `libroclasesa4.pdf` (páginas 14-27, A4 --
 * "Transporte de Carga"), 72 filas reales, 4 LIBRE (filas 12, 17, 18, 71). El módulo
 * Transporte cambia por completo respecto a A2/A3 (contenido de carga, no pasajeros); los
 * demás módulos (Ley del Tránsito, Conducción, Mecánica, Aspectos Psicológicos) comparten la
 * mayoría del texto salvo notas puntuales (INCENDIOS termina en "...de carga." acá, no "...de
 * pasajeros."). Ortografía corregida respecto del original (ej. "as drogas" -> "las drogas",
 * "sustancas" -> "sustancias", "caracteristicas" -> "características").
 */
function getA4Curriculum(): CurriculumRow[] {
  const CONDUCCION_III =
    'III. PRECAUCIONES EN LA CONDUCCIÓN; Recomendaciones generales, El tráfico, Detención para subida y bajada de ocupantes del vehículo, Conducción en curvas, Conducción en bajada, Conducción en subida, Conducción en hielo, Uso de cadenas, El clima, Lluvia, Neblina. Empleo correcto de luces: Código de luces, Señalización, Uso de luces altas y bajas.';
  const OPERACION_VEHICULO =
    'II. OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. Generalidades sobre los sistemas del vehículo y su incidencia en la conducción. La caja de cambios: Simple, automática. La aceleración del motor y la contaminación. El freno motor. El freno de estacionamiento o freno de mano. El freno de servicio o freno de pie. Los espejos retrovisores.';
  const CHEQUEOS_BASICOS_CONDUCTOR =
    'I. CHEQUEOS BÁSICOS; Carrocería. Limpieza. Verificaciones luego de poner en marcha el motor. Aplicar procedimientos para la revisión de: El puesto de trabajo del conductor, Posición de la palanca de cambio, Chapa de contacto: posición y efectos. Instrumentos del panel Luces de control interna y externas. Palancas e indicadores. Limpiadores de parabrisas.';
  const AUXILIOS =
    'PRIMEROS AUXILIOS; Generalidades, definición de primeros auxilios, la importancia de un auxilio adecuado, requisitos que debe reunir un auxiliador, puntos básicos de los primeros auxilios. Paro cardiaco y respiratorio. Shock. Asfixia. Fractura.';
  const COMUNICACION =
    'LA COMUNICACIÓN; Conceptualización. Procesos de comunicación. Comunicación eficaz. Guía para escuchar eficientemente. Tipo de comunicación, palabras e imágenes, comunicación no verbal, acción y lenguaje corporal. Barreras en la comunicación, omisión, distorsión, generalización y rumor.';
  const RELACIONES_HUMANAS =
    'RELACIONES HUMANAS; Ambiente laboral y su incidencia en las relaciones humanas. Motivación y frustración factores fundamentales, psicológicos en el actuar laboral y en las relaciones humanas. Los diversos tipos de relaciones de los conductores profesionales: con otros conductores, con los empresarios, con las autoridades.';
  const AUTOESTIMA =
    'LA AUTOESTIMA; Qué es la autoestima. Tipos de autoestimas. Formación de la autoestima. Elementos ligados a la autoestima. Factores importantes en el desarrollo de la autoestima. Componentes de la autoestima.';
  const PROCESOS_PSICOLOGICOS =
    'PROCESOS PSICOLÓGICO BÁSICOS; Percepción, definición, factores personales que influyen en la percepción y algunos aspectos básicos de la fisiología de la percepción. Atención. Memoria. Motivación, qué es la motivación, cuándo se está motivado y las motivaciones en el trabajo. Las Actitudes, qué es una actitud y las características.';
  const CONDICIONES_FISICAS =
    'LAS CONDICIONES FÍSICAS ÓPTIMAS PARA CONDUCIR; Los tiempos de conducción. La mezcla del alcohol con la conducción: qué es el alcohol, cuáles son los efectos del alcohol en el organismo, cuáles son las consecuencias en la conducción que produce el consumo de alcohol. La mezcla de las drogas con la conducción: qué son las drogas, clasificación y efectos de las drogas y efectos en la conducción.';
  const RESP_CIVIL_XV =
    'RESPONSABILIDAD CIVIL Y PENAL; TÍTULO XV RESPONSABILIDAD POR LOS ACCIDENTES; Toda persona que conduzca Art. 165. El nuevo hecho de la infracción no determinada la responsabilidad Art. 166. Presunción de responsabilidad Art. 167. En todo accidente donde se produzca daños Art. 168. Art. 169, 170 y 171, relacionado con infracciones y mal estado de vehículos.';
  const REGISTRO_XVIII =
    'TÍTULO XVIII DEL REGISTRO NACIONAL DE CONDUCTORES DE VEHÍCULOS MOTORIZADOS; Registro nacional de conductores de vehículos motorizados Art. 210. Deberes del registro nacional de conductores Art. 211. Datos de los conductores que serán enrolados en el registro nacional de conductores Art. 212. Art. 214, 215, 216 y 217 relacionado con registro nacional.';
  const CONDUCCION_SEGURA =
    'CONDUCCIÓN SEGURA; Conducción a la defensiva. Condiciones adversas para la conducción. Conducción nocturna. Condiciones ambientales. Las curvas. Pendientes. Características del conductor defensivo. Factores para la conducción defensiva. Colisiones.';
  const INFRAESTRUCTURA_VIAL =
    'INFRAESTRUCTURA VIAL; Disposiciones generales sobre uso de las vías: Prohibiciones en las vías públicas Art. 160, Normas del tránsito de peatones Art. 162. Los caminos públicos: Definiciones D.F.L 850/97. Redes Viales: Decretos.';
  const CONDUCTORES_LICENCIAS =
    'LOS CONDUCTORES Y LAS LICENCIAS; Ninguna persona podrá conducir sin poseer la licencia Art. 5. Los conductores deberán llevar consigo su licencia Art. 6. Se prohíbe al propietario facilitar su vehículo a una persona que no posea licencia Art. 7. Los propietarios de vehículos no podrán celebrar contratos Art. 8. Las licencias sólo podrán otorgarse por la municipalidad Art. 9. Art. 10-14, 17, 19, 22, 24 y 29. Relacionado con licencias y conductores.';
  const REDES_VIALES =
    'REDES VIALES BÁSICAS; Clasificación redes viales básicas: Autopistas, Autovía, Troncal, Servicio colector a Distribuidora D.S. 83/85. Peso por ejes y pesos máximos permitidos D.D. 158/80.';
  const INCENDIOS_CARGA =
    'COMBATE Y PREVENCIÓN DE INCENDIOS; El fuego y sus composiciones. Tipos de fuegos y formas de extinción. Tipo de extintores. Procedimientos a seguir en caso de incendio de vehículos de transporte de carga.';
  const MANTENCION_CARGA =
    'MANTENCIÓN DE VEHÍCULOS DE TRANSPORTE DE CARGA; Revisión del estado del vehículo: antes de poner en marcha el motor, con el motor en funcionamiento, después de estacionado y detenido el motor. Pruebas de funcionamiento. Normas de seguridad aplicada.';
  const REGLAMENTO_TRANSPORTE_CARGA_PELIGROSA =
    'II. REGLAMENTO TRANSPORTE DE CARGA PELIGROSA DECRETO 298/95; Disposiciones preliminares. Los vehículos y su equipamiento. La carga, su acondicionamiento, estiba, descarga y manipulación. Circulación y estacionamiento. Prohibiciones y obligaciones del transportista. Fiscalización.';
  const MANIPULACION_CARGA_ESTROBADO =
    'IV. MANIPULACIÓN DE CARGA Y ESTROBADO; Definiciones. Tipos de mercancías y recomendaciones para su embalaje. Tipos de mercancías y recomendaciones para su embalaje. Contenedores: definición, tipos de contenedores y sus respectivas identificación.';
  const REGLAMENTO_COMBUSTIBLES_LIQUIDOS =
    'VI. REGLAMENTO DE SEGURIDAD PARA LAS INSTALACIONES Y OPERACIONES DE PRODUCCIÓN Y REFINACIÓN, ALMACENAMIENTO, DISTRIBUCIÓN Y ABASTECIMIENTO DE COMBUSTIBLES LÍQUIDOS. DECRETO N°160 DEL 07/07/09; Requisitos mínimos de seguridad que deben cumplir las instalaciones de combustibles líquidos derivados del petróleo y biocombustible, y las operaciones asociadas a la producción.';
  const ESTABLECE_CARGAS_D75 =
    'ESTABLECE CONDICIONES PARA EL TRANSPORTE DE CARGAS QUE INDICA D.S. N° 75; Establece condiciones y reglamentos para el transporte de cargas por calles y caminos.';
  const LIBRE: CurriculumRow = {
    fecha: '',
    asignatura: 'LIBRE',
    materias: 'LIBRE',
    horas: 'LIBRE',
    profesor: 'LIBRE',
  };

  const rows: CurriculumRow[] = [
    {
      fecha: '1/17/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'I. ESTABLECE CONDICIONES PARA EL TRANSPORTE DE CARGAS DECRETO N°75/87; Forma de transportar la carga, utilización de banderines, los extremos que puede sobrepasar la carga. El transporte de desperdicios, arena, ripio, tierra u otros materiales (líquidos o sólidos). El transporte de materiales que produzcan polvo, mal olor en zonas urbanas. Los vehículos destinados al transporte de alimentos. Prohibiciones. Los vehículos que transportan contenedores. Límite velocidad.',
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/17/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias: REGLAMENTO_TRANSPORTE_CARGA_PELIGROSA,
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/18/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias: REGLAMENTO_TRANSPORTE_CARGA_PELIGROSA,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/18/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'III. REGLAMENTO DE SEGURIDAD PARA ALMACENAMIENTO, TRANSPORTE Y EXPENDIO DE GAS LICUADO; Transporte de gas licuado en camiones. El personal de operación de los vehículos de transporte de gas licuado. Equipo de los estanques para gas licuado. Transporte de cilindros y condiciones generales para manipular los cilindros durante la carga y descarga. Dispositivos generales. El sistema de escape en camiones que transportan gas licuado.',
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/18/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias: MANIPULACION_CARGA_ESTROBADO,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/19/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias: MANIPULACION_CARGA_ESTROBADO,
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/19/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'V. RESOLUCIÓN EX. N°1213/02. De la dirección del trabajo que "establece sistema obligatorio de control de asistencia, de las horas de trabajo y de descanso de la determinación de las remuneraciones para los conductores de vehículos de carga terrestre interurbano".',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/19/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias: REGLAMENTO_COMBUSTIBLES_LIQUIDOS,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/20/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias: REGLAMENTO_COMBUSTIBLES_LIQUIDOS,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/20/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'VII. REGLAMENTO GENERAL DE TRANSPORTE DE GANADO Y CARNE BOVINA. DECRETO SUPREMO N°240 DEL 26/10/93; Normas aplicables para el transporte de animales por vías públicas.',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/20/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'VIII. REGLAMENTO DE CONDICIONES PARA EL TRANSPORTE DE PRODUCTOS FORESTALES. DECRETO SUPREMO N°94/91; Condiciones aplicables al transporte por camión, remolque, semirremolque y vehículos especiales, que transiten por calles, caminos y demás vías públicas, o particulares destinadas al uso público, de los productos forestales.',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    { ...LIBRE, fecha: '1/21/2022' },
    {
      fecha: '1/22/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'CHEQUEOS BÁSICOS; Del conductor, cabina, exterior, chequeo de niveles, otros. Verificación de las condiciones del vehículo antes de poner en marcha el motor. OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. PRECAUCIONES EN LA CONDUCCIÓN; Recomendaciones generales. El tráfico. Detención para subidas y bajadas de ocupantes del vehículo. Conducción en curvas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/24/2022',
      asignatura: 'MECÁNICA',
      materias: MANTENCION_CARGA,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/25/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: RELACIONES_HUMANAS,
      horas: '5 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '1/26/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CONDUCCION_III,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    { ...LIBRE, fecha: '1/27/2022' },
    { ...LIBRE, fecha: '1/28/2022' },
    {
      fecha: '1/29/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CONDUCCION_III,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '1/31/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: PROCESOS_PSICOLOGICOS,
      horas: '3 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '1/31/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: AUTOESTIMA,
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY DE TRÁNSITO D.F.L. N°1 DE 2007; A quienes regula esta Ley Art. 1. Las municipalidades dictarán normas específicas Art. 3. Los encargados de supervigilar el cumplimiento de las disposiciones a que se refiere esta Ley Art. 4',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'TÍTULO III DEL DOMINIO Y REGISTRO DE LOS VEHÍCULOS MOTORIZADOS Y DE LA PATENTE ÚNICA Y CERTIFICADO DE INSCRIPCIÓN; El servicio de registro e identificación llevará un registro de vehículos motorizados. Art. 39, las variaciones de dominio. Art. 41, se presumirá propietario de un vehículo motorizado. Art. 44,45,48,51,52,53,55 y 56, relacionado con placa patente.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'TÍTULO VII DE LAS REVISIONES DE LOS VEHÍCULOS, DE SUS CONDICIONES DE SEGURIDAD Y DE LA HOMOLOGACIÓN; Las municipalidades no otorgarán permisos de circulación Art. 98. El ministerio de transporte y telecomunicaciones podrá licitar la función de homologación de vehículos Art. 90. Las revisiones que decreten los tribunales Art. 91. Los vehículos que hayan perdido sus condiciones de seguridad Art. 92',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: REGISTRO_XVIII,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: RESP_CIVIL_XV,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/2/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: AUTOESTIMA,
      horas: '1 hora',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/2/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'EL ESTRÉS; Qué es el estrés. Los peligros del estrés. Aparición de la ansiedad. Los síntomas del estrés: depresión, desconcentración, ansiedad, irritabilidad y baja autoestima. Los síntomas físicos: agotamiento, insomnio y trastornos psicosomáticos. Las causas del estrés.',
      horas: '4 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/3/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: COMUNICACION,
      horas: '3 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/3/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: CONDICIONES_FISICAS,
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/4/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: PROCESOS_PSICOLOGICOS,
      horas: '1 hora',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/4/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: AUTOESTIMA,
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/4/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: CONDICIONES_FISICAS,
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/5/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CHEQUEOS_BASICOS_CONDUCTOR,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/7/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: RESP_CIVIL_XV,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/7/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'RESPONSABILIDAD CIVIL Y PENAL; TÍTULO XVI DE LOS PROCEDIMIENTOS POLICIALES Y ADMINISTRATIVOS; Toda modificación que se hiciera al sentido del tránsito Art. 172. Los vehículos que hayan sufrido un desperfecto Art. 173. Los vehículos participantes en un accidente de tránsito Art. 174. Art. 175, 176, 177, 178, 179, 180, 184. Relacionados con procedimientos policiales.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/7/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'TÍTULO XVII, DE LOS DELITOS, CUASIDELITOS Y DE LA CONDUCCIÓN BAJO LA INFLUENCIA DEL ALCOHOL, EN ESTADO DE EBRIEDAD O BAJO LA INFLUENCIA DE SUSTANCIAS ESTUPEFACIENTES O SICOTRÓPICOS; Castigo a empleados públicos que abuse en su oficio Art. 190 A. Castigo a conductor hasta por 5 años Art. 192 B. En los accidentes, donde el conductor cause lesiones menos graves, lesiones graves o muerte Art. 193 C, 194 D. Art. 198 - 209 relacionado sobre licencias.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/8/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: COMUNICACION,
      horas: '1 hora',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/8/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: RELACIONES_HUMANAS,
      horas: '4 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/9/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: REGISTRO_XVIII,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/9/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY 18.287, ESTABLECE PROCEDIMIENTOS ANTE LOS JUZGADOS DE POLICÍA LOCAL; Conocimientos de los procesos Art. 1. Los delincuentes ante el juzgado Art. 3. La citación al juzgado y la carta certificada Art. 4. Denuncia motivada por infracciones alejadas del lugar de residencia Art. 5. Art. 6 - 40 relacionado con procedimientos ante los juzgados.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/9/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY DE DROGAS Y ESTUPEFACIENTES Y SUSTANCIAS SICOTRÓPICAS; Consumo y tráfico de drogas y estupefacientes, según Ley N° 20.000/05, y las sanciones de la D.F.L. N° 1 de 2007 Art. 16 N°1 y Art. N° 110.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/10/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: CONDUCCION_SEGURA,
      horas: '5 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/11/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'REGLAMENTO DE LOS SERVICIOS DE TRANSPORTE DE CARGA POR CALLES Y CAMINOS D.S. 298/94 Y 198/2000; Reglamento establece las condiciones, normas y procedimientos aplicables al transporte de carga, por calles y caminos, de sustancias o productos que por sus características, sean peligrosas o representen riesgos para la salud de las personas, para la seguridad del público o el medio ambiente.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/11/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: ESTABLECE_CARGAS_D75,
      horas: '4 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/12/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CHEQUEOS_BASICOS_CONDUCTOR,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: 'DEFINICIÓN D.F.L. N° 1 DE 2007; Definición del D.F.L. N°1 de 2007 Art. 2.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: CONDUCTORES_LICENCIAS,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: REDES_VIALES,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'MECÁNICA',
      materias:
        'CONCEPTO DE MOTOR; Elementos constitutivos de los sistemas. Piezas fundamentales. Tren alternativo de movimientos.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'MECÁNICA',
      materias:
        'PROCESOS FUNDAMENTALES; Ciclos de trabajo, 2 tiempos, 4 tiempos. Relación de compresión volumétrica. Calificación de motores y sus respectivos combustibles de acuerdo a la relación volumétrica que poseen.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE ALIMENTACIÓN; Combustible - Combustión. Carburación - Carburador. Bombas de combustible. Pruebas - Fallas - Reparación.',
      horas: '1 hora',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/16/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: CONDUCCION_SEGURA,
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/16/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: INCENDIOS_CARGA,
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY DE ALCOHOLES; Idoneidad moral y sanciones de la D.F.L N° 1 de 2007 Art. 16 N° 1. Modificación por la ley N° 20.580 aumentando las sanciones por manejo en estado de ebriedad, bajo la influencia de sustancias estupefacientes o sicotrópicas, y bajo la influencia del alcohol. Cambio artículos 87, 88, 111, 183, 192, 193, 196, 197, 197 bis, 208 y 209.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEGISLACIÓN LABORAL; Definiciones del empleador, trabajador, trabajador independiente. Contrato de trabajo. Qué es un contrato de trabajo, tipo de contratos y sus estipulaciones. Disposiciones legales referentes a los conductores. Código del trabajo actualizado 26/08 del 2013. Modifica el código del trabajo, jornada de choferes Ley 20.271.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'MEDIO AMBIENTE. DISPOSICIONES ADUANERAS; Introducción ley 19.300 modificada 13/11/10 ley 20.473 medio ambiente. Concepto de medio ambiente (Elementos abióticos y bióticos). Constituyentes del medio ambiente. Problemas medioambientales producidos por: Dióxido de carbono, Acidificación, Destrucción del ozono, Hidrocarburos clorados.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/18/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: INCENDIOS_CARGA,
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/18/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: ESTABLECE_CARGAS_D75,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/18/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'ESTACIONAMIENTO Y DETENCIÓN; Lado dónde se estacionan los vehículos. Estacionamiento que deberán establecer las municipalidades. Estacionamiento en los caminos y vías rurales. Forma de estacionar un vehículo. Obligación de frenar y detener el motor al estacionarse. Detención en sitios no autorizados para estacionarse. Detención y estacionamientos prohibidos. Retiro de vehículos abandonados. Luces de estacionamientos encendidas cuando no exista alumbrado público. Art. 148 a 159.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/19/2022',
      asignatura: 'CONDUCCIÓN',
      materias: OPERACION_VEHICULO,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE ENCENDIDO; Función de los elementos. Circuito de alto y bajo voltaje. Prueba y fallas. Reparaciones. Puesta a punto y Puesta a tiempo.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE REFRIGERACIÓN; Elementos que lo componen y su respectiva función. Pruebas, fallas y reparaciones. Clasificación de los diferentes sistemas de refrigeración en uso. Refrigeración. Termosifón. Refrigeración forzada. Refrigeración por aire libre y forzada.',
      horas: '1 hora',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE LUBRICACIÓN; Lubricación por salpicado, lubricación por presión de la bomba, lubricación mixta, clasificación de los lubricantes, cualidades de un buen lubricante, diagnóstico de estado del motor según su presión de aceite.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/22/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE DISTRIBUCIÓN; Función, clasificación de los sistemas de distribución de acuerdo a: mando directo, mando indirecto, mando mixto. El motor diésel componentes principales del motor.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/22/2022',
      asignatura: 'MECÁNICA',
      materias: MANTENCION_CARGA,
      horas: '3 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/23/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: INFRAESTRUCTURA_VIAL,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/23/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: AUXILIOS,
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: INFRAESTRUCTURA_VIAL,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias:
        'PROCEDIMIENTO EN CASO DE INCENDIO; El fuego y su composición. Tipos de fuegos y formas de extinción. Tipos de extintores. Procedimientos a seguir en caso de incendios de vehículos de transporte de carga. Elementos de seguridad que tienen los vehículos para evitar un incendio.',
      horas: '4 horas',
      profesor: 'PABLO VARGAS',
    },
    { ...LIBRE, fecha: '2/25/2022' },
    {
      fecha: '2/26/2022',
      asignatura: 'CONDUCCIÓN',
      materias: OPERACION_VEHICULO,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
  ];

  return rows;
}

/**
 * spec 0017-m: transcripción verbatim de `libroclasesa5.pdf` (páginas 14-27, A5 --
 * "Transporte de Carga" + módulo extra "Manipulación de Cargas y Sust. Peligrosas"), 72 filas
 * reales, 4 LIBRE al inicio (filas 1-4). Agrega una asignatura que A3/A4 no tienen
 * ("Manipulación de Cargas y Sust. Peligrosas", SAG/SII/Aduana, Ley 18.290 Art. 62-81) -- la
 * página de Evaluaciones del libro real sigue teniendo solo 7 columnas, esa asignatura extra
 * no tiene columna propia ahí (inconsistencia del libro real, no se inventa una columna al
 * replicar). **Dato sucio del original preservado a propósito** (filas 51/53/63): el texto de
 * Prevención de Riesgos / Mecánica dice "vehículos de transporte de pasajeros" por
 * copy-paste de A2/A3 sin actualizar para un libro de carga -- se transcribe tal cual, sin
 * corregir, por ser documento fiscalizable (ver tasks.md).
 */
function getA5Curriculum(): CurriculumRow[] {
  const CONDUCCION_III =
    'III. PRECAUCIONES EN LA CONDUCCIÓN; Recomendaciones generales, El tráfico, Detención para subida y bajada de ocupantes del vehículo, Conducción en curvas, Conducción en bajada, Conducción en subida, Conducción en hielo, Uso de cadenas, El clima, Lluvia, Neblina. Empleo correcto de luces: Código de luces, Señalización, Uso de luces altas y bajas.';
  const OPERACION_VEHICULO =
    'II. OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. Generalidades sobre los sistemas del vehículo y su incidencia en la conducción. La caja de cambios: Simple, automática. La aceleración del motor y la contaminación. El freno motor. El freno de estacionamiento o freno de mano. El freno de servicio o freno de pie. Los espejos retrovisores.';
  const CHEQUEOS_BASICOS_CONDUCTOR =
    'I. CHEQUEOS BÁSICOS; Carrocería. Limpieza. Verificaciones luego de poner en marcha el motor. Aplicar procedimientos para la revisión de: El puesto de trabajo del conductor, Posición de la palanca de cambio, Chapa de contacto: posición y efectos. Instrumentos del panel Luces de control interna y externas. Palancas e indicadores. Limpiadores de parabrisas.';
  const AUXILIOS =
    'PRIMEROS AUXILIOS; Generalidades, definición de primeros auxilios, la importancia de un auxilio adecuado, requisitos que debe reunir un auxiliador, puntos básicos de los primeros auxilios. Paro cardiaco y respiratorio. Shock. Asfixia. Fractura.';
  const PROCESOS_PSICOLOGICOS =
    'PROCESOS PSICOLÓGICO BÁSICOS; Percepción, definición, factores personales que influyen en la percepción y algunos aspectos básicos de la fisiología de la percepción. Atención. Memoria. Motivación, qué es la motivación, cuándo se está motivado y las motivaciones en el trabajo. Las Actitudes, qué es una actitud y las características.';
  const AUTOESTIMA =
    'LA AUTOESTIMA; Qué es la autoestima. Tipos de autoestimas. Formación de la autoestima. Elementos ligados a la autoestima. Factores importantes en el desarrollo de la autoestima. Componentes de la autoestima.';
  const COMUNICACION =
    'LA COMUNICACIÓN; Conceptualización. Procesos de comunicación. Comunicación eficaz. Guía para escuchar eficientemente. Tipo de comunicación, palabras e imágenes, comunicación no verbal, acción y lenguaje corporal. Barreras en la comunicación, omisión, distorsión, generalización y rumor.';
  const CONDICIONES_FISICAS =
    'LAS CONDICIONES FÍSICAS ÓPTIMAS PARA CONDUCIR; Los tiempos de conducción. La mezcla del alcohol con la conducción: qué es el alcohol, cuáles son los efectos del alcohol en el organismo, cuáles son las consecuencias en la conducción que produce el consumo de alcohol. La mezcla de las drogas con la conducción: qué son las drogas, clasificación y efectos de las drogas y efectos en la conducción.';
  const RESP_CIVIL_XV =
    'RESPONSABILIDAD CIVIL Y PENAL; TÍTULO XV RESPONSABILIDAD POR LOS ACCIDENTES; Toda persona que conduzca Art. 165. El nuevo hecho de la infracción no determinada la responsabilidad Art. 166. Presunción de responsabilidad Art. 167. En todo accidente donde se produzca daños Art. 168. Art. 169, 170 y 171, relacionado con infracciones y mal estado de vehículos.';
  const REGISTRO_XVIII =
    'TÍTULO XVIII DEL REGISTRO NACIONAL DE CONDUCTORES DE VEHÍCULOS MOTORIZADOS; Registro nacional de conductores de vehículos motorizados Art. 210. Deberes del registro nacional de conductores Art. 211. Datos de los conductores que serán enrolados en el registro nacional de conductores Art. 212. Art. 214, 215, 216 y 217 relacionado con registro nacional.';
  const CONDUCCION_SEGURA =
    'CONDUCCIÓN SEGURA; Conducción a la defensiva. Condiciones adversas para la conducción. Conducción nocturna. Condiciones ambientales. Las curvas. Pendientes. Características del conductor defensivo. Factores para la conducción defensiva. Colisiones.';
  const INFRAESTRUCTURA_VIAL =
    'INFRAESTRUCTURA VIAL; Disposiciones generales sobre uso de las vías: Prohibiciones en las vías públicas Art. 160, Normas del tránsito de peatones Art. 162. Los caminos públicos: Definiciones D.F.L 850/97. Redes Viales: Decretos.';
  const CONDUCTORES_LICENCIAS =
    'LOS CONDUCTORES Y LAS LICENCIAS; Ninguna persona podrá conducir sin poseer la licencia Art. 5. Los conductores deberán llevar consigo su licencia Art. 6. Se prohíbe al propietario facilitar su vehículo a una persona que no posea licencia Art. 7. Los propietarios de vehículos no podrán celebrar contratos Art. 8. Las licencias sólo podrán otorgarse por la municipalidad Art. 9. Art. 10-14, 17, 19, 22, 24 y 29. Relacionado con licencias y conductores.';
  const REDES_VIALES =
    'REDES VIALES BÁSICAS; Clasificación redes viales básicas: Autopistas, Autovía, Troncal, Servicio colector a Distribuidora D.S. 83/85. Peso por ejes y pesos máximos permitidos D.D. 158/80.';
  const REGLAMENTO_TRANSPORTE_CARGA_PELIGROSA =
    'II. REGLAMENTO TRANSPORTE DE CARGA PELIGROSA DECRETO 298/95; Disposiciones preliminares. Los vehículos y su equipamiento. La carga, su acondicionamiento, estiba, descarga y manipulación. Circulación y estacionamiento. Prohibiciones y obligaciones del transportista. Fiscalización.';
  const MANIPULACION_CARGA_ESTROBADO =
    'IV. MANIPULACIÓN DE CARGA Y ESTROBADO; Definiciones. Tipos de mercancías y recomendaciones para su embalaje. Tipos de mercancías y recomendaciones para su embalaje. Contenedores: definición, tipos de contenedores y sus respectivas identificación.';
  const REGLAMENTO_COMBUSTIBLES_LIQUIDOS =
    'VI. REGLAMENTO DE SEGURIDAD PARA LAS INSTALACIONES Y OPERACIONES DE PRODUCCIÓN Y REFINACIÓN, ALMACENAMIENTO, DISTRIBUCIÓN Y ABASTECIMIENTO DE COMBUSTIBLES LÍQUIDOS. DECRETO N°160 DEL 07/07/09; Requisitos mínimos de seguridad que deben cumplir las instalaciones de combustibles líquidos derivados del petróleo y biocombustible, y las operaciones asociadas a la producción.';
  const ESTABLECE_CARGAS_D75 =
    'ESTABLECE CONDICIONES PARA EL TRANSPORTE DE CARGAS QUE INDICA D.S. N° 75; Establece condiciones y reglamentos para el transporte de cargas por calles y caminos.';
  const DOCUMENTOS_MEDIDAS_RESGUARDO =
    'II. DOCUMENTOS Y MEDIDAS DE RESGUARDO; Documentos para la carga de productos agrícolas. Documentos para la carga de origen pecuario. Documentos para la carga especial o peligrosa. De las medidas de seguridad Ley 18.290, Art. 68 al 81. De las condiciones técnicas Ley 18.290 Art. 62 al 63.';
  // Dato sucio del original (ver comentario de la función): dice "de pasajeros" en un libro de carga.
  const INCENDIOS_SUCIO_PASAJEROS =
    'COMBATE Y PREVENCIÓN DE INCENDIOS; El fuego y sus composiciones. Tipos de fuegos y formas de extinción. Tipo de extintores. Procedimientos a seguir en caso de incendio de vehículos de transporte de pasajeros.';
  const CHEQUEOS_OPERACION_PRECAUCIONES_COMBO =
    'CHEQUEOS BÁSICOS; Del conductor, cabina, exterior, chequeo de niveles, otros. Verificación de las condiciones del vehículo antes de poner en marcha el motor. OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. PRECAUCIONES EN LA CONDUCCIÓN; Recomendaciones generales. El tráfico. Detención para subidas y bajadas de ocupantes del vehículo. Conducción en curvas.';
  const LIBRE: CurriculumRow = {
    fecha: '',
    asignatura: 'LIBRE',
    materias: 'LIBRE',
    horas: 'LIBRE',
    profesor: 'LIBRE',
  };

  const rows: CurriculumRow[] = [
    { ...LIBRE, fecha: '1/17/2022' },
    { ...LIBRE, fecha: '1/18/2022' },
    { ...LIBRE, fecha: '1/19/2022' },
    { ...LIBRE, fecha: '1/20/2022' },
    {
      fecha: '1/21/2022',
      asignatura: 'MANIPULACIÓN DE CARGAS Y SUST. PELIGROSAS',
      materias: DOCUMENTOS_MEDIDAS_RESGUARDO,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/21/2022',
      asignatura: 'MANIPULACIÓN DE CARGAS Y SUST. PELIGROSAS',
      materias:
        'III. ESTIBA Y DESESTIBA DE CARGA Y SUSTANCIAS PELIGROSAS; De la carga. Ley 18.290 Art. 64 al 67. Prohibición sobre uso de parachoques. Velocidades máximas. Limitaciones de peso y dimensiones. Estiba. Técnicas de carga con grúa horquilla. Desestiba. Técnicas de descarga con grúa horquilla. Transporte de la carga. Señalización de la carga. Clasificación de materiales peligrosos. Reglamento del transporte de carga peligrosa por calles y caminos.',
      horas: '4 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '1/22/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY DE TRÁNSITO D.F.L. N°1 DE 2007; A quienes regula esta Ley Art. 1. Las municipalidades dictarán normas específicas Art. 3. Los encargados de supervigilar el cumplimiento de las disposiciones a que se refiere esta Ley Art. 4',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/22/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'TÍTULO III DEL DOMINIO Y REGISTRO DE LOS VEHÍCULOS MOTORIZADOS Y DE LA PATENTE ÚNICA Y CERTIFICADO DE INSCRIPCIÓN; El servicio de registro e identificación llevará un registro de vehículos motorizados. Art. 39, las variaciones de dominio. Art. 41, se presumirá propietario de un vehículo motorizado. Art. 44,45,48,51,52,53,55 y 56, relacionado con placa patente.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/22/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'TÍTULO VII DE LAS REVISIONES DE LOS VEHÍCULOS, DE SUS CONDICIONES DE SEGURIDAD Y DE LA HOMOLOGACIÓN; Las municipalidades no otorgarán permisos de circulación Art. 98. El ministerio de transporte y telecomunicaciones podrá licitar la función de homologación de vehículos Art. 90. Las revisiones que decreten los tribunales Art. 91. Los vehículos que hayan perdido sus condiciones de seguridad Art. 92',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/22/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: REGISTRO_XVIII,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/22/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: RESP_CIVIL_XV,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/24/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: RESP_CIVIL_XV,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/24/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'RESPONSABILIDAD CIVIL Y PENAL; TÍTULO XVI DE LOS PROCEDIMIENTOS POLICIALES Y ADMINISTRATIVOS; Toda modificación que se hiciera al sentido del tránsito Art. 172. Los vehículos que hayan sufrido un desperfecto Art. 173. Los vehículos participantes en un accidente de tránsito Art. 174. Art. 175, 176, 177, 178, 179, 180, 184. Relacionados con procedimientos policiales.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/24/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'TÍTULO XVII, DE LOS DELITOS, CUASIDELITOS Y DE LA CONDUCCIÓN BAJO LA INFLUENCIA DEL ALCOHOL, EN ESTADO DE EBRIEDAD O BAJO LA INFLUENCIA DE SUSTANCIAS ESTUPEFACIENTES O SICOTRÓPICOS; Castigo a empleados públicos que abuse en su oficio Art. 190 A. Castigo a conductor hasta por 5 años Art. 192 B. En los accidentes, donde el conductor cause lesiones menos graves, lesiones graves o muerte Art. 193 C, 194 D. Art. 198 - 209 relacionado sobre licencias.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/25/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias: REGISTRO_XVIII,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/25/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY 18.287, ESTABLECE PROCEDIMIENTOS ANTE LOS JUZGADOS DE POLICÍA LOCAL; Conocimientos de los procesos Art. 1. Los delincuentes ante el juzgado Art. 3. La citación al juzgado y la carta certificada Art. 4. Denuncia motivada por infracciones alejadas del lugar de residencia Art. 5. Art. 6 - 40 relacionado con procedimientos ante los juzgados.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/25/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY DE DROGAS Y ESTUPEFACIENTES Y SUSTANCIAS SICOTRÓPICAS; Consumo y tráfico de drogas y estupefacientes, según Ley N° 20.000/05, y las sanciones de la D.F.L. N° 1 de 2007 Art. 16 N°1 y Art. N° 110.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/26/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEY DE ALCOHOLES; Idoneidad moral y sanciones de la D.F.L N° 1 de 2007 Art. 16 N° 1. Modificación por la ley N° 20.580 aumentando las sanciones por manejo en estado de ebriedad, bajo la influencia de sustancias estupefacientes o sicotrópicas, y bajo la influencia del alcohol. Cambio artículos 87, 88, 111, 183, 192, 193, 196, 197, 197 bis, 208 y 209.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/26/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'LEGISLACIÓN LABORAL; Definiciones del empleador, trabajador, trabajador independiente. Contrato de trabajo. Qué es un contrato de trabajo, tipo de contratos y sus estipulaciones. Disposiciones legales referentes a los conductores. Código del trabajo actualizado 26/08 del 2013. Modifica el código del trabajo, jornada de choferes Ley 20.271.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/26/2022',
      asignatura: 'LEY DEL TRÁNSITO, RESPONSABILIDAD CIVIL Y PENAL',
      materias:
        'MEDIO AMBIENTE. DISPOSICIONES ADUANERAS; Introducción ley 19.300 modificada 13/11/10 ley 20.473 medio ambiente. Concepto de medio ambiente (Elementos abióticos y bióticos). Constituyentes del medio ambiente. Problemas medioambientales producidos por: Dióxido de carbono, Acidificación, Destrucción del ozono, Hidrocarburos clorados.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '1/27/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: PROCESOS_PSICOLOGICOS,
      horas: '3 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '1/27/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: AUTOESTIMA,
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '1/28/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: `${AUTOESTIMA} EL ESTRÉS; Qué es el estrés. Los peligros del estrés. Aparición de la ansiedad. Los síntomas del estrés: depresión, desconcentración, ansiedad, irritabilidad y baja autoestima. Los síntomas físicos: agotamiento, insomnio y trastornos psicosomáticos. Las causas del estrés.`,
      horas: '5 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '1/29/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: `LA COMUNICACIÓN; Conceptualización. Procesos de comunicación. Comunicación eficaz. Guía para escuchar eficientemente. Tipo de comunicación, palabras e imágenes, comunicación no verbal, acción y lenguaje corporal. RELACIONES HUMANAS; Ambiente laboral y su incidencia en las relaciones humanas. Motivación y frustración factores fundamentales, psicológicos en el actuar laboral y en las relaciones humanas.`,
      horas: '5 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '1/31/2022',
      asignatura: 'CONDUCCIÓN',
      materias: OPERACION_VEHICULO,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/1/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CONDUCCION_III,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/2/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CONDUCCION_III,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/3/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: COMUNICACION,
      horas: '3 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/3/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: CONDICIONES_FISICAS,
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/4/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: PROCESOS_PSICOLOGICOS,
      horas: '1 hora',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/4/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: AUTOESTIMA,
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/4/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias: CONDICIONES_FISICAS,
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/5/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'I. ESTABLECE CONDICIONES PARA EL TRANSPORTE DE CARGAS DECRETO N°75/87; Forma de transportar la carga, utilización de banderines, los extremos que puede sobrepasar la carga. El transporte de desperdicios, arena, ripio, tierra u otros materiales (líquidos o sólidos). El transporte de materiales que produzcan polvo, mal olor en zonas urbanas. Los vehículos destinados al transporte de alimentos. Prohibiciones. Los vehículos que transportan contenedores. Límite velocidad.',
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/5/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias: REGLAMENTO_TRANSPORTE_CARGA_PELIGROSA,
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/7/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CHEQUEOS_BASICOS_CONDUCTOR,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/8/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CHEQUEOS_BASICOS_CONDUCTOR,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/9/2022',
      asignatura: 'CONDUCCIÓN',
      materias: OPERACION_VEHICULO,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/10/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: CONDUCCION_SEGURA,
      horas: '5 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/11/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'REGLAMENTO DE LOS SERVICIOS DE TRANSPORTE DE CARGA POR CALLES Y CAMINOS D.S. 298/94 Y 198/2000; Reglamento establece las condiciones, normas y procedimientos aplicables al transporte de carga, por calles y caminos, de sustancias o productos que por sus características, sean peligrosas o representen riesgos para la salud de las personas, para la seguridad del público o el medio ambiente.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/11/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: ESTABLECE_CARGAS_D75,
      horas: '4 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/12/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias: REGLAMENTO_TRANSPORTE_CARGA_PELIGROSA,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/12/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'III. REGLAMENTO DE SEGURIDAD PARA ALMACENAMIENTO, TRANSPORTE Y EXPENDIO DE GAS LICUADO; Transporte de gas licuado en camiones. El personal de operación de los vehículos de transporte de gas licuado. Equipo de los estanques para gas licuado. Transporte de cilindros y condiciones generales para manipular los cilindros durante la carga y descarga. Dispositivos generales. El sistema de escape en camiones que transportan gas licuado.',
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/12/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias: MANIPULACION_CARGA_ESTROBADO,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: 'DEFINICIÓN D.F.L. N° 1 DE 2007; Definición del D.F.L. N°1 de 2007 Art. 2.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: CONDUCTORES_LICENCIAS,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: REDES_VIALES,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'MECÁNICA',
      materias:
        'CONCEPTO DE MOTOR; Elementos constitutivos de los sistemas. Piezas fundamentales. Tren alternativo de movimientos.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'MECÁNICA',
      materias:
        'PROCESOS FUNDAMENTALES; Ciclos de trabajo, 2 tiempos, 4 tiempos. Relación de compresión volumétrica. Calificación de motores y sus respectivos combustibles de acuerdo a la relación volumétrica que poseen.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE ALIMENTACIÓN; Combustible - Combustión. Carburación - Carburador. Bombas de combustible. Pruebas - Fallas - Reparación.',
      horas: '1 hora',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/16/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: CONDUCCION_SEGURA,
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/16/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: INCENDIOS_SUCIO_PASAJEROS,
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'CONDUCCIÓN',
      materias: CHEQUEOS_OPERACION_PRECAUCIONES_COMBO,
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/18/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: INCENDIOS_SUCIO_PASAJEROS,
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/18/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: ESTABLECE_CARGAS_D75,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/18/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'ESTACIONAMIENTO Y DETENCIÓN; Lado dónde se estacionan los vehículos. Estacionamiento que deberán establecer las municipalidades. Estacionamiento en los caminos y vías rurales. Forma de estacionar un vehículo. Obligación de frenar y detener el motor al estacionarse. Detención en sitios no autorizados para estacionarse. Detención y estacionamientos prohibidos. Retiro de vehículos abandonados. Luces de estacionamientos encendidas cuando no exista alumbrado público. Art. 148 a 159.',
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/19/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias: MANIPULACION_CARGA_ESTROBADO,
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/19/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'V. RESOLUCIÓN EX. N°1213/02. De la dirección del trabajo que "establece sistema obligatorio de control de asistencia, de las horas de trabajo y de descanso de la determinación de las remuneraciones para los conductores de vehículos de carga terrestre interurbano".',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/19/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias: REGLAMENTO_COMBUSTIBLES_LIQUIDOS,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE ENCENDIDO; Función de los elementos. Circuito de alto y bajo voltaje. Prueba y fallas. Reparaciones. Puesta a punto y Puesta a tiempo.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE REFRIGERACIÓN; Elementos que lo componen y su respectiva función. Pruebas, fallas y reparaciones. Clasificación de los diferentes sistemas de refrigeración en uso. Refrigeración. Termosifón. Refrigeración forzada. Refrigeración por aire libre y forzada.',
      horas: '1 hora',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE LUBRICACIÓN; Lubricación por salpicado, lubricación por presión de la bomba, lubricación mixta, clasificación de los lubricantes, cualidades de un buen lubricante, diagnóstico de estado del motor según su presión de aceite.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/22/2022',
      asignatura: 'MECÁNICA',
      materias:
        'SISTEMA DE DISTRIBUCIÓN; Función, clasificación de los sistemas de distribución de acuerdo a: mando directo, mando indirecto, mando mixto. El motor diésel componentes principales del motor.',
      horas: '2 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/22/2022',
      asignatura: 'MECÁNICA',
      // Dato sucio verbatim: dice "de Pasajeros" en un libro de carga (ver comentario de la función).
      materias:
        'MANTENCIÓN DE VEHÍCULOS DE TRANSPORTE DE PASAJEROS; Revisión del estado del vehículo: antes de poner en marcha el motor, con el motor en funcionamiento, después de estacionado y detenido el motor. Pruebas de funcionamiento. Normas de seguridad aplicada.',
      horas: '3 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/23/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: INFRAESTRUCTURA_VIAL,
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/23/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias: AUXILIOS,
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias: INFRAESTRUCTURA_VIAL,
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias:
        'PROCEDIMIENTO EN CASO DE INCENDIO; El fuego y su composición. Tipos de fuegos y formas de extinción. Tipos de extintores. Procedimientos a seguir en caso de incendios de vehículos de transporte de carga. Elementos de seguridad que tienen los vehículos para evitar un incendio.',
      horas: '4 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/25/2022',
      asignatura: 'MANIPULACIÓN DE CARGAS Y SUST. PELIGROSAS',
      materias:
        'I. LOS ORGANISMOS PARTICIPANTES; Los organismos fiscalizadores que participan en el transporte de carga: S.A.G, S.I. I, Aduana y Ministerio de obras públicas.',
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/25/2022',
      asignatura: 'MANIPULACIÓN DE CARGAS Y SUST. PELIGROSAS',
      materias: DOCUMENTOS_MEDIDAS_RESGUARDO,
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/26/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias: REGLAMENTO_COMBUSTIBLES_LIQUIDOS,
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/26/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'VII. REGLAMENTO GENERAL DE TRANSPORTE DE GANADO Y CARNE BOVINA. DECRETO SUPREMO N°240 DEL 26/10/93; Normas aplicables para el transporte de animales por vías públicas.',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/26/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'VIII. REGLAMENTO DE CONDICIONES PARA EL TRANSPORTE DE PRODUCTOS FORESTALES. DECRETO SUPREMO N°94/91; Condiciones aplicables al transporte por camión, remolque, semirremolque y vehículos especiales, que transiten por calles, caminos y demás vías públicas, o particulares destinadas al uso público, de los productos forestales.',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
  ];

  return rows;
}

/**
 * spec 0018-m: malla del libro Conv. A-3 (`libroclasesconva3.pdf`, páginas 11-14), 23 filas en
 * 16 días de clase (CONV_BOOKS.A3.sessionDays). Las celdas FECHA/ASIGNATURA fusionadas del real
 * (filas 6, 12 y 18, partidas por el salto de página) se repiten en cada fila. 19 filas son
 * idénticas a textos ya corregidos de las mallas A2-A5 y se reutilizan tal cual; las filas 14 y
 * 20 tienen contenido propio de convalidación. Ortografía corregida y HORAS en minúscula
 * (decisión del dueño 2026-09-24).
 */
function getConvA3Curriculum(): CurriculumRow[] {
  return [
    {
      fecha: '2/9/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'I. CHEQUEOS BÁSICOS; Carrocería. Limpieza. Verificaciones luego de poner en marcha el motor. Aplicar procedimientos para la revisión de: El puesto de trabajo del conductor, Posición de la palanca de cambio, Chapa de contacto: posición y efectos. Instrumentos del panel Luces de control interna y externas. Palancas e indicadores. Limpiadores de parabrisas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/10/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'I. CHEQUEOS BÁSICOS; Carrocería. Limpieza. Verificaciones luego de poner en marcha el motor. Aplicar procedimientos para la revisión de: El puesto de trabajo del conductor, Posición de la palanca de cambio, Chapa de contacto: posición y efectos. Instrumentos del panel Luces de control interna y externas. Palancas e indicadores. Limpiadores de parabrisas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/11/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'II. OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. Generalidades sobre los sistemas del vehículo y su incidencia en la conducción. La caja de cambios: Simple, automática. La aceleración del motor y la contaminación. El freno motor. El freno de estacionamiento o freno de mano. El freno de servicio o freno de pie. Los espejos retrovisores.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/12/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'I. REGLAMENTACIÓN DEL TRANSPORTE PÚBLICO DE PASAJEROS; Reglamento de los servicios nacionales de transporte público de pasajeros, privado remunerado de pasajeros, servicios especiales de transporte de pasajeros, transporte remunerado de pasajeros desde y hacia aeródromos y aeropuertos, publicidad en los vehículos de transporte público de pasajeros, dimensionales y funcionales, cinturones de seguridad, luces encendidas. Decreto N°122/91. Sobre redes viales básicas.',
      horas: '5 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'I. REGLAMENTACIÓN DEL TRANSPORTE PÚBLICO DE PASAJEROS; Reglamento de los servicios nacionales de transporte público de pasajeros, privado remunerado de pasajeros, servicios especiales de transporte de pasajeros, transporte remunerado de pasajeros desde y hacia aeródromos y aeropuertos, publicidad en los vehículos de transporte público de pasajeros, dimensionales y funcionales, cinturones de seguridad, luces encendidas. Decreto N°122/91. Sobre redes viales básicas.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'II. OBLIGACIONES DEL CONDUCTOR; Mantener normas relativas a la atención de público. Conducir observando normas técnicas impartidas durante el proceso de instrucción. Seguro obligatorio de accidentes personales. La conducción en vehículos de transporte público y algunas indicaciones como: detención frente a colegios, precaución frente a los vehículos, uso de señales preventivas, disciplina de los pasajeros, los tiempos y velocidades.',
      horas: '3 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'II. OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. Generalidades sobre los sistemas del vehículo y su incidencia en la conducción. La caja de cambios: Simple, automática. La aceleración del motor y la contaminación. El freno motor. El freno de estacionamiento o freno de mano. El freno de servicio o freno de pie. Los espejos retrovisores.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/16/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'II. OBLIGACIONES DEL CONDUCTOR; Mantener normas relativas a la atención de público. Conducir observando normas técnicas impartidas durante el proceso de instrucción. Seguro obligatorio de accidentes personales. La conducción en vehículos de transporte público y algunas indicaciones como: detención frente a colegios, precaución frente a los vehículos, uso de señales preventivas, disciplina de los pasajeros, los tiempos y velocidades.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/16/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'III. SERVICIO DE AMBULANCIAS; Disposiciones generales. Legislación vigente, antigüedad de las ambulancias, restricciones y tipos de conducción. Requerimientos solicitados por el servicio de Salud.',
      horas: '3 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'II. SERVICIO DE AMBULANCIAS; Disposiciones generales. Legislación vigente, antigüedad de las ambulancias, restricciones y tipos de conducción. Requerimientos solicitados por el servicio de Salud.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'III. SERVICIO DE TAXIS; Inicio o término de sus servicios (Art. 47 Ds 212). Servicio de transporte público remunerado (Art. 20 Ds 212). Trazado y tarifa (Art. 48-49 Ds 212). Colores, letras y números. Modalidades (Art. 72 Ds 212). Número de personas (Art. 75 Ds 212). Prohibiciones de llevar acompañantes que no sean pasajeros (Art. 74 Ds 212). Requisitos (Art. 73 Ds 212). Taxímetro.',
      horas: '4 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/18/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'CHEQUEOS BÁSICOS; Del conductor, cabina, exterior, chequeo de niveles, otros. Verificación de las condiciones del vehículo antes de poner en marcha el motor. OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. PRECAUCIONES EN LA CONDUCCIÓN; Recomendaciones generales. El tráfico. Detención para subidas y bajadas de ocupantes del vehículo. Conducción en curvas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/19/2022',
      asignatura: 'TRANSPORTE DE PASAJEROS',
      materias:
        'V. TRANSPORTE REMUNERADO DE ESCOLARES DECRETO 38/92; Condiciones generales, Qué se entiende por escolares. N° de escolares que se pueden transportar. De la identificación del conductor y del acompañante del conductor. Del uso de las luces destellantes en la subida y bajada de los escolares. Duración de los viajes. De los viajes especiales de carácter interurbano. De la contratación del seguro obligatorio, revisión técnica, requisitos de los vehículos (Art. 1 al 13)',
      horas: '5 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'ATENCIÓN DE PÚBLICO; Las múltiples funciones de un conductor profesional y su efecto en su atención al cliente. Normas generales de un conductor eficiente, sus defectos a superar en la atención al cliente. La opinión pública del examinador y calificador del conductor. VII.- ALCOHOLISMO Y DROGADICCIÓN; Alcoholismo, definición y los efectos que provoca en la conducción. Drogadicción, qué son las drogas.',
      horas: '5 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/22/2022',
      asignatura: 'MECÁNICA',
      materias:
        'MANTENCIÓN DE VEHÍCULOS DE TRANSPORTE DE PASAJEROS; Revisión del estado del vehículo: antes de poner en marcha el motor, con el motor en funcionamiento, después de estacionado y detenido el motor. Pruebas de funcionamiento. Normas de seguridad aplicada.',
      horas: '4 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/22/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'VII.- ALCOHOLISMO Y DROGADICCIÓN; Alcoholismo, definición y los efectos que provoca en la conducción. Drogadicción, qué son las drogas, tolerancia, deseo y dependencia a las drogas, clasificación y efectos de las drogas, efectos que provocan las drogas en la conducción.',
      horas: '1 hora',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/23/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'VII.- ALCOHOLISMO Y DROGADICCIÓN; Alcoholismo, definición y los efectos que provoca en la conducción. Drogadicción, qué son las drogas, tolerancia, deseo y dependencia a las drogas, clasificación y efectos de las drogas, efectos que provocan las drogas en la conducción.',
      horas: '5 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'REGLAMENTO DE LOS SERVICIOS DE TRANSPORTE POR CALLES Y CAMINOS 163/1984; Prohíbe circulación que expele humo por tubo de escape. Otras revisiones técnicas si es necesario. Profundidad de la banda de rodado. Portar extintores. Portar botiquín. Prestar servicio de alquiler. Colores de los taxis. Pérdida de la patente. Título II de los servicios locomoción colectiva. Art. 12 a 23 y Art. 34 al 51.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'LOS CONDUCTORES Y LAS LICENCIAS; Ninguna persona podrá conducir sin poseer la licencia Art. 5. Los conductores deberán llevar consigo su licencia Art. 6. Se prohíbe al propietario facilitar su vehículo a una persona que no posea licencia Art. 7. Los propietarios de vehículos no podrán celebrar contratos Art. 8. Las licencias sólo podrán otorgarse por la municipalidad Art. 9. Art. 10-14, 17, 19, 22, 24 y 29. Relacionado con licencias y conductores.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'REGLAMENTO DE TRANSPORTE REMUNERADO DE ESCOLARES; Registro remunerado de escolares que se refiere la Ley 19.831, LA CONDUCCIÓN Y LA JORNADA DE TRABAJO; Jornada ordinaria de trabajo del personal de choferes y auxiliares de la locomoción colectiva interurbana. VELOCIDAD; Conducción a mayor velocidad de la que sea razonable y prudente Art. 144, Límites máximos de conducción. Art. 145 - 147.',
      horas: '2 horas',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'INFRAESTRUCTURA Y EDUCACIÓN VIAL',
      materias:
        'XI NORMATIVAS DEL TRANSPORTE DE PASAJEROS; Reglamento servicios nacionales D.S. N°212/92-MTT. Reglamenta y modifica el decreto 212 y deja sin efecto decreto que indica D.S. 80/04. Reglamento servicio especiales paseos giras D.S.237/92. Circulación con luces encendidas modifica decreto 22 de 2006 D.D181/06.',
      horas: '1 hora',
      profesor: 'ALBERTO ORMEÑO',
    },
    {
      fecha: '2/25/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'III. PRECAUCIONES EN LA CONDUCCIÓN; Recomendaciones generales, El tráfico, Detención para subida y bajada de ocupantes del vehículo, Conducción en curvas, Conducción en bajada, Conducción en subida, Conducción en hielo, Uso de cadenas, El clima, Lluvia, Neblina. Empleo correcto de luces: Código de luces, Señalización, Uso de luces altas y bajas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/26/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'III. PRECAUCIONES EN LA CONDUCCIÓN; Recomendaciones generales, El tráfico, Detención para subida y bajada de ocupantes del vehículo, Conducción en curvas, Conducción en bajada, Conducción en subida, Conducción en hielo, Uso de cadenas, El clima, Lluvia, Neblina. Empleo correcto de luces: Código de luces, Señalización, Uso de luces altas y bajas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
  ];
}

/**
 * spec 0018-m: malla del libro Conv. A-4 (`libroclasesconva4.pdf`, páginas 11-14), 23 filas en
 * 13 días de clase (CONV_BOOKS.A4.sessionDays). Mismo criterio que getConvA3Curriculum(): celdas
 * fusionadas repetidas por fila; 21 filas reutilizan textos ya corregidos de A2-A5; las filas
 * 15 y 18 tienen contenido propio. La fila 20 dice "...de transporte de pasajeros" en un libro
 * de carga: así viene en el real (igual que el A5 de la 0017-m), se deja como está por decisión
 * del dueño.
 */
function getConvA4Curriculum(): CurriculumRow[] {
  return [
    {
      fecha: '2/12/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'II. REGLAMENTO TRANSPORTE DE CARGA PELIGROSA DECRETO 298/95; Disposiciones preliminares. Los vehículos y su equipamiento. La carga, su acondicionamiento, estiba, descarga y manipulación. Circulación y estacionamiento. Prohibiciones y obligaciones del transportista. Fiscalización.',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/12/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'III. REGLAMENTO DE SEGURIDAD PARA ALMACENAMIENTO, TRANSPORTE Y EXPENDIO DE GAS LICUADO; Transporte de gas licuado en camiones. El personal de operación de los vehículos de transporte de gas licuado. Equipo de los estanques para gas licuado. Transporte de cilindros y condiciones generales para manipular los cilindros durante la carga y descarga. Dispositivos generales. El sistema de escape en camiones que transportan gas licuado.',
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/12/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'IV. MANIPULACIÓN DE CARGA Y ESTROBADO; Definiciones. Tipos de mercancías y recomendaciones para su embalaje. Tipos de mercancías y recomendaciones para su embalaje. Contenedores: definición, tipos de contenedores y sus respectivas identificación.',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/14/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'I. CHEQUEOS BÁSICOS; Carrocería. Limpieza. Verificaciones luego de poner en marcha el motor. Aplicar procedimientos para la revisión de: El puesto de trabajo del conductor, Posición de la palanca de cambio, Chapa de contacto: posición y efectos. Instrumentos del panel Luces de control interna y externas. Palancas e indicadores. Limpiadores de parabrisas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/15/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'I. CHEQUEOS BÁSICOS; Carrocería. Limpieza. Verificaciones luego de poner en marcha el motor. Aplicar procedimientos para la revisión de: El puesto de trabajo del conductor, Posición de la palanca de cambio, Chapa de contacto: posición y efectos. Instrumentos del panel Luces de control interna y externas. Palancas e indicadores. Limpiadores de parabrisas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/16/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'I. ESTABLECE CONDICIONES PARA EL TRANSPORTE DE CARGAS DECRETO N°75/87; Forma de transportar la carga, utilización de banderines, los extremos que puede sobrepasar la carga. El transporte de desperdicios, arena, ripio, tierra u otros materiales (líquidos o sólidos). El transporte de materiales que produzcan polvo, mal olor en zonas urbanas. Los vehículos destinados al transporte de alimentos. Prohibiciones. Los vehículos que transportan contenedores. Límite velocidad.',
      horas: '3 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/16/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'II. REGLAMENTO TRANSPORTE DE CARGA PELIGROSA DECRETO 298/95; Disposiciones preliminares. Los vehículos y su equipamiento. La carga, su acondicionamiento, estiba, descarga y manipulación. Circulación y estacionamiento. Prohibiciones y obligaciones del transportista. Fiscalización.',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/17/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'II. OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. Generalidades sobre los sistemas del vehículo y su incidencia en la conducción. La caja de cambios: Simple, automática. La aceleración del motor y la contaminación. El freno motor. El freno de estacionamiento o freno de mano. El freno de servicio o freno de pie. Los espejos retrovisores.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/18/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'II. OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. Generalidades sobre los sistemas del vehículo y su incidencia en la conducción. La caja de cambios: Simple, automática. La aceleración del motor y la contaminación. El freno motor. El freno de estacionamiento o freno de mano. El freno de servicio o freno de pie. Los espejos retrovisores.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/19/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'IV. MANIPULACIÓN DE CARGA Y ESTROBADO; Definiciones. Tipos de mercancías y recomendaciones para su embalaje. Tipos de mercancías y recomendaciones para su embalaje. Contenedores: definición, tipos de contenedores y sus respectivas identificación.',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/19/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'V. RESOLUCIÓN EX. N°1213/02. De la dirección del trabajo que "establece sistema obligatorio de control de asistencia, de las horas de trabajo y de descanso de la determinación de las remuneraciones para los conductores de vehículos de carga terrestre interurbano".',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/19/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'VI. REGLAMENTO DE SEGURIDAD PARA LAS INSTALACIONES Y OPERACIONES DE PRODUCCIÓN Y REFINACIÓN, ALMACENAMIENTO, DISTRIBUCIÓN Y ABASTECIMIENTO DE COMBUSTIBLES LÍQUIDOS. DECRETO N°160 DEL 07/07/09; Requisitos mínimos de seguridad que deben cumplir las instalaciones de combustibles líquidos derivados del petróleo y biocombustible, y las operaciones asociadas a la producción.',
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/21/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'CHEQUEOS BÁSICOS; Del conductor, cabina, exterior, chequeo de niveles, otros. Verificación de las condiciones del vehículo antes de poner en marcha el motor. OPERACIÓN DEL VEHÍCULO EN LA CONDUCCIÓN; Descripción desde el punto de vista del conductor. PRECAUCIONES EN LA CONDUCCIÓN; Recomendaciones generales. El tráfico. Detención para subidas y bajadas de ocupantes del vehículo. Conducción en curvas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/22/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'III. PRECAUCIONES EN LA CONDUCCIÓN; Recomendaciones generales, El tráfico, Detención para subida y bajada de ocupantes del vehículo, Conducción en curvas, Conducción en bajada, Conducción en subida, Conducción en hielo, Uso de cadenas, El clima, Lluvia, Neblina. Empleo correcto de luces: Código de luces, Señalización, Uso de luces altas y bajas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/23/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'CONDICIONES FÍSICAS ÓPTIMAS PARA CONDUCIR; Los tiempos de conducción. La mezcla del alcohol con la conducción: qué es el alcohol, cuáles son los efectos del alcohol en el organismo. Cuáles son las consecuencias en la conducción que produce el consumo de alcohol. La mezcla de las drogas con la conducción. Qué son las drogas, clasificación y efectos de las drogas, y efectos que provocan las drogas en la conducción.',
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/23/2022',
      asignatura: 'MECÁNICA',
      materias:
        'MANTENCIÓN DE VEHÍCULOS DE TRANSPORTE DE CARGA; Revisión del estado del vehículo: antes de poner en marcha el motor, con el motor en funcionamiento, después de estacionado y detenido el motor. Pruebas de funcionamiento. Normas de seguridad aplicada.',
      horas: '3 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/24/2022',
      asignatura: 'CONDUCCIÓN',
      materias:
        'III. PRECAUCIONES EN LA CONDUCCIÓN; Recomendaciones generales, El tráfico, Detención para subida y bajada de ocupantes del vehículo, Conducción en curvas, Conducción en bajada, Conducción en subida, Conducción en hielo, Uso de cadenas, El clima, Lluvia, Neblina. Empleo correcto de luces: Código de luces, Señalización, Uso de luces altas y bajas.',
      horas: '5 horas',
      profesor: 'JORGE PEREZ',
    },
    {
      fecha: '2/25/2022',
      asignatura: 'ASPECTOS PSICOLÓGICOS Y DE COMUNICACIÓN',
      materias:
        'CONDICIONES FÍSICAS ÓPTIMAS PARA CONDUCIR; Los tiempos de conducción. La mezcla del alcohol con la conducción: qué es el alcohol, cuáles son los efectos del alcohol en el organismo. Cuáles son las consecuencias en la conducción que produce el consumo de alcohol. La mezcla de las drogas con la conducción. Qué son las drogas, clasificación y efectos de las drogas, y efectos que provocan las drogas en la conducción.',
      horas: '2 horas',
      profesor: 'HORACIO LABBE',
    },
    {
      fecha: '2/25/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias:
        'CONDUCCIÓN SEGURA; Conducción a la defensiva. Condiciones adversas para la conducción. Conducción nocturna. Condiciones ambientales. Las curvas. Pendientes. Características del conductor defensivo. Factores para la conducción defensiva. Colisiones.',
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/25/2022',
      asignatura: 'PREVENCIÓN DE RIESGOS',
      materias:
        'COMBATE Y PREVENCIÓN DE INCENDIOS; El fuego y sus composiciones. Tipos de fuegos y formas de extinción. Tipo de extintores. Procedimientos a seguir en caso de incendio de vehículos de transporte de pasajeros.',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/26/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'VI. REGLAMENTO DE SEGURIDAD PARA LAS INSTALACIONES Y OPERACIONES DE PRODUCCIÓN Y REFINACIÓN, ALMACENAMIENTO, DISTRIBUCIÓN Y ABASTECIMIENTO DE COMBUSTIBLES LÍQUIDOS. DECRETO N°160 DEL 07/07/09; Requisitos mínimos de seguridad que deben cumplir las instalaciones de combustibles líquidos derivados del petróleo y biocombustible, y las operaciones asociadas a la producción.',
      horas: '1 hora',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/26/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'VII. REGLAMENTO GENERAL DE TRANSPORTE DE GANADO Y CARNE BOVINA. DECRETO SUPREMO N°240 DEL 26/10/93; Normas aplicables para el transporte de animales por vías públicas.',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
    {
      fecha: '2/26/2022',
      asignatura: 'TRANSPORTE DE CARGA',
      materias:
        'VIII. REGLAMENTO DE CONDICIONES PARA EL TRANSPORTE DE PRODUCTOS FORESTALES. DECRETO SUPREMO N°94/91; Condiciones aplicables al transporte por camión, remolque, semirremolque y vehículos especiales, que transiten por calles, caminos y demás vías públicas, o particulares destinadas al uso público, de los productos forestales.',
      horas: '2 horas',
      profesor: 'PABLO VARGAS',
    },
  ];
}

/**
 * Malla curricular por libro. Clase de licencia (A2-A5, spec 0017-m) o libro de convalidación
 * `CONV_A3` / `CONV_A4` (spec 0018-m). `null` = sin malla: el caller decide el fallback.
 */
function getCurriculum(bookKey: string): CurriculumRow[] | null {
  if (bookKey === 'A2') return getA2Curriculum();
  if (bookKey === 'A3') return getA3Curriculum();
  if (bookKey === 'A4') return getA4Curriculum();
  if (bookKey === 'A5') return getA5Curriculum();
  if (bookKey === 'CONV_A3') return getConvA3Curriculum();
  if (bookKey === 'CONV_A4') return getConvA4Curriculum();
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF Builder — Libro de Clases
// ══════════════════════════════════════════════════════════════════════════════

// fix-250-m: sin campos de resultados (notas/asistencia/firmas) — el Libro de Clases en
// PDF es una plantilla imprimible: trae alumnos, profesores y sesiones (para el layout),
// pero las secciones de resultados se dibujan vacías, listas para llenarse a mano.
interface ClassBookData {
  promo: { name: string; code: string; startDate: string; endDate: string };
  course: { name: string; code: string; licenseClass: string };
  /** spec 0018-m: null = libro normal; 'A3'/'A4' = libro de convalidación. */
  convalidation: 'A3' | 'A4' | null;
  /** Inicio/término del libro: los de la promoción, o los del tramo de convalidación. */
  courseStartDate: string | null;
  courseEndDate: string | null;
  branch: { name: string; address: string };
  senceCode: string;
  lecturers: { name: string; role: string | null }[];
  moduleNames: string[];
  enrollments: { id: number; numero: number; nombre: string; rut: string; telefono: string }[];
  theorySessions: { id: number; date: string; status: string }[];
}

async function buildClassBookPdf(d: ClassBookData): Promise<Uint8Array> {
  // spec 0017-m: tamaño medido del PDF real (libroclases.pdf) — MediaBox [0 0 1008 612],
  // Legal horizontal (14x8.5in). No es A4: no cambiar sin volver a medir el real.
  const W = 1008,
    H = 612;
  const ML = 40,
    MR = 40,
    MB = 40;
  const PW = W - ML - MR; // printable width

  // Logo desde Supabase Storage (bucket public "assets")
  const logo = await loadPngForPdf(
    'https://skvekggejikzxhzsjmkz.supabase.co/storage/v1/object/public/assets/chillan_capacita.png',
  );
  const logoH = 68;
  const logoW = logo ? Math.round((logo.width / logo.height) * logoH) : 0;

  // Smaller logo for inner pages
  const innerLogoH = 44;
  const innerLogoW = logo ? Math.round((logo.width / logo.height) * innerLogoH) : 0;

  const pages: string[] = [];
  let ops = '';
  let y = H - 40;

  /**
   * Draws a page header with logo (top-left) + centered bold title + thick separator.
   * Advances y to the content area below. Call right after NP().
   */
  const drawLogoHeader = (title: string, size = 12) => {
    if (logo) {
      ops += `q ${innerLogoW} 0 0 ${innerLogoH} ${ML} ${Math.round(y - innerLogoH)} cm /Im1 Do Q\n`;
    }
    // 2026-09-22 (feedback del dueño): el título quedaba muy pegado arriba, lejos de la
    // tabla -- se bajó hacia el borde inferior del logo (antes iba centrado en el medio),
    // sin tocar el espacio que sigue hasta el contenido de abajo.
    const titleY = Math.round(y - innerLogoH + size + 2);
    const halfW = Math.round((title.length * 0.68 * size) / 2);
    const cx = Math.round(W / 2);
    T(cx - halfW, titleY, title, 'F2', size);
    // 2026-09-22 (feedback del dueño): la línea gruesa bajo el header sobraba visualmente en
    // las tablas del libro -- se sacó, solo queda el logo + título.
    y -= innerLogoH + 10;
  };

  const NP = () => {
    pages.push(ops);
    ops = '';
    y = H - 40;
  };
  const need = (h: number) => {
    if (y - h < MB) NP();
  };

  const T = (x: number, yp: number, text: string, f: 'F1' | 'F2', size: number) => {
    ops += `BT /${f} ${size} Tf ${x} ${Math.round(yp)} Td (${esc(text)}) Tj ET\n`;
  };
  const HL = (yp: number, lw = 0.4, x1 = ML, x2 = W - MR) => {
    ops += `${lw} w ${x1} ${Math.round(yp)} m ${x2} ${Math.round(yp)} l S\n`;
  };
  const VL = (x: number, y1: number, y2: number, lw = 0.3) => {
    ops += `${lw} w ${Math.round(x)} ${Math.round(y1)} m ${Math.round(x)} ${Math.round(y2)} l S\n`;
  };
  const Rect = (x: number, yp: number, w: number, h: number) => {
    ops += `0.93 0.93 0.93 rg ${Math.round(x)} ${Math.round(yp)} ${Math.round(w)} ${Math.round(h)} re f 0 0 0 rg\n`;
  };
  // Set fill color (for text)
  const C = (r: number, g: number, b: number) => {
    ops += `${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)} rg\n`;
  };
  const K = () => {
    ops += `0 0 0 rg\n`;
  }; // reset to black

  // spec 0017-m (feedback del dueño): mismo mecanismo de justificado ya resuelto en
  // contract-pdf.ts — posicionar cada palabra a mano (Td relativo) en vez de depender del
  // operador `Tw`, que no todos los rasterizadores de PDF respetan. Envolver por ANCHO REAL
  // (`textWidth`), no por conteo de caracteres, para que cada línea llegue casi llena antes
  // de repartir el espacio sobrante entre palabras.
  const TJustifiedLine = (
    x: number,
    yp: number,
    line: string,
    size: number,
    targetWidth: number,
  ) => {
    const words = line.split(' ');
    if (words.length < 2) {
      T(x, yp, line, 'F1', size);
      return;
    }
    const wordWidths = words.map((w) => textWidth(w, size, false));
    const totalWordsWidth = wordWidths.reduce((a, b) => a + b, 0);
    const gap = (targetWidth - totalWordsWidth) / (words.length - 1);
    let block = `BT /F1 ${size} Tf ${x} ${Math.round(yp)} Td (${esc(words[0])}) Tj`;
    for (let i = 1; i < words.length; i++) {
      const dx = wordWidths[i - 1] + gap;
      block += ` ${dx.toFixed(3)} 0 Td (${esc(words[i])}) Tj`;
    }
    ops += block + ' ET\n';
  };

  /**
   * spec 0018-m (feedback del dueño 2026-09-24): texto de UNA línea para una celda de tabla de
   * alto fijo (drawGridTable). Parte en CELL_FONT; si no cabe en `maxWidth` (medido con el ancho
   * real, no por caracteres), achica de a 0.5pt hasta CELL_FONT_MIN; si aun así no cabe (nombre
   * extremadamente largo), corta con "..." — nunca se sale del borde de la celda.
   */
  const CELL_FONT = 10;
  const CELL_FONT_MIN = 7;
  const fitCellText = (text: string, maxWidth: number): { text: string; size: number } => {
    let size = CELL_FONT;
    while (size > CELL_FONT_MIN && textWidth(text, size, false) > maxWidth) size -= 0.5;
    if (textWidth(text, size, false) <= maxWidth) return { text, size };
    let cut = text;
    while (cut.length > 1 && textWidth(`${cut}...`, size, false) > maxWidth) cut = cut.slice(0, -1);
    return { text: `${cut.trimEnd()}...`, size };
  };

  const wrapToWidth = (text: string, maxWidth: number, size: number): string[] => {
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      // Palabra sola más ancha que la columna (ej. un apellido largo sin espacios, en una
      // columna angosta como PROFESOR) -- sin esto quedaba en su propia línea y se salía del
      // borde de la celda, porque el wrap normal solo corta entre palabras.
      if (textWidth(w, size, false) > maxWidth) {
        if (line) {
          lines.push(line);
          line = '';
        }
        let chunk = '';
        for (const ch of w) {
          const candidate = chunk + ch;
          // Reserva el ancho del guion en la medición -- así "trozo-" nunca se pasa de
          // maxWidth. El último trozo de la palabra no lleva guion (no es un corte, es el
          // final real de la palabra).
          if (chunk && textWidth(candidate + '-', size, false) > maxWidth) {
            lines.push(chunk + '-');
            chunk = ch;
          } else {
            chunk = candidate;
          }
        }
        line = chunk;
        continue;
      }
      const candidate = line ? `${line} ${w}` : w;
      if (line && textWidth(candidate, size, false) > maxWidth) {
        lines.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  /** Bloque de líneas justificadas a ambos márgenes, salvo la última (izquierda), igual que
   * el reglamento físico. */
  const drawJustifiedBlock = (lines: string[], size: number, lh: number, targetWidth: number) => {
    lines.forEach((line, i) => {
      const isLast = i === lines.length - 1;
      if (isLast) T(ML, y, line, 'F1', size);
      else TJustifiedLine(ML, y, line, size, targetWidth);
      y -= lh;
    });
  };

  /**
   * spec 0017-m (feedback del dueño): el real dibuja TODAS sus tablas como grilla completa
   * (bordes verticales + horizontales en cada celda) y siempre numera hasta `minRows` filas
   * (25), incluso sin alumno asignado a esa fila -- no es "tantas filas como alumnos", es una
   * plantilla imprimible de tamaño fijo. Este helper reemplaza los `HL()` sueltos que dejaban
   * las tablas sin líneas verticales (o directamente vacías) en Antecedentes, Asistencia
   * Semanal, Recuperación de Feriados, Evaluaciones y Resumen de Asistencia.
   */
  const drawGridTable = (opts: {
    title: string;
    subtitleLabel?: string;
    subtitleValue?: string;
    columns: { label: string; w: number }[];
    rowCount: number;
    rowH?: number;
    /** Texto de cada celda para la fila 1-based `rowNumber`. Debe incluir el N° si la
     * primera columna lo muestra -- el helper NO lo agrega solo. */
    cellText: (rowNumber: number) => string[];
  }) => {
    const rowH = opts.rowH ?? 16;
    const tableW = opts.columns.reduce((acc, c) => acc + c.w, 0);
    // Encabezados que no entran en una línea (ej. nombres largos de asignatura) se envuelven
    // por ancho real dentro de su propia columna -- la altura del header se ajusta al más alto.
    const headerLinesPerCol = opts.columns.map((col) => wrapToWidth(col.label, col.w - 8, 7.5));
    const headerLineCount = Math.max(1, ...headerLinesPerCol.map((l) => l.length));
    const headerRowH = Math.max(18, headerLineCount * 9 + 6);

    const drawTableHeader = () => {
      const hTop = y;
      Rect(ML, hTop - headerRowH, tableW, headerRowH);
      let x = ML;
      opts.columns.forEach((col, ci) => {
        headerLinesPerCol[ci].forEach((line, li) => {
          T(x + 4, hTop - 11 - li * 9, line, 'F2', 7.5);
        });
        x += col.w;
      });
      // Grilla del header: bordes verticales + horizontales.
      x = ML;
      for (let i = 0; i <= opts.columns.length; i++) {
        VL(x, hTop - headerRowH, hTop, 0.5);
        if (i < opts.columns.length) x += opts.columns[i].w;
      }
      HL(hTop, 0.6, ML, ML + tableW);
      HL(hTop - headerRowH, 0.6, ML, ML + tableW);
      y = hTop - headerRowH;
    };

    NP();
    drawLogoHeader(opts.title, 13);
    if (opts.subtitleLabel) {
      // Nota amigable (ej. fecha de inicio del curso) -- etiqueta gris + valor en negrita,
      // más prolija que la caja de Excel del real (feedback del dueño 2026-09-22).
      T(ML, y, opts.subtitleLabel, 'F1', 9);
      T(ML + textWidth(opts.subtitleLabel, 9, false) + 4, y, opts.subtitleValue ?? '', 'F2', 9);
      y -= 14;
    }
    drawTableHeader();

    for (let r = 1; r <= opts.rowCount; r++) {
      if (y - rowH < MB) {
        NP();
        drawLogoHeader(`${opts.title} (cont.)`, 13);
        drawTableHeader();
      }
      const rowTop = y;
      const values = opts.cellText(r);
      let x = ML;
      for (let c = 0; c < opts.columns.length; c++) {
        // spec 0018-m (feedback del dueño 2026-09-24): letra de celda más grande (10pt, antes 8pt)
        // y centrada en el alto de la fila; nunca se sale de la celda (ver fitCellText).
        const cell = fitCellText(values[c] ?? '', opts.columns[c].w - 8);
        T(x + 4, rowTop - (rowH + cell.size * 0.7) / 2, cell.text, 'F1', cell.size);
        x += opts.columns[c].w;
      }
      // Grilla de la fila: bordes verticales + horizontal inferior.
      x = ML;
      for (let i = 0; i <= opts.columns.length; i++) {
        VL(x, rowTop - rowH, rowTop, 0.3);
        if (i < opts.columns.length) x += opts.columns[i].w;
      }
      HL(rowTop - rowH, 0.3, ML, ML + tableW);
      y = rowTop - rowH;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1: PORTADA
  // ═══════════════════════════════════════════════════════════════════════════

  // spec 0017-m: la portada real (medida del .xlsx fuente, hoja LIBRO_A2 -- filas y alturas
  // exactas en puntos) NO es una grilla de tabla: es un formulario. Caja unica angosta (no
  // ocupa todo el ancho de la pagina), logo+titulo pegados a la izquierda dentro de la caja,
  // y cada campo es "ETIQUETA en negrita : valor con subrayado" -- sin lineas horizontales
  // ni verticales de grilla entre campos.
  // 2026-09-22 (feedback del dueño): la primera pasada quedó con texto chico y demasiado
  // espacio entre campos — el real es compacto y con texto grande. Sube tamaños de fuente y
  // baja las alturas de fila/relleno para que la densidad visual se acerque a la real.
  const boxX = ML + 60;
  const boxW = 700;
  const valueX = boxX + 224; // colon + inicio del valor (fijo, igual para todos los campos)
  const underlineEnd = boxX + boxW - 60;
  const headerH = 96;
  const bottomPad = 30;
  const labelSize = 11.5;
  const valueSize = 12;

  // "idSuffix": "ID:" + código en negrita, a un offset FIJO del inicio del valor (nunca
  // calculado a partir del ancho del texto del curso — un cálculo por caracter se desalineó
  // y quedó pisando el texto, ver captura del dueño 2026-09-22). El nombre del curso siempre
  // es corto ("CURSO PROFESIONAL CLASE A2"), así que un offset generoso nunca se solapa.
  const fields: {
    label: string;
    value: string;
    idSuffix?: { code: string; offset: number };
    h: number;
  }[] = [
    { label: 'NOMBRE DE LA AUTOESCUELA', value: d.branch.name, h: 30 },
    {
      label: 'NOMBRE E ID. ACTIVIDAD DE CAPACITACIÓN',
      // spec 0018-m: el libro de convalidación dice "CURSO CONVALIDACIÓN CLASE A-3/A-4",
      // igual que el real.
      value: d.convalidation
        ? `CURSO CONVALIDACIÓN CLASE A-${d.convalidation.slice(1)}`
        : `CURSO PROFESIONAL CLASE ${d.course.licenseClass}`,
      idSuffix: { code: d.course.code, offset: 260 },
      h: 42,
    },
    { label: 'CÓDIGO AUTORIZADO POR SENCE', value: d.senceCode || '—', h: 30 },
    // spec 0018-m: en convalidación, las fechas del tramo (no las de la promoción).
    { label: 'FECHA DE INICIO CURSO', value: fmtDate(d.courseStartDate), h: 30 },
    {
      label: 'FECHA DE TÉRMINO DE CURSO',
      value: fmtDate(d.courseEndDate),
      h: 30,
    },
    { label: 'LUGAR DE EJECUCIÓN', value: d.branch.address || '—', h: 30 },
    {
      label: 'HORARIO',
      value: 'Lunes a Viernes de 17:30 a 22:30 hrs. Sábado de 9:00 a 14:00 hrs.',
      h: 30,
    },
  ];

  // Centrada verticalmente en la página (el dueño la vio muy pegada arriba).
  const fieldsH = fields.reduce((acc, f) => acc + f.h, 0);
  const boxTotalH = headerH + fieldsH + bottomPad;
  const boxTop = Math.round((H + boxTotalH) / 2);
  const boxBot = boxTop - boxTotalH;

  // Caja unica (header + campos + relleno inferior, como en el real).
  ops += `1.2 w ${Math.round(boxX)} ${Math.round(boxBot)} ${boxW} ${Math.round(boxTop - boxBot)} re S\n`;

  // -- Logo + titulo, pegados a la izquierda dentro de la caja --
  const headerPadY = 6;
  if (logo) {
    ops += `q ${logoW} 0 0 ${logoH} ${Math.round(boxX + 8)} ${Math.round(boxTop - headerH + headerPadY)} cm /Im1 Do Q\n`;
  }
  const titleSize = 20;
  const titleX = boxX + 8 + logoW + 24;
  const titleY = Math.round(boxTop - headerH / 2 + titleSize / 2 - 3);
  const titleW = Math.round('LIBRO DE CONTROL DE CLASES'.length * 0.62 * titleSize);
  T(titleX, titleY, 'LIBRO DE CONTROL DE CLASES', 'F2', titleSize);
  HL(titleY - 4, 1, titleX, titleX + titleW);

  const labelCharsPerLine = Math.floor((valueX - boxX - 16) / (labelSize * 0.58));
  let fieldY = boxTop - headerH;
  for (const f of fields) {
    const textY = fieldY - 12;
    const labelLines = wrapLines(f.label, labelCharsPerLine);
    labelLines.forEach((line, i) => T(Math.round(boxX + 8), textY - i * 12, line, 'F2', labelSize));
    T(Math.round(valueX - 12), textY, ':', 'F2', labelSize);
    T(Math.round(valueX + 6), textY, f.value, 'F1', valueSize);
    if (f.idSuffix) {
      const idX = valueX + 6 + f.idSuffix.offset;
      T(Math.round(idX), textY, 'ID:', 'F2', labelSize);
      T(Math.round(idX + 26), textY, f.idSuffix.code, 'F2', valueSize);
    }
    HL(textY - 4, 0.6, valueX, underlineEnd);
    fieldY -= f.h;
  }

  y = boxBot;

  // spec 0017-m: el real no tiene pagina de "Profesores por modulo" ni "Lista de Clase" en
  // la portada -- el profesor aparece por bloque en el Calendario de Clases (Fase 3), y los
  // alumnos van en su propia pagina "Antecedentes de los Alumnos" tras el reglamento.
  // ═══════════════════════════════════════════════════════════════════════════
  // REGLAMENTO INTERNO OTEC
  // ═══════════════════════════════════════════════════════════════════════════

  // spec 0017-m (feedback del due\u00f1o): el ancho de wrap (130) y las fuentes (7/8) quedaron
  // calibradas para el ancho de p\u00e1gina viejo (A4, PW=762) \u2014 con el nuevo Legal (PW=928) el
  // texto solo ocupaba media hoja y quedaba min\u00fasculo. Recalibrado para usar el ancho
  // completo con fuente legible, igual que el real.
  NP();
  T(ML, y, 'REGLAMENTO INTERNO OTEC CONDUCTORES CHILL\u00c1N', 'F2', 14);
  y -= 20;

  // 2026-09-22 (feedback del due\u00f1o): el texto quedaba un poco chico y usaba todo el ancho de
  // la hoja \u2014 el real es levemente m\u00e1s grande y deja aire a la derecha. Si esto empuja el
  // reglamento a 4 p\u00e1ginas en vez de 3 no hay problema (as\u00ed lo pidi\u00f3 el due\u00f1o).
  const reglamentoBodySize = 10.5;
  const reglamentoHeaderSize = 11.5;
  const reglamentoWidth = PW - 90;

  // spec 0017-m (feedback del due\u00f1o): evitar que un T\u00cdTULO/Art\u00edculo quede hu\u00e9rfano al final
  // de una p\u00e1gina con su cuerpo reci\u00e9n en la siguiente \u2014 agrupamos cada encabezado con su
  // p\u00e1rrafo y medimos el bloque completo ANTES de imprimir, para saltar de p\u00e1gina como
  // unidad (nunca partiendo un encabezado de su contenido).
  const reglamento = getReglamentoText();
  const isHeader = (p: string) => p.startsWith('T\u00cdTULO') || p.startsWith('Art\u00edculo');
  const blocks: { headers: string[]; body: string | null }[] = [];
  for (const para of reglamento) {
    if (isHeader(para)) {
      const last = blocks[blocks.length - 1];
      if (last && last.body === null) last.headers.push(para);
      else blocks.push({ headers: [para], body: null });
    } else {
      const last = blocks[blocks.length - 1];
      if (last && last.body === null) last.body = para;
      else blocks.push({ headers: [], body: para });
    }
  }

  for (const block of blocks) {
    const bodyLines = block.body
      ? wrapToWidth(block.body, reglamentoWidth, reglamentoBodySize)
      : [];
    const blockH = block.headers.length * 15 + bodyLines.length * 13 + (bodyLines.length ? 5 : 0);
    need(Math.min(blockH, H - 40 - MB));

    for (const header of block.headers) {
      T(ML, y, header, 'F2', reglamentoHeaderSize);
      y -= 15;
    }
    drawJustifiedBlock(bodyLines, reglamentoBodySize, 13, reglamentoWidth);
    if (bodyLines.length) y -= 5;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTECEDENTES DE LOS ALUMNOS
  // ═══════════════════════════════════════════════════════════════════════════

  drawGridTable({
    title: 'ANTECEDENTES DE LOS ALUMNOS',
    columns: [
      { label: 'N°', w: 30 },
      { label: 'APELLIDOS, NOMBRE', w: 300 },
      { label: 'RUN', w: 120 },
      { label: 'NIVEL DE ESCOLARIDAD', w: 160 },
      { label: 'TELÉFONO', w: 120 },
      { label: 'FIRMA', w: PW - 30 - 300 - 120 - 160 - 120 },
    ],
    rowCount: Math.max(d.enrollments.length, 25),
    cellText: (r) => {
      const e = d.enrollments[r - 1];
      // Teléfono queda en blanco (feedback del dueño 2026-09-22) -- solo se pidió precargar
      // nombre; RUN quedó porque ya era parte del AC3 original, teléfono se saca.
      return e ? [`${r}`, e.nombre, e.rut, '', '', ''] : [`${r}`, '', '', '', '', ''];
    },
  });

  // ===========================================================================
  // ASISTENCIA SEMANAL
  // ===========================================================================

  const sessions = d.theorySessions ?? [];
  if (sessions.some((s) => s.status !== 'cancelled')) {
    // Group sessions by week (include cancelled to render them as 'C')
    const weekMap = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const mon = getMondayForDate(s.date);
      if (!weekMap.has(mon)) weekMap.set(mon, []);
      weekMap.get(mon)!.push(s);
    }
    // Remove weeks where ALL sessions are cancelled
    for (const [mon, ws] of weekMap) {
      if (ws.every((s) => s.status === 'cancelled')) weekMap.delete(mon);
    }

    let weekNum = 0;
    // spec 0017-m: el real usa 7 columnas (Lunes a Domingo) -- el domingo siempre se marca
    // "DOMINGO" y cualquier dia sin sesion programada (feriado/descanso) se marca "LIBRE",
    // no solo los cancelados explicitamente. Grilla completa y 25 filas fijas (feedback del
    // dueño 2026-09-22) -- no solo tantas filas como alumnos.
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const nameW = 230;
    const sigW = 72; // suficiente para "FIRMA SEMANAL" sin desbordar la columna
    const dayW = Math.floor((PW - 28 - nameW - sigW) / 7);

    for (const [monday, weekSessions] of weekMap) {
      weekNum++;
      const dias: string[] = [];
      for (let i = 0; i < 7; i++) {
        const dt = new Date(monday + 'T12:00:00');
        dt.setDate(dt.getDate() + i);
        dias.push(dt.toISOString().split('T')[0]);
      }

      drawGridTable({
        title: `CONTROL DE ASISTENCIA DE ALUMNOS (FIRMA DIARIA) — Semana ${weekNum}`,
        // Solo en la primera semana: fecha de inicio del curso (más amigable que la caja
        // de Excel del real, pedido del dueño 2026-09-22). El rango de fechas por semana ya
        // se ve en las cabeceras de columna, así que no hace falta repetirlo aparte.
        ...(weekNum === 1
          ? { subtitleLabel: 'Inicio del curso:', subtitleValue: fmtDate(d.courseStartDate) }
          : {}),
        columns: [
          { label: 'N°', w: 28 },
          { label: 'APELLIDO, NOMBRE', w: nameW },
          ...dayNames.map((dn, i) => ({
            label: `${dn} ${fmtShort(dias[i])}`,
            w: dayW,
          })),
          { label: 'FIRMA SEMANAL', w: sigW },
        ],
        rowCount: Math.max(d.enrollments.length, 25),
        cellText: (r) => {
          const e = d.enrollments[r - 1];
          const days = dias.map((date, di) => {
            if (di === 6) return 'DOMINGO';
            // spec 0018-m: en el libro de convalidación, los días de la semana que quedan
            // fuera del tramo (antes del inicio o después del término) van con "-", como en
            // la página 7 del real; solo los días DENTRO del tramo sin clase son "LIBRE".
            if (
              d.convalidation &&
              ((d.courseStartDate && date < d.courseStartDate) ||
                (d.courseEndDate && date > d.courseEndDate))
            ) {
              return '-';
            }
            const hasSession = weekSessions.some(
              (s) => s.date === date && s.status !== 'cancelled',
            );
            // Plantilla imprimible: si hay sesion la marca de asistencia se llena a mano.
            return hasSession ? '' : 'LIBRE';
          });
          return [`${r}`, e?.nombre ?? '', ...days, ''];
        },
      });
    }
  }

  // ===========================================================================
  // RECUPERACION DE FERIADOS
  // ===========================================================================

  // spec 0018-m (AC6): el libro real de convalidación no tiene esta página.
  if (!d.convalidation) {
    const dateColW = 90;
    const sigColW = 220;
    const dateColCount = 5;
    const nameW2 = PW - 28 - dateColW * dateColCount - sigColW;

    drawGridTable({
      title: 'CONTROL DE ASISTENCIA DE ALUMNOS (Recuperación de Feriados)',
      // spec 0017-m (feedback del dueño): con el alto de fila por defecto (16pt) la tabla de
      // 25 filas + header casi agotaba el alto de página, dejando muy poco espacio libre -- el
      // recuadro de notas se empujaba a una hoja aparte en vez de quedar debajo, como en el
      // real. 14pt libera margen suficiente (verificado: quedan ~25pt de sobra tras el chequeo
      // de espacio del recuadro, antes faltaban ~16pt).
      rowH: 14,
      columns: [
        { label: 'N°', w: 28 },
        { label: 'APELLIDOS, NOMBRE', w: nameW2 },
        ...Array.from({ length: dateColCount }, () => ({
          label: '',
          w: dateColW,
        })),
        { label: 'FIRMA CONFORMIDAD ALUMNO', w: sigColW },
      ],
      rowCount: Math.max(d.enrollments.length, 25),
      cellText: (r) => {
        const e = d.enrollments[r - 1];
        return [`${r}`, e?.nombre ?? '', ...Array(dateColCount + 1).fill('')];
      },
    });

    y -= 20;
    need(50);
    const notas = [
      'NOTA 1: los participantes deberán firmar al menos una vez a la semana y al finalizar el proceso de capacitación, acreditando con ello la asistencia registrada en el presente formulario de control.',
      'NOTA 2: la nomenclatura a utilizar deberá corresponder a la siguiente: / presente; X ausente; Xa atrasado; F feriado; L libre.',
      'NOTA 3: la asistencia deberá ser registrada como máximo a los 20 minutos del comienzo del horario formal de clases.',
    ];
    ops += `1 w ${ML} ${Math.round(y - notas.length * 22 - 6)} ${PW} ${notas.length * 22 + 12} re S\n`;
    y -= 10;
    for (const nota of notas) {
      for (const line of wrapLines(nota, 150)) {
        need(11);
        T(ML + 6, y, line, 'F1', 8);
        y -= 11;
      }
    }
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDARIO DE CLASES
  // ═══════════════════════════════════════════════════════════════════════════
  // spec 0017-m (corrección del dueño, 2026-09-23; cuarta ronda): el Libro de Clases
  // es una plantilla imprimible -- lo único que se precarga desde la BD son alumnos
  // (nombre/RUN) y feriados. El contenido (asignatura/materias/horas/profesor) es la
  // malla curricular FIJA verbatim del libro real (`getCurriculum()`) -- NUNCA sale de
  // `professional_theory_sessions`. Las FECHAS sí salen de ahí (fecha+status, nunca
  // contenido): esa tabla ya se genera acotada al rango real start/end de la promoción
  // con los feriados reales marcados `cancelled` (`promociones.facade.ts
  // crearPromocion()`), así que sus fechas activas son los días de clase reales, en
  // orden. Cada bloque de la malla (agrupado por día del libro real vía
  // `groupIntoSessionBlocks()` -- un día puede traer 1-4 filas de materia distinta,
  // igual que el real) se asigna, en orden, a la siguiente fecha activa real.
  //
  // NO se inventan días LIBRE (se probaron y descartaron dos variantes -- ver
  // tasks.md de esta spec para el historial completo):
  // 1. Offset fijo de días del libro 2022: no conocía los feriados reales del curso
  //    actual ni respetaba `promo.endDate` (bug real: clase cayó un 12 de octubre
  //    feriado, calendario se extendió al 31/10 con la promoción terminando el 26/10).
  // 2. Sábado siempre LIBRE: el dueño confirmó que el patrón de días libres del libro
  //    2022 es 100% una elección manual de quien armó ESA cohorte (código de
  //    asignatura tecleado a mano en el Excel fuente, sin fórmula ni feriado real
  //    detrás -- verificado celda por celda). Además, el propio dueño (don Jorge)
  //    confirmó que el horario real del negocio es lunes a sábado, 6 clases por
  //    semana -- forzar "sábado = LIBRE" taparía una clase real que sí existe en
  //    nuestros cursos con la palabra LIBRE. Nuestro sistema no tiene el concepto de
  //    "día de descanso programático"; solo feriados reales pausan una fecha.

  {
    const curriculum = getCurriculum(
      d.convalidation ? `CONV_${d.convalidation}` : d.course.licenseClass,
    );
    const colN = 25,
      colFecha = 65,
      colAsig = 130,
      colHoras = 55,
      colProf = 85;
    const colMaterias = PW - colN - colFecha - colAsig - colHoras - colProf;
    // spec 0017-m (feedback del dueño): con 8pt/10pt entraban 14 filas por hoja -- en el real
    // entran ~6, se ve chico y apretado en papel real. Subir fuente + interlineado (y el
    // padding/mínimo de rowH más abajo) para acercar la densidad visual al real, sin tocar el
    // ancho de columnas (el wrap ya se recalcula solo al cambiar rowFont).
    const rowFont = 10,
      rowLH = 16;

    // spec 0017-m (fix visual, corrección del dueño): a diferencia de las demás tablas del
    // documento (drawGridTable, alto de fila fijo), acá el alto de fila es variable -- lo
    // define MATERIAS, que puede necesitar hasta 5 líneas. Anclar todo el texto a un offset
    // fijo desde el tope de la fila (`rowTop - 11`) dejaba las columnas de una sola línea
    // (N°/FECHA/HORAS/PROFESOR) pegadas arriba, lejos del centro visual de la celda -- se ve
    // mal en filas altas y no calza con el real (que sí centra verticalmente el contenido
    // corto dentro de la celda alta). Centra el bloque de texto de `lineCount` líneas dentro
    // de `rowH`; con lineCount=1 y rowH=16 (fila mínima) da exactamente `rowTop - 11`, igual
    // que antes -- no cambia el caso ya correcto.
    const centeredBaseline = (rowTop: number, rowH: number, lineCount: number) => {
      const textBlockH = lineCount * rowLH;
      const topPad = Math.max(0, (rowH - textBlockH) / 2);
      return rowTop - topPad - (rowLH - 2);
    };

    const drawCalendarHeader = (title: string) => {
      NP();
      drawLogoHeader(title, 14);
      // Todo relativo a hTop (tope del rect), nunca a la `y` ambiente -- la versi\u00f3n anterior
      // dibujaba el rect en base a `hTop = y + 2` pero el TEXTO segu\u00eda en la `y` original, que
      // quedaba a solo 2pt del borde superior del rect (casi pegado arriba, en vez de centrado
      // en las 18pt de alto) -- por eso se ve\u00eda "flotando" aunque el rect ya tocaba la fila 1.
      const headerRowH = 18;
      const hTop = y + 2;
      const textY = hTop - 12; // centrado vertical de una l\u00ednea de 9pt dentro de 18pt
      Rect(ML, hTop - headerRowH, PW, headerRowH);
      let hx = ML;
      T(hx + 4, textY, 'N\u00b0', 'F2', 9);
      hx += colN;
      T(hx + 4, textY, 'FECHA', 'F2', 9);
      hx += colFecha;
      T(hx + 4, textY, 'ASIGNATURA', 'F2', 9);
      hx += colAsig;
      T(hx + 4, textY, 'MATERIAS', 'F2', 9);
      hx += colMaterias;
      T(hx + 4, textY, 'HORAS', 'F2', 9);
      hx += colHoras;
      T(hx + 4, textY, 'PROFESOR', 'F2', 9);

      // Bordes del header (verticales + horizontal arriba/abajo) -- mismo patrón que
      // drawTableHeader() de drawGridTable(). Sin esto el header se ve "pegado" arriba de la
      // tabla en vez de fusionado, porque las demás tablas del documento sí lo dibujan.
      let vx = ML;
      for (const w of [colN, colFecha, colAsig, colMaterias, colHoras, colProf]) {
        VL(vx, hTop - headerRowH, hTop, 0.5);
        vx += w;
      }
      VL(vx, hTop - headerRowH, hTop, 0.5);
      HL(hTop, 0.6, ML, ML + PW);
      HL(hTop - headerRowH, 0.6, ML, ML + PW);

      y = hTop - headerRowH;
    };

    let rowIndex = 0;
    const drawCalendarRow = (
      fechaLabel: string,
      asignatura: string,
      materias: string,
      horas: string,
      profesor: string,
    ) => {
      rowIndex++;
      const asigLines = wrapToWidth(asignatura, colAsig - 8, rowFont);
      const materiasLines = wrapToWidth(materias, colMaterias - 8, rowFont);
      // Nombres largos ("ALBERTO ORMEÑO", "HORACIO LABBE") no caben en 85pt a 10pt -- se
      // detectó en el PDF real (feedback del dueño). En vez de agrandar la columna a costa de
      // MATERIAS, envuelve igual que ASIGNATURA/MATERIAS.
      const profLines = wrapToWidth(profesor, colProf - 8, rowFont);
      const lineCount = Math.max(asigLines.length, materiasLines.length, profLines.length, 1);
      const rowH = Math.max(26, lineCount * rowLH + 10);

      if (y - rowH < MB) {
        drawCalendarHeader('CALENDARIO DE CLASES (cont.)');
      }

      const rowTop = y;
      const singleLineY = centeredBaseline(rowTop, rowH, 1);
      const asigBaseline = centeredBaseline(rowTop, rowH, asigLines.length);
      const materiasBaseline = centeredBaseline(rowTop, rowH, materiasLines.length);
      const profBaseline = centeredBaseline(rowTop, rowH, profLines.length);
      let cx = ML;
      T(cx + 4, singleLineY, `${rowIndex}`, 'F1', rowFont);
      cx += colN;
      T(cx + 4, singleLineY, fechaLabel, 'F1', rowFont);
      cx += colFecha;
      asigLines.forEach((line, li) => T(cx + 4, asigBaseline - li * rowLH, line, 'F1', rowFont));
      cx += colAsig;
      materiasLines.forEach((line, li) =>
        T(cx + 4, materiasBaseline - li * rowLH, line, 'F1', rowFont),
      );
      cx += colMaterias;
      T(cx + 4, singleLineY, horas, 'F1', rowFont);
      cx += colHoras;
      profLines.forEach((line, li) => T(cx + 4, profBaseline - li * rowLH, line, 'F1', rowFont));

      // Grilla de la fila: verticales + horizontal inferior.
      let vx = ML;
      for (const w of [colN, colFecha, colAsig, colMaterias, colHoras, colProf]) {
        VL(vx, rowTop - rowH, rowTop, 0.3);
        vx += w;
      }
      VL(vx, rowTop - rowH, rowTop, 0.3);
      HL(rowTop - rowH, 0.3, ML, ML + PW);
      y = rowTop - rowH;
    };

    drawCalendarHeader('CALENDARIO DE CLASES');

    if (curriculum) {
      const blocks = groupIntoSessionBlocks(curriculum);
      const activeDatesSorted = sessions
        .filter((s) => s.status !== 'cancelled')
        .map((s) => s.date)
        .sort();

      blocks.forEach((block, bi) => {
        const fechaLabel = activeDatesSorted[bi] ? fmtDate(activeDatesSorted[bi]) : '\u2014';
        block.forEach((row) =>
          drawCalendarRow(fechaLabel, row.asignatura, row.materias, row.horas, row.profesor),
        );
      });

      if (activeDatesSorted.length < blocks.length) {
        need(16);
        T(
          ML,
          y - 11,
          `Aviso: la malla tiene ${blocks.length} bloques de clase pero el curso solo tiene ${activeDatesSorted.length} sesiones activas programadas -- faltan fechas por asignar (marcadas "\u2014").`,
          'F1',
          8,
        );
        y -= 16;
      }
    } else {
      // A3/A4/A5: malla curricular todavía no transcrita verbatim (ver tasks.md de
      // spec 0017-m). Fila única visible en vez de simular sesiones de la BD.
      need(16);
      T(
        ML + colN + colFecha + 4,
        y - 11,
        'Pendiente de transcripción verbatim para esta clase.',
        'F1',
        rowFont,
      );
      y -= 16;
    }
  }

  // ===========================================================================
  // EVALUACIONES
  // ===========================================================================

  // spec 0018-m: 7 asignaturas en un libro normal, 5 en convalidación (moduleNames ya viene
  // resuelto). Todas las columnas mantienen el ancho del libro normal y en convalidación la
  // tabla simplemente termina antes, igual que en el real (libroclasesconva3/4.pdf p. 16: la
  // tabla llega a x=702 en vez de x=818, con las mismas columnas). NOTA FINAL no absorbe el
  // espacio sobrante (feedback del dueño 2026-09-24).
  const evalModW = 66;
  const evalNotaFinalW = PW - 25 - 215 - 7 * evalModW;
  drawGridTable({
    title: 'EVALUACIONES CLASE PROFESIONAL',
    columns: [
      { label: 'N°', w: 25 },
      { label: 'APELLIDO, NOMBRE', w: 215 },
      // spec 0017-m (confirmado por el dueño 2026-09-22): columnas por nombre de asignatura
      // real, no "Mód. N" — mismo orden y nombres que usa getModuleNames() para el
      // Calendario, verificado contra los libros reales de A2/A3/A4/A5.
      ...d.moduleNames.map((name) => ({ label: name, w: evalModW })),
      { label: 'NOTA FINAL', w: evalNotaFinalW },
    ],
    rowCount: Math.max(d.enrollments.length, 25),
    // Plantilla imprimible: notas y nota final se llenan a mano.
    cellText: (r) => {
      const e = d.enrollments[r - 1];
      return [`${r}`, e?.nombre ?? '', ...Array(d.moduleNames.length + 1).fill('')];
    },
  });

  // ===========================================================================
  // RESUMEN ASISTENCIA
  // ===========================================================================

  drawGridTable({
    title: 'ASISTENCIA CLASE PROFESIONAL',
    columns: [
      { label: 'N°', w: 30 },
      { label: 'APELLIDO, NOMBRE', w: 300 },
      { label: '% ASISTENCIA CLASE PRÁCTICA', w: 180 },
      { label: '% ASISTENCIA CLASE TEÓRICA', w: 180 },
      { label: 'FIRMA CONFORMIDAD ALUMNO (NOTAS Y ASISTENCIA)', w: PW - 30 - 300 - 180 - 180 },
    ],
    rowCount: Math.max(d.enrollments.length, 25),
    // Plantilla imprimible: los porcentajes y la firma se llenan a mano.
    cellText: (r) => {
      const e = d.enrollments[r - 1];
      return [`${r}`, e?.nombre ?? '', '', '', ''];
    },
  });

  // Commit last page
  pages.push(ops);
  return assemblePdf(pages, W, H, logo ?? undefined);
}

function pickLecturer(
  lecturers: { name: string; role: string | null }[],
  moduleNumber: number,
): string {
  if (lecturers.length === 0) return '\u2014';
  if (lecturers.length === 1) return lecturers[0].name;
  const pref = moduleNumber === 6 ? 'practice' : 'theory';
  return (
    lecturers.find((l) => l.role === pref) ??
    lecturers.find((l) => l.role === 'both') ??
    lecturers[0]
  ).name;
}

// ══════════════════════════════════════════════════════════════════════════════
// Reglamento Interno OTEC (texto estático)
// ══════════════════════════════════════════════════════════════════════════════

function getReglamentoText(): string[] {
  // spec 0017-m: texto verbatim transcrito de libroclases.pdf (paginas 2-5), sin parafrasear.
  return [
    'TÍTULO I — DISPOSICIONES GENERALES',
    'Artículo N° 1. Ámbito del Reglamento',
    'El presente Reglamento es el conjunto de normas que regula las actividades de capacitación en CONDUCTORES CHILLÁN así como los deberes y derechos del cliente o participante.',
    'Artículo N° 2. Definiciones',
    'Para los propósitos de este reglamento, se aplican las definiciones indicadas en la NCh 2728 y adicionalmente las siguientes: a) Jornadas Abiertas: Actividades de capacitación ofertadas directamente al mercado por parte de CONDUCTORES CHILLÁN; b) Jornadas Cerradas: Actividades de capacitación solicitadas explícitamente por el cliente a CONDUCTORES CHILLÁN, con características específicas acorde a sus necesidades o dirigidas a cierto grupo de participantes.',
    'Artículo N° 3. Responsabilidad OTEC',
    'La responsabilidad sobre la planificación, aplicación y evaluación de las actividades de capacitación contenidas en el programa de capacitación corresponden a CONDUCTORES CHILLÁN.',
    'Artículo N° 4. Calidad',
    'CONDUCTORES CHILLÁN se compromete a velar por la calidad del servicio ofrecido. Sometiéndose a lo establecido en la norma chilena de calidad NCh 2728 of2003.',
    'TÍTULO II — DE LOS PROGRAMAS',
    'Artículo N° 5.',
    'Los relatores o profesores deberán aplicar y desarrollar íntegramente los programas de capacitación aprobados por CONDUCTORES CHILLÁN y/o el cliente.',
    'Artículo N° 6.',
    'Cada relator deberá dar a conocer a sus alumnos el programa establecido al comienzo de la actividad de capacitación, explicando, en rasgos generales, el contenido de las materias que comprende cada unidad programática, los objetivos que se pretenden alcanzar, la bibliografía que se empleará y la forma y fechas de evaluación.',
    'TÍTULO III — DE LA INSCRIPCIÓN',
    'Artículo N° 7.',
    'La Inscripción es el proceso en virtud del cual un cliente se incorpora CONDUCTORES CHILLÁN en un determinado programa de Capacitación de jornadas abiertas.',
    'Artículo N° 8.',
    'CONDUCTORES CHILLÁN garantiza que ha adoptado las medidas organizativas y técnicas necesarias para mantener el nivel de seguridad requerido en atención a la naturaleza de los datos personales tratados durante la inscripción. Y, en ningún caso, se cederán los datos a terceros.',
    'TÍTULO IV — DE LA EVALUACIÓN DE LOS PARTICIPANTES',
    'Artículo N° 9.',
    'La evaluación es toda actividad tendiente a medir el grado o nivel de logro de un participante respecto de los aprendizajes esperados en cada actividad de capacitación necesaria para acceder a la acreditación respectiva. Si se aplicara la evaluación, corresponderá al relator a cargo de la actividad de capacitación determinar las oportunidades, condiciones, ponderaciones e instrumentos conforme a los cuales se realizará la evaluación.',
    'Artículo N° 10.',
    'Son instrumentos de evaluación: las pruebas escritas, interrogaciones orales, trabajos de grupo o individuales, informes de trabajos en terreno, resultados de experiencias de talleres y laboratorios, controles bibliográficos y otras actividades análogas que permiten valorar el rendimiento del participante.',
    'Artículo N° 11.',
    'Las evaluaciones se aplicarán dentro del horario y calendario que determine el relator encargado de la actividad de capacitación. Los alumnos tienen derecho a conocer las notas y correcciones de toda evaluación dentro de un plazo máximo de siete días hábiles, contados desde la fecha de la respectiva evaluación.',
    'TÍTULO V — DE LA ASISTENCIA',
    'Artículo N° 12.',
    'Se entiende por asistencia la comparecencia física del participante en las diversas actividades de carácter teórico y/o práctico, indicadas por el relator al inicio de una actividad de capacitación. La asistencia se registrará en una planilla destinada para tal objeto.',
    'Artículo N° 13.',
    'La asistencia es obligatoria. Es requisito esencial para aprobar una determinada actividad de capacitación (jornada abierta o cerrada), haber asistido al mínimo de clases o actividades establecidas en el programa de capacitación respectivo. En caso de no establecerse en éste el mínimo antes referido, el participante deberá asistir a lo menos al setenta y cinco por ciento (75%) de las actividades efectivamente realizadas.',
    'Artículo N° 14.',
    'Cualquier inasistencia deberá justificarse documentadamente ante el relator encargado de la actividad de capacitación, en un plazo no superior a tres (3) días hábiles contados desde la fecha de inicio de la causa de impedimento. La aceptación de esta petición permitirá al participante cumplir, posteriormente, con los controles evaluativos realizados durante su ausencia, de acuerdo a la fecha y contenido que establezca el relator encargado.',
    'Artículo N° 15.',
    'Se considerarán causales válidas para justificar una inasistencia: a) Problema de salud del participante justificado mediante certificado médico. b) Otras causales cuya resolución corresponderá a la jefatura de CONDUCTORES CHILLÁN.',
    'TÍTULO VI — DE LAS CALIFICACIONES',
    'Artículo N° 16.',
    'Se realizarán evaluaciones con una escala del 10 al 100. La nota setenta y cinco (75) corresponderá a la nota mínima de aprobación de una actividad, en caso de no establecerse en el programa de capacitación. La nota final deberá expresarse hasta con un decimal, elevando la centésima igual o superior a cinco (5) a la décima inmediatamente superior.',
    'Artículo N° 17.',
    'El participante inasistente a un control evaluativo, deberá justificar debidamente su inasistencia en un plazo no superior a tres (3) días hábiles, contado desde la fecha del control. La inasistencia injustificada a una evaluación será calificada con la nota diez (10).',
    'Artículo N° 18.',
    'Todo acto realizado por un participante que vicie su evaluación, será sancionado con la suspensión inmediata del control y con la aplicación de la nota mínima (10). El relator encargado entregará los antecedentes a la jefatura de CONDUCTORES CHILLÁN para aplicar medidas disciplinarias.',
    'Artículo N° 19.',
    'Para la aprobación de los alumnos se considerará el rendimiento y/o la asistencia a las actividades programadas. Sin perjuicio de lo anterior, en aquellos casos de participantes que no alcancen el porcentaje establecido en el Artículo N° 16 por razones justificadas, podrá solicitarse la reconsideración de su caso.',
    'TÍTULO VII — DEL RÉGIMEN DISCIPLINARIO',
    'Artículo N° 20.',
    'Los clientes de CONDUCTORES CHILLÁN deberán respetar y cumplir las disposiciones del presente Reglamento. Los participantes tendrán el deber de mantener, durante todo el servicio de capacitación, una conducta compatible con la sana convivencia; el respeto a las personas y sus bienes; y a los principios y valores de CONDUCTORES CHILLÁN. Constituirán infracción a los citados deberes, los actos que vicien de cualquier forma las evaluaciones; la agresión física o verbal hacia otras personas; la adulteración o falsificación de títulos, certificados u otros documentos oficiales; la destrucción o daño de bienes personales o institucionales; el consumo, porte o distribución de bebidas alcohólicas, drogas u otras sustancias prohibidas o peligrosas y el ingreso a los recintos o la participación en actividades institucionales bajo sus efectos; y, en general, toda otra acción que contravenga los deberes señalados. CONDUCTORES CHILLÁN se guarda el derecho a negar el servicio de capacitación cuando, quien asista cometa las infracciones anteriormente señaladas.',
    'Artículo N° 21.',
    'El Organismo Técnico de Capacitación, solicita a quienes se inscriban en una determinada actividad de capacitación, llegar puntualmente, considerándose hasta 15 minutos después de iniciada, como período límite apropiado para ingresar al salón. Se solicita a los participantes mantener los teléfonos móviles apagados o sin volumen durante las actividades de capacitación, a fin de no interrumpir o distraer al relator y/o a los demás participantes a la actividad.',
    'TÍTULO VIII — DEL PAGO POR CONCEPTO DE CAPACITACIÓN',
    'Artículo N° 22.',
    'Los costos asociados a las actividades de capacitación contemplan la forma prevista en el párrafo 4° de la Ley N° 19.518.',
    'Artículo N° 23.',
    'El valor del programa es fijado de acuerdo a la cantidad de horas de duración, y las condiciones requeridas para impartir la actividad.',
    'Artículo N° 24.',
    'El pago del valor del programa se podrá efectuar bajo alguna de las siguientes formas: a) Pago total al contado. b) Pago mediante depósito en cuenta corriente. c) Pago con cheque cruzado. Empresas y personas que requieran otra forma de pago, deberán solicitarlo durante el proceso de inscripción. En el caso de descuentos por número de participantes, la empresa cancelará el total del curso menos el descuento respectivo. Dicho descuento está disponible y puede ser solicitado a CONDUCTORES CHILLÁN en cualquier momento.',
    'Artículo N° 25.',
    'Toda anulación de inscripción a jornadas abiertas (una vez inscritas) cualquiera sea la causal, deberá informarse por escrito 72 horas hábiles antes del inicio de la actividad, de lo contrario, obliga al pago del 100% del valor de la actividad.',
    'Artículo N° 26.',
    'La renuncia a jornadas cerradas (una vez formalizada la aceptación de la cotización) cualquiera sea la causal, deberá informarse por escrito 7 días hábiles antes del inicio de la actividad, lo cual dará derecho a una devolución del 60% del valor de la actividad, de lo contrario, obliga al pago del 100% del valor de la actividad.',
    'Artículo N° 27.',
    'El participante puede manifestar de manera formal, su descontento con la actividad de capacitación, detallando las razones por las que no ha quedado conforme con el servicio, para ello tiene a su disposición la Ficha de Evaluación, donde podrá expresar su parecer. También, puede dirigirse directamente a la oficina central de CONDUCTORES CHILLÁN y expresar verbalmente su descontento en cualquier etapa del servicio a la Jefatura de la empresa. En caso justificado, previa conversación con el cliente, se le hará la devolución parcial o total del pago por la actividad.',
    'TÍTULO IX — DISPOSICIONES GENERALES',
    'Artículo N° 28.',
    'Todo participante deberá tener, al momento de su inscripción en CONDUCTORES CHILLÁN y durante toda su capacitación, salud y conducta compatibles con su programa y con la normal convivencia.',
    'Artículo N° 29.',
    'Las personas, empresas, OTIC y cualquier organismo vinculado con cualquiera de los servicios de capacitación impartidos por CONDUCTORES CHILLÁN, declaran conocer y aceptar el presente documento al momento de firmar y enviar la ficha de inscripción disponible en www.conductoreschillan.cl y en la oficina central de la empresa, o bien al enviar su propia orden de compra.',
    'Artículo N° 30.',
    'Las situaciones no previstas en el presente Reglamento serán resueltas por la Gerencia General de CONDUCTORES CHILLÁN.',
  ];
}
