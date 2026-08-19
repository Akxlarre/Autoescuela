import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ConsentsFacade } from '@core/facades/consents.facade';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import type { ConsentRow } from '@core/models/ui/consent.model';

/**
 * AdminConsentimientosDrawerComponent — Consentimientos del alumno (spec 0009-m, AC6/AC-E3).
 *
 * Panel de **solo lectura**: qué aceptó, cuándo, con qué versión de política y por qué vía.
 * Es la evidencia que se le muestra a la Agencia si pregunta "acredíteme el consentimiento
 * de este titular" (Art. 12: la carga de la prueba es del responsable).
 *
 * **No hay editar ni eliminar, y no es un olvido.** La tabla es append-only por diseño y la
 * base lo refuerza con `trg_consents_append_only` + ausencia de policy de DELETE en todos
 * los roles. Lo único que se puede hacer sobre un consentimiento otorgado es **revocarlo**,
 * que agrega una fecha sin borrar el hecho de que en su momento se otorgó.
 *
 * Organismo, no Dumb: se abre vía `LayoutDrawerFacadeService.open()`, que no pasa inputs,
 * así que inyecta el facade de su propio dominio (permitido por `architecture.md`).
 */
@Component({
  selector: 'app-admin-consentimientos-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    BadgeComponent,
    AlertCardComponent,
  ],
  host: { class: 'flex flex-col min-h-0 flex-1' },
  template: `
    @if (consents.isLoading()) {
      <div class="flex flex-col gap-3 p-1">
        @for (i of [1, 2, 3]; track i) {
          <app-skeleton-block variant="rect" width="100%" height="88px" />
        }
      </div>
    } @else if (consents.error()) {
      <!-- Un fallo de carga NO puede verse igual que "no hay consentimientos": en un panel de
           cumplimiento, confundir "la consulta falló" con "este titular nunca consintió" lleva a
           la conclusión exactamente opuesta a la verdad. Detectado en QA el 18-08-2026, cuando un
           400 de PostgREST se renderizaba como estado vacío. -->
      <div class="flex-1 flex items-center justify-center">
        <app-alert-card severity="error" title="No se pudieron cargar los consentimientos">
          <p class="m-0">
            Esto <strong>no significa</strong> que el alumno no haya consentido: la consulta falló y
            no sabemos qué hay registrado. Reintenta; si persiste, avisa a soporte antes de sacar
            conclusiones.
          </p>
          <p class="text-xs text-text-muted m-0 mt-2">{{ consents.error() }}</p>
        </app-alert-card>
      </div>
    } @else if (rows().length === 0) {
      <!-- Dentro de un contenedor que puede medir todo el alto: se centra en vez de
           quedar pegado arriba con un hueco debajo. -->
      <div class="flex-1 flex items-center justify-center">
        <app-empty-state
          message="Sin consentimientos registrados"
          subtitle="Este alumno se matriculó antes de que el registro existiera, o su matrícula no se completó."
          icon="shield"
        />
      </div>
    } @else {
      <div class="flex flex-col gap-3 overflow-y-auto min-h-0 flex-1 p-1">
        @for (row of rows(); track row.id) {
          <article class="card flex flex-col gap-2">
            <header class="flex items-start justify-between gap-3">
              <p class="item-title m-0">{{ row.typeLabel }}</p>
              <app-badge class="shrink-0" [variant]="statusVariant(row.status)">
                {{ statusLabel(row.status) }}
              </app-badge>
            </header>

            <dl class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <div>
                <dt class="micro-label">Fecha</dt>
                <dd class="text-text-primary m-0">{{ formatDate(row.grantedAt) }}</dd>
              </div>
              <div>
                <dt class="micro-label">Origen</dt>
                <dd class="text-text-primary m-0">{{ row.sourceLabel }}</dd>
              </div>
              <div>
                <dt class="micro-label">Versión de política</dt>
                <dd class="text-text-primary m-0">{{ row.policyVersion }}</dd>
              </div>
              <div>
                <dt class="micro-label">Dirección IP</dt>
                <dd class="text-text-primary m-0">{{ row.ip ?? 'No registrada' }}</dd>
              </div>
              @if (row.grantedByRepresentative) {
                <div class="col-span-2">
                  <dt class="micro-label">Otorgado por</dt>
                  <dd class="text-text-primary m-0">
                    Representante legal — su identidad consta en la autorización notarial del
                    expediente
                  </dd>
                </div>
              }
              @if (row.revokedAt) {
                <div class="col-span-2">
                  <dt class="micro-label">Revocado el</dt>
                  <dd class="text-text-primary m-0">{{ formatDate(row.revokedAt) }}</dd>
                </div>
              }
            </dl>

            @if (canRevoke() && row.status === 'otorgado') {
              <footer class="flex justify-end pt-1">
                <button
                  type="button"
                  class="btn-secondary"
                  [disabled]="consents.isSaving()"
                  (click)="onRevoke(row)"
                  data-llm-action="revocar-consentimiento"
                >
                  <app-icon name="ban" [size]="14" />
                  Registrar revocación
                </button>
              </footer>
            }
          </article>
        }
      </div>

      <p class="text-xs text-text-muted px-1 pt-3 shrink-0">
        Los consentimientos no se editan ni se eliminan: son prueba legal. Revocar agrega la fecha
        sin borrar el registro original.
      </p>
    }
  `,
})
export class AdminConsentimientosDrawerComponent {
  protected readonly consents = inject(ConsentsFacade);
  private readonly alumnoFacade = inject(AdminAlumnoDetalleFacade);
  private readonly auth = inject(AuthFacade);
  private readonly confirmModal = inject(ConfirmModalService);

  protected readonly rows = computed(() => this.consents.consents());

  /** Solo admin puede revocar: es la única policy de UPDATE que existe en `consents`. */
  protected readonly canRevoke = computed(() => this.auth.currentUser()?.role === 'admin');

  constructor() {
    effect(() => {
      const userId = this.alumnoFacade.alumno()?.userId;
      if (userId) void this.consents.loadByUser(userId);
    });
  }

  protected async onRevoke(row: ConsentRow): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Registrar revocación',
      message: `Se marcará "${row.typeLabel}" como revocado con la fecha de hoy. El registro original se conserva: la revocación no borra que el consentimiento se otorgó.`,
      severity: 'danger',
      confirmLabel: 'Registrar revocación',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;

    await this.consents.revoke(row.id);
  }

  protected formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected statusLabel(status: ConsentRow['status']): string {
    return { otorgado: 'Otorgado', rechazado: 'No autorizó', revocado: 'Revocado' }[status];
  }

  protected statusVariant(status: ConsentRow['status']): 'success' | 'error' | 'warning' {
    return { otorgado: 'success', rechazado: 'error', revocado: 'warning' }[status] as
      | 'success'
      | 'error'
      | 'warning';
  }
}
