import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdminProfesionalRelatoresComponent } from '@features/admin/profesional-relatores/admin-profesional-relatores.component';

@Component({
  selector: 'app-secretaria-profesional-relatores',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminProfesionalRelatoresComponent],
  template: `<app-admin-profesional-relatores />`,
})
export class SecretariaProfesionalRelatoresComponent {}
