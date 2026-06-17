import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
import type {
  AlumnoResult,
  SearchResult,
  SearchResultGroup,
} from '@core/models/ui/global-search.model';
import { getActionResults } from '@core/utils/search-intents';

@Injectable({ providedIn: 'root' })
export class GlobalSearchFacade {
  private readonly auth = inject(AuthFacade);
  private readonly adminAlumnos = inject(AdminAlumnosFacade);
  private readonly router = inject(Router);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _query = signal('');

  // ── Estado público ────────────────────────────────────────────────────────
  readonly query = this._query.asReadonly();

  // ── Computed: prefijo de ruta según rol ──────────────────────────────────
  private readonly rolePrefix = computed(() => {
    const role = this.auth.currentUser()?.role ?? 'admin';
    return `/app/${role}`;
  });

  // ── Computed: acciones por intención ────────────────────────────────────
  readonly actionResults = computed(() => {
    const q = this._query();
    if (!q.trim()) return [];
    const role = this.auth.currentUser()?.role ?? 'admin';
    return getActionResults(q, this.rolePrefix(), role, 4);
  });

  // ── Computed: alumnos encontrados en memoria ─────────────────────────────
  readonly alumnoResults = computed((): AlumnoResult[] => {
    const q = this._query().trim().toLowerCase();
    if (q.length < 2) return [];

    const prefix = this.rolePrefix();
    // Secretaria no tiene ruta de detalle; lleva a la lista con filtro
    const role = this.auth.currentUser()?.role ?? 'admin';
    const detailBase = role === 'admin' ? `${prefix}/alumnos` : `${prefix}/alumnos`;

    const qRut = q.replace(/[.\-]/g, '');

    return this.adminAlumnos
      .alumnos()
      .filter((a) => {
        const fullName = `${a.nombre} ${a.apellido}`.toLowerCase();
        const rut = a.rut.replace(/[.\-]/g, '').toLowerCase();
        return fullName.includes(q) || rut.includes(qRut);
      })
      .slice(0, 5)
      .map((a) => ({
        type: 'alumno' as const,
        studentId: a.id,
        label: `${a.nombre} ${a.apellido}`,
        rut: a.rut,
        status: a.status,
        route: [`${detailBase}/${a.id}`],
      }));
  });

  // ── Computed: grupos para la UI ──────────────────────────────────────────
  readonly groups = computed((): SearchResultGroup[] => {
    const groups: SearchResultGroup[] = [];
    const actions = this.actionResults();
    const alumnos = this.alumnoResults();
    if (actions.length > 0) {
      groups.push({ label: 'Acciones sugeridas', icon: 'zap', results: actions });
    }
    if (alumnos.length > 0) {
      groups.push({ label: 'Alumnos encontrados', icon: 'users', results: alumnos });
    }
    return groups;
  });

  readonly hasResults = computed(() => this.groups().some((g) => g.results.length > 0));

  /** true cuando el query tiene contenido pero aún no llega al mínimo para buscar alumnos */
  readonly tooShortForAlumnos = computed(() => this._query().trim().length === 1);

  // ── Acciones ─────────────────────────────────────────────────────────────

  setQuery(q: string): void {
    this._query.set(q);
  }

  reset(): void {
    this._query.set('');
  }

  navigate(result: SearchResult): void {
    void this.router.navigate(result.route);
  }
}
