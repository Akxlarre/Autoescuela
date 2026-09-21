import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { StableWidthDirective } from '@core/directives/stable-width.directive';
import { AnnouncementsFacade } from '@core/facades/announcements.facade';
import { NotificationTemplatesFacade } from '@core/facades/notification-templates.facade';
import { AnnouncementPreviewDrawerComponent } from './announcement-preview-drawer.component';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import {
  ANNOUNCEMENT_MAX_RECIPIENTS,
  ANNOUNCEMENT_WARN_RECIPIENTS,
  countExclusions,
  validateAnnouncementDraft,
} from '@core/utils/announcement-recipients.utils';
import { isScheduledForValid } from '@core/utils/announcement-template.utils';
import {
  applyBulkAction,
  filterRecipients,
  includedCount as countIncluded,
  onlyExcluded,
  type BulkAction,
} from '@core/utils/recipient-filter.utils';
import type {
  AnnouncementKind,
  AnnouncementCourseType,
  AnnouncementEnrollmentStatus,
  AnnouncementDraft,
} from '@core/models/ui/announcement.model';

/** Secciones plegables del compositor. `null` = todas cerradas. */
type ComposerSection = 'destinatarios' | 'mensaje' | 'envio' | null;

/**
 * `datetime-local` trabaja en hora local sin zona, así que no sirve `toISOString()`:
 * hay que descontar el offset antes de recortar.
 */
function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/**
 * Compositor de comunicados (spec 0041-b).
 *
 * El selector de tipo NO tiene valor por defecto a propósito: es lo que decide si el
 * consentimiento promocional se respeta, así que elegirlo tiene que ser un acto
 * deliberado y no un descuido (AC2).
 */
