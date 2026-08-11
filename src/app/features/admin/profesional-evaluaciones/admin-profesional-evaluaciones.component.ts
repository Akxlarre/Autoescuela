import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
} from '@angular/core';
import { BranchFacade } from '@core/facades/branch.facade';
import { EvaluacionesProfesionalFacade } from '@core/facades/evaluaciones-profesional.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { EvaluacionesProfesionalContentComponent } from '@shared/components/evaluaciones-profesional-content/evaluaciones-profesional-content.component';

@Component({
  selector: 'app-admin-profesional-evaluaciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EvaluacionesProfesionalContentComponent],
  template: `
    <app-evaluaciones-profesional-content
      [landing]="facade.landing()"
      [landingLoaded]="facade.landingLoaded()"
      [grilla]="facade.grilla()"
      [selectedCursoId]="facade.selectedCursoId()"
      [isDesktopLayout]="isDesktopLayout()"
      [isLoading]="facade.isLoading()"
      [isSaving]="facade.isSaving()"
      [hayDirty]="facade.hayDirty()"
      (cursoSelected)="facade.selectCurso($event)"
      (volverAterrizaje)="onVolverAterrizaje()"
      (gradeChanged)="onGradeChanged($event)"
      (gradeBlurred)="onGradeBlurred($event)"
      (guardarBorradorRequested)="facade.guardarBorrador()"
      (confirmarNotasRequested)="facade.confirmarNotas()"
    />
  `,
})
export class AdminProfesionalEvaluacionesComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(EvaluacionesProfesionalFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutService = inject(LayoutService);

  /** Por CONTENEDOR (`<main>`), no por viewport — reacciona igual si un drawer angosta el
   * layout aunque el viewport siga en desktop (specs 0030/0031). */
  protected readonly isDesktopLayout = computed(() => this.layoutService.tier() === 'desktop');

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
    this.facade.loadLanding();
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  protected onVolverAterrizaje(): void {
    this.facade.cerrarGrilla();
    this.facade.loadLanding();
  }

  protected onGradeChanged(event: {
    enrollmentId: number;
    moduleIndex: number;
    value: number | null;
  }): void {
    this.facade.setNota(event.enrollmentId, event.moduleIndex, event.value);
  }

  protected onGradeBlurred(event: { enrollmentId: number; moduleIndex: number }): void {
    this.facade.corregirNotaMinima(event.enrollmentId, event.moduleIndex);
  }
}
