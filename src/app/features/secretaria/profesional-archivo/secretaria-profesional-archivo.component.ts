import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdminProfesionalArchivoComponent } from '@features/admin/profesional-archivo/admin-profesional-archivo.component';

@Component({
  selector: 'app-secretaria-profesional-archivo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminProfesionalArchivoComponent],
  template: `<app-admin-profesional-archivo />`,
})
export class SecretariaProfesionalArchivoComponent {}
