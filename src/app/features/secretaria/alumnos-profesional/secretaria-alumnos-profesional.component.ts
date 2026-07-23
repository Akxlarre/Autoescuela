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
import { AlumnosProfesionalListContentComponent } from '@shared/components/alumnos-profesional-list-content/alumnos-profesional-list-content.component';
import { EliminarAlumnoModalComponent } from '@shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component';
import { SecretariaAlumnosPreInscritosComponent } from '@features/secretaria/alumnos-pre-inscritos/secretaria-alumnos-pre-inscritos.component';
import { AdminAlumnosProfesionalFacade } from '@core/facades/admin-alumnos-profesional.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import type { AlumnoProfesionalTableRow } from '@core/models/ui/alumno-profesional-table-row.model';

@Component({
  selector: 'app-secretaria-alumnos-profesional',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlumnosProfesionalListContentComponent,
    EliminarAlumnoModalComponent,
    SecretariaAlumnosPreInscritosComponent,
  ],
  template: `
    <!-- Vista condicional consciente de la URL (igual patrón que "Papelera"):
         Pre-inscritos se embebe aquí mismo en vez de navegar. -->
    @if (showPreInscritos()) {
      <app-secretaria-alumnos-pre-inscritos
        [embedded]="true"
        (closeRequested)="showPreInscritos.set(false)"
      />
    } @else {
      <app-alumnos-profesional-list-content
        basePath="/app/secretaria"
        [alumnos]="facade.alumnos()"
        [isLoading]="facade.isLoading()"
        [trashView]="facade.trashView()"
        (refreshRequested)="facade.initialize()"
        (preInscritosRequested)="showPreInscritos.set(true)"
        (archivarRequested)="requestArchivar($event)"
        (trashViewToggled)="onTrashViewToggled()"
        (restaurarRequested)="onRestaurar($event)"
      />
    }

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
export class SecretariaAlumnosProfesionalComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnosProfesionalFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly showPreInscritos = signal(false);

  // ── Estado del modal de borrado (homologado con AdminAlumnosComponent/Clase B) ──
  protected readonly deleteTarget = signal<AlumnoProfesionalTableRow | null>(null);
  protected readonly hasHistory = signal(false);
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
    // fix-028: con grant, la secretaria se comporta como admin → fuerza sede con profesional.
    this.branchFacade.setProfessionalOnly(true);
    this.facade.initialize();
    this.destroyRef.onDestroy(() => {
      this.branchFacade.setProfessionalOnly(false);
      this.facade.dispose();
    });
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
