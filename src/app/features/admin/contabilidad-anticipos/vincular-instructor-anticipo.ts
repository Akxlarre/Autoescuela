import { computed, effect, untracked, type Signal } from '@angular/core';
import type { FormControl } from '@angular/forms';
import {
  revisarInstructorAnticipo,
  type ListaInstructoresAnticipo,
  type RevisionInstructorAnticipo,
} from '@core/utils/instructor-anticipo.utils';

/**
 * Mantiene el campo instructor de un formulario de anticipo coherente con la lista vigente: un
 * instructor de otra sede no puede quedar elegido sin verse. Llamar al construir el drawer.
 * `aplica` permite desactivarlo cuando el formulario no está registrando un anticipo.
 */
export function vincularInstructorAnticipo<T extends number | '' | null>(opciones: {
  control: FormControl<T>;
  valorVacio: T;
  lista: Signal<ListaInstructoresAnticipo>;
  aplica?: Signal<boolean>;
}) {
  const { control, valorVacio, lista, aplica } = opciones;
  const aplicaAhora = () => aplica?.() ?? true;

  const revisar = (): RevisionInstructorAnticipo => {
    const revision = revisarInstructorAnticipo(control.value, lista());
    if (revision === 'fuera-de-lista') {
      control.setValue(valorVacio);
      control.markAsTouched();
    }
    return revision;
  };

  effect(() => {
    lista();
    if (aplicaAhora()) untracked(revisar);
  });

  return {
    /** La lista no permite confirmar ningún instructor: deshabilita el guardado. */
    bloqueado: computed(() => aplicaAhora() && (lista().cargando || lista().conError)),
    /** Revisa en el momento de guardar, sin depender de que la vista ya se haya actualizado. */
    confirmar: (): boolean => !aplicaAhora() || revisar() === 'vigente',
  };
}
