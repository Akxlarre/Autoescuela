import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { AgendaSemanalComponent } from '@shared/components/agenda-semanal/agenda-semanal.component';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AgendaScheduleDrawerComponent } from '@features/agenda/agenda-schedule-drawer.component';
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
      [showHero]="!drawer.isOpen()"
      [showKpis]="!drawer.isOpen()"
      (weekNext)="facade.goToNextWeek()"
      (weekPrev)="facade.goToPrevWeek()"
      (weekToday)="facade.goToToday()"
      (instructorFilterChange)="facade.setInstructorFilter($event)"
      (slotClick)="onSlotClick($event)"
    />
  `,
})
export class AdminAgendaComponent implements OnInit {
  protected readonly facade = inject(AgendaFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);

  ngOnInit(): void {
    this.facade.initialize();
  }

  onSlotClick(slot: AgendaSlot): void {
    if (!slot) return;
    this.facade.setSelectedSlot(slot);
    if (slot.status === 'available') {
      this.drawer.push(AgendaScheduleDrawerComponent, 'Agendar clase', 'calendar-days');
    } else {
      const title = slot.studentName ? `Clase: ${slot.studentName}` : 'Detalle de clase';
      this.drawer.push(AgendaSlotDetailDrawerComponent, title, 'calendar-clock');
    }
  }
}
