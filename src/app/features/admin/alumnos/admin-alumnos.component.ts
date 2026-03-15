import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { AlumnosListContentComponent } from '@shared/components/alumnos-list-content/alumnos-list-content.component';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
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
      (refreshRequested)="facade.loadAlumnos()"
      (claseOnlineAction)="openClaseOnlineDrawer($event)"
    />

    <app-admin-clase-online-drawer
      [isOpen]="drawerOpen()"
      [mode]="drawerMode()"
      (closed)="drawerOpen.set(false)"
      (saved)="facade.loadAlumnos()"
    />
  `,
})
export class AdminAlumnosComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnosFacade);

  protected readonly drawerOpen = signal(false);
  protected readonly drawerMode = signal<'zoom' | 'asistencia'>('zoom');

  ngOnInit(): void {
    this.facade.loadAlumnos();
  }

  protected openClaseOnlineDrawer(mode: 'zoom' | 'asistencia'): void {
    this.drawerMode.set(mode);
    this.drawerOpen.set(true);
  }
}
