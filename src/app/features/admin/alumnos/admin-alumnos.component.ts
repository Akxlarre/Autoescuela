import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { AlumnosListContentComponent } from '@shared/components/alumnos-list-content/alumnos-list-content.component';
import { EliminarAlumnoModalComponent } from '@shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AdminClaseOnlineDrawerComponent } from './clase-online-drawer/admin-clase-online-drawer.component';
import type { AlumnoTableRow } from '@core/models/ui/alumno-table-row.model';

@Component({
  selector: 'app-admin-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlumnosListContentComponent, EliminarAlumnoModalComponent],
  template: `
    <app-alumnos-list-content
      basePath="/app/admin"
      [alumnos]="facade.alumnos()"
      [isLoading]="facade.isLoading()"
      [trashView]="facade.trashView()"
      [alumnosPorVencer]="facade.alumnosPorVencer().length"
      (refreshRequested)="facade.initialize()"
      (claseOnlineAction)="openClaseOnlineDrawer($event)"
      (preInscritosRequested)="navigateToPreInscritos()"
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
export class AdminAlumnosComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnosFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly router = inject(Router);

  // ── Estado del modal de borrado ──────────────────────────────────────────
  protected readonly deleteTarget = signal<AlumnoTableRow | null>(null);
  protected readonly hasHistory = signal(false);

  protected readonly deleteTargetNombre = computed(() => {
    const t = this.deleteTarget();
    if (!t) return '';
    return `${t.nombre} ${t.apellido}`;
  });

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      this.facade.initialize();
    });
  }

  ngOnInit(): void {
    this.facade.initialize();
  }

  // ── Flujo de borrado ─────────────────────────────────────────────────────

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

  // ── Otros handlers ───────────────────────────────────────────────────────

  protected openClaseOnlineDrawer(mode: 'zoom' | 'asistencia'): void {
    this.facade.setDrawerMode(mode);
    const title = mode === 'zoom' ? 'Enviar Enlace Zoom' : 'Registrar Asistencia';
    const icon = mode === 'zoom' ? 'video' : 'check-circle';
    this.layoutDrawer.open(AdminClaseOnlineDrawerComponent, title, icon);
  }

  protected navigateToPreInscritos(): void {
    void this.router.navigate(['/app/admin/alumnos/pre-inscritos']);
  }

  protected onTrashViewToggled(): void {
    void this.facade.setTrashView(!this.facade.trashView());
  }

  protected async onRestaurar(alumnoId: string): Promise<void> {
    await this.facade.restaurarAlumno(Number(alumnoId));
  }
}
