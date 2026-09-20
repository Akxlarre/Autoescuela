/**
 * Fuente única de verdad de qué módulos están bloqueados durante la fase piloto
 * (fix-255-m). Para levantar la fase de un módulo, sacarlo de `BLOCKED_MODULES` —
 * no repetir esta condición en guards ni en el menú por separado.
 */
export type PilotBlockedModule = 'instructor' | 'alumno' | 'inscripcion-publica';

const BLOCKED_MODULES: ReadonlySet<PilotBlockedModule> = new Set<PilotBlockedModule>([
  'instructor',
  'alumno',
  'inscripcion-publica',
]);

export function isBlockedInPilot(module: PilotBlockedModule): boolean {
  return BLOCKED_MODULES.has(module);
}
