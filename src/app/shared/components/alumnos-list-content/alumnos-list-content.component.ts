import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  inject,
  viewChild,
  ElementRef,
  AfterViewInit,
  OnInit,
  WritableSignal,
} from '@angular/core';
import { sliceByBudget } from '@core/utils/layout-tier.utils';
import { matchesSearchTokens } from '@core/utils/search-filter.utils';
import { buildCourseFilterOptions } from '@core/utils/course-filter-options.utils';
import { withAllOption } from '@core/utils/filter-options.utils';
import { ClearFiltersButtonComponent } from '@shared/components/clear-filters-button/clear-filters-button.component';
import { SortHeaderComponent } from '@shared/components/sort-header/sort-header.component';
import { SortControlComponent } from '@shared/components/sort-control/sort-control.component';
import { buildAlumnosHeroActions } from '@core/utils/alumnos-hero-actions.utils';
import {
  ALUMNO_SORT_OPTIONS,
  nextAlumnoSort,
  sortAlumnos,
  toggleAlumnoSortDirection,
} from '@core/utils/alumnos-sort.utils';
import {
  getExpedienteStatus as computeExpedienteStatus,
  getAlumnoStatusSeverity,
  isAlumnoCursando,
} from '@core/utils/alumno-status.utils';
import type { ExpedienteStatus } from '@core/utils/alumno-status.utils';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

// Shared Components
import { IconComponent } from '../icon/icon.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { BadgeComponent } from '../badge/badge.component';
import { AlumnoCardComponent } from '../alumno-card/alumno-card.component';

// Directives
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import {
  ExportMenuComponent,
  type ExportFormat,
} from '@shared/components/export-menu/export-menu.component';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';

// Services
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

// Features
import { SecretariaMatriculaComponent } from '@features/secretaria/matricula/secretaria-matricula.component';

// Models
import type {
  AlumnoListFilters,
  AlumnoListSort,
  AlumnoSortField,
  AlumnoTableRow,
  AlumnoExpediente,
  AlumnoStatus,
} from '@core/models/ui/alumno-table-row.model';

/**
 * Exportar la lista (fix-281-m): las filas que la pantalla muestra, ya filtradas y en su
 * orden, y si la columna Sede está visible. El archivo trae exactamente lo que se ve.
 */
export interface AlumnoExportRequest {
  format: ExportFormat;
  rows: AlumnoTableRow[];
  showSede: boolean;
}

