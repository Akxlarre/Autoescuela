import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';

// ── Tipos internos (DTO de Supabase) ──────────────────────────────────────────

interface UserRow {
  first_names: string;
  paternal_last_name: string;
  maternal_last_name: string | null;
  rut: string | null;
}

interface StudentRow {
  users: UserRow | null;
}

interface CourseRow {
  name: string;
  code: string;
}

interface BranchRow {
  name: string;
}

interface EgresadoRow {
  id: number;
  pending_balance: number | null;
  updated_at: string | null;
  courses: CourseRow | null;
  branches: BranchRow | null;
  students: StudentRow | null;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ExAlumnosFacade {
  private readonly supabase = inject(SupabaseService);

  // ── Estado privado ───────────────────────────────────────────────────────────
  private readonly _egresados = signal<EgresadoTableRow[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // ── Estado público ───────────────────────────────────────────────────────────
  readonly egresados = this._egresados.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  // ── Estadísticas — Totales ──
  readonly totalEgresados = computed<number>(() => this._egresados().length);
  readonly egresadosClaseB = computed<number>(
    () =>
      this._egresados().filter((e: EgresadoTableRow) => e.licencia.toUpperCase().includes('B'))
        .length,
  );
  readonly egresadosProfesional = computed<number>(
    () =>
      this._egresados().filter((e: EgresadoTableRow) => !e.licencia.toUpperCase().includes('B'))
        .length,
  );
  readonly conAbonoPendiente = computed<number>(
    () => this._egresados().filter((e: EgresadoTableRow) => e.saldoPendiente > 0).length,
  );

  // ── Estadísticas — Tasas de Aprobación ──
  readonly municipalApprovalRate = signal<number>(0);
  readonly psychoApprovalRate = signal<number>(0);
  readonly totalExamenes = signal<number>(0);

  // ── Estadísticas — Balance General del Año (Académico) ──
  readonly annualEgresadosTotal = signal<number>(0);
  readonly annualLicensesTotal = signal<number>(0);
  readonly successConversionRate = signal<number>(0); // % de egresados que sacan licencia

  // ── Estadísticas — Encuestas (Post-Curso) ──
  readonly avgSatisfaction = signal<number>(0);
  readonly licenseSuccessRate = signal<number>(0);
  readonly _surveys = signal<any[]>([]);
  readonly surveys = this._surveys.asReadonly();

  // ── Acción principal ─────────────────────────────────────────────────────────
  async loadEgresados(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    await Promise.all([
      this.loadEgresadosList(),
      this.loadStatistics(),
      this.loadSurveys()
    ]);
    this._isLoading.set(false);
  }

  private async loadEgresadosList(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select(
        `
        id,
        pending_balance,
        updated_at,
        courses!inner ( name, code ),
        branches ( name ),
        students!inner (
          users!inner (
            first_names,
            paternal_last_name,
            maternal_last_name,
            rut
          )
        )
      `,
      )
      .eq('status', 'completed')
      .order('updated_at', { ascending: false });

    if (error) {
      this._error.set(error.message);
      return;
    }

    const rows = (data as unknown as EgresadoRow[]) ?? [];
    this._egresados.set(rows.map((r: EgresadoRow) => this.mapRow(r)));
  }

  // ── Helpers privados ─────────────────────────────────────────────────────────
  private mapRow(r: EgresadoRow): EgresadoTableRow {
    const u = r.students?.users;

    const nombre: string = u
      ? [u.first_names, u.paternal_last_name, u.maternal_last_name ?? '']
          .filter((s: string) => s.trim().length > 0)
          .join(' ')
      : '—';

    const rut: string = u?.rut ?? '—';
    const licencia: string = this.deriveLicencia(r.courses?.code ?? '', r.courses?.name ?? '');
    const anio: number | null = r.updated_at ? new Date(r.updated_at).getFullYear() : null;
    const sede: string = r.branches?.name ?? '—';

    return {
      id: r.id,
      nombre,
      rut,
      licencia,
      anio,
      sede,
      nroCertificado: null,
      saldoPendiente: r.pending_balance ?? 0,
    };
  }

  private async loadStatistics(): Promise<void> {
    try {
      const year = new Date().getFullYear();
      const startOfYear = `${year}-01-01`;

      // 1. Cargar exámenes para tasas de aprobación
      const { data: exams, error } = await this.supabase.client
        .from('class_b_exam_scores')
        .select('passed'); // Eliminamos exam_type por ahora ya que no existe en BD

      if (error) throw error;
      if (exams) {
        // Como no hay exam_type en BD todavía, mostramos la tasa general para ambos por ahora
        const approvalRate = this.calculateRate(exams);
        
        this.municipalApprovalRate.set(approvalRate);
        this.psychoApprovalRate.set(approvalRate);
        this.totalExamenes.set(exams.length);
      }

      // 2. Balance Real del Año (Egresados vs Licencias)
      // Contar egresados (enrollments completed este año)
      const { count: egresadosCount, error: countErr } = await this.supabase.client
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', startOfYear);

      if (countErr) throw countErr;
      this.annualEgresadosTotal.set(egresadosCount || 0);

      // Contar licencias (surveys with obtained_license = true este año)
      const { count: licensesCount, error: licErr } = await this.supabase.client
        .from('student_surveys')
        .select('*', { count: 'exact', head: true })
        .eq('obtained_license', true)
        .gte('created_at', startOfYear);

      if (licErr) throw licErr;
      const licTotal = licensesCount || 0;
      this.annualLicensesTotal.set(licTotal);

      // Calcular tasa de conversión
      if (egresadosCount && egresadosCount > 0) {
        this.successConversionRate.set(Math.round((licTotal / egresadosCount) * 100));
      }
    } catch (e) {
      console.error('[ExAlumnosFacade] Error loading statistics:', e);
    }
  }

  private async loadSurveys(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client
        .from('student_surveys')
        .select(`
          id,
          satisfaction_rating,
          comments,
          obtained_license,
          enrollments!inner(
            students!inner(
              users!inner(first_names, paternal_last_name)
            )
          )
        `);

      if (error) throw error;
      if (!data) return;

      const total = data.length;
      if (total > 0) {
        const sumRating = data.reduce((acc, s) => acc + s.satisfaction_rating, 0);
        const licenseSuccess = data.filter(s => s.obtained_license).length;

        this.avgSatisfaction.set(Number((sumRating / total).toFixed(1)));
        this.licenseSuccessRate.set(Math.round((licenseSuccess / total) * 100));
        
        // Mapear para la UI con tipado seguro
        const mappedSurveys = (data as any[]).map(s => {
          const user = s.enrollments?.students?.users;
          return {
            nombre: user ? `${user.first_names} ${user.paternal_last_name}` : 'Alumno Anónimo',
            rating: s.satisfaction_rating,
            texto: s.comments || 'Sin comentario',
            iniciales: user ? (user.first_names[0] + user.paternal_last_name[0]) : 'AA'
          };
        });
        this._surveys.set(mappedSurveys);
      }
    } catch (e) {
      console.error('[ExAlumnosFacade] Error loading surveys:', e);
    }
  }

  private calculateRate(exams: any[]): number {
    if (exams.length === 0) return 0;
    const passed = exams.filter(e => e.passed === true).length;
    return Math.round((passed / exams.length) * 100);
  }

  private deriveLicencia(code: string, name: string): string {
    const upper = (code + ' ' + name).toUpperCase();
    if (upper.includes('CLASE B') || upper.includes('CLASS B')) return 'Clase B';
    if (upper.includes('A1')) return 'A1';
    if (upper.includes('A2')) return 'A2';
    if (upper.includes('A3')) return 'A3';
    if (upper.includes('A4')) return 'A4';
    if (upper.includes('A5')) return 'A5';
    return name || code || '—';
  }
}
