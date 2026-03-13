import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';

interface ComentarioMock {
  iniciales: string;
  nombre: string;
  rating: number;
  texto: string;
}

@Component({
  selector: 'app-admin-ex-alumnos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    FormsModule,
    KpiCardVariantComponent,
    IconComponent,
    SkeletonBlockComponent,
  ],
  template: `
    <div class="page-content">
      <!-- ── Header ──────────────────────────────────────────────────────────────── -->
      <div class="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-semibold" style="color: var(--text-primary)">
            Gestión de Ex-Alumnos
          </h1>
          <p class="text-sm mt-1" style="color: var(--ds-brand)">
            Archivo histórico, búsqueda avanzada y estado de cuenta de egresados
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            class="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border"
            style="border-color: var(--border-default); color: var(--text-secondary); background: var(--bg-base); cursor: pointer;"
            data-llm-action="exportar-ex-alumnos"
          >
            <app-icon name="download" [size]="14" />
            Exportar
          </button>
          <button
            class="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border"
            style="border-color: var(--border-default); color: var(--text-secondary); background: var(--bg-base); cursor: pointer;"
            data-llm-action="ir-alumnos-activos"
          >
            <app-icon name="arrow-left" [size]="14" />
            Activos
          </button>
        </div>
      </div>

      <!-- ── KPI Cards ────────────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <app-kpi-card-variant
          label="TOTAL EGRESADOS"
          [value]="facade.totalEgresados()"
          icon="graduation-cap"
          [loading]="facade.isLoading()"
          data-llm-description="Total de alumnos egresados"
        />
        <app-kpi-card-variant
          label="EGRESADOS CLASE B"
          [value]="facade.egresadosClaseB()"
          icon="car"
          color="default"
          [loading]="facade.isLoading()"
          data-llm-description="Egresados del curso Clase B"
        />
        <app-kpi-card-variant
          label="EGRESADOS CLASE PROFESIONAL"
          [value]="facade.egresadosProfesional()"
          icon="award"
          color="success"
          [loading]="facade.isLoading()"
          data-llm-description="Egresados de cursos profesionales"
        />
        <app-kpi-card-variant
          label="CON ABONO PENDIENTE"
          [value]="facade.conAbonoPendiente()"
          icon="alert-circle"
          color="warning"
          [accent]="true"
          [loading]="facade.isLoading()"
          data-llm-description="Egresados con saldo pendiente de pago"
        />
      </div>

      <!-- ── Archivo Histórico ───────────────────────────────────────────────────── -->
      <div class="card p-6 mb-6">
        <h2 class="text-base font-semibold mb-4" style="color: var(--text-primary)">
          Archivo Histórico de Egresados
        </h2>

        <!-- Search + Filters -->
        <div class="flex flex-col gap-3 mb-4">
          <!-- Search -->
          <div class="relative">
            <span
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style="color: var(--text-muted)"
            >
              <app-icon name="search" [size]="15" />
            </span>
            <input
              type="text"
              class="search-input"
              placeholder="Ej: Carlos Soto, CM-2026-00342..."
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              data-llm-description="Buscar ex-alumno por nombre, RUT o número de certificado"
            />
          </div>

          <!-- Filter row -->
          <div class="flex flex-wrap items-center gap-2">
            <select
              class="filter-select"
              [ngModel]="filtroAnio()"
              (ngModelChange)="filtroAnio.set($event)"
              aria-label="Filtrar por año de egreso"
            >
              <option value="">Todos los años</option>
              @for (year of availableYears(); track year) {
                <option [value]="year">{{ year }}</option>
              }
            </select>

            <select
              class="filter-select"
              [ngModel]="filtroLicencia()"
              (ngModelChange)="filtroLicencia.set($event)"
              aria-label="Filtrar por tipo de licencia"
            >
              <option value="">Todas</option>
              @for (lic of availableLicencias(); track lic) {
                <option [value]="lic">{{ lic }}</option>
              }
            </select>

            <select
              class="filter-select"
              [ngModel]="filtroEstado()"
              (ngModelChange)="filtroEstado.set($event)"
              aria-label="Filtrar por estado de cuenta"
            >
              <option value="">Todos</option>
              <option value="deuda">Con deuda</option>
              <option value="al-dia">Al día</option>
            </select>

            <button
              class="text-sm px-3 py-1.75 rounded-lg border"
              style="border-color: var(--border-default); color: var(--text-secondary); background: transparent; cursor: pointer;"
              (click)="clearFilters()"
              data-llm-action="limpiar-filtros-ex-alumnos"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <!-- Count + hint -->
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm" style="color: var(--text-muted)">
            Mostrando
            <strong style="color: var(--text-primary)">{{ filteredEgresados().length }}</strong>
            egresados
          </p>
          <p class="text-xs hidden md:block" style="color: var(--text-muted)">
            Haz clic en una fila para ver el estado de cuenta detallado
          </p>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle);">
                <th class="th-col">EGRESADO</th>
                <th class="th-col">LICENCIA</th>
                <th class="th-col">AÑO</th>
                <th class="th-col">SEDE</th>
                <th class="th-col">N° CERT. CASA DE MONEDA</th>
                <th class="th-col">ESTADO CUENTA</th>
                <th class="w-8 pb-3"></th>
              </tr>
            </thead>
            <tbody>
              @if (facade.isLoading()) {
                @for (_ of skeletonRows; track $index) {
                  <tr style="border-bottom: 1px solid var(--border-subtle);">
                    <td class="py-4 pr-4">
                      <div class="flex flex-col gap-2">
                        <app-skeleton-block variant="text" width="160px" height="13px" />
                        <app-skeleton-block variant="text" width="100px" height="11px" />
                      </div>
                    </td>
                    <td class="py-4 pr-4">
                      <app-skeleton-block variant="rect" width="44px" height="24px" />
                    </td>
                    <td class="py-4 pr-4">
                      <app-skeleton-block variant="text" width="48px" height="13px" />
                    </td>
                    <td class="py-4 pr-4">
                      <app-skeleton-block variant="text" width="120px" height="13px" />
                    </td>
                    <td class="py-4 pr-4">
                      <app-skeleton-block variant="rect" width="110px" height="24px" />
                    </td>
                    <td class="py-4">
                      <app-skeleton-block variant="rect" width="72px" height="24px" />
                    </td>
                    <td></td>
                  </tr>
                }
              } @else if (filteredEgresados().length === 0) {
                <tr>
                  <td colspan="7" class="py-14 text-center">
                    <div class="flex flex-col items-center gap-2">
                      <app-icon name="graduation-cap" [size]="36" />
                      <p class="text-sm mt-1" style="color: var(--text-muted)">
                        No hay egresados que coincidan con los filtros.
                      </p>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (egresado of filteredEgresados(); track egresado.id) {
                  <tr class="table-row" style="border-bottom: 1px solid var(--border-subtle);">
                    <!-- Egresado: nombre + RUT -->
                    <td class="py-4 pr-4">
                      <div class="flex flex-col gap-0.5">
                        <span class="text-sm font-medium" style="color: var(--text-primary)">
                          {{ egresado.nombre }}
                        </span>
                        <span class="text-xs" style="color: var(--text-muted)">
                          {{ egresado.rut }}
                        </span>
                      </div>
                    </td>

                    <!-- Licencia badge -->
                    <td class="py-4 pr-4">
                      <span
                        class="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full"
                        [style.background]="getLicenciaBg(egresado.licencia)"
                        [style.color]="getLicenciaColor(egresado.licencia)"
                      >
                        {{ egresado.licencia }}
                      </span>
                    </td>

                    <!-- Año -->
                    <td class="py-4 pr-4">
                      <span class="text-sm font-semibold" style="color: var(--text-primary)">
                        {{ egresado.anio ?? '—' }}
                      </span>
                    </td>

                    <!-- Sede -->
                    <td class="py-4 pr-4">
                      <span class="text-sm" style="color: var(--text-secondary)">
                        {{ egresado.sede }}
                      </span>
                    </td>

                    <!-- N° Certificado -->
                    <td class="py-4 pr-4">
                      @if (egresado.nroCertificado) {
                        <span
                          class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
                          style="background: color-mix(in srgb, var(--state-warning) 15%, transparent); color: var(--state-warning);"
                        >
                          {{ egresado.nroCertificado }}
                        </span>
                      } @else {
                        <span class="text-xs" style="color: var(--text-muted)">Sin asignar</span>
                      }
                    </td>

                    <!-- Estado cuenta -->
                    <td class="py-4">
                      @if (egresado.saldoPendiente > 0) {
                        <span
                          class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style="background: color-mix(in srgb, var(--state-warning) 12%, transparent); color: var(--state-warning);"
                        >
                          Debe {{ egresado.saldoPendiente | currency: 'CLP' : 'symbol' : '1.0-0' }}
                        </span>
                      } @else {
                        <span
                          class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style="background: color-mix(in srgb, var(--state-success) 12%, transparent); color: var(--state-success);"
                        >
                          <app-icon name="check-circle" [size]="11" />
                          Al día
                        </span>
                      }
                    </td>

                    <!-- Chevron expand -->
                    <td class="py-4 pl-2" style="color: var(--text-muted);">
                      <app-icon name="chevron-down" [size]="16" />
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Bottom: Tasas + Comentarios ───────────────────────────────────────── -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Tasas de Aprobación -->
        <div class="card p-6">
          <h3 class="text-base font-semibold mb-5" style="color: var(--text-primary)">
            Tasas de Aprobación
          </h3>

          <div class="flex flex-col gap-5">
            <!-- Aprobación Municipal -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium" style="color: var(--text-primary)">
                  Aprobación Municipal
                </span>
                <span class="text-base font-bold" style="color: var(--state-success)">85%</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  style="width: 85%; background: var(--state-success);"
                ></div>
              </div>
              <p class="text-xs mt-1.5" style="color: var(--ds-brand)">
                Basado en 340 exámenes presentados este año
              </p>
            </div>

            <!-- Aprobación Psicotécnico -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium" style="color: var(--text-primary)">
                  Aprobación Examen Psicotécnico
                </span>
                <span class="text-base font-bold" style="color: var(--color-primary)">92%</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  style="width: 92%; background: var(--color-primary);"
                ></div>
              </div>
              <p class="text-xs mt-1.5" style="color: var(--ds-brand)">
                Alta tasa de éxito en primera instancia
              </p>
            </div>

            <!-- Resumen Anual -->
            <div class="rounded-xl p-4 mt-1" style="background: var(--bg-elevated);">
              <p
                class="text-xs font-semibold mb-3"
                style="color: var(--text-secondary); letter-spacing: 0.05em; text-transform: uppercase;"
              >
                Resumen Anual
              </p>
              <div class="grid grid-cols-2 gap-4">
                <div class="text-center">
                  <p class="text-xs" style="color: var(--text-muted)">Total Egresados</p>
                  <p class="text-3xl font-bold mt-1" style="color: var(--text-primary)">450</p>
                </div>
                <div class="text-center border-l" style="border-color: var(--border-subtle);">
                  <p class="text-xs" style="color: var(--text-muted)">Licencias Obtenidas</p>
                  <p class="text-3xl font-bold mt-1" style="color: var(--state-success)">412</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Últimos Comentarios -->
        <div class="card p-6">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-base font-semibold" style="color: var(--text-primary)">
              Últimos Comentarios
            </h3>
            <span
              class="text-xs font-semibold px-2.5 py-1 rounded-full"
              style="background: color-mix(in srgb, var(--state-warning) 15%, transparent); color: var(--state-warning);"
            >
              4.8 Promedio General
            </span>
          </div>

          <div class="flex flex-col">
            @for (comentario of comentarios; track comentario.nombre) {
              <div
                class="flex items-start gap-3 py-4"
                style="border-bottom: 1px solid var(--border-subtle);"
              >
                <!-- Avatar con iniciales -->
                <div
                  class="flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-xs font-bold"
                  style="background: var(--color-primary-tint); color: var(--color-primary);"
                >
                  {{ comentario.iniciales }}
                </div>

                <!-- Contenido -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="text-sm font-semibold" style="color: var(--text-primary)">
                      {{ comentario.nombre }}
                    </span>
                    <!-- Estrellas -->
                    <div class="flex items-center gap-0.5">
                      @for (star of starsArray; track star) {
                        <app-icon
                          name="star"
                          [size]="13"
                          [color]="
                            star <= comentario.rating
                              ? 'var(--state-warning)'
                              : 'var(--border-default)'
                          "
                        />
                      }
                    </div>
                  </div>
                  <p class="text-xs leading-relaxed" style="color: var(--text-secondary);">
                    "{{ comentario.texto }}"
                  </p>
                </div>
              </div>
            }
          </div>

          <button
            class="w-full mt-4 py-2.5 text-sm font-medium rounded-lg border"
            style="border-color: var(--border-default); color: var(--text-secondary); background: transparent; cursor: pointer;"
            data-llm-action="ver-todas-encuestas"
          >
            Ver todas las encuestas
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .search-input {
      width: 100%;
      padding: 9px 12px 9px 36px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      outline: none;
    }
    .search-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }
    .search-input::placeholder {
      color: var(--text-muted);
    }

    .filter-select {
      padding: 7px 10px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      outline: none;
      cursor: pointer;
    }
    .filter-select:focus {
      border-color: var(--ds-brand);
    }

    .th-col {
      text-align: left;
      padding-bottom: 12px;
      padding-right: 16px;
      color: var(--text-secondary);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .table-row {
      transition: background var(--duration-fast);
      cursor: pointer;
    }
    .table-row:hover {
      background: var(--bg-subtle, rgba(0, 0, 0, 0.02));
    }

    .progress-bar {
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: var(--bg-elevated);
    }
    .progress-fill {
      height: 100%;
      border-radius: 999px;
    }
  `,
})
export class AdminExAlumnosComponent implements OnInit {
  protected readonly facade = inject(ExAlumnosFacade);

