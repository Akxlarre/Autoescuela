import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { FichaTecnicaPrintService } from '@core/services/ui/ficha-tecnica-print.service';
import { AdminFichaTecnicaComponent } from '../components/ficha-tecnica/admin-ficha-tecnica.component';
import { AdminReprogramarClaseDrawerComponent } from '../reprogramar-clase-drawer/admin-reprogramar-clase-drawer.component';
import type { ClasePracticaUI } from '@core/models/ui/alumno-detalle.model';

/**
 * AdminFichaTecnicaDrawerComponent — Smart / Drawer (Fase 2 app-like).
 *
 * Envuelve el mismo `AdminFichaTecnicaComponent` que antes vivía inline en el
 * bento-grid (Fase 1 lo apagó con `showLegacyPanels`) — sin tocar ese Dumb
 * component. Su `h-full` + `flex-1 min-h-0` + tabla `overflow-x-auto` ya
 * resuelven el scroll interno de la tabla; el body del drawer (ya
 * `overflow-y-auto` vía LayoutDrawerComponent) no necesita scrollear porque
 * el contenido se ajusta exactamente al alto disponible.
 */
@Component({
  selector: 'app-admin-ficha-tecnica-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminFichaTecnicaComponent],
  template: `
    <app-admin-ficha-tecnica
      class="flex-1 min-h-0 w-full block"
      [clases]="facade.clasesPracticas()"
      (imprimirFicha)="imprimirFicha()"
      (reprogramarRequested)="openReprogramarDrawer($event)"
    />
  `,
})
export class AdminFichaTecnicaDrawerComponent {
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly fichaTecnicaPrint = inject(FichaTecnicaPrintService);

  protected imprimirFicha(): void {
    const alumno = this.facade.alumno();
    this.fichaTecnicaPrint.printFichaTecnica(this.facade.clasesPracticas(), {
      studentName: alumno?.nombre,
      matricula: alumno?.matricula,
    });
  }

  /** Reprogramar una clase — navega dentro del mismo drawer (push/back). */
  protected openReprogramarDrawer(clase: ClasePracticaUI): void {
    const enrollmentId = this.facade.alumno()?.enrollmentId;
    if (enrollmentId == null) return;
    this.facade.setReprogramarTarget(clase.sessionId, clase.numero, enrollmentId);
    this.layoutDrawer.push(
      AdminReprogramarClaseDrawerComponent,
      'Reprogramar Clase',
      'calendar-clock',
    );
  }
}