@Component({
  selector: 'app-announcement-composer-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    DrawerFormComponent,
    StableWidthDirective,
  ],
  template: `
    <app-drawer-form>
      <div class="flex flex-col gap-3" data-llm-form="create-announcement">
        <!-- ══ Sección: Destinatarios ══════════════════════════════════ -->
        <div class="card p-0 overflow-hidden">
          <button
            type="button"
            class="w-full cursor-pointer flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-subtle"
            [attr.aria-expanded]="openSection() === 'destinatarios'"
            (click)="toggleSection('destinatarios')"
          >
            <div class="min-w-0">
              <p class="item-title">Destinatarios</p>
              @if (openSection() !== 'destinatarios') {
                <!-- El resumen es lo que impide que el colapsable esconda un campo
                     obligatorio vacío: si falta algo, lo dice acá y en rojo. -->
                <p
                  class="text-xs truncate"
                  [class.text-text-muted]="destinatariosCompleto()"
                  [class.text-error]="!destinatariosCompleto()"
                >
                  {{ resumenDestinatarios() }}
                </p>
              }
            </div>
            <app-icon
              [name]="openSection() === 'destinatarios' ? 'chevron-up' : 'chevron-down'"
              [size]="16"
              class="shrink-0 text-text-muted"
            />
          </button>

          @if (openSection() === 'destinatarios') {
            <div class="flex flex-col gap-4 border-t border-border-subtle px-3 pb-4 pt-3">
              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="a-kind">
                  Tipo de comunicado <span class="text-error">*</span>
                </label>
                <p-select
                  id="a-kind"
                  [options]="kindOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Elige el tipo…"
                  styleClass="w-full"
                  [ngModel]="kind()"
                  (ngModelChange)="onKindChange($event)"
                  data-llm-description="announcement kind: operativo (reaches everyone) or promocional (consent-gated)"
                />
                @if (kind() === 'promocional') {
                  <p class="field-hint">
                    Solo llega a los alumnos que aceptaron recibir promociones y no lo revocaron.
                  </p>
                } @else if (kind() === 'operativo') {
                  <p class="field-hint">
                    Llega a todo el segmento: es información necesaria para el curso.
                  </p>
                }
              </div>

              <!-- ── Segmento ───────────────────────────────────────────────── -->
              @if (isAdmin()) {
                <div class="flex flex-col gap-1.5">
                  <label class="field-label" for="a-branch">Sede</label>
                  <p-select
                    id="a-branch"
                    [options]="branchOptions()"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Todas las sedes"
                    styleClass="w-full"
                    [ngModel]="branchId()"
                    (ngModelChange)="onFilterChange('branchId', $event)"
                  />
                </div>
              }

              <!-- Los dos filtros van en grilla: son selects cortos y apilarlos gastaba
                   una pantalla que después falta para ver el resto del formulario. -->
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <label class="field-label" for="a-course">Tipo de curso</label>
                  <p-select
                    id="a-course"
                    [options]="courseOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Todos"
                    styleClass="w-full"
                    [ngModel]="courseType()"
                    (ngModelChange)="onFilterChange('courseType', $event)"
                  />
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="field-label" for="a-status">Estado</label>
                  <p-select
                    id="a-status"
                    [options]="statusOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Cualquiera"
                    styleClass="w-full"
                    [ngModel]="enrollmentStatus()"
                    (ngModelChange)="onFilterChange('enrollmentStatus', $event)"
                  />
                </div>
              </div>

              <!-- ── Lista resuelta ─────────────────────────────────────────── -->
              @if (kind() === null) {
                <p class="field-hint">Elige el tipo de comunicado para ver a quién le llegaría.</p>
              } @else if (facade.isLoadingPreview()) {
                <div class="card p-3 flex flex-col gap-2">
                  <app-skeleton-block variant="text" width="45%" height="14px" />
                  <app-skeleton-block variant="text" width="80%" height="12px" />
                  <app-skeleton-block variant="text" width="70%" height="12px" />
                </div>
              } @else {
                <div class="card p-0 overflow-hidden">
                  <div class="flex items-center justify-between gap-2 px-3 py-2 bg-base">
                    <span class="micro-label">Alcance</span>
                    <div class="flex items-center gap-2">
                      <app-badge [variant]="includedCount() === 0 ? 'neutral' : 'success'">
                        {{ includedCount() }} destinatario(s)
                      </app-badge>
                      @if (facade.preview().length > 0) {
                        <!-- La lista va cerrada por defecto: lo que se necesita saber casi
                             siempre es CUÁNTOS, no leer 185 nombres. Abrirla es un acto
                             deliberado, y es lo que mantiene la sección dentro de la pantalla. -->
                        <button
                          type="button"
                          class="cursor-pointer text-2xs font-semibold text-brand"
                          (click)="verLista.set(!verLista())"
                        >
                          {{ verLista() ? 'Ocultar' : 'Ver lista' }}
                        </button>
                      }
                    </div>
                  </div>

                  @if (facade.preview().length === 0) {
                    <p class="px-3 py-3 text-xs text-text-muted border-t border-border-subtle">
                      Este segmento no tiene alumnos.
                    </p>
                  } @else if (exclusions().sinConsentimiento > 0) {
                    <!-- Esto se ve SIEMPRE, aunque la lista esté cerrada: que alumnos queden
                         fuera por consentimiento no puede depender de que a alguien se le
                         ocurra abrir la lista. -->
                    <p class="border-t border-border-subtle px-3 py-2 text-xs text-text-muted">
                      {{ exclusions().sinConsentimiento }} alumno(s) del segmento quedan fuera por
                      no tener consentimiento promocional vigente.
                    </p>
                  }

                  @if (verLista() && facade.preview().length > 0) {
                    <!-- Buscador + acciones masivas. El buscador solo cambia QUÉ SE VE: el
                   contador de arriba nunca depende del filtro. -->
                    <div class="flex flex-col gap-2 px-3 py-2 border-t border-border-subtle">
                      <input
                        type="search"
                        class="field-input h-8 text-xs"
                        placeholder="Buscar por nombre…"
                        [ngModel]="searchTerm()"
                        (ngModelChange)="searchTerm.set($event)"
                        data-llm-description="filter the recipient list by name; does not change who receives"
                      />

                      <div class="flex flex-wrap items-center gap-2">
                        <!-- Las etiquetas nombran el número exacto que van a afectar: un botón
                       que dijera "todos" y tocara 185 con 12 en pantalla sería una trampa. -->
                        <button
                          type="button"
                          class="cursor-pointer rounded-md border border-border-default bg-surface px-2 py-1 text-2xs font-semibold text-text-secondary transition-colors hover:bg-subtle disabled:opacity-50"
                          [disabled]="bulkTargetCount() === 0"
                          data-llm-action="quitar-destinatarios-visibles"
                          (click)="accionMasiva('quitar')"
                        >
                          Quitar {{ bulkLabel() }}
                        </button>
                        <button
                          type="button"
                          class="cursor-pointer rounded-md border border-border-default bg-surface px-2 py-1 text-2xs font-semibold text-text-secondary transition-colors hover:bg-subtle disabled:opacity-50"
                          [disabled]="bulkTargetCount() === 0"
                          data-llm-action="incluir-destinatarios-visibles"
                          (click)="accionMasiva('incluir')"
                        >
                          Incluir {{ bulkLabel() }}
                        </button>

                        @if (totalExcluidos() > 0) {
                          <button
                            type="button"
                            class="cursor-pointer rounded-md px-2 py-1 text-2xs font-semibold transition-colors"
                            [class.bg-brand-muted]="verSoloExcluidos()"
                            [class.text-brand]="verSoloExcluidos()"
                            [class.text-text-secondary]="!verSoloExcluidos()"
                            (click)="verSoloExcluidos.set(!verSoloExcluidos())"
                          >
                            {{
                              verSoloExcluidos()
                                ? 'Ver todos'
                                : 'Ver excluidos (' + totalExcluidos() + ')'
                            }}
                          </button>
                        }
                      </div>
                    </div>

                    @if (visibles().length === 0) {
                      <p class="px-3 py-3 text-xs text-text-muted border-t border-border-subtle">
                        @if (verSoloExcluidos()) {
                          No hay destinatarios excluidos.
                        } @else {
                          Ningún nombre coincide con “{{ searchTerm() }}”. El alcance sigue siendo
                          de {{ includedCount() }} destinatario(s).
                        }
                      </p>
                    } @else {
                      <ul class="max-h-56 overflow-y-auto border-t border-border-subtle">
                        @for (r of visibles(); track r.userId) {
                          <li
                            class="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle last:border-b-0"
                          >
                            <input
                              type="checkbox"
                              class="cursor-pointer"
                              [checked]="isChecked(r.userId)"
                              [disabled]="r.exclusionReason === 'sin_consentimiento'"
                              [attr.aria-label]="'Incluir a ' + r.name"
                              (change)="toggleRecipient(r.userId)"
                            />
                            <span class="flex-1 text-xs text-text-primary truncate">{{
                              r.name
                            }}</span>
                            @if (r.exclusionReason === 'sin_consentimiento') {
                              <app-badge variant="neutral">Sin consentimiento</app-badge>
                            } @else if (r.email === null) {
                              <app-badge variant="warning">Sin email</app-badge>
                            }
                          </li>
                        }
                      </ul>
                    }
                  }
                </div>

                @if (warnsHighVolume()) {
                  <div class="card p-3 flex items-start gap-2">
                    <app-icon name="alert-triangle" [size]="14" color="var(--state-warning)" />
                    <p class="text-xs text-text-secondary">
                      Vas a enviar más de {{ warnThreshold }} correos de una vez. Un volumen alto
                      puede afectar la reputación del dominio y hacer que otros correos de la
                      escuela (contratos, certificados) caigan en spam.
                    </p>
                  </div>
                }
                @if (excedeTope()) {
                  <div class="card p-3 flex items-start gap-2">
                    <app-icon name="alert-circle" [size]="14" color="var(--state-error)" />
                    <p class="text-xs text-error">
                      El máximo por comunicado es {{ maxRecipients }} destinatarios. Acota el
                      segmento.
                    </p>
                  </div>
                }
              }
            </div>
          }
        </div>

        <!-- ══ Sección: Mensaje ════════════════════════════════════════ -->
        <div class="card p-0 overflow-hidden">
          <button
            type="button"
            class="w-full cursor-pointer flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-subtle"
            [attr.aria-expanded]="openSection() === 'mensaje'"
            (click)="toggleSection('mensaje')"
          >
            <div class="min-w-0">
              <p class="item-title">Mensaje</p>
              @if (openSection() !== 'mensaje') {
                <p
                  class="text-xs truncate"
                  [class.text-text-muted]="mensajeCompleto()"
                  [class.text-error]="!mensajeCompleto()"
                >
                  {{ resumenMensaje() }}
                </p>
              }
            </div>
            <app-icon
              [name]="openSection() === 'mensaje' ? 'chevron-up' : 'chevron-down'"
              [size]="16"
              class="shrink-0 text-text-muted"
            />
          </button>

          @if (openSection() === 'mensaje') {
            <div class="flex flex-col gap-4 border-t border-border-subtle px-3 pb-4 pt-3">
              @if (templates.activeTemplates().length > 0) {
                <div class="flex flex-col gap-1.5">
                  <label class="field-label" for="a-template">Partir de una plantilla</label>
                  <p-select
                    id="a-template"
                    [options]="templateOptions()"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Escribir desde cero…"
                    [showClear]="true"
                    styleClass="w-full"
                    [ngModel]="templateId()"
                    (ngModelChange)="aplicarPlantilla($event)"
                    data-llm-description="optional saved template to prefill subject and body"
                  />
                  <p class="field-hint">
                    Podés editar el texto después: la plantilla es un punto de partida.
                  </p>
                </div>
              }

              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="a-subject"
                  >Asunto <span class="text-error">*</span></label
                >
                <input
                  id="a-subject"
                  type="text"
                  class="field-input"
                  maxlength="150"
                  [ngModel]="subject()"
                  (ngModelChange)="subject.set($event)"
                  data-llm-description="announcement subject line"
                />
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="field-label" for="a-body"
                  >Mensaje <span class="text-error">*</span></label
                >
                <textarea
                  id="a-body"
                  rows="6"
                  class="field-input"
                  [ngModel]="body()"
                  (ngModelChange)="body.set($event)"
                  data-llm-description="announcement body, plain text"
                ></textarea>
                <p class="field-hint">Texto plano. Los saltos de línea se respetan en el correo.</p>
              </div>
            </div>
          }
        </div>

        <!-- ══ Sección: Envío ══════════════════════════════════════════ -->
        <div class="card p-0 overflow-hidden">
          <button
            type="button"
            class="w-full cursor-pointer flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-subtle"
            [attr.aria-expanded]="openSection() === 'envio'"
            (click)="toggleSection('envio')"
          >
            <div class="min-w-0">
              <p class="item-title">Envío</p>
              @if (openSection() !== 'envio') {
                <p class="text-xs truncate" [class.text-error]="scheduledInvalid()">
                  {{ resumenEnvio() }}
                </p>
              }
            </div>
            <app-icon
              [name]="openSection() === 'envio' ? 'chevron-up' : 'chevron-down'"
              [size]="16"
              class="shrink-0 text-text-muted"
            />
          </button>

          @if (openSection() === 'envio') {
            <div class="flex flex-col gap-4 border-t border-border-subtle px-3 pb-4 pt-3">
              <label class="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  class="cursor-pointer"
                  [checked]="isScheduled()"
                  (change)="toggleScheduled()"
                />
                <span class="text-xs font-semibold text-text-primary"
                  >Programar para más adelante</span
                >
              </label>

              @if (isScheduled()) {
                <input
                  type="datetime-local"
                  class="field-input"
                  [min]="minScheduledFor"
                  [ngModel]="scheduledLocal()"
                  (ngModelChange)="setScheduledLocal($event)"
                  data-llm-description="date and time to send the announcement"
                />
                @if (scheduledInvalid()) {
                  <p class="text-xs text-error">La fecha de envío tiene que ser futura.</p>
                } @else {
                  <!-- El cron corre cada 15 minutos: prometer precisión al minuto sería mentir. -->
                  <p class="field-hint">Se enviará aproximadamente a esa hora (± 15 minutos).</p>
                }
              }
            </div>
          }
        </div>

        <!-- ── Progreso del envío ─────────────────────────────────────── -->
        @if (facade.isSending() && facade.progress().total > 0) {
          <div class="card p-3 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="micro-label">Enviando</span>
              <span class="text-xs text-text-secondary">
                {{ facade.progress().processed }} / {{ facade.progress().total }}
              </span>
            </div>
            <div class="h-1.5 w-full rounded-full bg-base overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                [style.width.%]="progressPercent()"
                [style.background]="'var(--ds-brand)'"
              ></div>
            </div>
          </div>
        }

        @if (facade.error()) {
          <div class="flex items-center gap-2 rounded-lg px-3 py-2 bg-error-subtle">
            <app-icon name="alert-circle" [size]="14" color="var(--state-error)" />
            <span class="text-xs text-error">{{ facade.error() }}</span>
          </div>
        }
      </div>

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          type="button"
          class="btn-secondary flex items-center justify-center gap-2"
          [disabled]="!puedePrevisualizar()"
          data-llm-action="previsualizar-comunicado"
          (click)="previsualizar()"
        >
          <app-icon name="eye" [size]="16" />
          Vista previa
        </button>
        <button
          type="button"
          class="btn-primary flex items-center justify-center gap-2"
          [disabled]="!canSend()"
          [appStableWidth]="facade.isSending()"
          (click)="submit()"
          data-llm-action="enviar-comunicado"
        >
          @if (facade.isSending()) {
            <app-icon name="loader-circle" [size]="16" class="animate-spin" />
            {{ isScheduled() ? 'Programando…' : 'Enviando…' }}
          } @else if (isScheduled()) {
            <app-icon name="calendar-clock" [size]="16" />
            Programar comunicado
          } @else {
            <app-icon name="megaphone" [size]="16" />
            Enviar comunicado
          }
        </button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class AnnouncementComposerDrawerComponent {
  protected readonly facade = inject(AnnouncementsFacade);
  protected readonly templates = inject(NotificationTemplatesFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);
  private readonly authFacade = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly confirmModal = inject(ConfirmModalService);

  protected readonly warnThreshold = ANNOUNCEMENT_WARN_RECIPIENTS;
  protected readonly maxRecipients = ANNOUNCEMENT_MAX_RECIPIENTS;

  protected readonly kindOptions = [
    { label: 'Operativo — aviso del curso', value: 'operativo' },
    { label: 'Promocional — promociones y novedades', value: 'promocional' },
  ];
  protected readonly courseOptions = [
    { label: 'Clase B', value: 'class_b' },
    { label: 'Profesional', value: 'professional' },
  ];
  protected readonly statusOptions = [
    { label: 'Activas', value: 'active' },
    { label: 'Finalizadas', value: 'completed' },
  ];

  protected readonly kind = signal<AnnouncementKind | null>(null);
  protected readonly branchId = signal<number | null>(null);
  protected readonly courseType = signal<AnnouncementCourseType | null>(null);
  protected readonly enrollmentStatus = signal<AnnouncementEnrollmentStatus | null>('active');
  protected readonly subject = signal('');
  protected readonly body = signal('');

  /** ISO de cuándo sale, o null para enviar ahora (spec 0042-b). */
  protected readonly scheduledFor = signal<string | null>(null);
  protected readonly templateId = signal<number | null>(null);

  /** Valor del `datetime-local`, que trabaja en hora local sin zona. */
  protected readonly scheduledLocal = signal('');
  protected readonly isScheduled = signal(false);

  /** El navegador no deja elegir un pasado obvio; la validación real igual corre. */
  protected readonly minScheduledFor = toLocalInputValue(new Date(Date.now() + 60_000));

  protected readonly templateOptions = computed(() =>
    this.templates.activeTemplates().map((t) => ({ label: t.name, value: t.id })),
  );

  // ── Estado de las secciones ────────────────────────────────────────────────

  protected readonly destinatariosCompleto = computed(
    () => this.kind() !== null && this.includedCount() > 0,
  );

  protected readonly mensajeCompleto = computed(
    () => this.subject().trim().length > 0 && this.body().trim().length > 0,
  );

  protected readonly resumenDestinatarios = computed(() => {
    if (this.kind() === null) return 'Falta elegir el tipo de comunicado';
    const tipo = this.kind() === 'promocional' ? 'Promocional' : 'Operativo';
    const n = this.includedCount();
    if (n === 0) return `${tipo} · sin destinatarios`;
    return `${tipo} · ${n} destinatario(s)`;
  });

  protected readonly resumenMensaje = computed(() => {
    if (!this.mensajeCompleto()) return 'Falta el asunto o el mensaje';
    return this.subject().trim();
  });

  protected readonly resumenEnvio = computed(() => {
    if (!this.isScheduled()) return 'Se envía al confirmar';
    if (this.scheduledInvalid()) return 'La fecha de envío tiene que ser futura';
    return `Programado para el ${this.scheduledLocal().replace('T', ' a las ')}`;
  });

  protected readonly puedePrevisualizar = computed(
    () =>
      this.subject().trim().length > 0 &&
      this.body().trim().length > 0 &&
      !this.facade.isLoadingPreviewHtml(),
  );

  protected readonly scheduledInvalid = computed(
    () => this.isScheduled() && !isScheduledForValid(this.scheduledFor()),
  );

  /** Destildados a mano. Solo aplica sobre quienes ya están habilitados. */
  private readonly excludedUserIds = signal<number[]>([]);

  /** Filtro de la lista. NO afecta el alcance: solo qué se ve. */
  protected readonly searchTerm = signal('');
  protected readonly verSoloExcluidos = signal(false);

  /**
   * Sección abierta. **Una sola a la vez** — eso es lo que acota el alto del formulario,
   * no el colapsable en sí: con todas plegables pero varias abiertas volveríamos a las 2,3
   * pantallas de scroll que motivaron esta spec.
   */
  protected readonly openSection = signal<ComposerSection>('destinatarios');

  /** La lista de nombres arranca cerrada: el dato que se necesita casi siempre es el conteo. */
  protected readonly verLista = signal(false);

  protected readonly isAdmin = computed(() => this.authFacade.currentUser()?.role === 'admin');

  protected readonly branchOptions = computed(() =>
    this.branchFacade.branches().map((b) => ({ label: b.name, value: b.id })),
  );

  protected readonly exclusions = computed(() => countExclusions(this.facade.preview()));

  /**
   * Lista con el estado manual ya aplicado. Es la fuente para contar y para mostrar, así
   * el contador y las casillas no pueden contradecirse.
   */
  private readonly recipientsConEstado = computed(() => {
    const excluidos = new Set(this.excludedUserIds());
    return this.facade
      .preview()
      .map((r) =>
        excluidos.has(r.userId)
          ? { ...r, included: false, exclusionReason: 'excluido_manualmente' as const }
          : r,
      );
  });

  /** Se cuenta SIEMPRE sobre la lista completa, nunca sobre la filtrada (AC-E1). */
  protected readonly includedCount = computed(() => countIncluded(this.recipientsConEstado()));

  /** Lo que se ve: filtrado por búsqueda, o solo los excluidos. */
  protected readonly visibles = computed(() => {
    const base = this.verSoloExcluidos()
      ? onlyExcluded(this.facade.preview(), this.excludedUserIds())
      : this.recipientsConEstado();
    return filterRecipients(base, this.searchTerm());
  });

  protected readonly totalExcluidos = computed(
    () => onlyExcluded(this.facade.preview(), this.excludedUserIds()).length,
  );

  /** Sobre cuántos opera de verdad una acción masiva (los que puede tocar). */
  protected readonly bulkTargetCount = computed(
    () => this.visibles().filter((r) => r.exclusionReason !== 'sin_consentimiento').length,
  );

  /** El botón dice el número exacto, y si hay filtro aclara que son los visibles. */
  protected readonly bulkLabel = computed(() => {
    const n = this.bulkTargetCount();
    const filtrando = this.searchTerm().trim().length > 0 || this.verSoloExcluidos();
    return filtrando ? `los ${n} visibles` : `los ${n}`;
  });

  private readonly validation = computed(() =>
    validateAnnouncementDraft(this.buildDraft(), this.includedCount()),
  );

  protected readonly warnsHighVolume = computed(() => this.validation().warnsHighVolume);
  protected readonly excedeTope = computed(() => this.validation().errors.includes('excede_tope'));

  protected readonly canSend = computed(
    () =>
      this.validation().valid &&
      !this.facade.isSending() &&
      !this.facade.isLoadingPreview() &&
      // Programar sin fecha válida no puede quedar habilitado: el draft se vería completo.
      !this.scheduledInvalid(),
  );

  protected readonly progressPercent = computed(() => {
    const { total, processed } = this.facade.progress();
    return total === 0 ? 0 : Math.round((processed / total) * 100);
  });

  constructor() {
    this.facade.clearPreview();
    this.facade.resetProgress();
    void this.templates.initialize();
  }

  protected isChecked(userId: number): boolean {
    const recipient = this.facade.preview().find((r) => r.userId === userId);
    if (recipient?.exclusionReason === 'sin_consentimiento') return false;
    return !this.excludedUserIds().includes(userId);
  }

  /** Abrir una cierra la anterior; volver a tocar la abierta la pliega. */
  protected toggleSection(section: ComposerSection): void {
    this.openSection.update((actual) => (actual === section ? null : section));
  }

  protected accionMasiva(action: BulkAction): void {
    this.excludedUserIds.set(
      applyBulkAction(this.facade.preview(), this.visibles(), action, this.excludedUserIds()),
    );
  }

  protected toggleRecipient(userId: number): void {
    this.excludedUserIds.update((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId],
    );
  }

  protected onKindChange(kind: AnnouncementKind): void {
    this.kind.set(kind);
    void this.refreshPreview();
  }

  protected onFilterChange(
    field: 'branchId' | 'courseType' | 'enrollmentStatus',
    value: unknown,
  ): void {
    if (field === 'branchId') this.branchId.set(value as number | null);
    if (field === 'courseType') this.courseType.set(value as AnnouncementCourseType | null);
    if (field === 'enrollmentStatus')
      this.enrollmentStatus.set(value as AnnouncementEnrollmentStatus | null);

    void this.refreshPreview();
  }

  private async refreshPreview(): Promise<void> {
    const kind = this.kind();
    if (kind === null) return;

    // Cambiar el segmento invalida los destildes: eran sobre otra lista. El filtro y la
    // vista de excluidos también se resetean: quedarían aplicados sobre gente que ya no está.
    this.excludedUserIds.set([]);
    this.searchTerm.set('');
    this.verSoloExcluidos.set(false);
    await this.facade.loadPreview(this.buildDraft().filters, kind);
  }

  private buildDraft(): AnnouncementDraft {
    return {
      kind: this.kind(),
      subject: this.subject(),
      body: this.body(),
      filters: {
        branchId: this.branchId(),
        courseType: this.courseType(),
        enrollmentStatus: this.enrollmentStatus(),
      },
      excludedUserIds: this.excludedUserIds(),
      scheduledFor: this.scheduledFor(),
      templateId: this.templateId(),
    };
  }

  protected toggleScheduled(): void {
    const activar = !this.isScheduled();
    this.isScheduled.set(activar);
    if (!activar) {
      this.scheduledLocal.set('');
      this.scheduledFor.set(null);
    }
  }

  protected setScheduledLocal(value: string): void {
    this.scheduledLocal.set(value);
    // El input da hora local; se guarda en ISO para que el servidor no tenga que adivinar.
    this.scheduledFor.set(value ? new Date(value).toISOString() : null);
  }

  /**
   * Carga la plantilla como PUNTO DE PARTIDA (AC2): el texto queda editable. No se
   * sustituyen las variables acá — se resuelven por destinatario al enviar, así que el
   * cuerpo guardado conserva los marcadores.
   */
  protected aplicarPlantilla(templateId: number | null): void {
    this.templateId.set(templateId);
    if (templateId === null) return;

    const plantilla = this.templates.activeTemplates().find((t) => t.id === templateId);
    if (!plantilla) return;

    this.subject.set(plantilla.subject);
    this.body.set(plantilla.body);
  }

  /**
   * Abre la vista previa. Se apila sobre el compositor (`push`), no lo reemplaza: volver
   * tiene que devolver el borrador intacto, no obligar a reescribirlo.
   */
  protected async previsualizar(): Promise<void> {
    const draft = this.buildDraft();
    if (!(await this.facade.loadPreviewHtml(draft))) return;

    this.drawer.push(AnnouncementPreviewDrawerComponent, 'Vista previa', 'eye');
  }

  protected async submit(): Promise<void> {
    if (!this.canSend()) return;

    const total = this.includedCount();
    const programado = this.isScheduled();

    // El alcance que se muestra acá es el de AHORA. En un comunicado programado la lista
    // se recalcula al enviar, así que el número puede cambiar: se dice, no se promete.
    const confirmed = await this.confirmModal.confirm({
      title: programado ? 'Programar comunicado' : 'Enviar comunicado',
      message: programado
        ? `Se enviará automáticamente en la fecha indicada. Hoy el segmento alcanza a ${total} destinatario(s), pero la lista se vuelve a calcular al momento del envío.`
        : `Se va a enviar a ${total} destinatario(s) por correo y a su portal. Esta acción no se puede deshacer.`,
      confirmLabel: programado ? 'Programar' : 'Enviar',
      cancelLabel: 'Revisar',
    });
    if (!confirmed) return;

    const draft = this.buildDraft();
    const ok = programado ? await this.facade.schedule(draft) : await this.facade.send(draft);
    if (ok) this.drawer.close();
  }
}
