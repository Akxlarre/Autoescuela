import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  effect,
  inject,
  viewChild,
  ElementRef,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

// Shared Components
import { IconComponent } from '../icon/icon.component';
import { KpiCardVariantComponent } from '../kpi-card/kpi-card-variant.component';
import { ActionKpiCardComponent } from '../kpi-card/action-kpi-card.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';

// Directives
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';

// Services
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

// Features
import { SecretariaMatriculaComponent } from '@features/secretaria/matricula/secretaria-matricula.component';
import { AlumnosPorVencerDrawerComponent } from '../alumnos-por-vencer-drawer/alumnos-por-vencer-drawer.component';

// Models
import type {
  AlumnoTableRow,
  AlumnoExpediente,
  AlumnoStatus,
} from '@core/models/ui/alumno-table-row.model';

interface ExpedienteStatus {
  label: 'Completo' | 'Parcial' | 'Pendiente';
  severity: 'success' | 'warn' | 'danger';
  count: string;
}

/** Forma de KPI para app-kpi-card-variant (compatible con Dashboard). */
interface AlumnoKpiItem {
  id: string;
  label: string;
  value: number;
  icon: 'users' | 'user-check' | 'circle-alert';
  color: 'default' | 'success' | 'warning' | 'error';
  accent?: boolean;
  suffix?: string;
  prefix?: string;
  trend?: number;
  trendLabel?: string;
  subValue?: string;
}

