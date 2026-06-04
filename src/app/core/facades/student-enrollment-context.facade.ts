import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type { EnrollmentTab, LicenseGroup } from '@core/models/ui/student-home.model';

/**
 * Fuente compartida del enrollment activo en el portal del alumno.
 * Sigue el patrón BranchFacade: los facades de página inyectan este servicio
 * para saber qué enrollment mostrar sin cada uno hacer su propia query.
 */
@Injectable({ providedIn: 'root' })
export class StudentEnrollmentContextFacade {
  private readonly supabase = inject(SupabaseService);

  private _initialized = false;
  private readonly _enrollments = signal<EnrollmentTab[]>([]);
  private readonly _activeId = signal<number | null>(null);

  readonly enrollments = this._enrollments.asReadonly();
  readonly activeEnrollmentId = this._activeId.asReadonly();

  /** Idempotente: solo carga la primera vez. */
  async initialize(dbId: number): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;

    const { data } = await this.supabase.client
      .from('enrollments')
      .select('id, number, license_group, created_at, courses!inner(name), students!inner(user_id)')
      .eq('students.user_id', dbId)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false });

    const rows = (data ?? []) as any[];
    const tabs: EnrollmentTab[] = rows.map((e) => {
      const lg: LicenseGroup = e.license_group === 'professional' ? 'professional' : 'class_b';
      const courseName: string = Array.isArray(e.courses)
        ? (e.courses[0]?.name ?? '')
        : (e.courses?.name ?? '');
      const base = lg === 'class_b' ? 'Clase B' : courseName;
      const label = e.number ? `${base} · #${e.number}` : base;
      return { id: e.id, label, licenseGroup: lg };
    });

    this._enrollments.set(tabs);
    if (tabs.length > 0) this._activeId.set(tabs[0].id);
  }

  setActive(id: number): void {
    this._activeId.set(id);
  }

  /** Resetea el estado al hacer logout para que el próximo alumno arranque limpio. */
  reset(): void {
    this._initialized = false;
    this._enrollments.set([]);
    this._activeId.set(null);
  }
}
