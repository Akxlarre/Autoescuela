import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdminInstructoresComponent } from '@features/admin/instructores/admin-instructores.component';

/**
 * Instructores (Secretaria) — reutiliza la página de admin (fix-208-m).
 *
 * Antes era una copia de 599 líneas que había divergido en tres puntos: el botón
 * "Horas trabajadas" sin handler, una columna "Tipo" que admin no tenía y un segundo
 * mecanismo de animación de entrada. La diferencia real entre roles es una sola —
 * la columna "Sede" — y `AdminInstructoresComponent` ya la resuelve por rol.
 *
 * Mismo patrón que las páginas profesionales de secretaria y la ficha de alumno.
 */
@Component({
  selector: 'app-secretaria-instructores',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminInstructoresComponent],
  template: `<app-admin-instructores />`,
})
export class SecretariaInstructoresComponent {}