/** Qué muestra app-empty-state cuando la lista no tiene filas. Sin actionLabel no hay botón. */
interface AlumnosEmptyState {
  icon: string;
  message: string;
  subtitle: string;
  actionLabel?: string;
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
    SelectModule,
    TagModule,
    TooltipModule,
    IconComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    BadgeComponent,
    AlumnoCardComponent,
    BentoGridLayoutDirective,
    AnimateInDirective,
    CardHoverDirective,
    SectionHeroComponent,
    ExportMenuComponent,
    ClearFiltersButtonComponent,
    SortHeaderComponent,
    SortControlComponent,
  ],
  template: `
    <div
      class="bento-grid bento-grid--fill-screen"
      appBentoGridLayout
      #bentoGrid
      aria-label="Panel de alumnos"
      [class.force-compact]="layoutDrawer.isOpen()"
    >
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Alumnos"
        [subtitle]="heroSubtitle()"
        [chips]="heroChips()"
        [kpis]="alumnosKpis()"
        [actions]="heroActions()"
        [backClickable]="trashView()"
        backLabel="Alumnos"
        (backClicked)="trashViewToggled.emit()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- Filtros y Tabla (Dual-Viewport). El modo fill-screen desktop lo da
           .bento-fill (spec 0028); en móvil la card crece con su contenido. -->
      <div
        class="bento-banner bento-fill card p-0 overflow-hidden shadow-sm dual-viewport-container flex flex-col w-full h-full"
        appCardHover
        #tableCard
      >
        <!-- Toolbar de la tabla -->
        <div class="flex flex-wrap items-center gap-3 p-4 border-b border-border-default">
          <!-- Buscador -->
          <div class="relative flex-1 min-w-52 max-w-xs">
            <app-icon
              name="search"
              [size]="15"
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
            />
            <input
              type="text"
              placeholder="Buscar por nombre, RUT o Nº Expediente..."
              class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-border-default bg-surface text-text-primary outline-none transition-colors"
              data-llm-description="Search students by name, RUT or file number"
              [ngModel]="searchTerm()"
              (ngModelChange)="updateFilter(searchTerm, $event)"
            />
          </div>

          <!-- Filtros -->
          <p-select
            [options]="cursos()"
            [ngModel]="selectedCurso()"
            (ngModelChange)="updateFilter(selectedCurso, $event)"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los cursos"
            class="h-9"
            data-llm-description="Filter students by course type"
          />
          <p-select
            [options]="estados"
            [ngModel]="selectedEstado()"
            (ngModelChange)="updateFilter(selectedEstado, $event)"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los estados"
            class="h-9"
            data-llm-description="Filter students by enrollment status"
          />
          <p-select
            [options]="expedienteOpciones"
            [ngModel]="selectedExpediente()"
            (ngModelChange)="updateFilter(selectedExpediente, $event)"
            optionLabel="label"
            optionValue="value"
            placeholder="Expediente: Todos"
            class="h-9"
            data-llm-description="Filter students by file completion status"
          />
          <app-clear-filters-button
            llmSubject="students"
            [active]="hasActiveFilters()"
            (clear)="resetFilters()"
          />

          <!-- Ordenar por (spec 0020-m, AC11): solo en la vista de tarjetas, que no tiene
               títulos de columna. Con la tabla visible se ordena desde los títulos. -->
          <app-sort-control
            class="show-on-squeeze"
            llmSubject="students"
            [options]="sortColumns()"
            [sort]="sort()"
            (fieldChange)="setSortField($any($event))"
            (directionToggle)="toggleSortDirection()"
          />

          <!-- Exportar: mismo menú que Ex-Alumnos (app-export-menu, spec 0021-m) -->
          <app-export-menu
            class="ml-auto"
            llmSubject="students"
            [exporting]="isExporting()"
            [disabled]="sortedAlumnos().length === 0"
            (exportRequested)="requestExport($event)"
          />
        </div>

        <!-- Tabla -->
        @if (isLoading()) {
          <div
            class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full"
            appAnimateIn
          >
            <!-- VISTA 1: TABLA SKELETON (Oculta cuando se comprime) -->
            <div
              class="desktop-view hide-on-squeeze p-4 space-y-0 flex flex-col flex-1 min-h-0 h-full w-full"
            >
              <!-- Header skeleton -->
              <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                <app-skeleton-block variant="text" width="15%" height="11px" />
                <app-skeleton-block variant="text" width="9%" height="11px" />
                <app-skeleton-block variant="text" width="9%" height="11px" />
                <app-skeleton-block variant="text" width="9%" height="11px" />
                @if (showSedeColumn()) {
                  <app-skeleton-block variant="text" width="9%" height="11px" />
                }
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
                  @if (showSedeColumn()) {
                    <app-skeleton-block variant="text" width="9%" height="12px" />
                  }
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
              <div class="bento-grid">
                @for (card of [1, 2, 3, 4, 5, 6]; track card) {
                  <div class="bento-wide" data-col-span="4">
                    <app-alumno-card [loading]="true" [alumno]="skeletonAlumno" />
                  </div>
                }
              </div>
            </div>
          </div>
        } @else if (showLoadError()) {
          <!-- La carga falló y no hay nada que mostrar: no es una lista vacía (hotfix-113-m).
               Centrado en el alto disponible de la celda bento-fill. -->
          <div class="flex-1 flex items-center justify-center bg-surface" role="alert">
            <app-empty-state
              icon="circle-alert"
              [message]="error() ?? ''"
              subtitle="No se pudo obtener la lista. Revisa tu conexión e inténtalo de nuevo."
              actionLabel="Reintentar"
              actionIcon="refresh-cw"
              (action)="refresh()"
            />
          </div>
        } @else {
          <!-- Contenido principal interactivo -->
          <div
            class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full"
            appAnimateIn
          >
            <!-- VISTA 1: LA TABLA CLÁSICA (Oculta cuando se comprime) -->
            <div class="desktop-view hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full">
              <p-table
                [value]="sortedAlumnos()"
                [rows]="10"
                [paginator]="true"
                [first]="tableFirstVisible()"
                (onPage)="onTablePage($event.first)"
                [scrollable]="true"
                scrollHeight="flex"
                responsiveLayout="scroll"
                styleClass="p-datatable-sm p-datatable-striped h-full flex flex-col"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} alumnos"
              >
                <ng-template pTemplate="header">
                  <tr class="micro-label text-left">
                    <!-- spec 0020-m: cada título ordena la lista completa (no solo la página).
                         Clic 1 ascendente, clic 2 descendente, clic 3 vuelve al orden por defecto. -->
                    @for (col of sortColumns(); track col.value; let first = $first) {
                      <th
                        [class.alumno-head]="first"
                        [class.pl-6]="first"
                        [class.py-4]="first"
                        [attr.aria-sort]="ariaSort(col.value)"
                      >
                        <app-sort-header
                          llmSubject="students"
                          [label]="col.label"
                          [field]="col.value"
                          [sort]="sort()"
                          (sortClick)="toggleSort(col.value)"
                        />
                      </th>
                    }
                    <th class="pr-6 text-right">Acciones</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-alumno>
                  <tr class="list-item-hover transition-colors border-b border-border-subtle">
                    <!-- Alumno -->
                    <td class="alumno-cell pl-6 py-4">
                      <div class="flex items-center gap-3">
                        <div
                          class="alumno-avatar w-9 h-9 shrink-0 rounded-full bg-elevated flex items-center justify-center border border-border-subtle text-text-secondary font-bold text-xs uppercase"
                        >
                          {{ alumno.nombre[0] }}{{ alumno.apellido[0] }}
                        </div>
                        <!-- fix-294-m: el nombre y el correo que no caben se recortan y se leen
                             completos al pasar el mouse. -->
                        <div class="flex flex-col min-w-0">
                          <span
                            class="item-title truncate"
                            [title]="alumno.apellido + ' ' + alumno.nombre"
                            >{{ alumno.apellido }} {{ alumno.nombre }}</span
                          >
                          <span class="text-xs text-text-muted truncate" [title]="alumno.email">{{
                            alumno.email
                          }}</span>
                        </div>
                      </div>
                    </td>
                    <!-- RUT -->
                    <td class="text-xs font-medium text-text-secondary font-mono whitespace-nowrap">
                      {{ alumno.rut }}
                    </td>
                    <!-- Nº Expediente -->
                    <td class="text-xs text-text-muted font-mono">
                      <div class="flex flex-wrap gap-1">
                        @for (nro of alumno.nroExpedientes; track nro) {
                          <span>{{ nro }}</span>
                        }
                      </div>
                    </td>
                    <!-- Curso -->
                    <td>
                      <div class="flex flex-wrap gap-1">
                        @for (curso of alumno.cursos; track curso.nombre) {
                          <app-badge
                            class="whitespace-nowrap"
                            [variant]="curso.licenseGroup === 'professional' ? 'brand' : 'neutral'"
                          >
                            {{ curso.nombre }}
                          </app-badge>
                        }
                      </div>
                    </td>
                    @if (showSedeColumn()) {
                      <!-- Sede -->
                      <td class="text-xs text-text-secondary">{{ alumno.sucursal }}</td>
                    }
                    <!-- Fecha Ingreso -->
                    <td class="text-xs text-text-secondary whitespace-nowrap">
                      {{ alumno.fechaIngreso }}
                    </td>
                    <!-- Estado -->
                    <td>
                      <div class="flex flex-col gap-1 items-start">
                        <p-tag
                          [value]="alumno.status"
                          [severity]="getStatusSeverity(alumno.status)"
                          styleClass="text-xs font-bold px-1.5 py-0.5 whitespace-nowrap"
                        ></p-tag>
                        @if (alumno.cursoCompletoPendienteEgreso) {
                          <!-- fix-012-i: curso completo (12/12 + certificado enviado), falta pasar a ex-alumno -->
                          <p-tag
                            value="Curso completo"
                            severity="warn"
                            styleClass="text-2xs font-bold px-2 py-0.5"
                            pTooltip="Certificado enviado y 12/12 prácticas — falta marcar como Ex-Alumno en su ficha"
                            tooltipPosition="top"
                          ></p-tag>
                        }
                      </div>
                    </td>
                    <!-- RF-085: Expediente (Completo/Parcial/Pendiente) -->
                    <td>
                      @let exp = getExpedienteStatus(alumno.expediente);
                      <p-tag
                        [value]="exp.label + ' · ' + exp.count"
                        [severity]="exp.severity"
                        styleClass="text-xs font-bold px-1.5 py-0.5 bg-transparent border border-current whitespace-nowrap"
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
                        @if (trashView()) {
                          <!-- Vista Papelera: solo Restaurar -->
                          <button
                            aria-label="Restaurar alumno"
                            pButton
                            class="row-action p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform text-success"
                            pTooltip="Restaurar alumno"
                            (click)="restaurarRequested.emit(alumno.id)"
                            data-llm-action="restore-student-row"
                          >
                            <app-icon name="rotate-ccw" [size]="16" />
                          </button>
                        } @else {
                          <!-- Vista Normal: Ver / Certificado / PDF / Archivar -->
                          <button
                            aria-label="Ver ficha"
                            pButton
                            class="row-action p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                            pTooltip="Ver ficha"
                            [routerLink]="[basePath() + '/alumnos/' + alumno.id]"
                            [queryParams]="{ enrollment: alumno.enrollmentId }"
                            data-llm-action="view-student-detail"
                          >
                            <app-icon name="eye" [size]="16" />
                          </button>
                          <button
                            pButton
                            class="row-action p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                            pTooltip="Exportar Ficha PDF"
                            aria-label="Exportar Ficha PDF"
                            [disabled]="isGeneratingFicha() === alumno.enrollmentId"
                            (click)="exportarFicha(alumno)"
                          >
                            @if (isGeneratingFicha() === alumno.enrollmentId) {
                              <app-icon name="loader-circle" [size]="16" class="animate-spin" />
                            } @else {
                              <app-icon name="download" [size]="16" />
                            }
                          </button>
                          <button
                            aria-label="Archivar alumno"
                            pButton
                            class="row-action p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform text-error"
                            pTooltip="Archivar alumno"
                            (click)="archivarRequested.emit(alumno.id)"
                            data-llm-action="archive-student-row"
                          >
                            <app-icon name="trash-2" [size]="16" />
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr>
                    <td [attr.colspan]="showSedeColumn() ? 9 : 8" class="p-0">
                      <app-empty-state
                        [icon]="emptyState().icon"
                        [message]="emptyState().message"
                        [subtitle]="emptyState().subtitle"
                        [actionLabel]="emptyState().actionLabel"
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
              <div class="bento-grid">
                @for (alumno of visibleCards(); track alumno.id) {
                  <div class="bento-wide" data-col-span="4">
                    <app-alumno-card
                      [alumno]="alumno"
                      [trashView]="trashView()"
                      [showSede]="showSedeColumn()"
                      [basePath]="basePath()"
                      [isGeneratingFicha]="isGeneratingFicha()"
                      (restaurarRequested)="restaurarRequested.emit($event)"
                      (archivarRequested)="archivarRequested.emit($event)"
                      (fichaExportRequested)="fichaExportRequested.emit($event)"
                    />
                  </div>
                } @empty {
                  <div class="col-span-full py-8">
                    <app-empty-state
                      [icon]="emptyState().icon"
                      [message]="emptyState().message"
                      [subtitle]="emptyState().subtitle"
                      [actionLabel]="emptyState().actionLabel"
                      actionIcon="refresh-cw"
                      (action)="resetFilters()"
                    />
                  </div>
                }

                <!-- Cargar más (AC5/AC6): densidad incremental de la vista tarjetas -->
                @if (remainingCards() > 0) {
                  <div class="col-span-full pt-1">
                    <button
                      type="button"
                      class="btn-ghost w-full flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer"
                      (click)="loadMoreCards()"
                      data-llm-action="load-more-students"
                    >
                      <app-icon name="chevron-down" [size]="16" />
                      Cargar más ({{ remainingCards() }} restantes)
                    </button>
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

      /* fix-294-m: tabla compacta para que quepa en un notebook (1366 px, panel de 940).
         El relleno global de las tablas (16 px por lado) suma 288 px en 9 columnas; aca baja
         a 6. Los selectores encadenados son a proposito: tienen que pesar mas que la regla
         global, que tambien usa important. */
      .dual-viewport-container .desktop-view th,
      .dual-viewport-container .desktop-view td {
        padding-left: 6px !important;
        padding-right: 6px !important;
      }
      /* El titulo deja 16 px a su derecha: ahi va la flecha de ordenar, que app-sort-header
         dibuja fuera del texto. Con menos, se monta sobre el titulo siguiente. */
      .dual-viewport-container .desktop-view th {
        padding-right: 16px !important;
      }
      .dual-viewport-container .desktop-view th:first-child,
      .dual-viewport-container .desktop-view td:first-child {
        padding-left: 12px !important;
      }
      .dual-viewport-container .desktop-view th:last-child,
      .dual-viewport-container .desktop-view td:last-child {
        padding-right: 12px !important;
      }

      /* Botones de accion de 32 px: el tema de PrimeNG los dejaba en 48 de ancho. */
      .row-action {
        width: 2rem !important;
        min-width: 2rem !important;
        padding: 0 !important;
      }

      /* La columna Alumno se queda con el ancho que sobra: las demas miden lo que mide su
         contenido y aca el nombre y el correo se recortan. width 100 + max-width 0 es lo que
         hace que la celda absorba el resto sin ensanchar la tabla; el piso lo pone el titulo. */
      .dual-viewport-container .desktop-view td.alumno-cell {
        width: 100%;
        max-width: 0;
      }
      .dual-viewport-container .desktop-view th.alumno-head {
        min-width: 8.5rem;
      }

      /* Panel angosto (notebook): sin el circulo de iniciales, que es decorativo. */
      @container listContainer (max-width: 1149px) {
        .alumno-avatar {
          display: none;
        }
      }
    `,
  ],
})
export class AlumnosListContentComponent implements OnInit, AfterViewInit {
  // ── Inputs ──────────────────────────────────────────────────────────────
  readonly alumnos = input.required<AlumnoTableRow[]>();
  readonly isLoading = input(false);
  readonly isExporting = input(false);
  readonly isGeneratingFicha = input<number | false>(false);
  readonly trashView = input(false);
  readonly basePath = input<string>('/app/secretaria');
  readonly showSedeColumn = input(false);
  /** Error de la última carga (signal `error` del facade), o null. */
  readonly error = input<string | null>(null);
  /**
   * Búsqueda y filtros con los que arranca la lista (fix-275-m). Se leen una sola vez, al crear
   * el componente: después manda lo que el usuario escribe, que se avisa por `filtersChanged`.
   */
  readonly initialFilters = input<AlumnoListFilters | null>(null);

