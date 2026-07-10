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
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import type {
  CertificacionProfesionalAlumnoRow,
  CertificacionProfesionalKpis,
  CertificacionProfesionalLogRow,
  CursoCertOption,
  PromocionCertOption,
} from '@core/models/ui/certificacion-profesional.model';
import { ACCION_LABELS_PROF } from '@core/models/ui/certificacion-profesional.model';

type EstadoFilter = 'generado' | 'pendiente' | null;

const PAGE_SIZE = 10;

/**
 * CertificacionProfesionalContentComponent — Dumb component.
 *
 * Vista de certificación Clase Profesional con selección en cascada:
 *  1. Selector de promoción finalizada (ordenadas por fecha de inicio DESC).
 *  2. Selector de curso (habilitado tras elegir promoción).
 *  3. KPIs + tabla de alumnos (visibles tras elegir curso).
 *  4. Confirmation inline si práctica < 100 % (criterio flexible).
 *  5. Historial de emisiones (log).
 */
@Component({
  selector: 'app-certificacion-profesional-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    SkeletonBlockComponent,
    IconComponent,
    EmptyStateComponent,
    BadgeComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- ── Section Hero ──────────────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Certificados Clase Profesional"
        subtitle="Certificación de finalización — Escuela de Conductores Profesionales"
        icon="shield-check"
        [actions]="heroActions"
      />

      <!-- ── Selección en cascada ───────────────────────────────────── -->
      <div class="bento-banner card flex flex-wrap items-end gap-4" appCardHover>
        <!-- Selector de Promoción -->
        <div class="flex flex-col gap-1.5 min-w-55 flex-1">
          <label class="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Promoción
          </label>
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

        <!-- Selector de Curso -->
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
        <div class="bento-banner card p-8">
          <app-empty-state
            icon="filter"
            message="Selecciona una promoción"
            subtitle="Elige una promoción finalizada para ver sus cursos y alumnos"
          />
        </div>

        <!-- ── Estado: promoción seleccionada, sin curso ─────────────── -->
      } @else if (!selectedCursoId()) {
        <div class="bento-banner card p-8">
          <app-empty-state
            icon="book-open"
            message="Selecciona un curso"
            subtitle="Elige un curso de la promoción para cargar los alumnos"
          />
        </div>

        <!-- ── Contenido principal (curso seleccionado) ───────────────── -->
      } @else {
        <!-- ── KPIs ──────────────────────────────────────────────────── -->
        <div class="bento-banner grid grid-cols-2 lg:grid-cols-4 gap-4">
          <app-kpi-card-variant
            label="Total Alumnos"
            [value]="kpis()?.totalAlumnos ?? 0"
            icon="graduation-cap"
            [loading]="isLoadingAlumnos()"
          />
          <app-kpi-card-variant
            label="Certificados Generados"
            [value]="kpis()?.certificadosGenerados ?? 0"
            icon="check-circle"
            color="success"
            [loading]="isLoadingAlumnos()"
          />
          <app-kpi-card-variant
            label="Pendientes Generación"
            [value]="kpis()?.pendientesGeneracion ?? 0"
            icon="clock"
            color="warning"
            [loading]="isLoadingAlumnos()"
          />
          <app-kpi-card-variant
            label="Pendientes Envío"
            [value]="kpis()?.pendientesEnvio ?? 0"
            icon="mail"
            [loading]="isLoadingAlumnos()"
          />
        </div>

        <!-- ── Tabla + Toolbar (card unificado) ─────────────────────── -->
        <div class="bento-banner card overflow-hidden" appCardHover>
          <div
            class="flex flex-wrap items-center gap-3 p-4"
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
                placeholder="Buscar por nombre o RUT..."
                class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border outline-none transition-colors border-border-default bg-surface text-text-primary"
                data-llm-description="Search professional certificate students by name or RUT"
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
              placeholder="Todos"
              class="h-9"
              data-llm-description="Filter professional certificates by status"
            />

            @if (pendientesCount() > 0) {
              <button
                class="btn-primary flex items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                data-llm-action="generate-pending-professional-certificates"
                [disabled]="isGeneratingPendientes()"
                (click)="abrirPanelPendientes()"
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
                class="btn-secondary flex items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                data-llm-action="send-bulk-emails-professional"
                [disabled]="sendingMasivo()"
                (click)="abrirPanelMasivo()"
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
              class="btn-secondary flex items-center gap-2 text-sm ml-auto disabled:opacity-60 disabled:cursor-not-allowed"
              data-llm-action="export-professional-certificates"
              [disabled]="isExporting()"
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

          <!-- ── Panel confirmación generar pendientes ────────────────── -->
          @if (pendientesPanelVisible()) {
            <div
              class="p-5 flex flex-col gap-4"
              style="border-bottom: 1px solid var(--border-default)"
            >
              <div class="flex items-start gap-3">
                <app-icon
                  name="file-check"
                  [size]="20"
                  class="text-brand shrink-0"
                  style="margin-top: 2px"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-text-primary">
                    Generar Pendientes —
                    {{ pendientesElegibles().length }} de {{ pendientesCount() }} alumno{{
                      pendientesCount() !== 1 ? 's' : ''
                    }}
                    {{
                      pendientesElegibles().length !== 1 ? 'serán certificados' : 'será certificado'
                    }}
                  </p>
                  @if (pendientesNoElegibles().length > 0) {
                    <p class="text-xs mt-0.5 text-text-muted">
                      {{ pendientesNoElegibles().length }} alumno{{
                        pendientesNoElegibles().length !== 1 ? 's no cumplen' : ' no cumple'
                      }}
                      los requisitos y no recibirán certificado.
                    </p>
                  }
                </div>
              </div>

              <!-- Elegibles -->
              @if (pendientesElegibles().length > 0) {
                <div class="rounded-lg border divide-y overflow-hidden border-border-subtle">
                  @for (alumno of pendientesElegibles(); track alumno.enrollmentId) {
                    <div class="flex items-center gap-3 px-4 py-2.5">
                      <app-icon name="file-check" [size]="14" class="text-success shrink-0" />
                      <span class="text-sm font-medium flex-1 truncate text-text-primary">
                        {{ alumno.nombre }}
                      </span>
                      @if (
                        alumno.pctAsistenciaPractica !== null && alumno.pctAsistenciaPractica < 100
                      ) {
                        <span class="text-xs text-warning">
                          <app-icon name="alert-triangle" [size]="11" />
                          {{ alumno.pctAsistenciaPractica }}% práctica
                        </span>
                      }
                    </div>
                  }
                </div>
              }

              <!-- No elegibles -->
              @if (pendientesNoElegibles().length > 0) {
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wider mb-2 text-text-muted">
                    No elegibles — no se generará certificado
                  </p>
                  <div class="rounded-lg border divide-y overflow-hidden border-border-subtle">
                    @for (alumno of pendientesNoElegibles(); track alumno.enrollmentId) {
                      <div class="flex items-center gap-3 px-4 py-2.5">
                        <app-icon name="x-circle" [size]="14" class="text-warning shrink-0" />
                        <span class="text-sm flex-1 truncate text-text-muted">
                          {{ alumno.nombre }}
                        </span>
                        <span class="text-xs text-text-muted">
                          @if (!alumno.elegibilidad.teoria) {
                            Teoría &lt;75% ·
                          }
                          @if (!alumno.elegibilidad.nota) {
                            Nota &lt;75 ·
                          }
                          @if (!alumno.elegibilidad.pago) {
                            Pago pendiente
                          }
                        </span>
                      </div>
                    }
                  </div>
                </div>
              }

              <div class="flex items-center gap-2 justify-end">
                <button
                  class="btn-ghost"
                  data-llm-action="cancel-generate-pending-professional-certificates"
                  (click)="cancelarPendientes()"
                >
                  Cancelar
                </button>
                <button
                  class="btn-primary"
                  data-llm-action="confirm-generate-pending-professional-certificates"
                  [disabled]="pendientesElegibles().length === 0"
                  (click)="confirmarPendientes()"
                >
                  <app-icon name="file-check" [size]="14" />
                  Generar {{ pendientesElegibles().length }} certificado{{
                    pendientesElegibles().length !== 1 ? 's' : ''
                  }}
                </button>
              </div>
            </div>
          }

          <!-- ── Panel confirmación envío masivo ──────────────────────── -->
          @if (masivoPanelVisible()) {
            <div
              class="p-5 flex flex-col gap-4"
              style="border-bottom: 1px solid var(--border-default)"
            >
              <div class="flex items-start gap-3">
                <app-icon
                  name="send"
                  [size]="20"
                  class="text-brand shrink-0"
                  style="margin-top: 2px"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-text-primary">
                    Envío masivo — {{ alumnosParaEnvioMasivo().length }} alumno{{
                      alumnosParaEnvioMasivo().length !== 1 ? 's' : ''
                    }}
                    recibirá{{ alumnosParaEnvioMasivo().length !== 1 ? 'n' : '' }} su certificado
                    por correo
                  </p>
                  <p class="text-xs mt-0.5 text-text-muted">
                    Solo se incluyen alumnos con certificado generado que aún no han recibido el
                    correo.
                  </p>
                </div>
              </div>

              <!-- Lista de destinatarios -->
              <div class="rounded-lg border divide-y overflow-hidden border-border-subtle">
                @for (alumno of alumnosParaEnvioMasivo(); track alumno.enrollmentId) {
                  <div class="flex items-center gap-3 px-4 py-2.5">
                    <app-icon name="user" [size]="14" class="text-text-muted shrink-0" />
                    <span class="text-sm font-medium flex-1 truncate text-text-primary">
                      {{ alumno.nombre }}
                    </span>
                    <span class="text-xs truncate text-brand">
                      {{ alumno.email }}
                    </span>
                  </div>
                }
              </div>

              <!-- Acciones -->
              <div class="flex items-center gap-2 justify-end">
                <button
                  class="btn-ghost"
                  data-llm-action="cancel-bulk-email-professional"
                  (click)="cancelarMasivo()"
                >
                  Cancelar
                </button>
                <button
                  class="btn-primary"
                  data-llm-action="confirm-bulk-email-professional"
                  (click)="confirmarMasivo()"
                >
                  <app-icon name="send" [size]="14" />
                  Enviar a {{ alumnosParaEnvioMasivo().length }} alumno{{
                    alumnosParaEnvioMasivo().length !== 1 ? 's' : ''
                  }}
                </button>
              </div>
            </div>
          }

          <!-- ── Tabla principal ────────────────────────────────────────── -->
          @if (isLoadingAlumnos()) {
            <div class="p-6 flex flex-col gap-4">
              @for (_ of skeletonRows; track $index) {
                <app-skeleton-block variant="text" width="100%" height="48px" />
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
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-(--border-default)">
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                    >
                      Alumno
                    </th>
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                    >
                      RUT
                    </th>
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                    >
                      Promoción
                    </th>
                    <th
                      class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                      title="Asistencia a clases teóricas (mínimo 75%)"
                    >
                      Teoría
                    </th>
                    <th
                      class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                      title="Asistencia a clases prácticas (recomendado 100%)"
                    >
                      Práctica
                    </th>
                    <th
                      class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                      title="Promedio de módulos (mínimo 75 en escala MTT)"
                    >
                      Nota Prom.
                    </th>
                    <th
                      class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                      title="Saldo pendiente de pago"
                    >
                      Pago
                    </th>
                    <th
                      class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                    >
                      Estado
                    </th>
                    <th
                      class="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                    >
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  @for (alumno of pagedAlumnos(); track alumno.enrollmentId) {
                    <!-- Fila principal -->
                    <tr
                      class="border-b border-(--border-default) last:border-b-0 transition-colors"
                      [class.bg-[var(--bg-subtle)]]="pendingConfirmId() === alumno.enrollmentId"
                    >
                      <td class="px-4 py-3 font-medium text-text-primary">
                        {{ alumno.nombre }}
                      </td>
                      <td class="px-4 py-3 text-brand">
                        {{ alumno.rut }}
                      </td>
                      <td class="px-4 py-3 text-xs text-text-muted max-w-40 truncate">
                        {{ alumno.promocion }}
                      </td>
                      <!-- Teoría -->
                      <td class="px-4 py-3 text-center">
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
                      <td class="px-4 py-3 text-center">
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
                      <td class="px-4 py-3 text-center">
                        @if (alumno.notaPromedio === null) {
                          <span class="text-xs text-text-muted">Sin notas</span>
                        } @else {
                          <app-badge [variant]="alumno.notaPromedio >= 75 ? 'success' : 'warning'">
                            <span class="inline-flex items-center gap-1">
                              @if (!alumno.elegibilidad.nota) {
                                <app-icon name="x-circle" [size]="11" />
                              }
                              {{ alumno.notaPromedio | number: '1.1-1' }}
                            </span>
                          </app-badge>
                        }
                      </td>
                      <!-- Pago -->
                      <td class="px-4 py-3 text-center">
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
                      <td class="px-4 py-3 text-center">
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
                      <td class="px-4 py-3 text-right">
                        <div class="flex items-center justify-end gap-2">
                          @if (alumno.certificadoStatus === 'pendiente') {
                            <button
                              class="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 btn-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                              data-llm-action="generate-professional-certificate"
                              [disabled]="generatingId() !== null || !alumno.elegible"
                              [title]="
                                !alumno.elegible ? 'El alumno no cumple todos los requisitos' : ''
                              "
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
                              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors btn-secondary"
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
                              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
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
                      </td>
                    </tr>

                    <!-- Fila de confirmación inline — envío de email -->
                    @if (emailConfirmId() === alumno.enrollmentId) {
                      <tr class="border-b border-(--border-default)">
                        <td colspan="9" class="px-4 py-3">
                          <div
                            class="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl px-4 py-3 bg-brand/8 border border-brand/30"
                          >
                            <app-icon name="send" [size]="18" class="text-brand shrink-0" />
                            <p class="text-sm flex-1 text-text-secondary">
                              Se enviará el certificado de
                              <strong class="text-text-primary">{{ alumno.nombre }}</strong>
                              @if (alumno.email) {
                                al correo
                                <strong class="text-brand">{{ alumno.email }}</strong
                                >.
                              }
                              @if (alumno.emailEnviado) {
                                <span class="text-text-muted"> (ya fue enviado anteriormente)</span>
                              }
                            </p>
                            <div class="flex items-center gap-2 shrink-0">
                              <button
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 btn-primary"
                                data-llm-action="confirm-send-professional-certificate-email"
                                (click)="confirmarEmail()"
                              >
                                <app-icon name="send" [size]="13" />
                                Confirmar envío
                              </button>
                              <button
                                class="btn-ghost text-xs"
                                data-llm-action="cancel-send-professional-certificate-email"
                                (click)="cancelarEmail()"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    }

                    <!-- Fila de confirmación inline — práctica < 100 % -->
                    @if (pendingConfirmId() === alumno.enrollmentId) {
                      <tr class="border-b border-(--border-default)">
                        <td colspan="9" class="px-4 pb-4 pt-0">
                          <div
                            class="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl px-4 py-3"
                            class="bg-warning-subtle border border-warning"
                          >
                            <app-icon
                              name="alert-triangle"
                              [size]="18"
                              class="text-warning shrink-0"
                            />
                            <p class="text-sm flex-1 text-text-secondary">
                              <span class="font-semibold text-warning">
                                Asistencia práctica incompleta:
                              </span>
                              {{ alumno.nombre }} registra
                              <strong>{{ alumno.pctAsistenciaPractica ?? 0 }}%</strong>
                              de asistencia a clases prácticas. ¿Confirmar generación del
                              certificado de todos modos?
                            </p>
                            <div class="flex items-center gap-2 shrink-0">
                              <button
                                class="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 btn-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                                data-llm-action="confirm-generate-professional-certificate-partial-practice"
                                [disabled]="generatingId() !== null"
                                (click)="confirmarGenerar()"
                              >
                                @if (generatingId() === pendingConfirmId()) {
                                  <app-icon name="loader-2" [size]="13" class="animate-spin" />
                                  Generando...
                                } @else {
                                  <span class="group-hover:hidden flex items-center gap-1.5">
                                    <app-icon name="check" [size]="13" />
                                    Confirmar de todos modos
                                  </span>
                                  <span class="hidden group-hover:flex items-center gap-1.5">
                                    <app-icon name="mouse-pointer-click" [size]="13" />
                                    Confirmar de todos modos
                                  </span>
                                }
                              </button>
                              <button
                                class="btn-ghost text-xs"
                                data-llm-action="cancel-generate-professional-certificate"
                                (click)="cancelarGenerar()"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>

            <!-- Paginación alumnos -->
            @if (totalPagesAlumnos() > 1) {
              <div
                class="flex items-center justify-between px-4 py-3 border-t border-(--border-default) text-xs text-text-muted"
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
        </div>
      }
      <!-- end @else (curso seleccionado) -->

      <!-- ── Historial de Emisiones — siempre visible ───────────────── -->
      <div class="bento-banner">
        <h2 class="flex items-center gap-2 text-lg font-semibold text-text-primary mb-4">
          <app-icon name="scroll" [size]="20" />
          Historial de Emisiones (Log)
        </h2>

        <div class="card overflow-hidden">
          @if (isLoading()) {
            <div class="p-6 flex flex-col gap-4">
              @for (_ of skeletonRowsSmall; track $index) {
                <app-skeleton-block variant="text" width="100%" height="36px" />
              }
            </div>
          } @else if (log().length === 0) {
            <div class="p-6 text-center text-text-muted text-sm">
              No hay registros de emisión de certificados profesionales aún
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-(--border-default)">
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                    >
                      Fecha/Hora
                    </th>
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                    >
                      Acción
                    </th>
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                    >
                      Alumno
                    </th>
                    <th
                      class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                    >
                      Usuario
                    </th>
                  </tr>
                </thead>
                <tbody>
                  @for (entry of pagedLog(); track entry.id) {
                    <tr
                      class="border-b border-(--border-default) last:border-b-0 hover:bg-(--bg-subtle) transition-colors"
                    >
                      <td class="px-4 py-3 text-text-muted text-xs font-mono">
                        {{ entry.fecha | date: 'yyyy-MM-dd HH:mm' }}
                      </td>
                      <td class="px-4 py-3">
                        <app-badge [variant]="getAccionVariant(entry.accion)">
                          {{ getAccionLabel(entry.accion) }}
                        </app-badge>
                      </td>
                      <td class="px-4 py-3 text-text-primary">{{ entry.alumnoNombre }}</td>
                      <td class="px-4 py-3 text-text-muted">{{ entry.usuarioNombre }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Paginación log -->
            @if (totalPagesLog() > 1) {
              <div
                class="flex items-center justify-between px-4 py-3 border-t border-(--border-default) text-xs text-text-muted"
              >
                <span>
                  {{ currentPageLog() * PAGE_SIZE + 1 }}–{{
                    pageEnd(log().length, currentPageLog())
                  }}
                  de {{ log().length }} &nbsp;·&nbsp; Pág. {{ currentPageLog() + 1 }} /
                  {{ totalPagesLog() }}
                </span>
                <div class="flex items-center gap-1">
                  <button
                    class="p-1 rounded hover:bg-(--bg-subtle) disabled:opacity-40 disabled:cursor-not-allowed"
                    [disabled]="currentPageLog() === 0"
                    (click)="prevPageLog()"
                    aria-label="Página anterior"
                  >
                    <app-icon name="chevron-left" [size]="15" />
                  </button>
                  <button
                    class="p-1 rounded hover:bg-(--bg-subtle) disabled:opacity-40 disabled:cursor-not-allowed"
                    [disabled]="currentPageLog() >= totalPagesLog() - 1"
                    (click)="nextPageLog()"
                    aria-label="Página siguiente"
                  >
                    <app-icon name="chevron-right" [size]="15" />
                  </button>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
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
  readonly log = input<CertificacionProfesionalLogRow[]>([]);
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
  readonly generarPendientes = output<void>();
  readonly enviarEmailsMasivo = output<void>();
  readonly exportar = output<void>();

  // ── Local state ──
  readonly estadoFilter = signal<EstadoFilter>(null);
  readonly searchQuery = signal('');
  readonly currentPageAlumnos = signal(0);
  readonly currentPageLog = signal(0);
  readonly masivoPanelVisible = signal(false);
  readonly pendientesPanelVisible = signal(false);
  readonly pendingConfirmId = signal<number | null>(null);
  readonly emailConfirmId = signal<number | null>(null);

  protected readonly PAGE_SIZE = PAGE_SIZE;
  readonly heroActions: SectionHeroAction[] = [];

  readonly estadoOptions = [
    { label: 'Generados', value: 'generado' },
    { label: 'Pendientes', value: 'pendiente' },
  ];

  readonly skeletonRows = Array.from({ length: 5 });
  readonly skeletonRowsSmall = Array.from({ length: 3 });

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

  readonly totalPagesLog = computed(() => Math.ceil(this.log().length / PAGE_SIZE));

  readonly pagedLog = computed(() => {
    const page = this.currentPageLog();
    const start = page * PAGE_SIZE;
    return this.log().slice(start, start + PAGE_SIZE);
  });

  readonly pendientesCount = computed(
    () => this.alumnos().filter((a) => a.certificadoStatus === 'pendiente').length,
  );

  readonly pendientesElegibles = computed(() =>
    this.alumnos().filter((a) => a.certificadoStatus === 'pendiente' && a.elegible),
  );

  readonly pendientesNoElegibles = computed(() =>
    this.alumnos().filter((a) => a.certificadoStatus === 'pendiente' && !a.elegible),
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

  prevPageLog(): void {
    this.currentPageLog.update((p) => Math.max(0, p - 1));
  }

  nextPageLog(): void {
    this.currentPageLog.update((p) => Math.min(this.totalPagesLog() - 1, p + 1));
  }

  pageEnd(total: number, page: number): number {
    return Math.min((page + 1) * PAGE_SIZE, total);
  }

  // ── Handlers de generación ──

  onClickGenerar(alumno: CertificacionProfesionalAlumnoRow): void {
    const pct = alumno.pctAsistenciaPractica;
    if (pct === null || pct >= 100) {
      this.generarCertificado.emit(alumno.enrollmentId);
      return;
    }
    this.pendingConfirmId.set(alumno.enrollmentId);
  }

  confirmarGenerar(): void {
    const id = this.pendingConfirmId();
    if (id !== null) {
      this.generarCertificado.emit(id);
      this.pendingConfirmId.set(null);
    }
  }

  cancelarGenerar(): void {
    this.pendingConfirmId.set(null);
  }

  abrirPanelPendientes(): void {
    this.pendientesPanelVisible.set(true);
  }

  cancelarPendientes(): void {
    this.pendientesPanelVisible.set(false);
  }

  confirmarPendientes(): void {
    this.pendientesPanelVisible.set(false);
    this.generarPendientes.emit();
  }

  onClickEmail(alumno: CertificacionProfesionalAlumnoRow): void {
    this.emailConfirmId.set(alumno.enrollmentId);
  }

  confirmarEmail(): void {
    const id = this.emailConfirmId();
    if (id !== null) {
      this.enviarEmail.emit(id);
      this.emailConfirmId.set(null);
    }
  }

  cancelarEmail(): void {
    this.emailConfirmId.set(null);
  }

  abrirPanelMasivo(): void {
    this.masivoPanelVisible.set(true);
  }

  cancelarMasivo(): void {
    this.masivoPanelVisible.set(false);
  }

  confirmarMasivo(): void {
    this.masivoPanelVisible.set(false);
    this.enviarEmailsMasivo.emit();
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  // ── Helpers de color ──

  getAccionLabel(accion: string): string {
    return ACCION_LABELS_PROF[accion] ?? accion;
  }

  getAccionVariant(accion: string): 'success' | 'brand' | 'info' | 'neutral' {
    switch (accion) {
      case 'generated':
        return 'success';
      case 'email_sent':
        return 'brand';
      case 'downloaded':
        return 'info';
      default:
        return 'neutral';
    }
  }
}
