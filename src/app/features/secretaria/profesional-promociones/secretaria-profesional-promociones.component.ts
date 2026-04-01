import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdminProfesionalPromocionesComponent } from '@features/admin/profesional-promociones/admin-profesional-promociones.component';

@Component({
  selector: 'app-secretaria-profesional-promociones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminProfesionalPromocionesComponent],
  template: `<app-admin-profesional-promociones />`,
})
export class SecretariaProfesionalPromocionesComponent {}