@Component({
  selector: 'app-alumnos-list-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    TooltipModule,
    IconComponent,
    KpiCardVariantComponent,
    ActionKpiCardComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
    AnimateInDirective,
    SectionHeroComponent,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid aria-label="Panel de alumnos">
      <app-section-hero
        title="Alumnos"
        subtitle="Listado de alumnos de la escuela"
        [chips]="heroChips()"
        [actions]="heroActions()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- KPIs — usando el mismo patrón que el Dashboard -->
      @for (kpi of alumnosKpis(); track kpi.id) {
        <div class="bento-square">
          <app-kpi-card-variant
            [label]="kpi.label"
            [value]="kpi.value"
            [suffix]="kpi.suffix ?? ''"
            [prefix]="kpi.prefix ?? ''"
            [trend]="kpi.trend"
            [trendLabel]="kpi.trendLabel ?? ''"
            [subValue]="kpi.subValue ?? ''"
            [accent]="kpi.accent ?? false"
            [icon]="kpi.icon"
            [color]="kpi.color"
            [loading]="isLoading()"
          />
        </div>
      }
      <div class="bento-square">
        <app-action-kpi-card
          label="Por Vencer"
          [value]="alumnosPorVencer().length"
          icon="alert-triangle"
          size="md"
          color="error"
          [pulse]="true"
          [loading]="isLoading()"
          (click)="openPorVencerDrawer()"
        >
          <div
            footer
            class="flex items-center gap-1 text-xs text-text-muted mt-2 group-hover:text-text-primary transition-colors"
          >
            <span>Ver detalles</span>
            <app-icon name="arrow-right" [size]="12" />
          </div>
        </app-action-kpi-card>
      </div>
      <!-- (End FAQs/KPIs) -->

      <!-- Filtros y Tabla (Dual-Viewport) -->
      <div
        class="bento-banner card p-0 overflow-hidden shadow-sm dual-viewport-container"
        #tableCard
      >
        <!-- Toolbar de la tabla -->
        <div class="toolbar-wrapper">
          <div class="toolbar-filters">
            <div class="toolbar-search">
              <app-icon
                name="search"
                [size]="16"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10 pointer-events-none"
              />
              <input
                pInputText
                type="text"
                placeholder="Buscar por nombre, RUT o Nº Expediente..."
                class="w-full !pl-10 h-10 rounded-lg border-border-subtle hover:border-border-strong focus:border-brand bg-base"
                [(ngModel)]="searchTerm"
              />
            </div>

            <div class="toolbar-dropdowns">
              <p-select
                [options]="cursos"
                [(ngModel)]="selectedCurso"
                placeholder="Todos los cursos"
                styleClass="w-full h-10"
              ></p-select>
              <p-select
                [options]="estados"
                [(ngModel)]="selectedEstado"
                placeholder="Todos los estados"
                styleClass="w-full h-10"
              ></p-select>
              <p-select
                [options]="expedienteOpciones"
                [(ngModel)]="selectedExpediente"
                placeholder="Expediente: Todos"
                styleClass="w-full h-10 toolbar-dropdown--full"
              ></p-select>
            </div>
          </div>

          <div class="toolbar-actions">
            <button pButton label="Exportar" class="p-button-outlined p-button-sm h-10">
              <app-icon name="file-text" [size]="14" class="mr-2" />
            </button>
            <button
              pButton
              label="Actualizar"
              class="p-button-outlined p-button-sm h-10"
              [loading]="isLoading()"
              (click)="refresh()"
            >
              <app-icon name="refresh-cw" [size]="14" class="mr-2" />
            </button>
          </div>
        </div>

        <!-- Tabla -->
        @if (isLoading()) {
          <div class="viewport-content bg-surface" appAnimateIn>
            <!-- VISTA 1: TABLA SKELETON (Oculta cuando se comprime) -->
            <div class="desktop-view hide-on-squeeze p-4 space-y-0">
              <!-- Header skeleton -->
              <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                <app-skeleton-block variant="text" width="15%" height="11px" />
                <app-skeleton-block variant="text" width="9%" height="11px" />
                <app-skeleton-block variant="text" width="9%" height="11px" />
                <app-skeleton-block variant="text" width="9%" height="11px" />
                <app-skeleton-block variant="text" width="11%" height="11px" />
                <app-skeleton-block variant="text" width="7%" height="11px" />
                <app-skeleton-block variant="text" width="9%" height="11px" />
              </div>
              <!-- Row skeletons -->
              @for (row of [1, 2, 3, 4, 5, 6]; track row) {
                <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                  <div class="flex items-center gap-3 w-[15%]">
                    <app-skeleton-block variant="circle" width="36px" height="36px" />
                    <div class="flex flex-col gap-1.5 flex-1">
                      <app-skeleton-block variant="text" width="75%" height="12px" />
                      <app-skeleton-block variant="text" width="55%" height="10px" />
                    </div>
                  </div>
                  <app-skeleton-block variant="text" width="9%" height="12px" />
                  <app-skeleton-block variant="text" width="9%" height="12px" />
                  <app-skeleton-block variant="rect" width="64px" height="20px" />
                  <app-skeleton-block variant="text" width="11%" height="12px" />
                  <app-skeleton-block variant="rect" width="56px" height="20px" />
                  <app-skeleton-block variant="rect" width="72px" height="20px" />
                  <div class="flex items-center gap-1 ml-auto">
                    <app-skeleton-block variant="circle" width="28px" height="28px" />
                    <app-skeleton-block variant="circle" width="28px" height="28px" />
                    <app-skeleton-block variant="circle" width="28px" height="28px" />
                  </div>
                </div>
              }
              <!-- Pagination skeleton -->
              <div class="flex items-center justify-between pt-3">
                <app-skeleton-block variant="text" width="210px" height="12px" />
                <div class="flex gap-1">
                  <app-skeleton-block variant="rect" width="32px" height="32px" />
                  <app-skeleton-block variant="rect" width="32px" height="32px" />
                  <app-skeleton-block variant="rect" width="32px" height="32px" />
                </div>
              </div>
            </div>

            <!-- VISTA 2: TARJETAS SKELETON (Visible cuando se comprime o móvil) -->
            <div class="mobile-view show-on-squeeze p-4 md:p-6 bg-surface">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (card of [1, 2, 3, 4, 5, 6]; track card) {
                  <div
                    class="flex flex-col bg-base border border-border-subtle rounded-xl overflow-hidden shadow-sm"
                  >
                    <!-- Header -->
                    <div
                      class="p-4 border-b border-border-subtle flex items-start justify-between gap-3"
                    >
                      <div class="flex items-center gap-3 min-w-0 flex-1">
                        <app-skeleton-block
                          variant="circle"
                          width="40px"
                          height="40px"
                          class="shrink-0"
                        />
                        <div class="flex flex-col gap-2 w-full">
                          <app-skeleton-block variant="text" width="80%" height="12px" />
                          <app-skeleton-block variant="text" width="60%" height="10px" />
                        </div>
                      </div>
                      <app-skeleton-block
                        variant="rect"
                        width="48px"
                        height="20px"
                        class="shrink-0"
                      />
                    </div>

                    <!-- Body -->
                    <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4 bg-surface">
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="40%" height="10px" />
                        <app-skeleton-block variant="text" width="80%" height="12px" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="60%" height="10px" />
                        <app-skeleton-block variant="rect" width="70px" height="20px" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="45%" height="10px" />
                        <app-skeleton-block variant="text" width="65%" height="12px" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="50%" height="10px" />
                        <app-skeleton-block variant="text" width="70%" height="12px" />
                      </div>
                    </div>

                    <!-- Footer Actions -->
                    <div
                      class="p-2 bg-transparent border-t border-border-subtle flex items-center justify-end gap-1"
                    >
                      <app-skeleton-block variant="circle" width="32px" height="32px" />
                      <app-skeleton-block variant="circle" width="32px" height="32px" />
                      <app-skeleton-block variant="circle" width="32px" height="32px" />
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        } @else {
          <!-- Contenido principal interactivo -->
          <div class="viewport-content bg-surface" appAnimateIn>
            <!-- VISTA 1: LA TABLA CLÁSICA (Oculta cuando se comprime) -->
            <div class="desktop-view hide-on-squeeze">
              <p-table
                [value]="filteredAlumnos()"
                [rows]="10"
                [paginator]="true"
                responsiveLayout="scroll"
                styleClass="p-datatable-sm p-datatable-striped"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} alumnos"
              >
                <ng-template pTemplate="header">
                  <tr
                    class="bg-subtle text-text-muted uppercase text-xs tracking-wider font-medium text-left"
                  >
                    <th class="pl-6 py-4">Alumno</th>
                    <th>RUT</th>
                    <th>Nº Exp.</th>
                    <th>Curso</th>
                    <th>Fecha Ingreso</th>
                    <th>Estado</th>
                    <th>Expediente</th>
                    <th class="pr-6 text-right">Acciones</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-alumno>
                  <tr class="hover:bg-subtle transition-colors border-b border-border-subtle">
                    <!-- Alumno -->
                    <td class="pl-6 py-4">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-9 h-9 rounded-full bg-elevated flex items-center justify-center border border-border-subtle text-text-secondary font-bold text-xs uppercase"
                        >
                          {{ alumno.nombre[0] }}{{ alumno.apellido[0] }}
                        </div>
                        <div class="flex flex-col">
                          <span class="font-bold text-sm text-text-primary"
                            >{{ alumno.nombre }} {{ alumno.apellido }}</span
                          >
                          <span class="text-xs text-text-muted">{{ alumno.email }}</span>
                        </div>
                      </div>
                    </td>
                    <!-- RUT -->
                    <td class="text-xs font-medium text-text-secondary font-mono">
                      {{ alumno.rut }}
                    </td>
                    <!-- Nº Expediente -->
                    <td class="text-xs text-text-muted font-mono">{{ alumno.nroExpediente }}</td>
                    <!-- Curso -->
                    <td>
                      <span
                        class="text-xs px-2 py-0.5 rounded-full bg-elevated border border-border-subtle text-text-secondary"
                      >
                        {{ alumno.cursa }}
                      </span>
                    </td>
                    <!-- Fecha Ingreso -->
                    <td class="text-xs text-text-secondary">{{ alumno.fechaIngreso }}</td>
                    <!-- Estado -->
                    <td>
                      <p-tag
                        [value]="alumno.status"
                        [severity]="getStatusSeverity(alumno.status)"
                        styleClass="text-xs font-bold px-2 py-0.5"
                      ></p-tag>
                    </td>
                    <!-- RF-085: Expediente (Completo/Parcial/Pendiente) -->
                    <td>
                      @let exp = getExpedienteStatus(alumno.expediente);
                      <p-tag
                        [value]="exp.label + ' · ' + exp.count"
                        [severity]="exp.severity"
                        styleClass="text-xs font-bold px-2 py-0.5 bg-transparent border border-current"
                        [pTooltip]="
                          'CI: ' +
                          (alumno.expediente.ci ? 'Sí' : 'No') +
                          ' | Foto: ' +
                          (alumno.expediente.foto ? 'Sí' : 'No') +
                          ' | Médico: ' +
                          (alumno.expediente.medico ? 'Sí' : 'No') +
                          ' | SEMEP: ' +
                          (alumno.expediente.semep ? 'Sí' : 'No')
                        "
                      ></p-tag>
                    </td>
                    <!-- Acciones -->
                    <td class="pr-6 text-right">
                      <div
                        class="inline-flex items-center justify-end gap-0.5 p-0.5 rounded-lg hover:bg-elevated hover:shadow-sm border border-transparent transition-all"
                      >
                        <!-- Ver Ficha -->
                        <button
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                          pTooltip="Ver ficha"
                          [routerLink]="[basePath() + '/alumnos/' + alumno.id]"
                        >
                          <app-icon name="eye" [size]="16" />
                        </button>
                        <!-- Certificado -->
                        <button
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                          pTooltip="Certificado"
                          [routerLink]="[basePath() + '/certificados']"
                          [queryParams]="{ alumno: alumno.id }"
                        >
                          <app-icon name="award" [size]="16" />
                        </button>
                        <!-- RF-086: Exportar Ficha PDF -->
                        <button
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                          pTooltip="Exportar Ficha PDF"
                          (click)="exportarFicha(alumno.id)"
                        >
                          <app-icon name="download" [size]="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr>
                    <td colspan="8" class="p-0">
                      <app-empty-state
                        icon="search"
                        message="No se encontraron alumnos"
                        subtitle="Intenta ajustar los criterios de búsqueda o filtros."
                        actionLabel="Limpiar filtros"
                        actionIcon="refresh-cw"
                        (action)="resetFilters()"
                      />
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </div>

            <!-- VISTA 2: TARJETAS APILADAS (Visible cuando se comprime o en móvil) -->
            <div class="mobile-view show-on-squeeze p-4 md:p-6 bg-surface">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (alumno of filteredAlumnos(); track alumno.id) {
                  <div
                    class="flex flex-col bg-base border border-border-subtle rounded-xl overflow-hidden shadow-sm hover:border-brand hover:-translate-y-0.5 hover:shadow-md transition-all duration-300"
                  >
                    <!-- Header -->
                    <div
                      class="p-4 border-b border-border-subtle flex items-start justify-between gap-3"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          class="shrink-0 w-10 h-10 rounded-full bg-surface shadow-sm flex items-center justify-center border border-border-default text-text-primary font-black text-sm uppercase"
                        >
                          {{ alumno.nombre[0] }}{{ alumno.apellido[0] }}
                        </div>
                        <div class="flex flex-col min-w-0">
                          <span class="font-bold text-sm text-text-primary truncate"
                            >{{ alumno.nombre }} {{ alumno.apellido }}</span
                          >
                          <span class="text-xs text-text-muted truncate">{{ alumno.email }}</span>
                        </div>
                      </div>
                      <p-tag
                        [value]="alumno.status"
                        [severity]="getStatusSeverity(alumno.status)"
                        styleClass="text-[10px] font-bold px-2 py-0.5 shrink-0"
                      ></p-tag>
                    </div>

                    <!-- Body -->
                    <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4 text-sm bg-surface">
                      <div class="flex flex-col">
                        <span class="text-[11px] text-text-muted mb-0.5">RUT</span>
                        <span class="font-medium text-text-secondary font-mono text-xs">{{
                          alumno.rut
                        }}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-[11px] text-text-muted mb-0.5">Expediente</span>
                        @let exp = getExpedienteStatus(alumno.expediente);
                        <div class="flex items-center">
                          <p-tag
                            [value]="exp.label + ' · ' + exp.count"
                            [severity]="exp.severity"
                            styleClass="text-[10px] font-bold px-1.5 py-0.5 bg-transparent border border-current"
                          ></p-tag>
                        </div>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-[11px] text-text-muted mb-0.5">Curso</span>
                        <span class="font-medium text-text-secondary text-xs truncate">{{
                          alumno.cursa
                        }}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-[11px] text-text-muted mb-0.5">Ingreso</span>
                        <span class="font-medium text-text-secondary text-xs">{{
                          alumno.fechaIngreso
                        }}</span>
                      </div>
                    </div>

                    <!-- Footer Actions -->
                    <div
                      class="p-2 bg-transparent border-t border-border-subtle flex items-center justify-end gap-0.5"
                    >
                      <button
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
                        pTooltip="Ver ficha"
                        [routerLink]="[basePath() + '/alumnos/' + alumno.id]"
                      >
                        <app-icon name="eye" [size]="16" />
                      </button>
                      <button
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
                        pTooltip="Certificado"
                        [routerLink]="[basePath() + '/certificados']"
                        [queryParams]="{ alumno: alumno.id }"
                      >
                        <app-icon name="award" [size]="16" />
                      </button>
                      <button
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
                        pTooltip="Exportar Ficha PDF"
                        (click)="exportarFicha(alumno.id)"
                      >
                        <app-icon name="download" [size]="16" />
                      </button>
                    </div>
                  </div>
                } @empty {
                  <div class="col-span-full py-8">
                    <app-empty-state
                      icon="search"
                      message="No se encontraron alumnos"
                      subtitle="Intenta ajustar los criterios de búsqueda o filtros."
                      actionLabel="Limpiar filtros"
                      actionIcon="refresh-cw"
                      (action)="resetFilters()"
                    />
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* Container Queries para Dual-Viewport Render */
      .dual-viewport-container {
        container-type: inline-size;
        container-name: listContainer;
      }

      /* Por defecto (Pantallas grandes): Mostramos tabla, ocultamos tarjetas */
      .show-on-squeeze {
        display: none;
      }

      @container listContainer (max-width: 900px) {
        .hide-on-squeeze {
          display: none !important;
        }
        .show-on-squeeze {
          display: block !important;
        }
      }

      /* --- Toolbar Container Queries --- */
      .toolbar-wrapper {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
        border-bottom: 1px solid var(--border-subtle);
        background-color: var(--surface);
      }
      .toolbar-filters {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        width: 100%;
      }
      .toolbar-search {
        width: 100%;
        position: relative;
      }
      .toolbar-dropdowns {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
        width: 100%;
      }
      /* Selector complejo porque PrimeNG injecta clases inner */
      ::ng-deep .toolbar-dropdown--full {
        grid-column: span 2;
      }
      .toolbar-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
      }
      .toolbar-actions button {
        flex: 1;
        justify-content: center;
      }

      @container listContainer (min-width: 900px) {
        .toolbar-wrapper {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }
        .toolbar-filters {
          flex-direction: row;
          align-items: center;
          flex-wrap: wrap;
          width: auto;
          flex: 1;
        }
        .toolbar-search {
          width: 20rem; /* equiv md:w-80 */
        }
        .toolbar-dropdowns {
          display: flex;
          width: auto;
        }
        ::ng-deep .toolbar-dropdowns p-select {
          min-width: 11rem;
        }
        ::ng-deep .toolbar-dropdown--full {
          grid-column: auto;
        }
        .toolbar-actions {
          width: auto;
        }
        .toolbar-actions button {
          flex: none;
        }
      }
    `,
  ],
})
export class AlumnosListContentComponent {
  // ── Inputs ──────────────────────────────────────────────────────────────
  readonly basePath = input.required<string>();
  readonly alumnos = input<AlumnoTableRow[]>([]);
  readonly isLoading = input(false);
  readonly alumnosPorVencer = input<AlumnoTableRow[]>([]);

  // ── Outputs ─────────────────────────────────────────────────────────────
  readonly refreshRequested = output<void>();
  readonly claseOnlineAction = output<'zoom' | 'asistencia'>();
  readonly preInscritosRequested = output<void>();

  // ── Internal UI state ────────────────────────────────────────────────────
  private readonly gsap = inject(GsapAnimationsService);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  readonly heroChips = computed((): SectionHeroChip[] => [
    { label: `${this.totalAlumnos()} alumnos`, icon: 'users', style: 'default' },
  ]);

  readonly heroActions = computed((): SectionHeroAction[] => {
    const path = this.basePath();
    return [
      { id: 'enviar-zoom', label: 'Enviar enlace Zoom', icon: 'video', primary: false },
      {
        id: 'registrar-asistencia',
        label: 'Registrar asistencia',
        icon: 'check-circle',
        primary: false,
      },
      {
        id: 'historial',
        label: 'Historial Ex-Alumnos',
        icon: 'archive',
        primary: false,
        route: `${path}/ex-alumnos`,
      },
      { id: 'preinscritos', label: 'Ver Pre-inscritos', icon: 'users', primary: false },
      {
        id: 'nueva-matricula',
        label: 'Nueva Matrícula',
        icon: 'plus',
        primary: true,
      },
    ];
  });

  /** KPIs estáticos para la grilla (Total, Activos, Con deuda). Misma forma que Dashboard. */
  readonly alumnosKpis = computed((): AlumnoKpiItem[] => [
    {
      id: 'total',
      label: 'Total Alumnos',
      value: this.totalAlumnos(),
      icon: 'users',
      color: 'default',
      accent: true,
    },
    {
      id: 'activos',
      label: 'Activos',
      value: this.activos(),
      icon: 'user-check',
      color: 'success',
    },
    {
      id: 'deuda',
      label: 'Con deuda',
      value: this.conDeuda(),
      icon: 'circle-alert',
      color: 'warning',
    },
  ]);

  searchTerm = '';
  selectedCurso: string | null = null;
  selectedEstado: string | null = null;
  selectedExpediente: string | null = null;
  isDrawerOpen = signal(false);

  cursos = ['Clase B', 'Clase B + SENCE', 'Clase A2', 'Profesional'];
  estados = [
    'Activo',
    'Finalizado',
    'Retirado',
    'Pre-inscrito',
    'Pendiente Pago',
    'Docs Pendientes',
    'Inactivo',
  ];
  expedienteOpciones = ['Completo', 'Parcial', 'Pendiente'];

  constructor() {
    // 1. Initial page load animation
    afterNextRender(() => {
      // Stagger only the KPIs on load; the main table card
      // is handled by the View Transitions API (vt-page-in)
      if (this.bentoGrid()) {
        setTimeout(() => {
          this.gsap.animateBentoGrid(this.bentoGrid()!.nativeElement);
        }, 50);
      }
    });
  }

  filteredAlumnos(): AlumnoTableRow[] {
    return this.alumnos().filter((a) => {
      const term = this.searchTerm.toLowerCase();
      const matchSearch =
        !term ||
        a.nombre.toLowerCase().includes(term) ||
        a.apellido.toLowerCase().includes(term) ||
        a.rut.includes(term) ||
        a.nroExpediente.toLowerCase().includes(term);

      const matchCurso = !this.selectedCurso || a.cursa === this.selectedCurso;
      const matchEstado = !this.selectedEstado || a.status === this.selectedEstado;
      const matchExpediente = (() => {
        if (!this.selectedExpediente) return true;
        const exp = this.getExpedienteStatus(a.expediente);
        return exp.label === this.selectedExpediente;
      })();

      return matchSearch && matchCurso && matchEstado && matchExpediente;
    });
  }

  totalAlumnos(): number {
    return this.alumnos().length;
  }

  activos(): number {
    return this.alumnos().filter((a) => a.status === 'Activo').length;
  }

  conDeuda(): number {
    return this.alumnos().filter((a) => a.pago_por_pagar > 0).length;
  }

  getExpedienteStatus(exp: AlumnoExpediente): ExpedienteStatus {
    const docs = [exp.ci, exp.foto, exp.medico, exp.semep];
    const ok = docs.filter(Boolean).length;
    const total = docs.length;
    const count = `${ok}/${total}`;
    if (ok === total) return { label: 'Completo', severity: 'success', count };
    if (ok === 0) return { label: 'Pendiente', severity: 'danger', count };
    return { label: 'Parcial', severity: 'warn', count };
  }

  getStatusSeverity(
    status: AlumnoStatus | string,
  ): 'success' | 'secondary' | 'info' | 'danger' | 'warn' | undefined {
    switch (status) {
      case 'Activo':
        return 'success';
      case 'Finalizado':
        return 'info';
      case 'Retirado':
        return 'danger';
      case 'Pre-inscrito':
        return 'warn';
      case 'Pendiente Pago':
        return 'warn';
      case 'Docs Pendientes':
        return 'info';
      case 'Inactivo':
        return 'secondary';
      default:
        return 'secondary';
    }
  }

  refresh(): void {
    this.refreshRequested.emit();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCurso = null;
    this.selectedEstado = null;
    this.selectedExpediente = null;
  }

  openPorVencerDrawer(): void {
    if (!this.isLoading()) {
      this.layoutDrawer.open(
        AlumnosPorVencerDrawerComponent,
        'Alumnos con Cuotas por Vencer',
        'alert-triangle',
      );
    }
  }

  handleHeroAction(actionId: string): void {
    switch (actionId) {
      case 'enviar-zoom':
        this.enviarEnlaceZoom();
        break;
      case 'registrar-asistencia':
        this.registrarAsistenciaZoom();
        break;
      case 'preinscritos':
        this.preInscritosRequested.emit();
        break;
      case 'nueva-matricula':
        this.openNuevaMatriculaDrawer();
        break;
      default:
        break;
    }
  }

  // RF-054
  enviarEnlaceZoom(): void {
    this.claseOnlineAction.emit('zoom');
  }

  openNuevaMatriculaDrawer(): void {
    this.layoutDrawer.open(SecretariaMatriculaComponent, 'Nueva Matrícula', 'plus');
  }

  // RF-054
  registrarAsistenciaZoom(): void {
    this.claseOnlineAction.emit('asistencia');
  }

  // RF-086
  exportarFicha(id: string): void {
    alert(
      `Exportando Ficha de Matricula (${id})...\n\nSe generara un PDF con los datos del alumno y el contrato firmado.\n\n[Mockup — RF-086]`,
    );
  }
}
