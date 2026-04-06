import { ChangeDetectionStrategy, Component, effect, inject, signal, OnInit } from '@angular/core';
import { AlumnosListContentComponent } from '@shared/components/alumnos-list-content/alumnos-list-content.component';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { AdminClaseOnlineDrawerComponent } from './clase-online-drawer/admin-clase-online-drawer.component';

@Component({
  selector: 'app-admin-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlumnosListContentComponent, AdminClaseOnlineDrawerComponent],
  template: `
    <app-alumnos-list-content
      basePath="/app/admin"
      [alumnos]="facade.alumnos()"
      [isLoading]="facade.isLoading()"
      [alumnosPorVencer]="facade.alumnosPorVencer()"
      (refreshRequested)="facade.initialize()"
      (claseOnlineAction)="openClaseOnlineDrawer($event)"
    />

    <app-admin-clase-online-drawer
      [isOpen]="drawerOpen()"
      [mode]="drawerMode()"
      (closed)="drawerOpen.set(false)"
      (saved)="facade.initialize()"
    />
  `,
})
export class AdminAlumnosComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnosFacade);
  private readonly branchFacade = inject(BranchFacade);

  protected readonly drawerOpen = signal(false);
  protected readonly drawerMode = signal<'zoom' | 'asistencia'>('zoom');

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
    this.drawerMode.set(mode);
    this.drawerOpen.set(true);
  }
}
