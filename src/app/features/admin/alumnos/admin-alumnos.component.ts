import { ChangeDetectionStrategy, Component, effect, inject, OnInit } from '@angular/core';
import { AlumnosListContentComponent } from '@shared/components/alumnos-list-content/alumnos-list-content.component';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AdminClaseOnlineDrawerComponent } from './clase-online-drawer/admin-clase-online-drawer.component';

@Component({
  selector: 'app-admin-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlumnosListContentComponent],
  template: `
    <app-alumnos-list-content
      basePath="/app/admin"
      [alumnos]="facade.alumnos()"
      [isLoading]="facade.isLoading()"
      [alumnosPorVencer]="facade.alumnosPorVencer()"
      (refreshRequested)="facade.initialize()"
      (claseOnlineAction)="openClaseOnlineDrawer($event)"
    />
  `,
})
export class AdminAlumnosComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnosFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  constructor() {
    // Re-carga la lista cada vez que el admin cambia de sede (o vuelve a "Todas")
    // Al usar initialize(), esto activa SWR (background refresh si la sede NO ha cambiado)
    effect(() => {
      this.branchFacade.selectedBranchId(); // tracking
      this.facade.initialize();
    });
  }

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected openClaseOnlineDrawer(mode: 'zoom' | 'asistencia'): void {
    this.facade.setDrawerMode(mode);
    const title = mode === 'zoom' ? 'Enviar Enlace Zoom' : 'Registrar Asistencia';
    const icon = mode === 'zoom' ? 'video' : 'check-circle';
    this.layoutDrawer.open(AdminClaseOnlineDrawerComponent, title, icon);
  }
}
