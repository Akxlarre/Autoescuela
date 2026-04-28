import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { AlumnosListContentComponent } from '@shared/components/alumnos-list-content/alumnos-list-content.component';
import { EliminarAlumnoModalComponent } from '@shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
import type { AlumnoTableRow } from '@core/models/ui/alumno-table-row.model';

@Component({
  selector: 'app-secretaria-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlumnosListContentComponent, EliminarAlumnoModalComponent],
  template: `
    <app-alumnos-list-content
      basePath="/app/secretaria"
      [alumnos]="facade.alumnos()"
      [isLoading]="facade.isLoading()"
      [alumnosPorVencer]="facade.alumnosPorVencer()"
      [trashView]="facade.trashView()"
      [alumnosPorVencer]="facade.alumnosPorVencer().length"
      (refreshRequested)="facade.initialize()"
      (archivarRequested)="requestArchivar($event)"
      (trashViewToggled)="onTrashViewToggled()"
      (restaurarRequested)="onRestaurar($event)"
    />

    <app-eliminar-alumno-modal
      [visible]="!!deleteTarget()"
      [alumnoNombre]="deleteTargetNombre()"
      [hasHistory]="hasHistory()"
      [isDeleting]="facade.isArchiving()"
      (confirmado)="onConfirmArchivar()"
      (cancelado)="onCancelArchivar()"
    />
  `,
})
export class SecretariaAlumnosComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnosFacade);

  protected readonly deleteTarget = signal<AlumnoTableRow | null>(null);
  protected readonly hasHistory = signal(false);

  protected readonly deleteTargetNombre = computed(() => {
    const t = this.deleteTarget();
    return t ? `${t.nombre} ${t.apellido}` : '';
  });

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected async requestArchivar(alumnoId: string): Promise<void> {
    const alumno = this.facade.alumnos().find((a) => a.id === alumnoId);
    if (!alumno) return;
    const { hasHistory } = await this.facade.checkHistorial(Number(alumnoId));
    this.hasHistory.set(hasHistory);
    this.deleteTarget.set(alumno);
  }

  protected async onConfirmArchivar(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    try {
      await this.facade.archivarAlumno(Number(target.id));
    } finally {
      this.deleteTarget.set(null);
      this.hasHistory.set(false);
    }
  }

  protected onCancelArchivar(): void {
    this.deleteTarget.set(null);
    this.hasHistory.set(false);
  }

  protected onTrashViewToggled(): void {
    void this.facade.setTrashView(!this.facade.trashView());
  }

  protected async onRestaurar(alumnoId: string): Promise<void> {
    await this.facade.restaurarAlumno(Number(alumnoId));
  }
}