  // ── Filtros locales ──────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly filtroAnio = signal('');
  protected readonly filtroLicencia = signal('');
  protected readonly filtroEstado = signal('');

  // ── Lista filtrada (cliente) ─────────────────────────────────────────────────
  protected readonly filteredEgresados = computed<EgresadoTableRow[]>(() => {
    let results: EgresadoTableRow[] = this.facade.egresados();

    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      results = results.filter(
        (e: EgresadoTableRow) =>
          e.nombre.toLowerCase().includes(term) ||
          e.rut.toLowerCase().includes(term) ||
          (e.nroCertificado?.toLowerCase().includes(term) ?? false),
      );
    }
    if (this.filtroAnio()) {
      results = results.filter((e: EgresadoTableRow) => String(e.anio) === this.filtroAnio());
    }
    if (this.filtroLicencia()) {
      results = results.filter((e: EgresadoTableRow) => e.licencia === this.filtroLicencia());
    }
    if (this.filtroEstado() === 'deuda') {
      results = results.filter((e: EgresadoTableRow) => e.saldoPendiente > 0);
    } else if (this.filtroEstado() === 'al-dia') {
      results = results.filter((e: EgresadoTableRow) => e.saldoPendiente === 0);
    }
    return results;
  });

  // ── Opciones de filtros dinámicas ────────────────────────────────────────────
  protected readonly availableYears = computed<string[]>(() => {
    const years = this.facade
      .egresados()
      .map((e: EgresadoTableRow) => e.anio)
      .filter((y): y is number => y !== null);
    return [...new Set(years)].sort((a: number, b: number) => Number(b) - Number(a)).map(String);
  });

  protected readonly availableLicencias = computed<string[]>(() =>
    [...new Set(this.facade.egresados().map((e: EgresadoTableRow) => e.licencia))].sort(),
  );

  // ── Mock estático (sección inferior) ────────────────────────────────────────
  protected readonly comentarios: ComentarioMock[] = [
    {
      iniciales: 'CG',
      nombre: 'Carlos González',
      rating: 5,
      texto: 'Excelente instructor, muy paciente. Me ayudó mucho con los estacionamientos.',
    },
    {
      iniciales: 'AR',
      nombre: 'Ana Rojas',
      rating: 4,
      texto: 'Buena experiencia general, aunque la plataforma online a veces es lenta.',
    },
    {
      iniciales: 'PS',
      nombre: 'Pedro Soto',
      rating: 5,
      texto: 'Muy recomendado. Aprobé mi examen a la primera gracias a las clases prácticas.',
    },
    {
      iniciales: 'MP',
      nombre: 'María Pérez',
      rating: 5,
      texto: 'Todo super bien organizado. La secretaria muy amable.',
    },
  ];

  protected readonly starsArray = [1, 2, 3, 4, 5];
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  ngOnInit(): void {
    this.facade.loadEgresados();
  }

  protected clearFilters(): void {
    this.searchTerm.set('');
    this.filtroAnio.set('');
    this.filtroLicencia.set('');
    this.filtroEstado.set('');
  }

  protected getLicenciaBg(licencia: string): string {
    const l = licencia.toUpperCase();
    if (l.includes('B')) return 'color-mix(in srgb, var(--color-primary) 15%, transparent)';
    if (['A1', 'A2', 'A3'].some((x) => l.includes(x)))
      return 'color-mix(in srgb, var(--state-warning) 15%, transparent)';
    return 'color-mix(in srgb, var(--state-success) 15%, transparent)';
  }

  protected getLicenciaColor(licencia: string): string {
    const l = licencia.toUpperCase();
    if (l.includes('B')) return 'var(--color-primary)';
    if (['A1', 'A2', 'A3'].some((x) => l.includes(x))) return 'var(--state-warning)';
    return 'var(--state-success)';
  }
}
