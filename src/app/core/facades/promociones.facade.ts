import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import type {
  PromocionTableRow,
  PromocionCursoRow,
  PromocionCursoRelator,
  PromocionAlumno,
  PromocionStatus,
  RelatorOption,
  CrearPromocionPayload,
  EditarPromocionPayload,
} from '@core/models/ui/promocion-table.model';
import { licenseClassToSuffix } from '@core/utils/license-suffix.utils';
import { computePromotionEndDate } from '@core/utils/promotion-end-date.utils';

@Injectable({ providedIn: 'root' })
export class PromocionesFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);

  // ── Estado privado ──────────────────────────────────────────────────────────
  private readonly _promociones = signal<PromocionTableRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _isSubmitting = signal(false);
  private readonly _selectedPromocion = signal<PromocionTableRow | null>(null);
  private readonly _relatoresDisponibles = signal<RelatorOption[]>([]);
  private readonly _professionalCourses = signal<{ id: number; code: string; name: string }[]>([]);
  private readonly _cursoStudents = signal<Record<number, PromocionAlumno[]>>({});
  private readonly _isLoadingStudents = signal(false);
  private readonly _holidaysCheckFailed = signal(false);
  private _initialized = false;

  // ── Estado público ──────────────────────────────────────────────────────────
  readonly promociones = this._promociones.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly selectedPromocion = this._selectedPromocion.asReadonly();
  readonly relatoresDisponibles = this._relatoresDisponibles.asReadonly();
  readonly professionalCourses = this._professionalCourses.asReadonly();
  readonly cursoStudents = this._cursoStudents.asReadonly();
  readonly isLoadingStudents = this._isLoadingStudents.asReadonly();
  /** true si el último fetch de feriados falló (DNS/red/CORS/5xx) — end_date pudo calcularse sin feriados reales. */
  readonly holidaysCheckFailed = this._holidaysCheckFailed.asReadonly();

  // ── KPIs ────────────────────────────────────────────────────────────────────
  readonly totalPromociones = computed(() => this._promociones().length);
  readonly planificadas = computed(
    () => this._promociones().filter((p) => p.status === 'planned').length,
  );
  readonly enCurso = computed(
    () => this._promociones().filter((p) => p.status === 'in_progress').length,
  );
  readonly canceladas = computed(
    () => this._promociones().filter((p) => p.status === 'cancelled').length,
  );
  readonly totalAlumnos = computed(() =>
    this._promociones().reduce((sum, p) => sum + p.totalEnrolled, 0),
  );

  // ── SWR: initialize ─────────────────────────────────────────────────────────
  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await this.fetchData();
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Sede activa para el scope de queries (fix-090).
   * admin → respeta el selector; secretaria → su sede (misconfig → ninguna fila).
   */
  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  private async fetchData(): Promise<void> {
    const branchId = this.getActiveBranchId();

    // 1. Fetch promotions with courses, lecturers
    let query = this.supabase.client
      .from('professional_promotions')
      .select(
        `id, code, name, start_date, end_date, max_students, status, created_at,
         promotion_courses (
           id, course_id, max_students, status,
           courses!inner ( id, code, name, is_convalidation ),
           promotion_course_lecturers (
             id, lecturer_id, role,
             lecturers!inner ( id, first_names, paternal_last_name, maternal_last_name, specializations )
           )
         )`,
      )
      .not('status', 'eq', 'finished')
      .order('start_date', { ascending: false });

    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { data, error } = await query;

    if (error) throw error;

    // 2. Fetch enrolled counts per promotion_course from enrollments
    const allPcIds = (data as any[]).flatMap((p) =>
      (p.promotion_courses ?? []).map((pc: any) => pc.id),
    );
    let enrolledCounts: Record<number, number> = {};
    if (allPcIds.length > 0) {
      const { data: enrollData } = await this.supabase.client
        .from('enrollments')
        .select('promotion_course_id')
        .in('promotion_course_id', allPcIds)
        .not('status', 'in', '("cancelled","draft")');
      if (enrollData) {
        enrolledCounts = enrollData.reduce((acc: Record<number, number>, e: any) => {
          acc[e.promotion_course_id] = (acc[e.promotion_course_id] ?? 0) + 1;
          return acc;
        }, {});
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._promociones.set((data as any[]).map((p) => this.mapToRow(p, enrolledCounts)));
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchData();
    } catch {
      // datos stale siguen visibles
    }
  }

  // ── Selección para drawers ──────────────────────────────────────────────────
  selectPromocion(promo: PromocionTableRow): void {
    this._selectedPromocion.set(promo);
    this._cursoStudents.set({});
    void this.loadStudentsForPromocion(promo);
  }

  // ── Cargar alumnos por curso de una promoción ─────────────────────────────
  async loadStudentsForPromocion(promo: PromocionTableRow): Promise<void> {
    const pcIds = promo.cursos.map((c) => c.id);
    if (pcIds.length === 0) return;

    this._isLoadingStudents.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('enrollments')
        .select(
          `id, status, promotion_course_id,
           students!inner (
             id,
             users!inner ( first_names, paternal_last_name, maternal_last_name, rut )
           )`,
        )
        .in('promotion_course_id', pcIds)
        .not('status', 'in', '("cancelled","draft")');

      if (error) throw error;

      const map: Record<number, PromocionAlumno[]> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of data as any[]) {
        const pcId = row.promotion_course_id as number;
        const u = row.students?.users;
        if (!u) continue;
        const nombre = [u.paternal_last_name, u.maternal_last_name, u.first_names]
          .filter(Boolean)
          .join(' ');
        const parts = nombre.trim().split(' ');
        const initials = parts
          .filter((_: string, i: number) => i === 0 || i === parts.length - 1)
          .map((p: string) => p[0]?.toUpperCase() ?? '')
          .join('');

        if (!map[pcId]) map[pcId] = [];
        map[pcId].push({
          enrollmentId: row.id,
          studentId: row.students.id,
          nombre,
          rut: u.rut ?? '',
          initials: initials || '?',
          enrollmentStatus: row.status,
        });
      }
      for (const pcId of Object.keys(map)) {
        map[Number(pcId)].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      }
      this._cursoStudents.set(map);
    } catch {
      this._cursoStudents.set({});
    } finally {
      this._isLoadingStudents.set(false);
    }
  }

  // ── Cargar relatores disponibles (para crear/editar) ────────────────────────
  async loadRelatoresDisponibles(): Promise<void> {
    if (this._relatoresDisponibles().length > 0) return;
    const { data, error } = await this.supabase.client
      .from('lecturers')
      .select('id, first_names, paternal_last_name, maternal_last_name, specializations')
      .eq('active', true)
      .order('paternal_last_name');

    if (error) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._relatoresDisponibles.set(
      (data as any[]).map((l) => {
        const nombre = [l.first_names, l.paternal_last_name, l.maternal_last_name]
          .filter(Boolean)
          .join(' ');
        const parts = nombre.trim().split(' ');
        const initials = parts
          .filter((_, i: number) => i === 0 || i === parts.length - 1)
          .map((p: string) => p[0]?.toUpperCase() ?? '')
          .join('');
        return {
          id: l.id,
          nombre,
          initials: initials || '?',
          specializations: l.specializations ?? [],
        };
      }),
    );
  }

  // ── Cargar cursos profesionales (para crear) ────────────────────────────────
  async loadProfessionalCourses(): Promise<void> {
    if (this._professionalCourses().length > 0) return;
    const { data, error } = await this.supabase.client
      .from('courses')
      .select('id, code, name')
      .eq('type', 'professional')
      .eq('is_convalidation', false)
      .order('code');

    if (error) return;
    this._professionalCourses.set(
      (data as { id: number; code: string; name: string }[]).map((c) => ({
        id: c.id,
        code: this.extractLicenseCode(c.code),
        name: this.extractCourseName(c.code, c.name),
      })),
    );
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────
  /**
   * Calcula el `end_date` real de una promoción que arrancaría en `startDate`, aplicando
   * la recuperación de feriados (AC6). Usado por el preview del drawer ANTES de guardar —
   * `crearPromocion()` recalcula lo mismo internamente, así que el valor coincide siempre.
   */
  async previewEndDate(startDate: string): Promise<string> {
    const holidays = await this.fetchHolidaysForYears(startDate);
    return computePromotionEndDate(startDate, new Set(holidays));
  }

  async crearPromocion(payload: CrearPromocionPayload): Promise<boolean> {
    this._isSubmitting.set(true);
    try {
      // 1. Fetch feriados (por año, ANTES del insert) y calcular end_date extendido (AC6).
      //    No se puede filtrar por end_date todavía: aún no existe, depende de este cálculo.
      const holidays = await this.fetchHolidaysForYears(payload.startDate);
      const endDate = computePromotionEndDate(payload.startDate, new Set(holidays));

      // 2. Crear la promoción
      const { data: promo, error: promoError } = await this.supabase.client
        .from('professional_promotions')
        .insert({
          name: payload.name,
          start_date: payload.startDate,
          end_date: endDate,
          status: 'planned',
          current_day: 0,
          branch_id: this.getActiveBranchId(),
        })
        .select('id')
        .single();

      if (promoError) throw promoError;

      // 3. Crear los cursos
      const createdPcIds: number[] = [];
      for (const curso of payload.cursos) {
        const { data: pc, error: pcError } = await this.supabase.client
          .from('promotion_courses')
          .insert({
            promotion_id: promo.id,
            course_id: curso.courseId,
            max_students: 25,
            status: 'planned',
          })
          .select('id')
          .single();

        if (pcError) throw pcError;
        createdPcIds.push(pc.id);

        // 4. Asignar relatores al curso
        if (curso.lecturerIds.length > 0) {
          const lecturerRows = curso.lecturerIds.map((lid) => ({
            promotion_course_id: pc.id,
            lecturer_id: lid,
            role: null,
          }));
          const { error: lError } = await this.supabase.client
            .from('promotion_course_lecturers')
            .insert(lecturerRows);
          if (lError) throw lError;
        }
      }

      // 5. Cancelar sesiones que caen en feriados dentro del rango ya extendido
      const holidaysInRange = holidays.filter((d) => d >= payload.startDate && d <= endDate);
      if (holidaysInRange.length > 0) {
        await Promise.all(
          createdPcIds.map((pcId) => this.cancelHolidaySessions(pcId, holidaysInRange)),
        );
        this.toast.info(
          `Se marcaron automáticamente ${holidaysInRange.length} feriado(s) como sesiones canceladas.`,
        );
      }

      this.toast.success('Promoción creada correctamente');
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error al crear promoción';
      this.toast.error(msg);
      return false;
    } finally {
      this._isSubmitting.set(false);
    }
  }

  // ── Feriados chilenos (apis.digital.gob.cl, con respaldo api.boostr.cl) ───────
  /**
   * Devuelve las fechas (YYYY-MM-DD) de feriados desde `startDate` en adelante, para el/los
   * año(s) calendario que la promoción podría llegar a cubrir (~35-40 días) — no se puede
   * acotar por `endDate` porque ese valor todavía no existe, depende de este resultado (AC6).
   * Marca `holidaysCheckFailed` en true solo si NINGUNA fuente respondió para algún año del
   * rango (fix-139) — en ese caso, retorna [] sin bloquear la creación de la promoción.
   */
  private async fetchHolidaysForYears(startDate: string): Promise<string[]> {
    const anchor = new Date(`${startDate}T12:00:00`);
    const startYear = anchor.getFullYear();
    // Solo cruza a un 2º año calendario si arranca en diciembre (rango ~35-40 días).
    const years = anchor.getMonth() === 11 ? [startYear, startYear + 1] : [startYear];

    const perYear = await Promise.all(years.map((year) => this.fetchHolidaysForYear(year)));
    this._holidaysCheckFailed.set(perYear.some((r) => r === null));

    return perYear.flatMap((r) => r ?? []).filter((d) => d >= startDate);
  }

  /**
   * Intenta la API oficial del gobierno (`apis.digital.gob.cl`); si falla (DNS/red/CORS/5xx),
   * reintenta con `api.boostr.cl` como respaldo. `null` indica que AMBAS fuentes fallaron
   * para ese año (fix-139 — `apis.digital.gob.cl` quedó inalcanzable en producción).
   */
  private async fetchHolidaysForYear(year: number): Promise<string[] | null> {
    try {
      const resp = await fetch(`https://apis.digital.gob.cl/fl/feriados/${year}`);
      if (resp.ok) {
        const data = (await resp.json()) as { fecha: string }[];
        return data.map((f) => f.fecha);
      }
    } catch {
      // sigue al respaldo
    }

    try {
      const resp = await fetch(`https://api.boostr.cl/holidays.json?year=${year}&country=CL`);
      if (resp.ok) {
        const json = (await resp.json()) as { data: { date: string }[] };
        return json.data.map((f) => f.date);
      }
    } catch {
      // ambas fuentes fallaron
    }

    return null;
  }

  /**
   * Marca como 'cancelled' todas las sesiones (teóricas y prácticas) de un
   * promotion_course que coincidan con alguna fecha de la lista de feriados.
   */
  private async cancelHolidaySessions(pcId: number, holidays: string[]): Promise<void> {
    await Promise.all([
      this.supabase.client
        .from('professional_theory_sessions')
        .update({ status: 'cancelled' })
        .eq('promotion_course_id', pcId)
        .in('date', holidays),
      this.supabase.client
        .from('professional_practice_sessions')
        .update({ status: 'cancelled' })
        .eq('promotion_course_id', pcId)
        .in('date', holidays),
    ]);
  }

  async editarPromocion(id: number, payload: EditarPromocionPayload): Promise<boolean> {
    this._isSubmitting.set(true);
    try {
      const { error } = await this.supabase.client
        .from('professional_promotions')
        .update({ name: payload.name, code: payload.code, status: payload.status })
        .eq('id', id);

      if (error) throw error;

      if (/^\d+$/.test(payload.code)) {
        await this.propagateCodeToCourses(id, payload.code);
      }

      this.toast.success('Promoción actualizada correctamente');
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al actualizar promoción';
      this.toast.error(msg);
      return false;
    } finally {
      this._isSubmitting.set(false);
    }
  }

  /**
   * Propaga el ID numérico MTT de la promoción a cada uno de sus cursos:
   * promotion_courses.code = "{promoCode}.{sufijo de licencia}" (ej. "156.2" para A2).
   */
  private async propagateCodeToCourses(promotionId: number, promoCode: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('promotion_courses')
      .select('id, courses!inner(license_class)')
      .eq('promotion_id', promotionId);

    if (error || !data) return;

    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data as any[]).map((pc) => {
        const suffix = licenseClassToSuffix(pc.courses.license_class ?? '');
        return this.supabase.client
          .from('promotion_courses')
          .update({ code: `${promoCode}.${suffix}` })
          .eq('id', pc.id);
      }),
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private extractLicenseCode(code: string): string {
    const m = code.match(/[Aa]([2-5])/);
    return m ? `A${m[1]}` : code.slice(0, 4).toUpperCase();
  }

  private extractCourseName(code: string, name: string): string {
    const map: Record<string, string> = {
      A2: 'Taxis y colectivos',
      A3: 'Buses',
      A4: 'Carga simple',
      A5: 'Carga',
    };
    const licCode = this.extractLicenseCode(code);
    return map[licCode] ?? name;
  }

  private getStatusLabel(status: string | null): string {
    const labels: Record<string, string> = {
      planned: 'Planificada',
      in_progress: 'En curso',
      finished: 'Finalizada',
      cancelled: 'Cancelada',
    };
    return labels[status ?? ''] ?? 'Sin estado';
  }

  /**
   * Cuenta días de clase (lun-sáb) transcurridos entre start_date y hoy.
   * Retorna 0 si la promoción aún no empieza, max 30.
   */
  private computeClassDays(startDateIso: string): number {
    const start = new Date(startDateIso + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today < start) return 0;

    let count = 0;
    const cursor = new Date(start);
    while (cursor <= today && count < 30) {
      const dow = cursor.getDay(); // 0=Sun, 1=Mon ... 6=Sat
      if (dow >= 1 && dow <= 6) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return Math.min(count, 30);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToRow(p: any, enrolledCounts: Record<number, number>): PromocionTableRow {
    const cursos: PromocionCursoRow[] = (p.promotion_courses ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((pc: any) => {
        const courseCode = this.extractLicenseCode(pc.courses.code);
        const relatores: PromocionCursoRelator[] = (pc.promotion_course_lecturers ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((pcl: any) => {
            const l = pcl.lecturers;
            const nombre = [l.first_names, l.paternal_last_name, l.maternal_last_name]
              .filter(Boolean)
              .join(' ');
            const parts = nombre.trim().split(' ');
            const initials = parts
              .filter((_: string, i: number) => i === 0 || i === parts.length - 1)
              .map((w: string) => w[0]?.toUpperCase() ?? '')
              .join('');
            return {
              id: pcl.id,
              lecturerId: pcl.lecturer_id,
              nombre,
              initials: initials || '?',
              role: pcl.role ?? null,
              specializations: l.specializations ?? [],
            };
          });
        return {
          id: pc.id,
          courseCode,
          courseName: this.extractCourseName(pc.courses.code, pc.courses.name),
          courseId: pc.course_id,
          enrolledStudents: enrolledCounts[pc.id] ?? 0,
          maxStudents: pc.max_students ?? 25,
          relatores,
        };
      })
      .sort((a: PromocionCursoRow, b: PromocionCursoRow) =>
        a.courseCode.localeCompare(b.courseCode),
      );

    const totalEnrolled = cursos.reduce((sum, c) => sum + c.enrolledStudents, 0);
    const currentDay =
      p.status === 'in_progress'
        ? this.computeClassDays(p.start_date)
        : p.status === 'finished'
          ? 30
          : 0;

    return {
      id: p.id,
      code: p.code ?? '',
      name: p.name ?? '',
      startDate: p.start_date,
      endDate: p.end_date ?? '',
      status: (p.status as PromocionStatus) ?? 'planned',
      statusLabel: this.getStatusLabel(p.status),
      currentDay,
      maxStudents: p.max_students ?? 100,
      totalEnrolled,
      cursos,
    };
  }
}
