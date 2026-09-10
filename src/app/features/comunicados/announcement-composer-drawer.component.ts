import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { StableWidthDirective } from '@core/directives/stable-width.directive';
import { AnnouncementsFacade } from '@core/facades/announcements.facade';
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
import type {
  AnnouncementKind,
  AnnouncementCourseType,
  AnnouncementEnrollmentStatus,
  AnnouncementDraft,
} from '@core/models/ui/announcement.model';

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
      <div class="flex flex-col gap-5" data-llm-form="create-announcement">
        <!-- ── Tipo de comunicado ─────────────────────────────────────── -->
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
        <h3 class="section-title">Destinatarios</h3>

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
          <label class="field-label" for="a-status">Estado de matrícula</label>
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
              <app-badge [variant]="includedCount() === 0 ? 'neutral' : 'success'">
                {{ includedCount() }} destinatario(s)
              </app-badge>
            </div>

            @if (exclusions().sinConsentimiento > 0) {
              <p class="px-3 py-2 text-xs text-text-muted border-t border-border-subtle">
                {{ exclusions().sinConsentimiento }} alumno(s) del segmento quedan fuera por no
                tener consentimiento promocional vigente.
              </p>
            }

            @if (facade.preview().length === 0) {
              <p class="px-3 py-3 text-xs text-text-muted border-t border-border-subtle">
                Este segmento no tiene alumnos.
              </p>
            } @else {
              <ul class="max-h-56 overflow-y-auto border-t border-border-subtle">
                @for (r of facade.preview(); track r.userId) {
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
                    <span class="flex-1 text-xs text-text-primary truncate">{{ r.name }}</span>
                    @if (r.email === null) {
                      <app-badge variant="warning">Sin email</app-badge>
                    } @else if (r.exclusionReason === 'sin_consentimiento') {
                      <app-badge variant="neutral">Sin consentimiento</app-badge>
                    }
                  </li>
                }
              </ul>
            }
          </div>

          @if (warnsHighVolume()) {
            <div class="card p-3 flex items-start gap-2">
              <app-icon name="alert-triangle" [size]="14" color="var(--state-warning)" />
              <p class="text-xs text-text-secondary">
                Vas a enviar más de {{ warnThreshold }} correos de una vez. Un volumen alto puede
                afectar la reputación del dominio y hacer que otros correos de la escuela
                (contratos, certificados) caigan en spam.
              </p>
            </div>
          }
          @if (excedeTope()) {
            <div class="card p-3 flex items-start gap-2">
              <app-icon name="alert-circle" [size]="14" color="var(--state-error)" />
              <p class="text-xs text-error">
                El máximo por comunicado es {{ maxRecipients }} destinatarios. Acota el segmento.
              </p>
            </div>
          }
        }

        <!-- ── Mensaje ────────────────────────────────────────────────── -->
        <h3 class="section-title">Mensaje</h3>

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
          <label class="field-label" for="a-body">Mensaje <span class="text-error">*</span></label>
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
        <button type="button" class="btn-secondary" (click)="drawer.close()">Cancelar</button>
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
            Enviando…
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

  /** Destildados a mano. Solo aplica sobre quienes ya están habilitados. */
  private readonly excludedUserIds = signal<number[]>([]);

  protected readonly isAdmin = computed(() => this.authFacade.currentUser()?.role === 'admin');

  protected readonly branchOptions = computed(() =>
    this.branchFacade.branches().map((b) => ({ label: b.name, value: b.id })),
  );

  protected readonly exclusions = computed(() => countExclusions(this.facade.preview()));

  protected readonly includedCount = computed(
    () =>
      this.facade.preview().filter((r) => r.included && !this.excludedUserIds().includes(r.userId))
        .length,
  );

  private readonly validation = computed(() =>
    validateAnnouncementDraft(this.buildDraft(), this.includedCount()),
  );

  protected readonly warnsHighVolume = computed(() => this.validation().warnsHighVolume);
  protected readonly excedeTope = computed(() => this.validation().errors.includes('excede_tope'));

  protected readonly canSend = computed(
    () => this.validation().valid && !this.facade.isSending() && !this.facade.isLoadingPreview(),
  );

  protected readonly progressPercent = computed(() => {
    const { total, processed } = this.facade.progress();
    return total === 0 ? 0 : Math.round((processed / total) * 100);
  });

  constructor() {
    this.facade.clearPreview();
    this.facade.resetProgress();
  }

  protected isChecked(userId: number): boolean {
    const recipient = this.facade.preview().find((r) => r.userId === userId);
    if (recipient?.exclusionReason === 'sin_consentimiento') return false;
    return !this.excludedUserIds().includes(userId);
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

    // Cambiar el segmento invalida los destildes: eran sobre otra lista.
    this.excludedUserIds.set([]);
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
    };
  }

  protected async submit(): Promise<void> {
    if (!this.canSend()) return;

    const total = this.includedCount();
    const confirmed = await this.confirmModal.confirm({
      title: 'Enviar comunicado',
      message: `Se va a enviar a ${total} destinatario(s) por correo y a su portal. Esta acción no se puede deshacer.`,
      confirmLabel: 'Enviar',
      cancelLabel: 'Revisar',
    });
    if (!confirmed) return;

    const ok = await this.facade.send(this.buildDraft());
    if (ok) this.drawer.close();
  }
}
