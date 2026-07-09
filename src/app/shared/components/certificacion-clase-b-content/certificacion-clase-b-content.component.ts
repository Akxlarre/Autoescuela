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
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import type {
  CertificacionAlumnoRow,
  CertificacionKpis,
  CertificacionLogRow,
} from '@core/models/ui/certificacion-clase-b.model';
import { ACCION_LABELS } from '@core/models/ui/certificacion-clase-b.model';

type EstadoFilter = 'generado' | 'pendiente' | null;

/**
 * CertificacionClaseBContentComponent — Dumb component.
 *
 * Vista de certificación Clase B:
 *  - Section Hero compacto
 *  - 4 KPIs (Total alumnos, Generados, Pendientes Generación, Pendientes Envío)
 *  - Toolbar con buscador (nombre/RUT) + filtro de estado + acciones masivas
 *  - Tabla de alumnos elegibles paginada (PAGE_SIZE=10)
 *  - Historial de emisiones paginado
 */
@Component({
  selector: 'app-certificacion-clase-b-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    EmptyStateComponent,
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
        title="Gestión de Certificados"
        subtitle="Certificación de finalización de curso Clase B"
        icon="award"
        [kpis]="heroKpis()"
        [actions]="heroActions"
      />

      <!-- ── Tabla + Toolbar (card unificado) ────────────────────────── -->
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
            placeholder="Todos"
            class="h-9"
            data-llm-description="Filter certificates by status"
          />

          @if (pendientesCount() > 0) {
            <button
              class="btn-primary flex items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              data-llm-action="generate-pending-certificates"
              [disabled]="isGeneratingPendientes()"
              (click)="abrirPanelPendientes()"
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
              class="btn-secondary flex items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              data-llm-action="send-bulk-emails"
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
            data-llm-action="export-all-certificates-zip"
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

        <!-- ── Panel confirmación generar pendientes ────────────────────── -->
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
                  Generar Pendientes — {{ alumnosPendientes().length }} certificado{{
                    alumnosPendientes().length !== 1 ? 's' : ''
                  }}
                </p>
                <p class="text-xs mt-0.5 text-text-muted">
                  Se generará el certificado de todos los alumnos con las prácticas completas.
                </p>
              </div>
            </div>

            <div class="rounded-lg border divide-y overflow-hidden border-border-subtle">
              @for (alumno of alumnosPendientes(); track alumno.enrollmentId) {
                <div class="flex items-center gap-3 px-4 py-2.5">
                  <app-icon name="file-check" [size]="14" class="text-success shrink-0" />
                  <span class="text-sm font-medium flex-1 truncate text-text-primary">
                    {{ alumno.nombre }}
                  </span>
                </div>
              }
            </div>

            <div class="flex items-center gap-2 justify-end">
              <button
                class="btn-ghost"
                data-llm-action="cancel-generate-pending-certificates"
                (click)="cancelarPendientes()"
              >
                Cancelar
              </button>
              <button
                class="btn-primary"
                data-llm-action="confirm-generate-pending-certificates"
                (click)="confirmarPendientes()"
              >
                <app-icon name="file-check" [size]="14" />
                Generar {{ alumnosPendientes().length }} certificado{{
                  alumnosPendientes().length !== 1 ? 's' : ''
                }}
              </button>
            </div>
          </div>
        }

        <!-- ── Panel confirmación envío masivo ──────────────────────────── -->
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
                  recibirá{{ alumnosParaEnvioMasivo().length !== 1 ? 'n' : '' }} su certificado por
                  correo
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
                data-llm-action="cancel-bulk-email"
                (click)="cancelarMasivo()"
              >
                Cancelar
              </button>
              <button
                class="btn-primary"
                data-llm-action="confirm-bulk-email"
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

        <!-- ── Tabla principal ─────────────────────────────────────────── -->
        @if (isLoading()) {
          <div class="p-6 flex flex-col gap-4">
            @for (_ of skeletonRows; track $index) {
              <app-skeleton-block variant="text" width="100%" height="48px" />
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
                    Curso
                  </th>
                  <th
                    class="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                  >
                    Prácticas
                  </th>
                  <th
                    class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted"
                  >
                    Fecha Término
                  </th>
                  <th
                    class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted"
                  >
                    N° Certificado
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
                    <td class="px-4 py-3">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-muted text-brand"
                      >
                        {{ alumno.curso }}
                      </span>
                    </td>
                    <!-- Prácticas: siempre 12/12 si aparece en esta lista -->
                    <td class="px-4 py-3 text-center">
                      <span class="font-semibold text-success">
                        {{ alumno.clasesCompletadas }}/{{ alumno.clasesTotales }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-muted">
                      {{ alumno.fechaTermino ?? '—' }}
                    </td>
                    <td class="px-4 py-3 text-brand">
                      {{ alumno.certificadoFolio ?? '—' }}
                    </td>
                    <td class="px-4 py-3 text-center">
                      @if (alumno.certificadoStatus === 'generado') {
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-success"
                          class="bg-success-subtle"
                        >
                          <app-icon name="check" [size]="12" />
                          Generado
                        </span>
                      } @else {
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-warning"
                          class="bg-warning-subtle"
                        >
                          Pendiente
                        </span>
                      }
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-2">
                        @if (alumno.certificadoStatus === 'pendiente') {
                          <button
                            class="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 btn-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                            data-llm-action="generate-certificate"
                            [disabled]="generatingId() !== null"
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
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
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
                              data-llm-action="confirm-send-certificate-email"
                              (click)="confirmarEmail()"
                            >
                              <app-icon name="send" [size]="13" />
                              Confirmar envío
                            </button>
                            <button
                              class="btn-ghost text-xs"
                              data-llm-action="cancel-send-certificate-email"
                              (click)="cancelarEmail()"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  }

                  <!-- Fila de confirmación inline — visible solo si teoría < 100 % -->
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
                              Asistencia teórica incompleta:
                            </span>
                            {{ alumno.nombre }} registra
                            <strong>{{ alumno.pctAsistenciaTeoria }}%</strong>
                            de asistencia a sus clases teóricas. Las prácticas están completas
                            (12/12). ¿Confirmar generación del certificado de todos modos?
                          </p>
                          <div class="flex items-center gap-2 shrink-0">
                            <button
                              class="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 btn-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                              data-llm-action="confirm-generate-certificate-partial-theory"
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
                              data-llm-action="cancel-generate-certificate"
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

          <!-- Paginación tabla principal -->
          @if (totalPagesAlumnos() > 1) {
            <div class="flex items-center justify-between px-4 py-3 border-t border-border-default">
              <span class="text-xs text-text-muted">
                {{ currentPageAlumnos() * PAGE_SIZE + 1 }}–{{
                  pageEnd(currentPageAlumnos(), filteredAlumnos().length)
                }}
                de {{ filteredAlumnos().length }} alumnos
              </span>
              <div class="flex items-center gap-1">
                <button
                  class="p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary"
                  [disabled]="currentPageAlumnos() === 0"
                  (click)="prevPageAlumnos()"
                >
                  <app-icon name="chevron-left" [size]="16" />
                </button>
                <span class="text-xs px-3 text-text-secondary">
                  Pág. {{ currentPageAlumnos() + 1 }} / {{ totalPagesAlumnos() }}
                </span>
                <button
                  class="p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary"
                  [disabled]="currentPageAlumnos() >= totalPagesAlumnos() - 1"
                  (click)="nextPageAlumnos()"
                >
                  <app-icon name="chevron-right" [size]="16" />
                </button>
              </div>
            </div>
          }
        }
      </div>

      <!-- ── Historial de Emisiones (Log) ────────────────────────────── -->
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
              No hay registros de emisión aún
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
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          [style.background]="getAccionBg(entry.accion)"
                          [style.color]="getAccionColor(entry.accion)"
                        >
                          {{ getAccionLabel(entry.accion) }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-text-primary">
                        {{ entry.alumnoNombre }}
                      </td>
                      <td class="px-4 py-3 text-text-muted">
                        {{ entry.usuarioNombre }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Paginación log -->
            @if (totalPagesLog() > 1) {
              <div
                class="flex items-center justify-between px-4 py-3 border-t border-border-default"
              >
                <span class="text-xs text-text-muted">
                  {{ currentPageLog() * PAGE_SIZE + 1 }}–{{
                    pageEnd(currentPageLog(), log().length)
                  }}
                  de {{ log().length }} registros
                </span>
                <div class="flex items-center gap-1">
                  <button
                    class="p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary"
                    [disabled]="currentPageLog() === 0"
                    (click)="prevPageLog()"
                  >
                    <app-icon name="chevron-left" [size]="16" />
                  </button>
                  <span class="text-xs px-3 text-text-secondary">
                    Pág. {{ currentPageLog() + 1 }} / {{ totalPagesLog() }}
                  </span>
                  <button
                    class="p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary"
                    [disabled]="currentPageLog() >= totalPagesLog() - 1"
                    (click)="nextPageLog()"
                  >
                    <app-icon name="chevron-right" [size]="16" />
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
export class CertificacionClaseBContentComponent implements AfterViewInit {
  // ── Internal ────────────────────────────────────────────────────────────────
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');
  // ── Inputs ──
  readonly alumnos = input<CertificacionAlumnoRow[]>([]);
  readonly kpis = input<CertificacionKpis | null>(null);
  readonly log = input<CertificacionLogRow[]>([]);
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

  // ── Outputs ──
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
  /** ID de la matrícula esperando confirmación para generar (teoría incompleta). */
  readonly pendingConfirmId = signal<number | null>(null);
  /** ID de la matrícula esperando confirmación para enviar email. */
  readonly emailConfirmId = signal<number | null>(null);
  /** true = panel de confirmación masiva visible. */
  readonly masivoPanelVisible = signal(false);
  /** true = panel de confirmación de generación en lote visible. */
  readonly pendientesPanelVisible = signal(false);

  // ── Pagination ──
  readonly PAGE_SIZE = 10;

  // ── Hero config ──
  readonly heroActions: SectionHeroAction[] = [];

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

  // ── Filter options ──
  readonly estadoOptions = [
    { label: 'Generados', value: 'generado' },
    { label: 'Pendientes', value: 'pendiente' },
  ];

  // ── Skeleton helpers ──
  readonly skeletonRows = Array.from({ length: 5 });
  readonly skeletonRowsSmall = Array.from({ length: 3 });

  // ── Computed ──

  readonly filteredAlumnos = computed(() => {
    const filter = this.estadoFilter();
    const query = this.searchQuery().trim().toLowerCase();
    const all = this.alumnos();

    let result = !filter ? all : all.filter((a) => a.certificadoStatus === filter);

    if (query) {
      // Normalize: strip diacritics so "Gonza" matches "González"
      const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const queryNorm = normalize(query).replace(/[.\-]/g, '');
      result = result.filter((a) => {
        const nameMatch = normalize(a.nombre).includes(normalize(query));
        const rutNorm = a.rut.replace(/[.\-]/g, '').toLowerCase();
        const rutMatch = rutNorm.includes(queryNorm);
        return nameMatch || rutMatch;
      });
    }

    return result;
  });

  readonly totalPagesAlumnos = computed(() =>
    Math.ceil(this.filteredAlumnos().length / this.PAGE_SIZE),
  );

  readonly pagedAlumnos = computed(() => {
    const page = this.currentPageAlumnos();
    const start = page * this.PAGE_SIZE;
    return this.filteredAlumnos().slice(start, start + this.PAGE_SIZE);
  });

  readonly totalPagesLog = computed(() => Math.ceil(this.log().length / this.PAGE_SIZE));

  readonly pagedLog = computed(() => {
    const page = this.currentPageLog();
    const start = page * this.PAGE_SIZE;
    return this.log().slice(start, start + this.PAGE_SIZE);
  });

  readonly pendientesCount = computed(
    () => this.alumnos().filter((a) => a.certificadoStatus === 'pendiente').length,
  );

  /** Alumnos pendientes de certificado — para el panel de confirmación de generación masiva. */
  readonly alumnosPendientes = computed(() =>
    this.alumnos().filter((a) => a.certificadoStatus === 'pendiente'),
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

  prevPageLog(): void {
    this.currentPageLog.update((p) => Math.max(0, p - 1));
  }

  nextPageLog(): void {
    this.currentPageLog.update((p) => Math.min(this.totalPagesLog() - 1, p + 1));
  }

  /** Upper bound of the current page range (for "X–Y de N" label). */
  pageEnd(currentPage: number, total: number): number {
    return Math.min((currentPage + 1) * this.PAGE_SIZE, total);
  }

  // ── Handlers de generación ──

  /**
   * Punto de entrada del botón "Generar".
   * - Si teoría = 100 % o sin registro → emite directamente.
   * - Si teoría < 100 % → abre la fila de confirmación inline.
   */
  onClickGenerar(alumno: CertificacionAlumnoRow): void {
    const pct = alumno.pctAsistenciaTeoria;
    if (pct === null || pct >= 100) {
      this.generarCertificado.emit(alumno.enrollmentId);
      return;
    }
    this.pendingConfirmId.set(alumno.enrollmentId);
  }

  /** Confirmó generar a pesar de teoría incompleta. */
  confirmarGenerar(): void {
    const id = this.pendingConfirmId();
    if (id !== null) {
      this.generarCertificado.emit(id);
      this.pendingConfirmId.set(null);
    }
  }

  /** Canceló la confirmación de generación. */
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

  /** Abre la confirmación inline de envío de email. */
  onClickEmail(alumno: CertificacionAlumnoRow): void {
    this.emailConfirmId.set(alumno.enrollmentId);
  }

  /** Confirma y dispara el envío del certificado por email. */
  confirmarEmail(): void {
    const id = this.emailConfirmId();
    if (id !== null) {
      this.enviarEmail.emit(id);
      this.emailConfirmId.set(null);
    }
  }

  /** Cancela la confirmación de envío de email. */
  cancelarEmail(): void {
    this.emailConfirmId.set(null);
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  getAccionLabel(accion: string): string {
    return ACCION_LABELS[accion] ?? accion;
  }

  getAccionColor(accion: string): string {
    switch (accion) {
      case 'generated':
        return 'var(--state-success)';
      case 'email_sent':
        return 'var(--color-primary)';
      case 'downloaded':
        return 'var(--state-info, var(--color-primary))';
      case 'printed':
        return 'var(--text-secondary)';
      default:
        return 'var(--text-muted)';
    }
  }

  getAccionBg(accion: string): string {
    switch (accion) {
      case 'generated':
        return 'var(--bg-success-muted, rgba(34,197,94,0.1))';
      case 'email_sent':
        return 'var(--bg-brand-muted)';
      case 'downloaded':
        return 'var(--bg-info-muted, rgba(59,130,246,0.1))';
      case 'printed':
        return 'var(--bg-subtle)';
      default:
        return 'var(--bg-subtle)';
    }
  }
}
