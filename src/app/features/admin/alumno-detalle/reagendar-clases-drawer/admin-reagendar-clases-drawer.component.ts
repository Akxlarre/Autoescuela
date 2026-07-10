import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AdminReagendarHorariosDrawerComponent } from './admin-reagendar-horarios-drawer.component';
import type { ClasePendienteReagendarUI } from '@core/models/ui/alumno-detalle.model';

/** Fila del checklist — solo agrega el estado de selección al dato de la clase. */
interface FilaReagendar extends ClasePendienteReagendarUI {
  selected: boolean;
}

/**
 * AdminReagendarClasesDrawerComponent — Smart / Drawer. Paso 1 de 2.
 *
 * RF-053: checklist de clases pendientes (canceladas por penalización + inasistencias
 * a recuperar), TODAS pre-marcadas por defecto. La secretaria puede desmarcar las que
 * no quiera reagendar todavía. Al continuar, la selección se guarda en el Facade y se
 * navega (via `push`, sin perder el drawer) al Paso 2 — el mismo agendador masivo de
 * horarios que usa la Matrícula (`AdminReagendarHorariosDrawerComponent`).
 */
@Component({
  selector: 'app-admin-reagendar-clases-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="flex flex-col h-full bg-surface">
      <!-- ── Body scrolleable ── -->
      <div class="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        <div
          class="flex items-start gap-3 rounded-lg p-2.5"
          style="background: color-mix(in srgb, var(--ds-brand) 6%, transparent); border: 1px solid color-mix(in srgb, var(--ds-brand) 20%, transparent);"
        >
          <app-icon name="info" [size]="16" color="var(--ds-brand)" />
          <p class="text-xs leading-relaxed" style="color: var(--ds-brand)">
            Todas las clases pendientes vienen preseleccionadas. Desmarca las que NO quieras
            reagendar ahora — el resto se agenda en el siguiente paso, todas de una vez.
          </p>
        </div>

        @if (rows().length === 0) {
          <p class="text-sm text-text-muted text-center py-6">
            No hay clases pendientes de reagendar.
          </p>
        }

        <!-- Grid compacto: 12 clases visibles sin scroll en la mayoría de pantallas -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          @for (row of rows(); track row.sessionId) {
            <label
              class="flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer"
              style="border-color: var(--border-default)"
            >
              <input
                type="checkbox"
                class="reagendar-checkbox mt-0.5"
                [checked]="row.selected"
                (change)="toggleRow(row.sessionId, $any($event.target).checked)"
                [attr.aria-label]="'Seleccionar clase ' + row.claseNumero + ' para reagendar'"
                data-llm-action="toggle-clase-reagendar"
              />
              <span class="flex flex-col gap-0.5 flex-1 min-w-0">
                <span class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-text-primary"
                    >Clase #{{ row.claseNumero }}</span
                  >
                  <span class="reagendar-origen-badge" [attr.data-origen]="row.origen">
                    {{ badgeLabel(row) }}
                  </span>
                </span>
                @if (row.fechaOriginal) {
                  <span class="text-[10px] text-text-muted">{{ row.fechaOriginal }}</span>
                }
              </span>
            </label>
          }
        </div>
      </div>

      <!-- ── Footer fijo ── -->
      <div
        class="shrink-0 px-5 py-4 border-t bg-surface flex items-center justify-end gap-3"
        style="border-color: var(--border-subtle)"
      >
        <button type="button" class="btn-secondary" (click)="onCancel()">Cancelar</button>
        <button
          type="button"
          class="btn-primary flex items-center gap-2"
          [disabled]="selectedRows().length === 0"
          (click)="onContinue()"
          data-llm-action="continuar-seleccion-reagendar"
        >
          <app-icon name="calendar-clock" [size]="14" />
          Seleccionar Horarios ({{ selectedRows().length }})
        </button>
      </div>
    </div>
  `,
  styles: `
    .reagendar-checkbox {
      width: 18px;
      height: 18px;
      accent-color: var(--ds-brand);
      cursor: pointer;
      flex-shrink: 0;
    }
    .reagendar-origen-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .reagendar-origen-badge[data-origen='no_show'] {
      color: var(--state-error);
      background: var(--state-error-bg);
      border: 1px solid var(--state-error-border);
    }
    .reagendar-origen-badge[data-origen='cancelled'] {
      color: var(--state-warning);
      background: var(--state-warning-bg);
      border: 1px solid var(--state-warning-border);
    }
  `,
})
export class AdminReagendarClasesDrawerComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly rows = signal<FilaReagendar[]>([]);

  protected readonly selectedRows = computed(() => this.rows().filter((r) => r.selected));

  ngOnInit(): void {
    // Todas pre-marcadas por defecto — la secretaria desmarca las que NO quiera.
    this.rows.set(this.facade.clasesPendientesReagendar().map((c) => ({ ...c, selected: true })));
  }

  protected toggleRow(sessionId: number, checked: boolean): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.sessionId === sessionId ? { ...r, selected: checked } : r)),
    );
  }

  /** Texto del badge — la inasistencia justificada se rotula explícitamente (sigue en rojo). */
  protected badgeLabel(row: FilaReagendar): string {
    if (row.origen === 'cancelled') return 'Cancelada';
    return row.justificada ? 'Inasistencia — Justificada' : 'Inasistencia';
  }

  protected onContinue(): void {
    const selected = this.selectedRows();
    if (selected.length === 0) return;

    this.facade.setReagendarSeleccion(
      selected.map((r) => ({
        sessionId: r.sessionId,
        claseNumero: r.claseNumero,
        origen: r.origen,
      })),
    );

    // push (no open/close): navega dentro del mismo drawer sin perder contexto,
    // habilita "Volver" al checklist vía layoutDrawer.back().
    this.layoutDrawer.push(
      AdminReagendarHorariosDrawerComponent,
      `Reagendar ${selected.length} ${selected.length === 1 ? 'Clase' : 'Clases'}`,
      'calendar-clock',
    );
  }

  protected onCancel(): void {
    this.layoutDrawer.close();
  }
}
