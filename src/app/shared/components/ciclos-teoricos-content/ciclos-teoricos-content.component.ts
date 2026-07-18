import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { ModalOverlayDirective } from '@core/directives/modal-overlay.directive';
import { groupCyclesByStatus } from '@core/utils/ciclo-select-groups.util';
import { formatChileanDate, to24hTime } from '@core/utils/date.utils';
import { filterBySearch } from '@core/utils/search-filter.utils';
import type {
  CicloAlumno,
  CicloAlumnoMovible,
  CicloClaseRow,
  CicloOption,
} from '@core/models/ui/ciclos-teoricos.model';

/**
 * CiclosTeoricosContentComponent — Dumb (OnPush).
 *
 * Pestaña "Ciclos Teóricos" de Asistencia B (Spec 0001):
 *  - Selector de ciclo (RF-11).
 *  - 6 clases con tema opcional + enlace Zoom (RF-14) y envío con destinatarios
 *    preseleccionables (RF-15/16).
 *  - Roster de la cohorte (RF-12) con reasignación entre ciclos (override).
 *
 * Solo inputs/outputs; el Smart Component coordina CiclosTeoricosFacade.
 */
@Component({
  selector: 'app-ciclos-teoricos-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    EmptyStateComponent,
    CardHoverDirective,
    AnimateInDirective,
    ModalOverlayDirective,
  ],
  styles: `
    /* El host se comporta como celda fill (spec 0031): cuando el parent le pone
       .bento-fill, contain:size (solo desktop, @container ≥1024) le fija la
       altura de la fila del grid y este display:flex deja que el root llene con
       flex-1. En móvil (sin contain) es altura natural y la página scrollea. */
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .field-input {
      width: 100%;
      padding: 8px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
    }
    .field-input--icon {
      padding-left: 2.25rem;
    }
    .field-label {
      display: block;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
  `,
  template: `
    <!-- Root llena el host (celda fill en desktop): 2 columnas con scroll
         interno por columna (spec 0031). El selector de ciclo se fusionó en el
         header de la columna de Clases (spec 0031 refinamiento) para recuperar
         la fila que ocupaba (~140px de 457px). En móvil = altura natural. -->
    <div class="flex-1 min-h-0 flex flex-col gap-4">
      @if (isLoading()) {
        <!-- Skeleton de 2 columnas (fix-046): espeja el shell real (card Clases
             flex-1 + card Alumnos w-96), no 3 barras desnudas. Mismo switch
             fila/columna por isDesktop() que el layout cargado. -->
        <div class="flex flex-col gap-6 flex-1 min-h-0" [class.flex-row]="isDesktop()">
          <!-- Columna Clases (protagonista) -->
          <section class="card p-5 flex flex-col gap-4 flex-1 min-w-0 min-h-0">
            <div class="flex items-center gap-2 shrink-0">
              <app-skeleton-block variant="circle" width="18px" height="18px" />
              <div class="flex-1 min-w-0">
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              </div>
              <app-skeleton-block variant="rect" width="72px" height="26px" />
            </div>
            <div class="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
              @for (i of [1, 2]; track i) {
                <div
                  class="rounded-xl border p-5 flex flex-col gap-4"
                  [style.border-color]="'var(--border-subtle)'"
                >
                  <app-skeleton-block variant="text" width="140px" height="14px" />
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1">
                      <app-skeleton-block variant="text" width="90px" height="10px" />
                      <app-skeleton-block variant="rect" width="100%" height="38px" />
                    </div>
                    <div class="flex flex-col gap-1">
                      <app-skeleton-block variant="text" width="80px" height="10px" />
                      <app-skeleton-block variant="rect" width="100%" height="38px" />
                    </div>
                  </div>
                  <div class="flex items-center justify-end gap-2">
                    <app-skeleton-block variant="rect" width="84px" height="36px" />
                    <app-skeleton-block variant="rect" width="180px" height="36px" />
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- Rail Alumnos -->
          <section
            class="card p-5 flex flex-col gap-4 min-h-0"
            [class.w-96]="isDesktop()"
            [class.shrink-0]="isDesktop()"
          >
            <div class="flex items-center justify-between gap-2 shrink-0">
              <div class="flex items-center gap-2">
                <app-skeleton-block variant="circle" width="20px" height="20px" />
                <app-skeleton-block variant="text" width="130px" height="14px" />
              </div>
              <app-skeleton-block variant="rect" width="104px" height="36px" />
            </div>
            <div class="flex flex-col gap-1 flex-1 min-h-0 overflow-hidden">
              @for (i of [1, 2, 3, 4, 5]; track i) {
                <div class="flex items-center justify-between gap-2 px-2 py-3">
                  <div class="flex flex-col gap-1.5 min-w-0 flex-1">
                    <app-skeleton-block variant="text" width="60%" height="13px" />
                    <app-skeleton-block variant="text" width="80%" height="10px" />
                  </div>
                  <app-skeleton-block variant="text" width="80px" height="12px" />
                </div>
              }
            </div>
          </section>
        </div>
      } @else {
        <!-- 2 columnas con flex (no grid): en fill de altura acotada, flex-1 +
             min-h-0 propaga el alto a las columnas para que su scroll interno
             enganche (con grid la fila queda 'auto'). Switch fila/columna por
             isDesktop() (contenedor), no lg: (viewport). Mismo patrón que el tab
             Prácticas: columna protagonista flex-1 + rail de ancho fijo. -->
        <div class="flex flex-col gap-6 flex-1 min-h-0" [class.flex-row]="isDesktop()">
          <!-- ── Clases del ciclo (RF-14/15/16) — protagonista ───────────────── -->
          <section class="card p-5 flex flex-col gap-4 flex-1 min-w-0 min-h-0" appCardHover>
            <!-- Header fusionado (spec 0031 refinamiento): el selector de ciclo
                 vive aquí (antes era una fila-tarjeta aparte de ~140px). Ícono +
                 dropdown que crece + badge de estado del ciclo. -->
            <div class="flex items-center gap-2 shrink-0">
              <app-icon name="video" [size]="18" [style.color]="'var(--color-primary)'" />
              @if (cycles().length === 0) {
                <p class="text-sm text-text-secondary flex-1">
                  No hay ciclos en esta sede todavía.
                </p>
              } @else {
                <div class="flex-1 min-w-0">
                  <p-select
                    [options]="cycleSelectGroups()"
                    optionLabel="label"
                    optionValue="value"
                    [group]="true"
                    optionGroupLabel="label"
                    optionGroupChildren="items"
                    [ngModel]="selectedCycleId()"
                    (ngModelChange)="selectCycle.emit($event)"
                    placeholder="Selecciona un ciclo"
                    styleClass="w-full"
                    appendTo="body"
                    data-llm-description="Selector de ciclo teórico"
                  />
                </div>
                @if (selectedCycle(); as c) {
                  <app-badge
                    class="shrink-0"
                    [variant]="c.status === 'active' ? 'success' : 'neutral'"
                  >
                    <app-icon
                      [name]="c.status === 'active' ? 'circle-play' : 'circle-check'"
                      [size]="13"
                    />
                    {{ c.status === 'active' ? 'Activo' : 'Finalizado' }}
                  </app-badge>
                }
              }
            </div>

            <!-- Wrapper de scroll interno (spec 0031): en desktop fill llena el
                 resto de la columna y scrollea; en móvil altura natural. -->
            <div class="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
              @if (isLoadingCycle()) {
                <div class="flex flex-col gap-2">
                  @for (i of [1, 2, 3]; track i) {
                    <app-skeleton-block variant="rect" width="100%" height="80px" />
                  }
                </div>
              } @else if (selectedCycleId() === null) {
                <app-empty-state
                  icon="monitor-play"
                  message="Sin ciclo seleccionado"
                  subtitle="Selecciona un ciclo para ver sus clases."
                />
              } @else {
                @for (clase of clases(); track clase.id) {
                  <div
                    class="rounded-xl border p-5 flex flex-col gap-4"
                    [style.border-color]="'var(--border-subtle)'"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-sm font-semibold text-text-primary">{{ clase.label }}</p>
                      @if (clase.zoomSentAt) {
                        <app-badge variant="success">
                          <app-icon name="mail-check" [size]="11" />
                          Enviado el {{ formatSentAt(clase.zoomSentAt) }}
                        </app-badge>
                      }
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div class="flex flex-col gap-1">
                        <label class="field-label">Tema (opcional)</label>
                        <input
                          type="text"
                          class="field-input"
                          placeholder="Ej: Legislación de Tránsito"
                          [ngModel]="clase.tema ?? ''"
                          (ngModelChange)="topicDrafts[clase.id] = $event"
                          data-llm-description="Tema opcional de la clase del ciclo"
                        />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="field-label">Enlace Zoom</label>
                        <input
                          type="url"
                          class="field-input"
                          placeholder="https://zoom.us/j/..."
                          [ngModel]="clase.zoomLink ?? ''"
                          (ngModelChange)="zoomDrafts[clase.id] = $event"
                          data-llm-description="URL del enlace Zoom de la clase"
                        />
                      </div>
                    </div>

                    <div class="flex items-center justify-end gap-2">
                      <button
                        class="btn-secondary text-sm px-4 py-2"
                        [disabled]="isSaving()"
                        data-llm-action="guardar-clase-ciclo"
                        (click)="onSaveClase(clase)"
                      >
                        Guardar
                      </button>
                      <button
                        class="btn-primary text-sm px-4 py-2 flex items-center gap-2"
                        [disabled]="isSaving() || !hasZoom(clase)"
                        data-llm-action="abrir-envio-zoom"
                        (click)="openSendPanel(clase)"
                      >
                        @if (sendingClassId() === clase.id) {
                          <app-icon name="loader-circle" [size]="14" class="animate-spin" />
                          Enviando...
                        } @else {
                          <app-icon [name]="clase.zoomSentAt ? 'refresh-cw' : 'send'" [size]="14" />
                          {{
                            clase.zoomSentAt ? 'Reenviar enlace' : 'Elegir destinatarios y enviar'
                          }}
                        }
                      </button>
                    </div>
                  </div>
                } @empty {
                  <app-empty-state
                    icon="video-off"
                    message="Ciclo sin clases"
                    subtitle="Este ciclo aún no tiene clases generadas."
                  />
                }
              }
            </div>
          </section>

          <!-- ── Roster + reasignación (RF-12 + override) — rail ─────────────── -->
          <section
            class="card p-5 flex flex-col gap-4 min-h-0"
            [class.w-96]="isDesktop()"
            [class.shrink-0]="isDesktop()"
            appCardHover
          >
            <div class="flex items-center justify-between gap-2 shrink-0">
              <div class="flex items-center gap-2">
                <app-icon name="users" [size]="20" [style.color]="'var(--color-primary)'" />
                <h2 class="font-semibold text-text-primary">
                  Alumnos del ciclo
                  @if (selectedCycleId() !== null) {
                    <span class="text-text-muted">({{ roster().length }})</span>
                  }
                </h2>
              </div>
              <button
                class="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
                data-llm-action="abrir-incorporar-alumno"
                (click)="openAddPanel()"
              >
                <app-icon name="user-plus" [size]="14" />
                Incorporar
              </button>
            </div>

            @if (isLoadingCycle()) {
              <div class="flex flex-col gap-2">
                @for (i of [1, 2, 3]; track i) {
                  <app-skeleton-block variant="rect" width="100%" height="40px" />
                }
              </div>
            } @else if (selectedCycleId() === null) {
              <app-empty-state
                icon="users"
                message="Sin ciclo seleccionado"
                subtitle="Selecciona un ciclo para ver sus alumnos."
              />
            } @else if (roster().length === 0) {
              <app-empty-state
                icon="user-x"
                message="Ciclo vacío"
                subtitle="Sin alumnos en este ciclo."
              />
            } @else {
              <div class="relative shrink-0">
                <app-icon
                  name="search"
                  [size]="14"
                  class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                <input
                  type="text"
                  class="field-input field-input--icon"
                  placeholder="Buscar alumno…"
                  [ngModel]="rosterSearchQuery()"
                  (ngModelChange)="rosterSearchQuery.set($event)"
                  data-llm-description="Buscar alumno dentro del roster del ciclo"
                />
              </div>
              @if (filteredRoster().length === 0) {
                <app-empty-state
                  icon="search"
                  message="Sin resultados"
                  subtitle="No se encontraron alumnos para tu búsqueda."
                />
              }
              <div class="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
                @for (alumno of filteredRoster(); track alumno.enrollmentId) {
                  <div class="flex items-center gap-2 px-2 py-3 rounded-md hover:bg-elevated">
                    <div class="min-w-0 flex-1">
                      <p class="text-text-primary truncate">{{ alumno.nombre }}</p>
                      <p class="text-sm text-text-muted truncate">
                        {{ alumno.email || 'Sin correo' }}
                      </p>
                    </div>
                    @if (movingEnrollmentId() === alumno.enrollmentId) {
                      <p-select
                        [options]="otherCycleOptions()"
                        optionLabel="label"
                        optionValue="value"
                        [ngModel]="moveTargetCycleId()"
                        (ngModelChange)="moveTargetCycleId.set($event)"
                        placeholder="Cambiar a…"
                        styleClass="w-40"
                        appendTo="body"
                        data-llm-description="Ciclo destino para cambiar al alumno de ciclo"
                      />
                      <button
                        class="p-1.5 rounded-md cursor-pointer"
                        [style.color]="'var(--state-success)'"
                        [disabled]="moveTargetCycleId() === null || isSaving()"
                        title="Confirmar"
                        data-llm-action="confirmar-mover-alumno"
                        (click)="confirmMove(alumno.enrollmentId)"
                      >
                        <app-icon name="check" [size]="16" />
                      </button>
                      <button
                        class="p-1.5 rounded-md cursor-pointer text-text-muted"
                        title="Cancelar"
                        (click)="cancelMove()"
                      >
                        <app-icon name="x" [size]="16" />
                      </button>
                    } @else {
                      <button
                        class="text-sm font-medium hover:underline cursor-pointer shrink-0"
                        [style.color]="'var(--color-primary)'"
                        [disabled]="otherCycleOptions().length === 0"
                        title="Cambiar de ciclo"
                        data-llm-action="cambiar-alumno-de-ciclo"
                        (click)="startMove(alumno.enrollmentId)"
                      >
                        Cambiar de ciclo
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </section>
        </div>
      }
    </div>

    <!-- Modal: elegir destinatarios y enviar Zoom (canon: backdrop + card, hotfix-021) -->
    <div [appModalOverlay]="openPanelClassId() !== null">
      @if (openPanelClassId() !== null && sendingClase(); as clase) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-(--overlay-backdrop) backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Elegir destinatarios y enviar enlace Zoom"
          (click)="closeSendPanel()"
          (document:keydown.escape)="closeSendPanel()"
        >
          <div
            class="relative w-full max-w-md max-h-[85vh] rounded-2xl shadow-2xl flex flex-col gap-0 overflow-hidden bg-surface"
            (click)="$event.stopPropagation()"
            appAnimateIn
          >
            <!-- Header -->
            <div
              class="flex items-center justify-between gap-3 px-6 py-5 border-b border-border-subtle shrink-0"
            >
              <div class="min-w-0">
                <span class="font-bold text-base text-text-primary block truncate"
                  >Elegir destinatarios</span
                >
                <span class="text-xs text-text-muted truncate block">{{ clase.label }}</span>
              </div>
              <button
                type="button"
                class="p-1.5 rounded-md cursor-pointer text-text-muted hover:bg-elevated shrink-0"
                title="Cerrar"
                [disabled]="sendingClassId() === clase.id"
                data-llm-action="cerrar-destinatarios-zoom"
                (click)="closeSendPanel()"
              >
                <app-icon name="x" [size]="16" />
              </button>
            </div>

            <!-- Body -->
            <div class="px-6 py-5 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <p class="text-xs font-semibold text-text-primary">
                  Destinatarios ({{ selectedRecipientCount() }} de {{ roster().length }})
                </p>
                <button
                  class="text-xs font-medium text-brand bg-transparent border-none cursor-pointer"
                  (click)="toggleAllRecipients()"
                >
                  {{ allRecipientsSelected() ? 'Quitar todos' : 'Marcar todos' }}
                </button>
              </div>
              @if (roster().length === 0) {
                <p class="text-xs text-text-muted py-2">El ciclo no tiene alumnos.</p>
              } @else {
                <div class="flex flex-col gap-1">
                  @for (alumno of roster(); track alumno.enrollmentId) {
                    <label
                      class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-elevated"
                    >
                      <input
                        type="checkbox"
                        class="accent-(--ds-brand)"
                        [checked]="isRecipientSelected(alumno.enrollmentId)"
                        (change)="toggleRecipient(alumno.enrollmentId)"
                      />
                      <span class="min-w-0 flex-1">
                        <span class="text-sm text-text-primary block truncate">{{
                          alumno.nombre
                        }}</span>
                        <span class="text-xs text-text-muted block truncate">{{
                          alumno.email || 'Sin correo'
                        }}</span>
                      </span>
                    </label>
                  }
                </div>
              }
            </div>

            <!-- Footer -->
            <div
              class="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-subtle shrink-0"
            >
              <button
                class="btn-secondary text-sm px-4 py-2"
                [disabled]="sendingClassId() === clase.id"
                (click)="closeSendPanel()"
              >
                Cancelar
              </button>
              <button
                class="btn-primary text-sm px-4 py-2 flex items-center gap-2"
                [disabled]="
                  isSaving() || selectedRecipientCount() === 0 || sendingClassId() === clase.id
                "
                data-llm-action="confirmar-envio-zoom"
                (click)="confirmSend(clase.id)"
              >
                @if (sendingClassId() === clase.id) {
                  <app-icon name="loader-circle" [size]="14" class="animate-spin" />
                  Enviando...
                } @else {
                  Enviar a {{ selectedRecipientCount() }}
                }
              </button>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Modal: traer alumno de otro ciclo (canon: backdrop + card, no p-dialog) -->
    <div [appModalOverlay]="addPanelOpen()">
      @if (addPanelOpen()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-(--overlay-backdrop) backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Incorporar alumno de otro ciclo"
          (click)="closeAddPanel()"
          (document:keydown.escape)="closeAddPanel()"
        >
          <div
            class="relative w-full max-w-md max-h-[85vh] rounded-2xl shadow-2xl flex flex-col gap-0 overflow-hidden bg-surface"
            (click)="$event.stopPropagation()"
            appAnimateIn
          >
            <!-- Header -->
            <div
              class="flex items-center justify-between gap-3 px-6 py-5 border-b border-border-subtle shrink-0"
            >
              <span class="font-bold text-base text-text-primary"
                >Incorporar alumno de otro ciclo</span
              >
              <button
                type="button"
                class="p-1.5 rounded-md cursor-pointer text-text-muted hover:bg-elevated"
                title="Cerrar"
                data-llm-action="cerrar-incorporar-alumno"
                (click)="closeAddPanel()"
              >
                <app-icon name="x" [size]="16" />
              </button>
            </div>

            <!-- Body -->
            <div class="px-6 py-5 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
              @if (isLoadingAddable() && addableStudents().length === 0) {
                <!-- SWR (swr-pattern.md): skeleton solo en la carga inicial sin datos
                     cacheados, para no mostrar el empty state y luego "saltar" al
                     llegar los datos. -->
                <div class="flex flex-col gap-2">
                  @for (i of [1, 2, 3]; track i) {
                    <app-skeleton-block variant="rect" width="100%" height="44px" />
                  }
                </div>
              } @else if (addableStudents().length === 0) {
                <app-empty-state
                  icon="users-minus"
                  message="Sin candidatos"
                  subtitle="No hay alumnos en otros ciclos de esta sede."
                />
              } @else {
                <div class="relative shrink-0">
                  <app-icon
                    name="search"
                    [size]="14"
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                  />
                  <input
                    type="text"
                    class="field-input field-input--icon"
                    placeholder="Buscar alumno…"
                    [ngModel]="addableSearchQuery()"
                    (ngModelChange)="addableSearchQuery.set($event)"
                    data-llm-description="Buscar alumno candidato a incorporar"
                  />
                </div>
                @if (filteredAddableStudents().length === 0) {
                  <app-empty-state
                    icon="search"
                    message="Sin resultados"
                    subtitle="No se encontraron alumnos para tu búsqueda."
                  />
                }
                <div class="flex flex-col gap-1">
                  @for (a of filteredAddableStudents(); track a.enrollmentId) {
                    <div class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-elevated">
                      <div class="min-w-0 flex-1">
                        <p class="text-sm text-text-primary truncate">{{ a.nombre }}</p>
                        <p class="text-xs text-text-muted truncate">{{ a.cicloActualLabel }}</p>
                      </div>
                      <button
                        class="text-xs font-medium text-brand hover:underline cursor-pointer flex items-center gap-1"
                        [disabled]="isSaving()"
                        data-llm-action="incorporar-alumno"
                        (click)="onAddStudent(a.enrollmentId)"
                      >
                        @if (addingEnrollmentId() === a.enrollmentId) {
                          <app-icon name="loader-circle" [size]="12" class="animate-spin" />
                          Agregando...
                        } @else {
                          Agregar
                        }
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Footer -->
            <div class="flex justify-end px-6 py-4 border-t border-border-subtle shrink-0">
              <button class="btn-secondary text-sm px-4 py-2" (click)="closeAddPanel()">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class CiclosTeoricosContentComponent {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  readonly cycles = input<CicloOption[]>([]);
  readonly selectedCycleId = input<number | null>(null);
  readonly clases = input<CicloClaseRow[]>([]);
  readonly roster = input<CicloAlumno[]>([]);
  readonly addableStudents = input<CicloAlumnoMovible[]>([]);
  /** true mientras el Facade resuelve loadAddableStudents() (fix del flash/resize al abrir el modal). */
  readonly isLoadingAddable = input(false);
  readonly isLoading = input(false);
  readonly isLoadingCycle = input(false);
  readonly isSaving = input(false);
  /** Id de la clase cuyo envío de Zoom está en curso (facade), o null si ninguno. */
  readonly sendingClassId = input<number | null>(null);
  /**
   * true = layout desktop de 2 columnas con fill (scroll interno por columna).
   * Lo resuelve el parent con `isDesktopLayout()` (= tier desktop por CONTENEDOR,
   * spec 0030/0031) — NO el breakpoint de viewport `lg:` de Tailwind, para que
   * con el drawer abierto (main angosto) apile igual que la densidad se compacta.
   */
  readonly isDesktop = input(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────
  readonly selectCycle = output<number>();
  readonly saveZoomLink = output<{ classId: number; link: string }>();
  readonly updateTopic = output<{ classId: number; tema: string }>();
  readonly sendZoom = output<{ classId: number; recipientEnrollmentIds: number[] }>();
  readonly moveStudent = output<{ enrollmentId: number; targetCycleId: number }>();
  readonly requestAddable = output<void>();
  readonly addStudent = output<number>();

  // ── Drafts (edición inline sin perder lo tecleado) ───────────────────────────
  protected readonly topicDrafts: Record<number, string> = {};
  protected readonly zoomDrafts: Record<number, string> = {};

  // ── Estado local de paneles ──────────────────────────────────────────────────
  protected readonly openPanelClassId = signal<number | null>(null);
  protected readonly recipientSelection = signal<Set<number>>(new Set());
  protected readonly movingEnrollmentId = signal<number | null>(null);
  protected readonly moveTargetCycleId = signal<number | null>(null);
  protected readonly addPanelOpen = signal(false);
  protected readonly addingEnrollmentId = signal<number | null>(null);
  protected readonly rosterSearchQuery = signal('');
  protected readonly addableSearchQuery = signal('');
  private previousSendingClassId: number | null = null;
  private previousIsSaving = false;

  constructor() {
    // Cierra el panel de destinatarios solo cuando el envío en curso (facade) termina,
    // para que el botón "Enviar a N" pueda mostrar su spinner mientras dura la llamada.
    effect(() => {
      const sendingClassId = this.sendingClassId();
      const openPanelClassId = this.openPanelClassId();
      if (
        openPanelClassId !== null &&
        sendingClassId === null &&
        this.previousSendingClassId === openPanelClassId
      ) {
        this.closeSendPanel();
      }
      this.previousSendingClassId = sendingClassId;
    });

    // Limpia el spinner de "Agregando..." solo cuando el guardado en curso (facade) termina.
    effect(() => {
      const isSaving = this.isSaving();
      if (!isSaving && this.previousIsSaving) {
        this.addingEnrollmentId.set(null);
      }
      this.previousIsSaving = isSaving;
    });

    // Limpia el buscador del roster al cambiar de ciclo, para no ocultar la lista nueva con texto obsoleto.
    effect(() => {
      this.selectedCycleId();
      untracked(() => this.rosterSearchQuery.set(''));
    });
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  protected readonly selectedCycle = computed(
    () => this.cycles().find((c) => c.id === this.selectedCycleId()) ?? null,
  );

  /** Agrupa el selector en Activos / Finalizados para que la lista no se vuelva ilegible con el historial. */
  protected readonly cycleSelectGroups = computed(() => groupCyclesByStatus(this.cycles()));

  /** Ciclos distintos al actual, para mover/traer alumnos. */
  protected readonly otherCycleOptions = computed(() =>
    this.cycles()
      .filter((c) => c.id !== this.selectedCycleId())
      .map((c) => ({ label: c.label, value: c.id })),
  );

  protected readonly selectedRecipientCount = computed(() => this.recipientSelection().size);

  protected readonly allRecipientsSelected = computed(
    () => this.roster().length > 0 && this.recipientSelection().size === this.roster().length,
  );

  /** Clase objetivo del modal "Elegir destinatarios" (hotfix-021: ahora vive a nivel raíz, no inline en la card). */
  protected readonly sendingClase = computed(
    () => this.clases().find((c) => c.id === this.openPanelClassId()) ?? null,
  );

  /** Roster filtrado por el buscador del rail (no afecta el conteo del header ni destinatarios Zoom). */
  protected readonly filteredRoster = computed(() =>
    filterBySearch(this.roster(), this.rosterSearchQuery(), (a) => [a.nombre, a.email]),
  );

  /** Candidatos filtrados por el buscador del modal "Incorporar". */
  protected readonly filteredAddableStudents = computed(() =>
    filterBySearch(this.addableStudents(), this.addableSearchQuery(), (a) => [a.nombre, a.email]),
  );

  // ── Clases: guardar / enviar ──────────────────────────────────────────────────

  protected hasZoom(clase: CicloClaseRow): boolean {
    const draft = this.zoomDrafts[clase.id];
    const val = draft !== undefined ? draft : (clase.zoomLink ?? '');
    return val.trim().length > 0;
  }

  protected formatSentAt(zoomSentAt: string): string {
    return `${formatChileanDate(zoomSentAt, { day: 'numeric', month: 'short' })}, ${to24hTime(zoomSentAt)}`;
  }

  protected onSaveClase(clase: CicloClaseRow): void {
    const tema = this.topicDrafts[clase.id];
    if (tema !== undefined && tema !== (clase.tema ?? '')) {
      this.updateTopic.emit({ classId: clase.id, tema });
    }
    const link = this.zoomDrafts[clase.id];
    if (link !== undefined && link !== (clase.zoomLink ?? '')) {
      this.saveZoomLink.emit({ classId: clase.id, link });
    }
  }

  protected openSendPanel(clase: CicloClaseRow): void {
    // Auto-guarda cambios pendientes de tema/enlace antes de abrir el panel, para
    // que "Enviar a N" nunca despache un enlace desactualizado. El botón de envío
    // queda deshabilitado mientras isSaving() esté activo, evitando la carrera.
    this.onSaveClase(clase);

    this.openPanelClassId.set(clase.id);
    // Preseleccionar toda la cohorte (RF-16) — des-seleccionable.
    this.recipientSelection.set(new Set(this.roster().map((a) => a.enrollmentId)));
  }

  protected closeSendPanel(): void {
    this.openPanelClassId.set(null);
    this.recipientSelection.set(new Set());
  }

  protected isRecipientSelected(enrollmentId: number): boolean {
    return this.recipientSelection().has(enrollmentId);
  }

  protected toggleRecipient(enrollmentId: number): void {
    this.recipientSelection.update((set) => {
      const next = new Set(set);
      if (next.has(enrollmentId)) next.delete(enrollmentId);
      else next.add(enrollmentId);
      return next;
    });
  }

  protected toggleAllRecipients(): void {
    if (this.allRecipientsSelected()) {
      this.recipientSelection.set(new Set());
    } else {
      this.recipientSelection.set(new Set(this.roster().map((a) => a.enrollmentId)));
    }
  }

  protected confirmSend(classId: number): void {
    this.sendZoom.emit({
      classId,
      recipientEnrollmentIds: Array.from(this.recipientSelection()),
    });
    // El panel se cierra solo al terminar el envío (ver effect en el constructor),
    // así el botón "Enviar a N" puede mostrar su estado de carga mientras tanto.
  }

  // ── Roster: mover / traer ──────────────────────────────────────────────────────

  protected startMove(enrollmentId: number): void {
    this.movingEnrollmentId.set(enrollmentId);
    this.moveTargetCycleId.set(null);
  }

  protected cancelMove(): void {
    this.movingEnrollmentId.set(null);
    this.moveTargetCycleId.set(null);
  }

  protected confirmMove(enrollmentId: number): void {
    const target = this.moveTargetCycleId();
    if (target === null) return;
    this.moveStudent.emit({ enrollmentId, targetCycleId: target });
    this.cancelMove();
  }

  protected openAddPanel(): void {
    this.addPanelOpen.set(true);
    this.addableSearchQuery.set('');
    this.requestAddable.emit();
  }

  protected closeAddPanel(): void {
    this.addPanelOpen.set(false);
  }

  protected onAddStudent(enrollmentId: number): void {
    this.addingEnrollmentId.set(enrollmentId);
    this.addStudent.emit(enrollmentId);
  }
}
