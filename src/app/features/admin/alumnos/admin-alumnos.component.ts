import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlumnosListContentComponent } from '@shared/components/alumnos-list-content/alumnos-list-content.component';

@Component({
  selector: 'app-admin-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, AlumnosListContentComponent],
  template: `
    <div class="p-6 max-w-[1600px] mx-auto">
      <app-alumnos-list-content basePath="/app/admin" />
    </div>
  `,
})
export class AdminAlumnosComponent { }
