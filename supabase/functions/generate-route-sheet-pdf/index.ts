// supabase/functions/generate-route-sheet-pdf/index.ts
//
// Edge Function: generate-route-sheet-pdf
//
// Genera la Hoja de Ruta Diaria (RF-091) de un vehículo en PDF on-demand — planilla en
// blanco con la grilla horaria REAL de bloques de clase (13 bloques de 45 min, 08:30–20:45,
// leídos de `courses.schedule_blocks`) para que alumno/instructor registren rutina,
// kilometraje y firma en papel. Reemplaza `buildRouteSheetHtml` (HTML client-side, ver
// fix-134-b + spec 0011-m). **Corrección post-migración (2026-08-23):** el util original
// hardcodeaba una grilla de 11 horas en punto (08:00–18:00) que nunca coincidió con el
// horario real de clases Clase B (13 bloques exactos de 45 min con pausas, ver
// `20260513000001_class_b_schedule_exact_slots.sql`) — bug heredado, detectado en QA visual
// del usuario tras esta migración, corregido acá leyendo `schedule_blocks` en vez de
// replicar la grilla fija. Nunca se almacena — siempre refleja los datos actuales del
// vehículo, mismo patrón que `generate-enrollment-sheet`.
//
// Invocación desde el frontend:
//   const { data, error } = await supabase.functions.invoke('generate-route-sheet-pdf', {
//     body: { vehicle_id: 42 }
//   })
//   // data es un Blob con el PDF
// @ts-nocheck

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { escapePdfWinAnsi as esc, assemblePdf, textWidth } from '../_shared/pdf-utils.ts';