  /**
   * El estado de error reemplaza a la tabla solo si no hay alumnos que mostrar. Si un refresco en
   * segundo plano falla con datos ya en pantalla, se siguen mostrando (SWR).
   */
  readonly showLoadError = computed(() => !!this.error() && this.alumnos().length === 0);

  // ── Outputs ─────────────────────────────────────────────────────────────
  readonly refreshRequested = output<void>();
  readonly archivarRequested = output<string>();
  readonly restaurarRequested = output<string>();
  readonly trashViewToggled = output<void>();
  readonly exportRequested = output<AlumnoExportRequest>();
  readonly fichaExportRequested = output<number>();
  /** Se emite cada vez que cambia la búsqueda o un filtro, para que el Smart los conserve. */
  readonly filtersChanged = output<AlumnoListFilters>();

  // ── Internal UI state ────────────────────────────────────────────────────
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');
  readonly heroSubtitle = computed(() =>
    this.trashView() ? 'Papelera — Alumnos archivados' : 'Listado de alumnos de la escuela',
  );

  readonly heroChips = computed((): SectionHeroChip[] => [
    { label: `${this.totalAlumnos()} alumnos`, icon: 'users', style: 'default' },
  ]);

  readonly heroActions = computed((): SectionHeroAction[] =>
    buildAlumnosHeroActions(this.trashView()),
  );

