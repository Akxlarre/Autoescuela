import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SecretariaMatriculaComponent } from '../../../features/secretaria/matricula/secretaria-matricula.component';

/**
 * Admin Matrícula — reutiliza el mismo wizard de Secretaria.
 * El componente de secretaria contiene toda la UI del wizard paso-a-paso.
 */
@Component({
  selector: 'app-admin-matricula',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SecretariaMatriculaComponent],
  template: `<app-secretaria-matricula />`,
})
export class AdminMatriculaComponent { }
