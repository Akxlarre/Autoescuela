import type { AlumnoDeudor } from '@core/models/ui/pagos.model';

/** Estados de matrícula que se nombran: los "en curso" (`active`, `pending_payment`) no se anotan. */
const ESTADO_VISIBLE: Readonly<Record<string, string>> = {
  completed: 'terminada',
  cancelled: 'cancelada',
};

/**
 * Identifica una matrícula de la lista de deudores: "N° B-0123 · Clase B · cancelada" (fix-053-i).
 *
 * Un alumno puede tener dos matrículas con saldo (una terminada o cancelada con deuda y una nueva,
 * o un duplicado viejo); con solo nombre, RUT y fecha se ven idénticas y el abono se imputa a la
 * equivocada. El número las distingue siempre; el estado avisa cuál es la deuda vieja.
 */
export function describeMatriculaDeudor(
  deudor: Pick<AlumnoDeudor, 'numeroMatricula' | 'cursoNombre' | 'estadoMatricula'>,
): string {
  const partes = [
    deudor.numeroMatricula ? `N° ${deudor.numeroMatricula}` : 'sin N°',
    deudor.cursoNombre,
  ];
  const estado = deudor.estadoMatricula ? ESTADO_VISIBLE[deudor.estadoMatricula] : undefined;
  if (estado) partes.push(estado);
  return partes.join(' · ');
}