  readonly alumnosKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'total',
      label: 'Total Alumnos',
      value: this.totalAlumnos(),
      icon: 'users',
      color: 'default',
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

  readonly searchTerm = signal('');
  readonly selectedCurso = signal('');
  readonly selectedEstado = signal('');
  readonly selectedExpediente = signal('');
  /** Orden elegido por el usuario; null = orden por defecto, más recientes primero (spec 0020-m). */
  readonly sort = signal<AlumnoListSort | null>(null);
  /** Índice de la primera fila de la página visible de la tabla. */
  readonly tableFirst = signal(0);
  isDrawerOpen = signal(false);

  /** Columnas ordenables, en el orden de la tabla. "Sede" solo si la columna se muestra. */
  readonly sortColumns = computed(() =>
    ALUMNO_SORT_OPTIONS.filter((col) => col.value !== 'sede' || this.showSedeColumn()),
  );

  /** Densidad incremental de la vista tarjetas (spec 0028, AC5). */
  private static readonly CARDS_STEP = 6;
  private static readonly TABLE_ROWS = 10;
  readonly mobileShown = signal(AlumnosListContentComponent.CARDS_STEP);
  readonly visibleCards = computed(() => sliceByBudget(this.sortedAlumnos(), this.mobileShown()));
  readonly remainingCards = computed(() =>
    Math.max(0, this.filteredAlumnos().length - this.mobileShown()),
  );

