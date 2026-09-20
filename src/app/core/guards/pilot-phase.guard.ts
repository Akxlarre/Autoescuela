import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { isBlockedInPilot, type PilotBlockedModule } from '@core/config/pilot-phase.config';

/**
 * Guard de fase piloto (fix-255-m): bloquea un módulo mientras esté en
 * `pilot-phase.config.ts`, sin depender de autenticación — aplica igual a rutas
 * dentro del AppShell (instructor/alumno) y a rutas públicas (matrícula online).
 */
export function pilotPhaseGuard(module: PilotBlockedModule): CanActivateFn {
  return () => {
    const router = inject(Router);
    return isBlockedInPilot(module) ? router.createUrlTree(['/modulo-no-disponible']) : true;
  };
}
