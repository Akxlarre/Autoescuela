import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
} from '@angular/core';

import { AgendaSemanalComponent } from '@shared/components/agenda-semanal/agenda-semanal.component';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AgendaSettingsService } from '@core/services/ui/agenda-settings.service';
import { AgendaSlotDetailDrawerComponent } from '@features/agenda/agenda-slot-detail-drawer.component';
import type { AgendaSlot } from '@core/models/ui/agenda.model';

@Component({
  selector: 'app-admin-agenda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgendaSemanalComponent],
  template: `
    <app-agenda-semanal
      [weekData]="facade.weekData()"
      [filteredDays]="facade.filteredDays()"
      [timeRows]="facade.timeRows()"
      [isLoading]="facade.isLoading()"
      [isCurrentWeek]="facade.isCurrentWeek()"
      [instructors]="facade.instructors()"
      [selectedInstructorId]="facade.selectedInstructorId()"
      [showHero]="false"
      [showKpis]="false"
      [maxVisibleDateIso]="agendaSettings.maxVisibleDateIso()"
      [maxVisibleDateLabel]="agendaSettings.maxVisibleDateLabel()"
      (weekNext)="facade.goToNextWeek()"
      (weekPrev)="facade.goToPrevWeek()"
      (weekToday)="facade.goToToday()"
      (weekJump)="facade.goToDate($event)"
      (instructorFilterChange)="facade.setInstructorFilter($event)"
      (slotClick)="onSlotClick($event)"
    />
  `,
})
export class AdminAgendaComponent implements OnInit {
  protected readonly facade = inject(AgendaFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);
  protected readonly agendaSettings = inject(AgendaSettingsService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.facade.dispose());
  }

  onSlotClick(slot: AgendaSlot): void {
    if (!slot) return;
    this.facade.setSelectedSlot(slot);
    // Desde fix-017 ya no se agendan clases desde la Agenda. Todo click abre el
    // detalle de solo lectura: horario ocupado (alumno) o disponible (instructor/vehículo).
    const title =
      slot.status === 'available'
        ? 'Horario disponible'
        : slot.studentName
          ? `Clase: ${slot.studentName}`
          : 'Detalle de clase';
    this.drawer.push(AgendaSlotDetailDrawerComponent, title, 'calendar-clock');
  }
}
