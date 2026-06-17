import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import type { ProfessionalModuleGrade } from '@core/models/dto/professional-module-grade.model';
import type {
  CeldaNota,
  FilaEvaluacion,
  GrillaEvaluacion,
  PromocionConCursos,
} from '@core/models/ui/evaluaciones-profesional.model';
import type { PromocionOption, CursoOption } from '@core/models/ui/sesion-profesional.model';
import {
  calcAverage,
  getModuleNames,
  isPassing,
  MODULE_COUNT,
  roundGrade,
} from '@core/utils/professional-modules';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import {
  buildLanding,
  type CourseLite,
  type EnrollmentLite,
  type GradeLite,
  type PromotionLite,
} from '@core/utils/evaluaciones-landing';

/** Fila cruda de Supabase: enrollment + datos del alumno */
interface EnrollmentRow {
  id: number;
  students: {
    users: {
      first_names: string;
      paternal_last_name: string;
      maternal_last_name: string | null;
      rut: string;
    };
  };
}

@Injectable({ providedIn: 'root' })
export class EvaluacionesProfesionalFacade {
    private readonly sanitizer = inject(ErrorSanitizerService);
private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthFacade);

  // ── Estado privado ──────────────────────────────────────────────────────────
  private readonly _promociones = signal<PromocionOption[]>([]);
  private readonly _cursos = signal<CursoOption[]>([]);
  private readonly _landing = signal<PromocionConCursos[]>([]);
  private readonly _landingLoaded = signal(false);
  private readonly _selectedPromocionId = signal<number | null>(null);
  private readonly _selectedCursoId = signal<number | null>(null);
  private readonly _grilla = signal<GrillaEvaluacion | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _isSaving = signal(false);
  private readonly _error = signal<string | null>(null);

  // ── Estado público ──────────────────────────────────────────────────────────
  readonly promociones = this._promociones.asReadonly();
  readonly cursos = this._cursos.asReadonly();
  /** Aterrizaje: promociones activas (padre) con sus cursos resumidos. */
  readonly landing = this._landing.asReadonly();
  /** true tras la primera carga del aterrizaje (para distinguir vacío real de "cargando"). */
  readonly landingLoaded = this._landingLoaded.asReadonly();
  readonly selectedPromocionId = this._selectedPromocionId.asReadonly();
  readonly selectedCursoId = this._selectedCursoId.asReadonly();
  readonly grilla = this._grilla.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hayDirty = computed(() => {
    const g = this._grilla();
    if (!g) return false;
    return g.filas.some((f) => f.notas.some((n) => n.dirty));
  });

  readonly grillaConfirmada = computed(() => this._grilla()?.confirmed ?? false);

  // ── Carga de selectores ─────────────────────────────────────────────────────

  async loadPromociones(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('professional_promotions')
      .select('id, name, code, status')
      .in('status', ['planned', 'in_progress'])
      .order('start_date', { ascending: false });

    if (error) {
      this._error.set('Error cargando promociones');
      return;
    }

    this._promociones.set(
      (data ?? []).map((p) => ({
        id: p.id,
        name: p.name ?? p.code ?? `Promoción #${p.id}`,
        code: p.code ?? '',
        status: p.status ?? '',
      })),
    );
  }

  /**
   * Carga el aterrizaje: promociones activas (padre) con sus cursos resumidos.
   * Solo consulta promociones `planned`/`in_progress` y arma el resumen por curso
   * con una función pura. No carga históricas (escala a miles sin renderizarlas).
   */
  async loadLanding(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      // 1. Promociones activas (padre)
      const { data: promoData, error: promoErr } = await this.supabase.client
        .from('professional_promotions')
        .select('id, name, code, status')
        .in('status', ['planned', 'in_progress'])
        .order('start_date', { ascending: false });
      if (promoErr) throw new Error('Error cargando promociones');

      const promotions: PromotionLite[] = (promoData ?? []).map((p) => ({
        id: p.id,
        name: p.name ?? p.code ?? `Promoción #${p.id}`,
        code: p.code ?? '',
        status: p.status ?? '',
      }));

      // Espejo para los selectores legacy (compatibilidad con flujo de grilla).
      this._promociones.set(
        promotions.map((p) => ({ id: p.id, name: p.name, code: p.code, status: p.status })),
      );

      if (promotions.length === 0) {
        this._landing.set([]);
        return;
      }

      const promoIds = promotions.map((p) => p.id);

      // 2. Cursos de esas promociones
      const { data: pcData, error: pcErr } = await this.supabase.client
        .from('promotion_courses')
        .select('id, promotion_id, courses!inner(name, license_class)')
        .in('promotion_id', promoIds);
      if (pcErr) throw new Error('Error cargando cursos');

      const courses: CourseLite[] = (pcData ?? []).map((pc) => {
        const course = pc.courses as unknown as { name: string; license_class: string };
        return {
          promotionCourseId: pc.id,
          promotionId: pc.promotion_id,
          courseCode: course.license_class,
          courseName: course.name,
        };
      });

      const promotionCourseIds = courses.map((c) => c.promotionCourseId);

      // 3. Matrículas activas de esos cursos
      const enrollments: EnrollmentLite[] = [];
      if (promotionCourseIds.length > 0) {
        const { data: enrData, error: enrErr } = await this.supabase.client
          .from('enrollments')
          .select('id, promotion_course_id')
          .in('promotion_course_id', promotionCourseIds)
          .in('status', ['active', 'completed']);
        if (enrErr) throw new Error('Error cargando matrículas');
        for (const e of enrData ?? []) {
          enrollments.push({ id: e.id, promotionCourseId: e.promotion_course_id });
        }
      }

      // 4. Notas de esas matrículas (para estado y promedio por curso)
      const grades: GradeLite[] = [];
      const enrollmentIds = enrollments.map((e) => e.id);
      if (enrollmentIds.length > 0) {
        const { data: gradeData, error: gradeErr } = await this.supabase.client
          .from('professional_module_grades')
          .select('enrollment_id, grade, status')
          .in('enrollment_id', enrollmentIds);
        if (gradeErr) throw new Error('Error cargando notas');
        for (const g of gradeData ?? []) {
          if (g.grade !== null) {
            grades.push({
              enrollmentId: g.enrollment_id,
              grade: g.grade,
              status: g.status === 'confirmed' ? 'confirmed' : 'draft',
            });
          }
        }
      }

      // 5. Ensamblaje puro (testeable)
      this._landing.set(buildLanding(promotions, courses, enrollments, grades));
    } catch (err) {
      this._error.set(err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error cargando el panorama');
      this._landing.set([]);
    } finally {
      this._landingLoaded.set(true);
      this._isLoading.set(false);
    }
  }

  /** Vuelve del gradebook al aterrizaje (limpia curso y grilla seleccionados). */
  cerrarGrilla(): void {
    this._selectedCursoId.set(null);
    this._grilla.set(null);
  }

  async selectPromocion(id: number): Promise<void> {
    this._selectedPromocionId.set(id);
    this._selectedCursoId.set(null);
    this._grilla.set(null);
    this._cursos.set([]);
    await this.loadCursos(id);
  }

  private async loadCursos(promotionId: number): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('promotion_courses')
      .select('id, courses!inner(code, name, license_class)')
      .eq('promotion_id', promotionId);

    if (error) {
      this._error.set('Error cargando cursos');
      return;
    }

    this._cursos.set(
      (data ?? []).map((pc) => {
        const course = pc.courses as unknown as {
          code: string;
          name: string;
          license_class: string;
        };
        return {
          id: pc.id,
          courseCode: course.license_class,
          courseName: course.name,
        };
      }),
    );
  }

  async selectCurso(promotionCourseId: number): Promise<void> {
    this._selectedCursoId.set(promotionCourseId);
    await this.loadGrilla(promotionCourseId);
  }

  // ── Carga de la grilla ──────────────────────────────────────────────────────

  async loadGrilla(promotionCourseId: number): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      // Datos del curso (nombre, licenseClass, nombre de promoción)
      const { data: pcData, error: pcError } = await this.supabase.client
        .from('promotion_courses')
        .select('id, courses!inner(name, license_class), professional_promotions!inner(name, code)')
        .eq('id', promotionCourseId)
        .single();

      if (pcError || !pcData) throw new Error('Curso no encontrado');

      const course = pcData.courses as unknown as { name: string; license_class: string };
      const promotion = pcData.professional_promotions as unknown as {
        name: string;
        code: string;
      };

      // Matrículas activas del curso
      const { data: enrollments, error: enrError } = await this.supabase.client
        .from('enrollments')
        .select(
          'id, students!inner(users!inner(first_names, paternal_last_name, maternal_last_name, rut))',
        )
        .eq('promotion_course_id', promotionCourseId)
        .in('status', ['active', 'completed'])
        .order('id');

      if (enrError) throw new Error('Error cargando alumnos');

      const enrollmentIds = (enrollments ?? []).map((e) => e.id);

      // Notas existentes en BD
      const { data: gradesData, error: gradesError } = await this.supabase.client
        .from('professional_module_grades')
        .select('id, enrollment_id, module_number, grade, passed, status')
        .in('enrollment_id', enrollmentIds.length > 0 ? enrollmentIds : [-1]);

      if (gradesError) throw new Error('Error cargando notas');

      // Mapear notas existentes: enrollmentId → moduleNumber → grade row
      const gradesMap = new Map<string, ProfessionalModuleGrade>();
      for (const g of gradesData ?? []) {
        gradesMap.set(`${g.enrollment_id}-${g.module_number}`, g as ProfessionalModuleGrade);
      }

      const licenseClass = course.license_class;
      const moduleNames = getModuleNames(licenseClass);

      // Verificar si alguna nota está confirmada
      const hasConfirmed = (gradesData ?? []).some((g) => g.status === 'confirmed');

      // Construir filas
      const filas: FilaEvaluacion[] = (enrollments ?? []).map((enr) => {
        const row = enr as unknown as EnrollmentRow;
        const u = row.students.users;
        const fullName = [u.paternal_last_name, u.maternal_last_name, u.first_names]
          .filter(Boolean)
          .join(' ');
        const initials = fullName
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join('');

        const notas: CeldaNota[] = Array.from({ length: MODULE_COUNT }, (_, i) => {
          const moduleNumber = i + 1;
          const existing = gradesMap.get(`${enr.id}-${moduleNumber}`);
          return {
            grade: existing?.grade ?? null,
            passed: existing?.passed ?? null,
            status: existing?.status ?? 'draft',
            gradeId: existing?.id ?? null,
            dirty: false,
          };
        });

        const gradeValues = notas.map((n) => n.grade);
        const promedio = calcAverage(gradeValues);

        return {
          enrollmentId: enr.id,
          nombre: fullName,
          rut: u.rut,
          initials,
          notas,
          promedio,
          promedioAprobado: promedio !== null ? isPassing(promedio) : null,
        };
      });

      filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

      this._grilla.set({
        promotionCourseId,
        promotionName: promotion.name ?? promotion.code,
        courseName: course.name,
        licenseClass,
        moduleNames,
        totalAlumnos: filas.length,
        filas,
        confirmed: hasConfirmed,
      });
    } catch (err) {
      this._error.set(err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error desconocido');
    } finally {
      this._isLoading.set(false);
    }
  }

  // ── Edición local (sin ir a BD) ─────────────────────────────────────────────

  /**
   * Actualiza una nota localmente (marca como dirty).
   * Valida rango 10–100 antes de aplicar.
   */
  setNota(enrollmentId: number, moduleIndex: number, rawValue: number | null): void {
    const g = this._grilla();
    if (!g || g.confirmed) return;

    const filas = g.filas.map((fila) => {
      if (fila.enrollmentId !== enrollmentId) return fila;

      const notas = fila.notas.map((nota, idx) => {
        if (idx !== moduleIndex) return nota;
        // Solo aplica clamp del máximo durante el tipeo.
        // El mínimo (10) se valida al guardar, no aquí, para no interferir
        // con valores intermedios (ej: "5" camino a "56").
        const grade = rawValue !== null ? Math.min(100, roundGrade(rawValue)) : null;
        return {
          ...nota,
          grade,
          passed: grade !== null ? isPassing(grade) : null,
          dirty: true,
        };
      });

      const promedio = calcAverage(notas.map((n) => n.grade));
      return {
        ...fila,
        notas,
        promedio,
        promedioAprobado: promedio !== null ? isPassing(promedio) : null,
      };
    });

    this._grilla.set({ ...g, filas });
  }

  /**
   * Corrige al mínimo (10) una nota que quedó por debajo del rango y avisa al
   * usuario. Se invoca desde la UI en el blur del input — el clamp del mínimo no
   * se aplica durante el tipeo para no romper valores intermedios (ej: "5" → "56").
   * No-op si la nota es válida, null o la grilla está confirmada.
   */
  corregirNotaMinima(enrollmentId: number, moduleIndex: number): void {
    const g = this._grilla();
    if (!g || g.confirmed) return;
    const fila = g.filas.find((f) => f.enrollmentId === enrollmentId);
    const grade = fila?.notas[moduleIndex]?.grade ?? null;
    if (grade !== null && grade < 10) {
      this.setNota(enrollmentId, moduleIndex, 10);
      this.toast.info('La nota mínima es 10 — el valor se ajustó automáticamente.');
    }
  }

  // ── Persistencia ────────────────────────────────────────────────────────────

  /** Guarda únicamente las celdas marcadas como dirty en estado 'draft'. */
  async guardarBorrador(): Promise<boolean> {
    return this._persist('draft');
  }

  /** Guarda todas las notas y las marca como 'confirmed' (irreversible). */
  async confirmarNotas(): Promise<boolean> {
    return this._persist('confirmed');
  }

  private async _persist(targetStatus: 'draft' | 'confirmed'): Promise<boolean> {
    const g = this._grilla();
    if (!g) return false;

    this._isSaving.set(true);
    const userId = this.auth.currentUser()?.dbId ?? null;

    const moduleNames = g.moduleNames;

    // Construir upserts para todas las celdas con nota (draft) o todas (confirmed)
    const upserts: object[] = [];
    for (const fila of g.filas) {
      fila.notas.forEach((nota, idx) => {
        const moduleNumber = idx + 1;
        const shouldUpsert = targetStatus === 'confirmed' || nota.dirty;
        if (!shouldUpsert || nota.grade === null || nota.grade < 10) return;

        const payload: Record<string, unknown> = {
          enrollment_id: fila.enrollmentId,
          module_number: moduleNumber,
          module: moduleNames[idx],
          grade: nota.grade,
          passed: isPassing(nota.grade),
          status: targetStatus,
          recorded_by: userId,
          updated_at: new Date().toISOString(),
        };
        if (nota.gradeId !== null) payload['id'] = nota.gradeId;

        upserts.push(payload);
      });
    }

    if (upserts.length === 0) {
      this._isSaving.set(false);
      this.toast.info('No hay notas nuevas que guardar.');
      return true;
    }

    const { error } = await this.supabase.client
      .from('professional_module_grades')
      .upsert(upserts, { onConflict: 'enrollment_id,module_number' });

    this._isSaving.set(false);

    if (error) {
      this._error.set('Error al guardar las notas');
      this.toast.error('No se pudieron guardar las notas. Intenta de nuevo.');
      return false;
    }

    const msg =
      targetStatus === 'confirmed'
        ? 'Notas confirmadas correctamente.'
        : 'Borrador guardado correctamente.';
    this.toast.success(msg);

    // Recargar la grilla para reflejar IDs generados y limpiar dirty flags
    await this.loadGrilla(g.promotionCourseId);
    return true;
  }
}