// ─── CORS ───────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { vehicle_id } = await req.json();

    if (!vehicle_id || typeof vehicle_id !== 'number') {
      return jsonErr('vehicle_id (number) is required', 400);
    }

    // JWT del usuario invocante — RLS `select_vehicles`/`select_instructors` ya cubre lo
    // que este documento necesita mostrar (ver AC-E1, plan.md §4).
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
      },
    );

    const { data: vehicle, error: vehicleErr } = await supabase
      .from('vehicles')
      .select(
        `id, license_plate, brand, model, branch_id, both_branches,
         vehicle_assignments(instructor_id, end_date, instructors(users(first_names, paternal_last_name)))`,
      )
      .eq('id', vehicle_id)
      .single();

    if (vehicleErr || !vehicle) {
      return jsonErr(`Vehicle ${vehicle_id} not found`, 404);
    }

    let branchLabel: string | null = null;
    if (vehicle.both_branches) {
      branchLabel = 'Ambas';
    } else if (vehicle.branch_id) {
      const { data: branch } = await supabase
        .from('branches')
        .select('name')
        .eq('id', vehicle.branch_id)
        .maybeSingle();
      branchLabel = branch?.name ?? null;
    }

    const activeAssignment = (vehicle.vehicle_assignments ?? []).find(
      (a: any) => a.end_date === null,
    );
    let instructorName: string | null = null;
    if (activeAssignment) {
      const userRaw = activeAssignment.instructors?.users;
      const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
      if (user) instructorName = `${user.first_names} ${user.paternal_last_name}`.trim();
    }

    // Horario real de bloques de clase Clase B — uniforme entre cursos/sedes (ver
    // 20260513000001_class_b_schedule_exact_slots.sql, "Nuevos horarios L-V (ambas sedes)").
    // Se toma cualquier curso class_b activo como representante; si no hay ninguno (BD
    // recién creada sin seed), se usa el DEFAULT canónico de la columna como respaldo.
    const { data: courseRow } = await supabase
      .from('courses')
      .select('schedule_blocks')
      .eq('type', 'class_b')
      .eq('active', true)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    const scheduleBlocks: ScheduleBlock[] =
      courseRow?.schedule_blocks && courseRow.schedule_blocks.length > 0
        ? courseRow.schedule_blocks
        : DEFAULT_SCHEDULE_BLOCKS;

    const pdfBytes = buildRouteSheetPdf({
      licensePlate: vehicle.license_plate,
      vehicleLabel: `${vehicle.brand ?? ''} ${vehicle.model ?? ''}`.trim() || null,
      instructorName,
      branchLabel,
      scheduleBlocks,
    });

    const safeName = sanitize(`Hoja_de_Ruta_${vehicle.license_plate ?? vehicle_id}`);
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error('generate-route-sheet-pdf error:', err);
    return jsonErr(err instanceof Error ? err.message : 'Internal server error', 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PDF Builder
// ══════════════════════════════════════════════════════════════════════════════

interface ScheduleBlock {
  from: string;
  to: string;
}

interface RouteSheetData {
  licensePlate: string | null;
  vehicleLabel: string | null;
  instructorName: string | null;
  branchLabel: string | null;
  scheduleBlocks: ScheduleBlock[];
}

// Respaldo si no hay ningún curso class_b activo en BD — mismo valor que el DEFAULT de
// `courses.schedule_blocks` (20260513000001_class_b_schedule_exact_slots.sql), no una grilla
// inventada aparte.
const DEFAULT_SCHEDULE_BLOCKS: ScheduleBlock[] = [
  { from: '08:30', to: '09:15' },
  { from: '09:20', to: '10:05' },
  { from: '10:10', to: '10:55' },
  { from: '11:00', to: '11:45' },
  { from: '11:50', to: '12:35' },
  { from: '12:40', to: '13:25' },
  { from: '15:00', to: '15:45' },
  { from: '15:50', to: '16:35' },
  { from: '16:40', to: '17:25' },
  { from: '17:30', to: '18:15' },
  { from: '18:20', to: '19:05' },
  { from: '19:10', to: '19:55' },
  { from: '20:00', to: '20:45' },
];

function buildRouteSheetPdf(data: RouteSheetData): Uint8Array {
  const W = 595;
  const H = 842;
  const M = 50;
  const contentW = W - 2 * M;
  const ops: string[] = [];
  let y = H - 60;

  const text = (x: number, yPos: number, str: string, size: number, bold = false) => {
    const font = bold ? 'F2' : 'F1';
    ops.push(`BT /${font} ${size} Tf ${x} ${yPos} Td (${esc(str)}) Tj ET`);
  };
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  const rect = (x: number, yPos: number, w: number, h: number, fill = false) =>
    ops.push(`${x} ${yPos} ${w} ${h} re ${fill ? 'f' : 'S'}`);
  const setGray = (g: number) => ops.push(`${g} g ${g} G`);
  const resetColor = () => ops.push('0 g 0 G');

  // ── Header ───────────────────────────────────────────────────────────────
  text(M, y, 'AUTOESCUELA CHILLÁN', 14, true);
  text(W - M - 150, y, `Sede: ${data.branchLabel ?? '_____________'}`, 9);
  y -= 14;
  text(W - M - 150, y, 'Fecha: ____/____/______', 9);
  y -= 10;
  line(M, y, W - M, y);
  y -= 20;

  text(M + contentW / 2 - 90, y, 'HOJA DE RUTA DIARIA', 13, true);
  y -= 24;

  // ── Datos del vehículo ──────────────────────────────────────────────────
  const plate = data.licensePlate
    ? `${data.licensePlate}${data.vehicleLabel ? ` (${data.vehicleLabel})` : ''}`
    : '_____________';
  text(M, y, `Vehículo / Patente: ${plate}`, 9, true);
  text(M + 300, y, `Instructor a cargo: ${data.instructorName ?? '_____________'}`, 9, true);
  y -= 16;
  text(M, y, 'Kilometraje Inicial: _____________', 9, true);
  text(M + 300, y, 'Kilometraje Final: _____________', 9, true);
  y -= 20;

  // ── Tabla horaria ────────────────────────────────────────────────────────
  const cols = [62, 128, 160, 65, 80]; // HORA, ALUMNO, RUTINA, KM FINAL, FIRMA — HORA ensanchada para "HH:MM-HH:MM"
  const headers = ['HORA', 'ALUMNO', 'RUTINA / ACTIVIDAD', 'KM FINAL', 'FIRMA'];
  const rowH = 32;

  setGray(0.88);
  rect(M, y - 14, contentW, 14, true);
  resetColor();
  let xCur = M;
  headers.forEach((h, i) => {
    text(xCur + 3, y - 10, h, 8, true);
    xCur += cols[i];
  });
  y -= 14;
  line(M, y, W - M, y);

  for (const block of data.scheduleBlocks) {
    const horaLabel = `${block.from}-${block.to}`;
    const horaX = M + (cols[0] - textWidth(horaLabel, 8, true)) / 2;
    text(horaX, y - rowH / 2 - 3, horaLabel, 8, true);
    xCur = M;
    for (const w of cols) {
      line(xCur, y, xCur, y - rowH);
      xCur += w;
    }
    line(xCur, y, xCur, y - rowH);
    y -= rowH;
    line(M, y, W - M, y);
  }
  line(M, y + rowH * data.scheduleBlocks.length, M, y);
  line(W - M, y + rowH * data.scheduleBlocks.length, W - M, y);

  // ── Observaciones ───────────────────────────────────────────────────────
  y -= 16;
  text(M, y, 'OBSERVACIONES / FALLAS MECÁNICAS DETECTADAS:', 9, true);
  rect(M, y - 90, contentW, 80);

  return assemblePdf([ops.join('\n')], W, H);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 80);
}

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