  /** Cursos presentes en la lista cargada (hotfix-114-m: antes era una lista fija). */
  /** Cada filtro abre con su opción "todos", con el mismo '' por defecto que sus signals (spec 0022-m). */
  readonly cursos = computed(() =>
    withAllOption(buildCourseFilterOptions(this.alumnos()), 'Todos los cursos', ''),
  );
  readonly estados = withAllOption(
    [
      { label: 'Activo', value: 'Activo' },
      { label: 'Retirado', value: 'Retirado' },
      { label: 'Pre-inscrito', value: 'Pre-inscrito' },
      { label: 'Pendiente Pago', value: 'Pendiente Pago' },
      { label: 'Docs Pendientes', value: 'Docs Pendientes' },
      { label: 'Inactivo', value: 'Inactivo' },
    ],
    'Todos los estados',
    '',
  );
  readonly expedienteOpciones = withAllOption(
    [
      { label: 'Completo', value: 'Completo' },
      { label: 'Parcial', value: 'Parcial' },
      { label: 'Pendiente', value: 'Pendiente' },
    ],
    'Expediente: Todos',
    '',
  );

  /** Muestra "Limpiar filtros": algún selector fuera de "todos" o texto en el buscador. */
  readonly hasActiveFilters = computed(
    () =>
      this.searchTerm() !== '' ||
      this.selectedCurso() !== '' ||
      this.selectedEstado() !== '' ||
      this.selectedExpediente() !== '',
  );

