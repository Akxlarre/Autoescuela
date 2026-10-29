import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  inject,
  AfterViewInit,
  ElementRef,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ClearFiltersButtonComponent } from '@shared/components/clear-filters-button/clear-filters-button.component';
import { withAllOption } from '@core/utils/filter-options.utils';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { filterCertificadoAlumnos } from '@core/utils/certificate-list.utils';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import type {
  CertificacionAlumnoRow,
  CertificacionKpis,
} from '@core/models/ui/certificacion-clase-b.model';
import { StableWidthDirective } from '@core/directives/stable-width.directive';

type EstadoFilter = 'generado' | 'pendiente' | null;

/**
 * CertificacionClaseBContentComponent — Dumb component.
 *
 * Vista de certificación Clase B (app-like, Desktop lg+ fill-screen):
 *  - Section Hero compacto con acción "Historial de emisiones" (abre drawer)
 *  - 4 KPIs (Total alumnos, Generados, Pendientes Generación, Pendientes Envío)
 *  - Toolbar con buscador (nombre/RUT) + filtro de estado + acciones masivas (abren drawers)
 *  - Tabla de alumnos elegibles con scroll interno + paginación (PAGE_SIZE=10)
 */
@Component({
  selector: 'app-certificacion-clase-b-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ClearFiltersButtonComponent,
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    EmptyStateComponent,
    BadgeComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
    StableWidthDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoGridLayout #bentoGrid>
      <!-- ── Section Hero ──────────────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Gestión de Certificados"
        subtitle="Certificación de finalización de curso Clase B"
        icon="award"
        [kpis]="heroKpis()"
        [actions]="heroActions()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- ── Tabla + Toolbar (card unificado, app-like fill-screen, dual-viewport) ─────── -->
      <div
        class="bento-banner bento-fill card p-0 overflow-hidden flex flex-col w-full h-full dual-viewport-container"
        appCardHover
      >
        <div
          class="flex flex-wrap items-center gap-3 p-4 shrink-0"
          style="border-bottom: 1px solid var(--border-default)"
        >
          <!-- Buscador -->
          <div class="relative flex-1 min-w-50 max-w-xs">
            <app-icon
              name="search"
              [size]="15"
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
            />
            <input
              type="text"
              placeholder="Buscar por Nº, nombre o RUT..."
              class="w-full list-search-input h-9 pl-8 pr-3 text-sm rounded-lg border outline-none transition-colors border-border-default bg-surface text-text-primary"
              data-llm-description="Search students by name or RUT"
              [value]="searchQuery()"
              (input)="setSearchQuery($any($event.target).value)"
            />
          </div>

          <!-- Filtro de estado -->
          <p-select
            [options]="estadoOptions"
            [ngModel]="estadoFilter()"
            (ngModelChange)="setEstadoFilter($event)"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los estados"
            class="h-9"
            data-llm-description="Filter certificates by status"
          />
          <app-clear-filters-button
            llmSubject="certificates"
            [active]="hasActiveFilters()"
            (clear)="clearFilters()"
          />

          @if (pendientesCount() > 0) {
            <button
              class="btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              data-llm-action="open-generate-pending-certificates-drawer"
              [disabled]="isGeneratingPendientes()"
              [appStableWidth]="isGeneratingPendientes()"
              (click)="abrirGenerarPendientesDrawer.emit()"
            >
              @if (isGeneratingPendientes()) {
                <app-icon name="loader-circle" [size]="16" class="animate-spin" />
                Generando...
              } @else {
                <app-icon name="file-check" [size]="16" />
                Generar Pendientes ({{ pendientesCount() }})
              }
            </button>
          }

          @if (alumnosParaEnvioMasivo().length > 0) {
            <button
              class="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              data-llm-action="open-send-bulk-emails-drawer"
              [disabled]="sendingMasivo()"
              [appStableWidth]="sendingMasivo()"
              (click)="abrirEnviarMasivoDrawer.emit()"
            >
              @if (sendingMasivo()) {
                <app-icon name="loader-circle" [size]="16" class="animate-spin" />
                Enviando...
              } @else {
                <app-icon name="send" [size]="16" />
                Enviar Emails Masivo ({{ alumnosParaEnvioMasivo().length }})
              }
            </button>
          }

          <button
            class="btn-secondary flex items-center justify-center gap-2 ml-auto disabled:opacity-60 disabled:cursor-not-allowed"
            data-llm-action="export-all-certificates-zip"
            [disabled]="isExporting()"
            [appStableWidth]="isExporting()"
            (click)="exportar.emit()"
          >
            @if (isExporting()) {
              <app-icon name="loader-circle" [size]="16" class="animate-spin" />
              Exportando...
            } @else {
              <app-icon name="download" [size]="16" />
              Exportar todos
            }
          </button>
        </div>

        <!-- ── Indicador de criterio admin/secretaría (fix-011-i, H-012) ──────────────────
             Admin y secretaría ven listas distintas (admin: todos los estados + puede
             forzar el bypass; secretaría: solo alumnos habilitados) — esto es intencional,
             pero antes no se comunicaba en la UI. Vive dentro de la card (no como hijo
             directo del bento-grid) para no romper el template de filas del fill-screen. -->
        <div
          class="flex items-center gap-2 px-4 py-2 text-xs font-medium shrink-0"
          style="background: var(--bg-elevated); border-bottom: 1px solid var(--border-subtle); color: var(--text-secondary)"
        >
          <app-icon name="info" [size]="14" color="var(--text-muted)" />
          @if (isAdmin()) {
            Vista admin: se muestran todos los alumnos (activos y con curso completado), incluidos
            los que aún no cumplen las 12 prácticas.
          } @else {
            Vista secretaría: solo se muestran alumnos habilitados para certificado (12/12 prácticas
            completadas).
          }
        </div>

        <!-- ── Tabla principal ─────────────────────────────────────────── -->
        @if (isLoading()) {
          <div class="p-6 flex flex-col gap-4">
            @for (_ of skeletonRows; track $index) {
              <app-skeleton-block variant="text" width="100%" height="42px" />
            }
          </div>
        } @else if (filteredAlumnos().length === 0) {
          <div class="p-8">
            @if (alumnos().length === 0) {
              <app-empty-state
                icon="award"
                message="No hay alumnos elegibles para certificación"
                subtitle="Los alumnos aparecerán aquí cuando completen sus 12 clases prácticas de Clase B"
              />
            } @else {
              <app-empty-state
                icon="filter-x"
                message="No hay resultados para este filtro"
                subtitle="Prueba cambiando el filtro de estado o el texto de búsqueda"
              />
            }
          </div>
        } @else {
          <!-- VISTA 1: Tabla clásica (oculta cuando el drawer angosta la card) -->
          <div class="desktop-view hide-on-squeeze flex-1 min-h-0 overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="sticky top-0 z-10 bg-surface">
                <tr class="border-b border-(--border-default)">
                  <th class="micro-label text-left px-4 py-2" title="Nº de matrícula">Nº</th>
                  <th class="micro-label text-left px-4 py-2">Alumno</th>
                  <th class="micro-label text-left px-4 py-2">RUT</th>
                  <th class="micro-label text-left px-4 py-2">Curso</th>
                  <th class="micro-label text-center px-4 py-2">Prácticas</th>
                  <th class="micro-label text-left px-4 py-2">Fecha Término</th>
                  <th class="micro-label text-left px-4 py-2">N° Certificado</th>
                  <th class="micro-label text-center px-4 py-2">Estado</th>
                  <th class="micro-label text-right px-4 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (alumno of pagedAlumnos(); track alumno.enrollmentId) {
                  <!-- Fila principal -->
                  <tr class="border-b border-(--border-default) last:border-b-0 transition-colors">
                    <!-- fix-484-m: el Nº de matrícula identifica al alumno -->
                    <td class="px-4 py-2 item-title whitespace-nowrap tabular-nums">
                      {{ alumno.numeroMatricula ?? '—' }}
                    </td>
                    <td class="px-4 py-2 font-medium text-text-primary">
                      {{ alumno.nombre }}
                    </td>
                    <td class="px-4 py-2 text-brand whitespace-nowrap">
                      {{ alumno.rut }}
                    </td>
                    <td class="px-4 py-2">
                      <app-badge variant="brand">{{ alumno.curso }}</app-badge>
                    </td>
                    <!-- Prácticas: verde solo completas (el admin ve también incompletos, hotfix-165-m) -->
                    <td class="px-4 py-2 text-center">
                      <span
                        class="font-semibold"
                        [class.text-success]="alumno.clasesCompletadas >= alumno.clasesTotales"
                        [class.text-warning]="alumno.clasesCompletadas < alumno.clasesTotales"
                      >
                        {{ alumno.clasesCompletadas }}/{{ alumno.clasesTotales }}
                      </span>
                    </td>
                    <td class="px-4 py-2 text-text-muted">
                      {{ alumno.fechaTermino ?? '—' }}
                    </td>
                    <td class="px-4 py-2 text-brand">
                      {{ alumno.certificadoFolio ?? '—' }}
                    </td>
                    <td class="px-4 py-2 text-center">
                      @if (alumno.certificadoStatus === 'generado') {
                        <app-badge variant="success">
                          <span class="inline-flex items-center gap-1">
                            <app-icon name="check" [size]="12" />
                            Generado
                          </span>
                        </app-badge>
                      } @else {
                        <app-badge variant="warning">Pendiente</app-badge>
                      }
                    </td>
                    <td class="px-4 py-2 text-right">
                      <div class="flex items-center justify-end gap-2">
                        @if (alumno.certificadoStatus === 'pendiente') {
                          <button
                            class="group inline-flex items-center justify-center font-semibold transition-all active:scale-95 btn-primary btn-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                            data-llm-action="generate-certificate"
                            [disabled]="generatingId() !== null || isBlockedForRow(alumno)"
                            [attr.title]="
                              isBlockedForRow(alumno)
                                ? 'Faltan prácticas por completar (' +
                                  alumno.clasesCompletadas +
                                  '/' +
                                  alumno.clasesTotales +
                                  ')'
                                : null
                            "
                            [appStableWidth]="generatingId() === alumno.enrollmentId"
                            (click)="onClickGenerar(alumno)"
                          >
                            @if (generatingId() === alumno.enrollmentId) {
                              <app-icon name="loader-2" [size]="12" class="animate-spin" />
                              Generando...
                            } @else {
                              <span class="group-hover:hidden flex items-center gap-1.5">
                                <app-icon name="file-check" [size]="12" />
                                Generar
                              </span>
                              <span class="hidden group-hover:flex items-center gap-1.5">
                                <app-icon name="mouse-pointer-click" [size]="12" />
                                Generar
                              </span>
                            }
                          </button>
                        } @else {
                          <button
                            class="inline-flex items-center font-semibold transition-colors btn-secondary btn-sm"
                            data-llm-action="view-certificate-pdf"
                            (click)="
                              verCertificado.emit({
                                storagePath: alumno.storagePath!,
                                nombre: alumno.nombre,
                              })
                            "
                          >
                            <app-icon name="eye" [size]="13" />
                            Ver
                          </button>
                          <button
                            class="inline-flex items-center justify-center font-semibold transition-colors btn-secondary btn-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            data-llm-action="regenerate-certificate"
                            title="Volver a generar el PDF con los datos y la plantilla actuales"
                            [disabled]="generatingId() !== null"
                            [appStableWidth]="generatingId() === alumno.enrollmentId"
                            (click)="regenerarCertificado.emit(alumno.enrollmentId)"
                          >
                            @if (generatingId() === alumno.enrollmentId) {
                              <app-icon name="loader-circle" [size]="13" class="animate-spin" />
                              Generando...
                            } @else {
                              <app-icon name="refresh-cw" [size]="13" />
                              Regenerar
                            }
                          </button>
                          <button
                            class="inline-flex items-center justify-center font-semibold transition-colors btn-secondary btn-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            data-llm-action="send-certificate-email"
                            [disabled]="sendingEmailId() === alumno.enrollmentId"
                            [appStableWidth]="sendingEmailId() === alumno.enrollmentId"
                            (click)="onClickEmail(alumno)"
                          >
                            @if (sendingEmailId() === alumno.enrollmentId) {
                              <app-icon name="loader-circle" [size]="13" class="animate-spin" />
                              Enviando...
                            } @else if (alumno.emailEnviado) {
                              <app-icon name="mail-check" [size]="13" />
                              Reenviar
                            } @else {
                              <app-icon name="mail" [size]="13" />
                              Email
                            }
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- VISTA 2: Tarjetas compactas (visible cuando la card se angosta, ej. drawer abierto) -->
          <div
            class="mobile-view show-on-squeeze flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2"
          >
            @for (alumno of pagedAlumnos(); track alumno.enrollmentId) {
              <div class="card flex flex-col gap-2.5" appCardHover>
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="micro-label m-0">Matrícula {{ alumno.numeroMatricula ?? '—' }}</p>
                    <p class="item-title truncate m-0">
                      {{ alumno.nombre }}
                    </p>
                    <p class="text-xs text-brand m-0">{{ alumno.rut }}</p>
                  </div>
                  @if (alumno.certificadoStatus === 'generado') {
                    <app-badge variant="success">
                      <span class="inline-flex items-center gap-1">
                        <app-icon name="check" [size]="12" />
                        Generado
                      </span>
                    </app-badge>
                  } @else {
                    <app-badge variant="warning">Pendiente</app-badge>
                  }
                </div>

                <div
                  class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary"
                >
                  <app-badge variant="brand">{{ alumno.curso }}</app-badge>
                  <span
                    class="font-semibold"
                    [class.text-success]="alumno.clasesCompletadas >= alumno.clasesTotales"
                    [class.text-warning]="alumno.clasesCompletadas < alumno.clasesTotales"
                  >
                    {{ alumno.clasesCompletadas }}/{{ alumno.clasesTotales }} prácticas
                  </span>
                  @if (alumno.fechaTermino) {
                    <span class="text-text-muted">{{ alumno.fechaTermino }}</span>
                  }
                  @if (alumno.certificadoFolio) {
                    <span class="text-brand">{{ alumno.certificadoFolio }}</span>
                  }
                </div>

                <div
                  class="flex items-center gap-2 pt-2"
                  style="border-top: 1px dashed var(--border-subtle)"
                >
                  @if (alumno.certificadoStatus === 'pendiente') {
                    <button
                      class="flex-1 inline-flex items-center justify-center font-semibold transition-all active:scale-95 btn-primary btn-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      data-llm-action="generate-certificate"
                      [disabled]="generatingId() !== null || isBlockedForRow(alumno)"
                      [attr.title]="
                        isBlockedForRow(alumno)
                          ? 'Faltan prácticas por completar (' +
                            alumno.clasesCompletadas +
                            '/' +
                            alumno.clasesTotales +
                            ')'
                          : null
                      "
                      (click)="onClickGenerar(alumno)"
                    >
                      @if (generatingId() === alumno.enrollmentId) {
                        <app-icon name="loader-2" [size]="12" class="animate-spin" />
                        Generando...
                      } @else {
                        <app-icon name="file-check" [size]="12" />
                        Generar
                      }
                    </button>
                  } @else {
                    <button
                      class="flex-1 inline-flex items-center justify-center font-semibold transition-colors btn-secondary btn-sm"
                      data-llm-action="view-certificate-pdf"
                      (click)="
                        verCertificado.emit({
                          storagePath: alumno.storagePath!,
                          nombre: alumno.nombre,
                        })
                      "
                    >
                      <app-icon name="eye" [size]="13" />
                      Ver
                    </button>
                    <button
                      class="flex-1 inline-flex items-center justify-center font-semibold transition-colors btn-secondary btn-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      data-llm-action="regenerate-certificate"
                      [disabled]="generatingId() !== null"
                      (click)="regenerarCertificado.emit(alumno.enrollmentId)"
                    >
                      @if (generatingId() === alumno.enrollmentId) {
                        <app-icon name="loader-circle" [size]="13" class="animate-spin" />
                        Generando...
                      } @else {
                        <app-icon name="refresh-cw" [size]="13" />
                        Regenerar
                      }
                    </button>
                    <button
                      class="flex-1 inline-flex items-center justify-center font-semibold transition-colors btn-secondary btn-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      data-llm-action="send-certificate-email"
                      [disabled]="sendingEmailId() === alumno.enrollmentId"
                      (click)="onClickEmail(alumno)"
                    >
                      @if (sendingEmailId() === alumno.enrollmentId) {
                        <app-icon name="loader-circle" [size]="13" class="animate-spin" />
                        Enviando...
                      } @else if (alumno.emailEnviado) {
                        <app-icon name="mail-check" [size]="13" />
                        Reenviar
                      } @else {
                        <app-icon name="mail" [size]="13" />
                        Email
                      }
                    </button>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Paginación tabla principal -->
          @if (totalPagesAlumnos() > 1) {
            <div
              class="flex items-center justify-between px-4 py-3 border-t border-border-default shrink-0"
            >
              <span class="text-xs text-text-muted">
                {{ currentPageAlumnos() * PAGE_SIZE + 1 }}–{{
                  pageEnd(currentPageAlumnos(), filteredAlumnos().length)
                }}
                de {{ filteredAlumnos().length }} alumnos
              </span>
              <div class="flex items-center gap-1">
                <button
                  class="p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary"
                  [disabled]="currentPageAlumnos() === 0"
                  aria-label="Página anterior"
                  (click)="prevPageAlumnos()"
                >
                  <app-icon name="chevron-left" [size]="16" />
                </button>
                <span class="text-xs px-3 text-text-secondary">
                  Pág. {{ currentPageAlumnos() + 1 }} / {{ totalPagesAlumnos() }}
                </span>
                <button
                  class="p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary"
                  [disabled]="currentPageAlumnos() >= totalPagesAlumnos() - 1"
                  aria-label="Página siguiente"
                  (click)="nextPageAlumnos()"
                >
                  <app-icon name="chevron-right" [size]="16" />
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* Dual-viewport: tabla vs. tarjetas según el ancho REAL de la card
         (container query, no viewport) — se activa al angostar por un drawer abierto. */
      .dual-viewport-container {
        container-type: inline-size;
        container-name: certListContainer;
      }

      .show-on-squeeze {
        display: none;
      }

      @container certListContainer (max-width: 900px) {
        .hide-on-squeeze {
          display: none !important;
        }
        .show-on-squeeze {
          display: flex !important;
        }
      }
    `,
  ],
})
export class CertificacionClaseBContentComponent implements AfterViewInit {
  // ── Internal ────────────────────────────────────────────────────────────────
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');
  // ── Inputs ──
  readonly alumnos = input<CertificacionAlumnoRow[]>([]);
  readonly kpis = input<CertificacionKpis | null>(null);
  readonly isLoading = input(false);
  /** ID del enrollment cuyo certificado se está generando. null = ninguno en curso. */
  readonly generatingId = input<number | null>(null);
  /** ID del enrollment cuyo correo se está enviando. null = ninguno en curso. */
  readonly sendingEmailId = input<number | null>(null);
  /** true mientras el envío masivo está en curso. */
  readonly sendingMasivo = input(false);
  /** true mientras la Edge Function genera el ZIP de exportación. */
  readonly isExporting = input(false);
  /** true mientras se están generando certificados pendientes en lote. */
  readonly isGeneratingPendientes = input(false);
  /** true si el usuario autenticado es admin — habilita el bypass de prácticas incompletas. */
  readonly isAdmin = input(false);

  // ── Outputs ──
  /** fix-466-m: el facade confirma con un modal (avisos, deuda) y decide el bypass admin. */
  readonly generarCertificado = output<number>();
  readonly verCertificado = output<{ storagePath: string; nombre: string }>();
  readonly enviarEmail = output<number>();
  /** fix-464-m: reemitir el PDF de un certificado ya generado (conserva el folio). */
  readonly regenerarCertificado = output<number>();
  readonly abrirHistorialDrawer = output<void>();
  readonly abrirGenerarPendientesDrawer = output<void>();
  readonly abrirEnviarMasivoDrawer = output<void>();
  readonly exportar = output<void>();

  // ── Local state ──
  readonly estadoFilter = signal<EstadoFilter>(null);
  readonly searchQuery = signal('');
  readonly currentPageAlumnos = signal(0);

  // ── Pagination ──
  readonly PAGE_SIZE = 10;

  // ── Hero config ──
  readonly heroActions = computed((): SectionHeroAction[] => [
    { id: 'historial', label: 'Historial de emisiones', icon: 'scroll', primary: false },
  ]);

  readonly heroKpis = computed((): SectionHeroKpi[] => {
    const k = this.kpis();
    return [
      { id: 'total', label: 'Total Alumnos', value: k?.totalAlumnos ?? 0, icon: 'graduation-cap' },
      {
        id: 'generados',
        label: 'Generados',
        value: k?.certificadosGenerados ?? 0,
        icon: 'check-circle',
        color: 'success',
      },
      {
        id: 'pend-gen',
        label: 'Pend. Generación',
        value: k?.pendientesGeneracion ?? 0,
        icon: 'clock',
        color: 'warning',
      },
      { id: 'pend-env', label: 'Pend. Envío', value: k?.pendientesEnvio ?? 0, icon: 'mail' },
    ];
  });

  handleHeroAction(actionId: string): void {
    if (actionId === 'historial') this.abrirHistorialDrawer.emit();
  }

  // ── Filter options ──
  /** Abre con "Todos los estados" = null, su valor por defecto (spec 0022-m). */
  readonly estadoOptions = withAllOption(
    [
      { label: 'Generados', value: 'generado' },
      { label: 'Pendientes', value: 'pendiente' },
    ],
    'Todos los estados',
  );

  /** Muestra "Limpiar filtros": un estado elegido o texto en el buscador. */
  readonly hasActiveFilters = computed(
    () => this.estadoFilter() !== null || this.searchQuery() !== '',
  );

  clearFilters(): void {
    this.estadoFilter.set(null);
    this.searchQuery.set('');
    this.currentPageAlumnos.set(0);
  }

  // ── Skeleton helpers ──
  readonly skeletonRows = Array.from({ length: 6 });

  // ── Computed ──

  /** fix-484-m: estado + texto (Nº de matrícula, nombre o RUT), igual que Profesional. */
  readonly filteredAlumnos = computed(() =>
    filterCertificadoAlumnos(this.alumnos(), this.estadoFilter(), this.searchQuery()),
  );

  readonly totalPagesAlumnos = computed(() =>
    Math.ceil(this.filteredAlumnos().length / this.PAGE_SIZE),
  );

  readonly pagedAlumnos = computed(() => {
    const page = this.currentPageAlumnos();
    const start = page * this.PAGE_SIZE;
    return this.filteredAlumnos().slice(start, start + this.PAGE_SIZE);
  });

  /** fix-462-m: los que "Generar pendientes" emite — mismo criterio que `pendientesElegibles`. */
  readonly pendientesCount = computed(
    () =>
      this.alumnos().filter(
        (a) => a.certificadoStatus === 'pendiente' && a.clasesCompletadas >= a.clasesTotales,
      ).length,
  );

  /** Alumnos con certificado generado que aún no recibieron el correo. */
  readonly alumnosParaEnvioMasivo = computed(() =>
    this.alumnos().filter(
      (a) => a.certificadoStatus === 'generado' && !a.emailEnviado && !!a.email,
    ),
  );

  // ── Filter/search setters (reset page on change) ──

  setEstadoFilter(value: EstadoFilter): void {
    this.estadoFilter.set(value);
    this.currentPageAlumnos.set(0);
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
    this.currentPageAlumnos.set(0);
  }

  // ── Pagination navigation ──

  prevPageAlumnos(): void {
    this.currentPageAlumnos.update((p) => Math.max(0, p - 1));
  }

  nextPageAlumnos(): void {
    this.currentPageAlumnos.update((p) => Math.min(this.totalPagesAlumnos() - 1, p + 1));
  }

  /** Upper bound of the current page range (for "X–Y de N" label). */
  pageEnd(currentPage: number, total: number): number {
    return Math.min((currentPage + 1) * this.PAGE_SIZE, total);
  }

  // ── Handlers de generación ──

  /**
   * fix-011-i (H-025): secretaría nunca puede saltarse el gate de prácticas —
   * el botón queda deshabilitado (antes: clickeaba y no pasaba nada, sin feedback).
   * Admin no se bloquea acá: el modal del facade le avisa las prácticas que faltan (fix-466-m).
   */
  isBlockedForRow(alumno: CertificacionAlumnoRow): boolean {
    return !this.isAdmin() && alumno.clasesCompletadas < alumno.clasesTotales;
  }

  /** Botón "Generar": la confirmación (y el bypass admin) la resuelve el facade (fix-466-m). */
  onClickGenerar(alumno: CertificacionAlumnoRow): void {
    if (this.isBlockedForRow(alumno)) return;
    this.generarCertificado.emit(alumno.enrollmentId);
  }

  /** fix-466-m: el facade confirma el envío con un modal (antes, una fila inline). */
  onClickEmail(alumno: CertificacionAlumnoRow): void {
    this.enviarEmail.emit(alumno.enrollmentId);
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }
}
