import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import {
  AlumnosListContentComponent,
  type AlumnoExportRequest,
} from '@shared/components/alumnos-list-content/alumnos-list-content.component';
import { EliminarAlumnoModalComponent } from '@shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
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
      [error]="facade.error()"
      [trashView]="facade.trashView()"
      [alumnosPorVencer]="facade.alumnosPorVencer().length"
      [isExporting]="facade.isExporting()"
      [showSedeColumn]="facade.showSedeColumn()"
      (refreshRequested)="facade.initialize()"
      (archivarRequested)="requestArchivar($event)"
      (trashViewToggled)="onTrashViewToggled()"
      (restaurarRequested)="onRestaurar($event)"
      (exportRequested)="onExport($event)"
      [isGeneratingFicha]="facade.isGeneratingFicha()"
      (fichaExportRequested)="onExportarFicha($event)"
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
  private readonly branchFacade = inject(BranchFacade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly deleteTarget = signal<AlumnoTableRow | null>(null);
  protected readonly hasHistory = signal(false);

  protected readonly deleteTargetNombre = computed(() => {
    const t = this.deleteTarget();
    return t ? `${t.nombre} ${t.apellido}` : '';
  });

  constructor() {
    // fix-269-m: una secretaria con grant multi-sede tiene selector de sede; la lista se
    // recarga cada vez que lo cambia. La carga inicial también sale de acá (el effect corre
    // una vez al crear el componente), igual que en AdminAlumnosComponent.
    effect(() => {
      this.branchFacade.selectedBranchId();
      // untracked: initialize() lee otros signals (usuario, vista Papelera). Si el effect los
      // siguiera, cualquier cambio en ellos dispararía una segunda carga solapada con la primera.
      untracked(() => void this.facade.initialize());
    });
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.facade.destroyRealtime();
      this.facade.leaveTrashView();
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

  protected onExport(req: AlumnoExportRequest): void {
    void this.facade.exportAlumnos(req);
  }

  protected onExportarFicha(enrollmentId: number): void {
    void this.facade.exportarFicha(enrollmentId);
  }
}
