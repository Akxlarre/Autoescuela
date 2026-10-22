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
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ClearFiltersButtonComponent } from '@shared/components/clear-filters-button/clear-filters-button.component';
import { withAllOption } from '@core/utils/filter-options.utils';
import { isBlockedInPilot } from '@core/config/pilot-phase.config';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import type {
  CertificacionProfesionalAlumnoRow,
  CertificacionProfesionalKpis,
  CursoCertOption,
  PromocionCertOption,
} from '@core/models/ui/certificacion-profesional.model';
import { StableWidthDirective } from '@core/directives/stable-width.directive';

type EstadoFilter = 'generado' | 'pendiente' | null;

const PAGE_SIZE = 10;

/**
 * CertificacionProfesionalContentComponent — Dumb component.
 *
 * Vista de certificación Clase Profesional (app-like, Desktop lg+ fill-screen)
 * con selección en cascada dentro de la misma card que la lista de alumnos:
 *  1. Selector de promoción finalizada + selector de curso (header de la card).
 *  2. KPIs en el hero (solo cuando hay curso seleccionado).
 *  3. Tabla/tarjetas (dual-viewport) de alumnos con scroll interno.
 *  4. Confirmación inline si práctica < 100 % (criterio flexible).
 *  5. "Generar Pendientes"/"Enviar Emails Masivo"/"Historial de emisiones" → drawers.
 */
