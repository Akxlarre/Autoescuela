import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';

// ── Tipos internos (DTO de Supabase) ──────────────────────────────────────────

interface UserRow {
  first_names: string;
  paternal_last_name: string;
  maternal_last_name: string | null;
  document_number: string | null;
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

  // ── KPIs computed ────────────────────────────────────────────────────────────
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

  // ── Acción principal ─────────────────────────────────────────────────────────
  async loadEgresados(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

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
            document_number
          )
        )
      `,
      )
      .eq('status', 'egresado')
      .order('updated_at', { ascending: false });

    if (error) {
      this._error.set(error.message);
      this._isLoading.set(false);
      return;
    }

    const rows = (data as unknown as EgresadoRow[]) ?? [];
    this._egresados.set(rows.map((r: EgresadoRow) => this.mapRow(r)));
    this._isLoading.set(false);
  }

  // ── Helpers privados ─────────────────────────────────────────────────────────
  private mapRow(r: EgresadoRow): EgresadoTableRow {
    const u = r.students?.users;

    const nombre: string = u
      ? [u.first_names, u.paternal_last_name, u.maternal_last_name ?? '']
          .filter((s: string) => s.trim().length > 0)
          .join(' ')
      : '—';

    const rut: string = u?.document_number ?? '—';
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
