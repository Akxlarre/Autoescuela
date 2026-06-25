import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AlumnosProfesionalListContentComponent } from '@shared/components/alumnos-profesional-list-content/alumnos-profesional-list-content.component';
import { EliminarAlumnoModalComponent } from '@shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component';
import { AdminAlumnosProfesionalFacade } from '@core/facades/admin-alumnos-profesional.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import type { AlumnoProfesionalTableRow } from '@core/models/ui/alumno-profesional-table-row.model';

@Component({
  selector: 'app-admin-alumnos-profesional',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlumnosProfesionalListContentComponent, EliminarAlumnoModalComponent],
  template: `
    <app-alumnos-profesional-list-content
      basePath="/app/admin"
      [alumnos]="facade.alumnos()"
      [isLoading]="facade.isLoading()"
      [trashView]="facade.trashView()"
      (refreshRequested)="facade.initialize()"
      (preInscritosRequested)="navigateToPreInscritos()"
      (archivarRequested)="requestArchivar($event)"
      (trashViewToggled)="onTrashViewToggled()"
      (restaurarRequested)="onRestaurar($event)"
    />

    <app-eliminar-alumno-modal
      [visible]="!!deleteTarget()"
      [alumnoNombre]="deleteTargetNombre()"
      [hasHistory]="false"
      [isDeleting]="facade.isArchiving()"
      (confirmado)="onConfirmArchivar()"
      (cancelado)="onCancelArchivar()"
    />
  `,
})
export class AdminAlumnosProfesionalComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnosProfesionalFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly deleteTarget = signal<AlumnoProfesionalTableRow | null>(null);
  protected readonly deleteTargetNombre = computed(() => {
    const t = this.deleteTarget();
    return t ? `${t.nombre} ${t.apellido}` : '';
  });

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      this.facade.initialize();
    });
  }

  ngOnInit(): void {
    // fix-028: fuerza una sede con Clase Profesional (deshabilita "Todas"/sedes sin profesional
    // en el selector) para no quedar en una vista vacía. Patrón de las demás páginas profesionales.
    this.branchFacade.setProfessionalOnly(true);
    this.facade.initialize();
    this.destroyRef.onDestroy(() => {
      this.branchFacade.setProfessionalOnly(false);
      this.facade.dispose();
    });
  }

  protected requestArchivar(alumnoId: string): void {
    const alumno = this.facade.alumnos().find((a) => a.id === alumnoId);
    if (alumno) this.deleteTarget.set(alumno);
  }

  protected async onConfirmArchivar(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    try {
      await this.facade.archivarAlumno(Number(target.id));
    } finally {
      this.deleteTarget.set(null);
    }
  }

  protected onCancelArchivar(): void {
    this.deleteTarget.set(null);
  }

  protected navigateToPreInscritos(): void {
    void this.router.navigate(['/app/admin/clase-profesional/pre-inscritos']);
  }

  protected onTrashViewToggled(): void {
    void this.facade.setTrashView(!this.facade.trashView());
  }

  protected async onRestaurar(alumnoId: string): Promise<void> {
    await this.facade.restaurarAlumno(Number(alumnoId));
  }
}