  /**
   * Texto del estado vacío (fix-285-m). "Limpiar filtros" solo tiene sentido si hay filtros: una
   * Papelera o una lista vacías de verdad lo dicen sin ofrecer limpiar nada.
   */
  readonly emptyState = computed((): AlumnosEmptyState => {
    if (this.hasActiveFilters()) {
      return {
        icon: 'search',
        message: 'No se encontraron alumnos',
        subtitle: 'Intenta ajustar los criterios de búsqueda o filtros.',
        actionLabel: 'Limpiar filtros',
      };
    }
    if (this.trashView()) {
      return {
        icon: 'trash-2',
        message: 'No hay alumnos archivados',
        subtitle: 'Los alumnos que archives aparecerán aquí y podrás restaurarlos.',
      };
    }
    return {
      icon: 'users',
      message: 'Aún no hay alumnos',
      subtitle: 'Los alumnos aparecerán aquí cuando se matriculen.',
    };
  });

  /** Placeholder para satisfacer `alumno` (input.required) en las 6 cards skeleton. */
  protected readonly skeletonAlumno: AlumnoTableRow = {
    id: '',
    nombre: '',
    apellido: '',
    rut: '',
    email: '',
    celular: '',
    sucursal: '',
    comuna: '',
    nroExpedientes: [],
    fechaIngreso: '',
    status: 'Activo',
    cursos: [],
    pago_por_pagar: 0,
    pago_total: 0,
    exp_teorico: 'pendiente',
    exp_practico: 'pendiente',
    expediente: { ci: false, foto: false, medico: false, semep: false },
    cursoCompletoPendienteEgreso: false,
  };

