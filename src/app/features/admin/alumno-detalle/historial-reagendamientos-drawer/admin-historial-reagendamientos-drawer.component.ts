import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { AdminHistorialReagendamientosComponent } from '../components/historial-reagendamientos/admin-historial-reagendamientos.component';

/**
 * AdminHistorialReagendamientosDrawerComponent — Smart / Drawer (fix-009-i).
 *
 * Wrapper delgado que envuelve `AdminHistorialReagendamientosComponent` (Dumb,
 * sin cambios) dentro del sistema de drawers — mismo patrón que
 * `AdminFichaTecnicaDrawerComponent`. Antes vivía inline al final de la
 * columna izquierda de la ficha del alumno, generando scroll vertical.
 */
@Component({
  selector: 'app-admin-historial-reagendamientos-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminHistorialReagendamientosComponent],
  template: `
    <app-admin-historial-reagendamientos
      class="flex-1 min-h-0 w-full block"
      [reagendamientos]="facade.historialReagendamientos()"
    />
  `,
})
export class AdminHistorialReagendamientosDrawerComponent {
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
}
