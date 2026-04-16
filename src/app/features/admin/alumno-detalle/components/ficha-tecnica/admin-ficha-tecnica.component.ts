import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { ClasePracticaUI } from '@core/models/ui/alumno-detalle.model';

@Component({
  selector: 'app-admin-ficha-tecnica',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, Button, IconComponent],
  template: `
    <div id="ficha-tecnica-container" class="bento-card overflow-hidden !p-0 flex flex-col h-full w-full">
      <!-- Header -->
      <div class="flex items-center justify-between gap-4 p-5 border-b border-border-subtle bg-bg-elevated/30">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <app-icon name="clipboard-check" [size]="18" />
          </div>
          <div class="flex flex-col">
            <span class="text-base font-bold text-text-primary">Ficha Técnica</span>
            <span class="text-xs text-text-muted">Desempeño en clases prácticas</span>
          </div>
        </div>
        <p-button
          label="Imprimir Informe"
          icon="pi pi-print"
          size="small"
          [text]="true"
          severity="secondary"
          class="no-print"
          (onClick)="imprimirFicha.emit()"
        />
      </div>

      <!-- Desktop Table View (Hidden on mobile) -->
      <div class="hidden md:block overflow-x-auto min-h-0 flex-1">
        <table class="tabla-ficha w-full">
          <thead>
            <tr>
              <th scope="col" class="sticky top-0 z-10">N°</th>
              <th scope="col" class="sticky top-0 z-10">Fecha / Hora</th>
              <th scope="col" class="sticky top-0 z-10">Instructor</th>
              <th scope="col" class="sticky top-0 z-10 text-right">Kilometraje</th>
              <th scope="col" class="sticky top-0 z-10">Observaciones</th>
              <th scope="col" class="sticky top-0 z-10 text-center">Validación</th>
            </tr>
          </thead>
          <tbody>
            @for (clase of clases(); track clase.numero) {
              <tr [class.fila-pendiente]="!clase.completada" class="group transition-colors hover:bg-bg-elevated/50">
                <td class="font-bold text-text-primary">#{{ clase.numero }}</td>
                <td>
                  <div class="flex flex-col gap-0.5">
                    <span class="text-xs font-semibold">{{ clase.fecha || '-' }}</span>
                    <span class="text-[10px] text-text-muted italic">{{ clase.hora || '-' }}</span>
                  </div>
                </td>
                <td>
                  <span class="text-xs font-bold" [class.text-brand]="clase.instructor" [class.text-text-muted]="!clase.instructor">
                    {{ clase.instructor || 'Sin asignar' }}
                  </span>
                </td>
                <td class="text-right">
                  @if (clase.kmInicio !== null) {
                    <div class="flex flex-col items-end gap-0.5">
                      <span class="text-xs font-medium">{{ clase.kmInicio.toLocaleString('es-CL') }} km</span>
                      <span class="text-[10px] text-text-muted">Fin: {{ clase.kmFin?.toLocaleString('es-CL') || '?' }} km</span>
                    </div>
                  } @else {
                    <span class="dato-vacio">-</span>
                  }
                </td>
                <td class="max-w-[200px]">
                  <span class="text-xs text-text-secondary line-clamp-2" [title]="clase.observaciones">
                    {{ clase.observaciones || 'Pendiente de sesión' }}
                  </span>
                </td>
                <td>
                  <div class="flex items-center justify-center gap-2">
                    <div class="firma-dot group-hover:scale-110 transition-transform shadow-sm"
                         [class.firma-alumno]="clase.alumnoFirmo"
                         [class.firma-pendiente]="!clase.alumnoFirmo"
                         [title]="clase.alumnoFirmo ? 'Alumno firmó' : 'Firma alumno pendiente'">
                      <app-icon name="user" [size]="10" color="#fff" />
                    </div>
                    <div class="firma-dot group-hover:scale-110 transition-transform shadow-sm"
                         [class.firma-instructor]="clase.instructorFirmo"
                         [class.firma-pendiente]="!clase.instructorFirmo"
                         [title]="clase.instructorFirmo ? 'Instructor firmó' : 'Firma instructor pendiente'">
                      <app-icon name="shield" [size]="10" color="#fff" />
                    </div>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Mobile Card View (Visible on mobile only) -->
      <div class="md:hidden flex-1 overflow-y-auto p-4 space-y-3 bg-bg-surface/50">
        @for (clase of clases(); track clase.numero) {
          <div class="p-4 rounded-xl border border-border-subtle bg-bg-surface shadow-sm flex flex-col gap-3"
               [class.opacity-60]="!clase.completada">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded bg-bg-elevated text-[10px] font-bold text-text-primary">SESIÓN #{{ clase.numero }}</span>
              <div class="flex items-center gap-2">
                 <div class="firma-dot firma-dot--sm shadow-sm" [class.firma-alumno]="clase.alumnoFirmo" [class.firma-pendiente]="!clase.alumnoFirmo">
                   <app-icon name="user" [size]="8" color="#fff" />
                 </div>
                 <div class="firma-dot firma-dot--sm shadow-sm" [class.firma-instructor]="clase.instructorFirmo" [class.firma-pendiente]="!clase.instructorFirmo">
                   <app-icon name="shield" [size]="8" color="#fff" />
                 </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
               <div class="flex flex-col gap-0.5">
                  <span class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Fecha / Hora</span>
                  <span class="text-xs font-semibold text-text-primary">{{ clase.fecha || '--' }} · {{ clase.hora || '--' }}</span>
               </div>
               <div class="flex flex-col gap-0.5">
                  <span class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Instructor</span>
                  <span class="text-xs font-bold text-brand truncate">{{ clase.instructor || 'Sin asignar' }}</span>
               </div>
            </div>

            @if (clase.observaciones) {
               <div class="p-2 rounded bg-bg-elevated/50 border-l-2 border-brand/30">
                  <p class="text-[11px] text-text-secondary m-0 line-clamp-2 italic">"{{ clase.observaciones }}"</p>
               </div>
            } @else {
              <div class="h-px bg-border-subtle w-full"></div>
              <span class="text-[10px] text-text-muted italic text-center">Sesión aún no realizada</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .tabla-ficha {
      border-collapse: collapse;
      font-size: var(--text-sm);
    }
    .tabla-ficha th {
      padding: 12px 16px;
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      letter-spacing: 0.04em;
      color: var(--text-secondary);
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border-default);
      white-space: nowrap;
    }
    .tabla-ficha td {
      padding: 14px 16px;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-subtle);
      white-space: nowrap;
    }
    .fila-pendiente td {
      color: var(--text-muted);
    }
    .dato-vacio {
      color: var(--text-muted);
    }

    .firma-dot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: var(--radius-full);
    }
    .firma-dot--sm {
      width: 16px;
      height: 16px;
    }
    .firma-alumno {
      background: var(--state-success);
    }
    .firma-instructor {
      background: var(--ds-brand);
    }
    .firma-pendiente {
      background: var(--bg-subtle);
    }

    @media print {
      :host { visibility: hidden; }
      #ficha-tecnica-container, #ficha-tecnica-container * { visibility: visible; }
      #ficha-tecnica-container {
        position: fixed;
        inset: 0;
        border: none !important;
        box-shadow: none !important;
        background: #fff !important;
      }
      .no-print { display: none !important; }
      .md-hidden { display: none !important; } /* Siempre usar tabla para imprimir */
      .hidden { display: block !important; }
    }
  `
})
export class AdminFichaTecnicaComponent {
  clases = input.required<ClasePracticaUI[]>();
  imprimirFicha = output<void>();
}
