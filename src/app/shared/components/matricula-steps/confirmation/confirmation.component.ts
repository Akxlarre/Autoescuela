import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EnrollmentConfirmationData } from '@core/models/ui/enrollment-confirmation.model';

import { ScrollRevealDirective } from '@core/directives/scroll-reveal.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';

@Component({
  selector: 'app-confirmation-step',
  standalone: true,
  imports: [DatePipe, IconComponent, ScrollRevealDirective, AnimateInDirective],
  templateUrl: './confirmation.component.html',
  styleUrl: './confirmation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationComponent {
  data = input.required<EnrollmentConfirmationData>();
  finish = output<void>();
  downloadReceipt = output<void>();
  downloadContract = output<void>();

  today = new Date();

  onFinish() {
    this.finish.emit();
  }

  onDownloadReceipt() {
    this.downloadReceipt.emit();
  }

  onDownloadContract() {
    this.downloadContract.emit();
  }
}