  ngOnInit(): void {
    const filters = this.initialFilters();
    if (!filters) return;
    this.searchTerm.set(filters.search);
    this.selectedCurso.set(filters.curso);
    this.selectedEstado.set(filters.estado);
    this.selectedExpediente.set(filters.expediente);
    this.sort.set(filters.sort);
    // fix-282-m: también la página de la tabla y las tarjetas cargadas.
    this.tableFirst.set(filters.first);
    this.mobileShown.set(filters.cardsShown);
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  readonly filteredAlumnos = computed<AlumnoTableRow[]>(() => {
    const term = this.searchTerm().toLowerCase();
    const curso = this.selectedCurso();
    const estado = this.selectedEstado();
    const expediente = this.selectedExpediente();

    return this.alumnos().filter((a) => {
      const matchSearch = matchesSearchTokens(
        [a.nombre, a.apellido, a.rut, ...a.nroExpedientes],
        term,
      );

      const matchCurso = !curso || a.cursos.some((c) => c.nombre === curso);
      const matchEstado = !estado || a.status === estado;
      const matchExpediente = (() => {
        if (!expediente) return true;
        const exp = this.getExpedienteStatus(a.expediente);
        return exp.label === expediente;
      })();

      return matchSearch && matchCurso && matchEstado && matchExpediente;
    });
  });

  /** La lista filtrada, en el orden elegido. Alimenta la tabla y las tarjetas por igual. */
  readonly sortedAlumnos = computed(() => sortAlumnos(this.filteredAlumnos(), this.sort()));

  /**
   * Setea un filtro y resetea la densidad de tarjetas (AC6): el filtro opera
   * sobre el TOTAL y el contador de "Cargar más" se recalcula desde cero.
   */
  updateFilter(filter: WritableSignal<string>, value: string): void {
    filter.set(value);
    // fix-283-m: un resultado nuevo se mira desde la página 1 (con [first] la tabla no vuelve sola).
    this.tableFirst.set(0);
    this.mobileShown.set(AlumnosListContentComponent.CARDS_STEP);
    this.emitFilters();
  }

  /** Clic en el título de una columna: ascendente → descendente → orden por defecto. */
  toggleSort(field: AlumnoSortField): void {
    this.applySort(nextAlumnoSort(this.sort(), field));
  }

  /** Control "Ordenar por" de la vista de tarjetas. Limpiarlo vuelve al orden por defecto. */
  setSortField(field: AlumnoSortField | null): void {
    if (field === this.sort()?.field) return;
    this.applySort(field ? { field, direction: 'asc' } : null);
  }

  toggleSortDirection(): void {
    this.applySort(toggleAlumnoSortDirection(this.sort()));
  }

  /** Un orden nuevo se mira desde el principio: primera página y primeras tarjetas. */
  private applySort(sort: AlumnoListSort | null): void {
    this.sort.set(sort);
    this.tableFirst.set(0);
    this.mobileShown.set(AlumnosListContentComponent.CARDS_STEP);
    this.emitFilters();
  }

  sortIcon(field: AlumnoSortField): string {
    const sort = this.sort();
    if (sort?.field !== field) return 'arrow-up-down';
    return sort.direction === 'asc' ? 'chevron-up' : 'chevron-down';
  }

  ariaSort(field: AlumnoSortField): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    if (sort?.field !== field) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  private emitFilters(): void {
    this.filtersChanged.emit({
      search: this.searchTerm(),
      curso: this.selectedCurso(),
      estado: this.selectedEstado(),
      expediente: this.selectedExpediente(),
      sort: this.sort(),
      first: this.tableFirst(),
      cardsShown: this.mobileShown(),
    });
  }

  loadMoreCards(): void {
    this.mobileShown.update((n) => n + AlumnosListContentComponent.CARDS_STEP);
    this.emitFilters();
  }

  /** Cambio de página de la tabla: se avisa para conservarla al volver de la ficha (fix-282-m). */
  onTablePage(first: number): void {
    this.tableFirst.set(first);
    this.emitFilters();
  }

  /**
   * Página que muestra la tabla. Si la guardada ya no existe (al volver de la ficha, alguien se
   * archivó), cae en la última que sí existe. Sin filas (cargando) deja la guardada.
   */
  readonly tableFirstVisible = computed(() => {
    const first = this.tableFirst();
    const total = this.sortedAlumnos().length;
    if (total === 0 || first < total) return first;
    return (
      Math.floor((total - 1) / AlumnosListContentComponent.TABLE_ROWS) *
      AlumnosListContentComponent.TABLE_ROWS
    );
  });

  totalAlumnos(): number {
    return this.alumnos().length;
  }

  activos(): number {
    return this.alumnos().filter((a) => isAlumnoCursando(a.status)).length;
  }

  conDeuda(): number {
    return this.alumnos().filter((a) => a.pago_por_pagar > 0).length;
  }

  getExpedienteStatus(exp: AlumnoExpediente): ExpedienteStatus {
    return computeExpedienteStatus(exp);
  }

  getStatusSeverity(
    status: AlumnoStatus | string,
  ): 'success' | 'secondary' | 'info' | 'danger' | 'warn' | undefined {
    return getAlumnoStatusSeverity(status);
  }

  refresh(): void {
    this.refreshRequested.emit();
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.selectedCurso.set('');
    this.selectedEstado.set('');
    this.selectedExpediente.set('');
    this.tableFirst.set(0);
    this.mobileShown.set(AlumnosListContentComponent.CARDS_STEP);
    this.emitFilters();
  }

  handleHeroAction(actionId: string): void {
    switch (actionId) {
      case 'papelera':
        this.trashViewToggled.emit();
        break;
      case 'nueva-matricula':
        this.openNuevaMatriculaDrawer();
        break;
      default:
        break;
    }
  }

  openNuevaMatriculaDrawer(): void {
    this.layoutDrawer.open(SecretariaMatriculaComponent, 'Nueva Matrícula', 'plus');
  }

  requestExport(format: ExportFormat): void {
    this.exportRequested.emit({
      format,
      rows: this.sortedAlumnos(),
      showSede: this.showSedeColumn(),
    });
  }

  exportarFicha(alumno: AlumnoTableRow): void {
    if (!alumno.enrollmentId) return;
    this.fichaExportRequested.emit(alumno.enrollmentId);
  }
}
