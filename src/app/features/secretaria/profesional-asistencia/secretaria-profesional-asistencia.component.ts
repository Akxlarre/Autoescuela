import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdminProfesionalAsistenciaComponent } from '@features/admin/profesional-asistencia/admin-profesional-asistencia.component';

@Component({
  selector: 'app-secretaria-profesional-asistencia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminProfesionalAsistenciaComponent],
  template: `<app-admin-profesional-asistencia />`,
})
export class SecretariaProfesionalAsistenciaComponent {}