@Component({
  selector: 'app-certificacion-profesional-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ClearFiltersButtonComponent,
    DecimalPipe,
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
        title="Certificados Clase Profesional"
        subtitle="Certificación de finalización — Escuela de Conductores Profesionales"
        icon="shield-check"
        [kpis]="heroKpis()"
        [actions]="heroActions()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- ── Card unificada: selectores + lista de alumnos (app-like fill-screen, dual-viewport) ── -->
      <div
        class="bento-banner bento-fill card p-0 overflow-hidden flex flex-col w-full h-full dual-viewport-container"
        appCardHover
      >
        <!-- Selectores de Promoción / Curso -->
        <div
          class="flex flex-wrap items-end gap-4 p-4 shrink-0"
          style="border-bottom: 1px solid var(--border-default)"
        >
          <div class="flex flex-col gap-1.5 min-w-55 flex-1">
            <label class="micro-label"> Promoción </label>
            @if (isLoading()) {
              <app-skeleton-block variant="rect" width="100%" height="38px" />
            } @else {
              <p-select
                [options]="promociones()"
                [ngModel]="selectedPromocionId()"
                (ngModelChange)="promocionSelected.emit($event)"
                optionLabel="label"
                optionValue="id"
                placeholder="Selecciona una promoción..."
                [showClear]="true"
                styleClass="w-full"
                data-llm-description="Selector de promoción de clase profesional finalizada"
              />
            }
          </div>

          <div class="flex flex-col gap-1.5 min-w-50 flex-1">
            <label
              class="text-xs font-semibold uppercase tracking-wider"
              [class.text-text-muted]="!selectedPromocionId()"
            >
              Curso
            </label>
            @if (isLoading()) {
              <app-skeleton-block variant="rect" width="100%" height="38px" />
            } @else {
              <p-select
                [options]="cursos()"
                [ngModel]="selectedCursoId()"
                (ngModelChange)="cursoSelected.emit($event)"
                optionLabel="label"
                optionValue="id"
                placeholder="Selecciona un curso..."
                [disabled]="!selectedPromocionId()"
                [showClear]="true"
                styleClass="w-full"
                data-llm-description="Selector de curso dentro de la promoción seleccionada"
              />
            }
          </div>
        </div>

        <!-- ── Estado: sin promoción seleccionada ────────────────────── -->
        @if (!selectedPromocionId()) {
          <div class="flex-1 flex items-center justify-center p-8">
            <app-empty-state
              icon="filter"
              message="Selecciona una promoción"
              subtitle="Elige una promoción finalizada para ver sus cursos y alumnos"
            />
          </div>

          <!-- ── Estado: promoción seleccionada, sin curso ─────────────── -->
        } @else if (!selectedCursoId()) {
          <div class="flex-1 flex items-center justify-center p-8">
            <app-empty-state
              icon="book-open"
              message="Selecciona un curso"
              subtitle="Elige un curso de la promoción para cargar los alumnos"
            />
          </div>

          <!-- ── Contenido principal (curso seleccionado) ───────────────── -->
        } @else {
          <!-- Toolbar -->
          <div
            class="flex flex-wrap items-center gap-3 p-4 shrink-0"
            style="border-bottom: 1px solid var(--border-default)"
          >
            <div class="relative flex-1 min-w-50 max-w-xs">
              <app-icon
                name="search"
                [size]="15"
                class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
              />
              <input
                type="text"
                placeholder="Buscar por nombre o RUT..."
                class="w-full list-search-input h-9 pl-8 pr-3 text-sm rounded-lg border outline-none transition-colors border-border-default bg-surface text-text-primary"
                data-llm-description="Search professional certificate students by name or RUT"
                [value]="searchQuery()"
                (input)="setSearchQuery($any($event.target).value)"
              />
            </div>

            <p-select
              [options]="estadoOptions"
              [ngModel]="estadoFilter()"
              (ngModelChange)="setEstadoFilter($event)"
              optionLabel="label"
              optionValue="value"
              placeholder="Todos los estados"
              class="h-9"
              data-llm-description="Filter professional certificates by status"
            />
            <app-clear-filters-button
              llmSubject="professional-certificates"
              [active]="hasActiveFilters()"
              (clear)="clearFilters()"
            />

            @if (pendientesCount() > 0) {
              <button
                class="btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                data-llm-action="open-generate-pending-professional-certificates-drawer"
                [disabled]="isGeneratingPendientes()"
                [appStableWidth]="isGeneratingPendientes()"
                (click)="abrirGenerarPendientesDrawer.emit()"
              >
                @if (isGeneratingPendientes()) {
                  <app-icon name="loader-circle" [size]="16" class="animate-spin" />
                  Generando...
                } @else {
                  <app-icon name="file-check" [size]="16" />
                  Generar Pendientes ({{ pendientesElegibles().length }})
                }
              </button>
            }

            @if (alumnosParaEnvioMasivo().length > 0) {
              <button
                class="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                data-llm-action="open-send-bulk-emails-professional-drawer"
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
              data-llm-action="export-professional-certificates"
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

          <!-- ── Contenido ────────────────────────────────────────────── -->
          @if (isLoadingAlumnos()) {
            <div class="p-6 flex flex-col gap-4">
              @for (_ of skeletonRows; track $index) {
                <app-skeleton-block variant="text" width="100%" height="42px" />
              }
            </div>
          } @else if (alumnos().length === 0) {
            <div class="p-8">
              <app-empty-state
                icon="shield-check"
                message="No hay alumnos en este curso"
                subtitle="Los alumnos con promoción finalizada aparecerán aquí con su estado de certificación"
              />
            </div>
          } @else if (filteredAlumnos().length === 0) {
            <div class="p-8">
              <app-empty-state
                icon="filter-x"
                message="No hay resultados para este filtro"
                subtitle="Intenta cambiar el filtro de estado o el término de búsqueda"
              />
            </div>
          } @else {
            <!-- VISTA 1: Tabla clásica (oculta cuando el drawer angosta la card) -->
            <div class="desktop-view hide-on-squeeze flex-1 min-h-0 overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="sticky top-0 z-10 bg-surface">
                  <tr class="border-b border-(--border-default)">
                    <th class="micro-label text-left px-4 py-2">Alumno</th>
                    <th class="micro-label text-left px-4 py-2">RUT</th>
                    <th class="micro-label text-left px-4 py-2">Promoción</th>
                    @if (academicoVisible) {
                      <th
                        class="micro-label text-center px-4 py-2"
                        title="Asistencia a clases teóricas (mínimo 75%)"
                      >
                        Teoría
                      </th>
                      <th
                        class="micro-label text-center px-4 py-2"
                        title="Asistencia a clases prácticas (recomendado 100%)"
                      >
                        Práctica
                      </th>
                      <th
                        class="micro-label text-center px-4 py-2"
                        title="Promedio de módulos (mínimo 75 en escala MTT)"
                      >
                        Nota Prom.
                      </th>
                    }
                    <th class="micro-label text-center px-4 py-2" title="Saldo pendiente de pago">
                      Pago
                    </th>
                    <th class="micro-label text-center px-4 py-2">Estado</th>
                    <th class="micro-label text-right px-4 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (alumno of pagedAlumnos(); track alumno.enrollmentId) {
                    <!-- Fila principal -->
                    <tr
                      class="border-b border-(--border-default) last:border-b-0 transition-colors"
                    >
                      <td class="px-4 py-2 font-medium text-text-primary">
                        <div class="flex items-center gap-1.5">
                          <span>{{ alumno.nombre }}</span>
                          @if (alumno.convalidatedLicense) {
                            <app-badge variant="info"
                              >Convalida {{ alumno.convalidatedLicense }}</app-badge
                            >
                          }
                        </div>
                      </td>
                      <td class="px-4 py-2 text-brand">
                        {{ alumno.rut }}
                      </td>
                      <td class="px-4 py-2 text-xs text-text-muted max-w-40 truncate">
                        {{ alumno.promocion }}
                      </td>
                      <!-- fix-465-m: sin asistencia ni notas en el piloto (se llevan en el libro de clases) -->
                      @if (academicoVisible) {
                        <!-- Teoría -->
                        <td class="px-4 py-2 text-center">
                          @if (alumno.pctAsistenciaTeoria === null) {
                            <span class="text-xs text-text-muted">Sin registro</span>
                          } @else {
                            <app-badge
                              [variant]="alumno.pctAsistenciaTeoria >= 75 ? 'success' : 'warning'"
                            >
                              <span class="inline-flex items-center gap-1">
                                @if (!alumno.elegibilidad.teoria) {
                                  <app-icon name="alert-triangle" [size]="11" />
                                }
                                {{ alumno.pctAsistenciaTeoria }}%
                              </span>
                            </app-badge>
                          }
                        </td>
                        <!-- Práctica -->
                        <td class="px-4 py-2 text-center">
                          @if (alumno.pctAsistenciaPractica === null) {
                            <span class="text-xs text-text-muted">Sin registro</span>
                          } @else {
                            <app-badge
                              [variant]="
                                alumno.pctAsistenciaPractica >= 100
                                  ? 'success'
                                  : alumno.pctAsistenciaPractica >= 75
                                    ? 'info'
                                    : 'warning'
                              "
                            >
                              <span class="inline-flex items-center gap-1">
                                @if (alumno.pctAsistenciaPractica < 100) {
                                  <app-icon name="alert-circle" [size]="11" />
                                }
                                {{ alumno.pctAsistenciaPractica }}%
                              </span>
                            </app-badge>
                          }
                        </td>
                        <!-- Nota promedio -->
                        <td class="px-4 py-2 text-center">
                          @if (alumno.notaPromedio === null) {
                            <span class="text-xs text-text-muted">Sin notas</span>
                          } @else {
                            <app-badge
                              [variant]="alumno.notaPromedio >= 75 ? 'success' : 'warning'"
                            >
                              <span class="inline-flex items-center gap-1">
                                @if (!alumno.elegibilidad.nota) {
                                  <app-icon name="x-circle" [size]="11" />
                                }
                                {{ alumno.notaPromedio | number: '1.1-1' }}
                              </span>
                            </app-badge>
                          }
                        </td>
                      }
                      <!-- Pago -->
                      <td class="px-4 py-2 text-center">
                        @if (alumno.pagoCorrecto) {
                          <app-badge variant="success">
                            <span class="inline-flex items-center gap-1">
                              <app-icon name="check" [size]="11" />
                              Al día
                            </span>
                          </app-badge>
                        } @else {
                          <app-badge variant="warning">
                            <span class="inline-flex items-center gap-1">
                              <app-icon name="alert-triangle" [size]="11" />
                              Pendiente
                            </span>
                          </app-badge>
                        }
                      </td>
                      <!-- Estado certificado -->
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
                      <!-- Acciones -->
                      <td class="px-4 py-2 text-right">
                        <div class="flex items-center justify-end gap-2">
                          @if (alumno.certificadoStatus === 'pendiente') {
                            <button
                              class="group inline-flex items-center justify-center font-semibold transition-all active:scale-95 btn-primary btn-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                              data-llm-action="generate-professional-certificate"
                              [disabled]="generatingId() !== null"
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
                              data-llm-action="view-professional-certificate-pdf"
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
                            <!-- fix-481-m: reemite el PDF con los datos y la plantilla actuales -->
                            <button
                              class="inline-flex items-center justify-center font-semibold transition-colors btn-secondary btn-sm disabled:opacity-60 disabled:cursor-not-allowed"
                              data-llm-action="regenerate-professional-certificate"
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
                              data-llm-action="send-professional-certificate-email"
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
                      <div class="flex items-center gap-1.5">
                        <p class="item-title truncate m-0">
                          {{ alumno.nombre }}
                        </p>
                        @if (alumno.convalidatedLicense) {
                          <app-badge variant="info"
                            >Convalida {{ alumno.convalidatedLicense }}</app-badge
                          >
                        }
                      </div>
                      <p class="text-xs text-brand m-0">{{ alumno.rut }}</p>
                      <p class="text-xs text-text-muted m-0 truncate">{{ alumno.promocion }}</p>
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

                  <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    @if (academicoVisible) {
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-text-muted">Teoría</span>
                        @if (alumno.pctAsistenciaTeoria === null) {
                          <span class="text-text-muted">Sin registro</span>
                        } @else {
                          <app-badge
                            [variant]="alumno.pctAsistenciaTeoria >= 75 ? 'success' : 'warning'"
                          >
                            {{ alumno.pctAsistenciaTeoria }}%
                          </app-badge>
                        }
                      </div>
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-text-muted">Práctica</span>
                        @if (alumno.pctAsistenciaPractica === null) {
                          <span class="text-text-muted">Sin registro</span>
                        } @else {
                          <app-badge
                            [variant]="
                              alumno.pctAsistenciaPractica >= 100
                                ? 'success'
                                : alumno.pctAsistenciaPractica >= 75
                                  ? 'info'
                                  : 'warning'
                            "
                          >
                            {{ alumno.pctAsistenciaPractica }}%
                          </app-badge>
                        }
                      </div>
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-text-muted">Nota</span>
                        @if (alumno.notaPromedio === null) {
                          <span class="text-text-muted">Sin notas</span>
                        } @else {
                          <app-badge [variant]="alumno.notaPromedio >= 75 ? 'success' : 'warning'">
                            {{ alumno.notaPromedio | number: '1.1-1' }}
                          </app-badge>
                        }
                      </div>
                    }
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-text-muted">Pago</span>
                      @if (alumno.pagoCorrecto) {
                        <app-badge variant="success">Al día</app-badge>
                      } @else {
                        <app-badge variant="warning">Pendiente</app-badge>
                      }
                    </div>
                  </div>

                  <div
                    class="flex items-center gap-2 pt-2"
                    style="border-top: 1px dashed var(--border-subtle)"
                  >
                    @if (alumno.certificadoStatus === 'pendiente') {
                      <button
                        class="flex-1 inline-flex items-center justify-center font-semibold transition-all active:scale-95 btn-primary btn-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        data-llm-action="generate-professional-certificate"
                        [disabled]="generatingId() !== null"
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
                        data-llm-action="view-professional-certificate-pdf"
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
                        data-llm-action="regenerate-professional-certificate"
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
                        data-llm-action="send-professional-certificate-email"
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

            <!-- Paginación alumnos -->
            @if (totalPagesAlumnos() > 1) {
              <div
                class="flex items-center justify-between px-4 py-3 border-t border-(--border-default) text-xs text-text-muted shrink-0"
              >
                <span>
                  {{ currentPageAlumnos() * PAGE_SIZE + 1 }}–{{
                    pageEnd(filteredAlumnos().length, currentPageAlumnos())
                  }}
                  de {{ filteredAlumnos().length }} &nbsp;·&nbsp; Pág.
                  {{ currentPageAlumnos() + 1 }} / {{ totalPagesAlumnos() }}
                </span>
                <div class="flex items-center gap-1">
                  <button
                    class="p-1 rounded hover:bg-(--bg-subtle) disabled:opacity-40 disabled:cursor-not-allowed"
                    [disabled]="currentPageAlumnos() === 0"
                    (click)="prevPageAlumnos()"
                    aria-label="Página anterior"
                  >
                    <app-icon name="chevron-left" [size]="15" />
                  </button>
                  <button
                    class="p-1 rounded hover:bg-(--bg-subtle) disabled:opacity-40 disabled:cursor-not-allowed"
                    [disabled]="currentPageAlumnos() >= totalPagesAlumnos() - 1"
                    (click)="nextPageAlumnos()"
                    aria-label="Página siguiente"
                  >
                    <app-icon name="chevron-right" [size]="15" />
                  </button>
                </div>
              </div>
            }
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
        container-name: certProfListContainer;
      }

      .show-on-squeeze {
        display: none;
      }

      @container certProfListContainer (max-width: 900px) {
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
export class CertificacionProfesionalContentComponent implements AfterViewInit {
  // ── Internal ────────────────────────────────────────────────────────────────
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');
  // ── Inputs ──
  readonly promociones = input<PromocionCertOption[]>([]);
  readonly cursos = input<CursoCertOption[]>([]);
  readonly selectedPromocionId = input<number | null>(null);
  readonly selectedCursoId = input<number | null>(null);
  readonly alumnos = input<CertificacionProfesionalAlumnoRow[]>([]);
  readonly kpis = input<CertificacionProfesionalKpis | null>(null);
  readonly isLoading = input(false);
  readonly isLoadingAlumnos = input(false);
  readonly generatingId = input<number | null>(null);
  readonly sendingEmailId = input<number | null>(null);
  readonly sendingMasivo = input(false);
  readonly isExporting = input(false);
  /** true mientras se están generando certificados pendientes en lote. */
  readonly isGeneratingPendientes = input(false);

  // ── Outputs ──
  readonly promocionSelected = output<number | null>();
  readonly cursoSelected = output<number | null>();
  readonly generarCertificado = output<number>();
  readonly verCertificado = output<{ storagePath: string; nombre: string }>();
  readonly enviarEmail = output<number>();
  /** fix-481-m */
  readonly regenerarCertificado = output<number>();
  readonly abrirHistorialDrawer = output<void>();
  readonly abrirGenerarPendientesDrawer = output<void>();
  readonly abrirEnviarMasivoDrawer = output<void>();
  readonly exportar = output<void>();

  // ── Local state ──
  readonly estadoFilter = signal<EstadoFilter>(null);
  readonly searchQuery = signal('');
  readonly currentPageAlumnos = signal(0);

  protected readonly PAGE_SIZE = PAGE_SIZE;

  readonly heroActions = computed((): SectionHeroAction[] => [
    { id: 'historial', label: 'Historial de emisiones', icon: 'scroll', primary: false },
  ]);

  readonly heroKpis = computed((): SectionHeroKpi[] => {
    if (!this.selectedCursoId()) return [];
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

  readonly skeletonRows = Array.from({ length: 6 });

  /** fix-465-m: mientras el piloto recorte Profesional no hay asistencia ni notas que mostrar. */
  protected readonly academicoVisible = !isBlockedInPilot('clase-profesional-recorte');

  // ── Computed ──
  readonly filteredAlumnos = computed(() => {
    const filter = this.estadoFilter();
    const query = this.searchQuery().trim();
    let result = this.alumnos();
    if (filter) {
      result = result.filter((a) => a.certificadoStatus === filter);
    }
    if (!query) return result;
    const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const queryNorm = normalize(query).replace(/[.\-]/g, '');
    return result.filter((a) => {
      const nameMatch = normalize(a.nombre).includes(normalize(query));
      const rutNorm = a.rut.replace(/[.\-]/g, '').toLowerCase();
      const rutMatch = rutNorm.includes(queryNorm);
      return nameMatch || rutMatch;
    });
  });

  readonly totalPagesAlumnos = computed(() => Math.ceil(this.filteredAlumnos().length / PAGE_SIZE));

  readonly pagedAlumnos = computed(() => {
    const page = this.currentPageAlumnos();
    const start = page * PAGE_SIZE;
    return this.filteredAlumnos().slice(start, start + PAGE_SIZE);
  });

  readonly pendientesCount = computed(
    () => this.alumnos().filter((a) => a.certificadoStatus === 'pendiente').length,
  );

  readonly pendientesElegibles = computed(() =>
    this.alumnos().filter((a) => a.certificadoStatus === 'pendiente' && a.elegible),
  );

  readonly alumnosParaEnvioMasivo = computed(() =>
    this.alumnos().filter(
      (a) => a.certificadoStatus === 'generado' && !a.emailEnviado && !!a.email,
    ),
  );

  // ── Setters con reset de página ──

  setEstadoFilter(value: EstadoFilter): void {
    this.estadoFilter.set(value);
    this.currentPageAlumnos.set(0);
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
    this.currentPageAlumnos.set(0);
  }

  prevPageAlumnos(): void {
    this.currentPageAlumnos.update((p) => Math.max(0, p - 1));
  }

  nextPageAlumnos(): void {
    this.currentPageAlumnos.update((p) => Math.min(this.totalPagesAlumnos() - 1, p + 1));
  }

  pageEnd(total: number, page: number): number {
    return Math.min((page + 1) * PAGE_SIZE, total);
  }

  // ── Handlers de generación ──

  /**
   * fix-466-m: el facade confirma con un modal (avisos de asistencia, deuda con motivo). Ni la
   * asistencia ni la deuda deshabilitan el botón.
   */
  onClickGenerar(alumno: CertificacionProfesionalAlumnoRow): void {
    this.generarCertificado.emit(alumno.enrollmentId);
  }

  /** fix-466-m: el facade confirma el envío con un modal (antes, una fila inline). */
  onClickEmail(alumno: CertificacionProfesionalAlumnoRow): void {
    this.enviarEmail.emit(alumno.enrollmentId);
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }
}
