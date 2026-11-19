import type { InstructorOption } from '@core/models/ui/anticipos.model';

export interface ListaInstructoresAnticipo {
  instructores: readonly InstructorOption[];
  cargando: boolean;
  conError: boolean;
}

export type RevisionInstructorAnticipo = 'bloqueado' | 'sin-elegir' | 'vigente' | 'fuera-de-lista';

/**
 * Compara el instructor elegido con la lista. Mientras carga o con error la lista no dice nada
 * sobre él: está vacía de forma temporal, así que se bloquea sin descartar lo elegido.
 */
export function revisarInstructorAnticipo(
  instructorId: number | '' | null,
  lista: ListaInstructoresAnticipo,
): RevisionInstructorAnticipo {
  if (lista.cargando || lista.conError) return 'bloqueado';
  if (instructorId === null || instructorId === '') return 'sin-elegir';
  return lista.instructores.some((i) => i.id === instructorId) ? 'vigente' : 'fuera-de-lista';
}
