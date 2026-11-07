import { describe, expect, it } from 'vitest';

import { ENTITY_MODULE_MAP, MODULE_OPTIONS } from './audit-log-row.model';
import {
  ENTITY_MODULE_MAP as DENO_ENTITY_MODULE_MAP,
  MODULE_OPTIONS as DENO_MODULE_OPTIONS,
} from '../../../../../supabase/functions/_shared/audit-modules';

/**
 * fix-487-m: el mapa tabla → módulo de Auditoría vive en la app y en
 * `supabase/functions/_shared/audit-modules.ts` (Deno no puede importar `src/app/`). Las dos
 * copias ya divergieron una vez: la exportación no conocía "Instructores" y filtrar por él no
 * filtraba nada. Este test es la red contra que vuelva a pasar.
 */
describe('módulos de Auditoría: app y edge functions (fix-487-m)', () => {
  it('el mapa tabla → módulo es el mismo', () => {
    expect(DENO_ENTITY_MODULE_MAP).toEqual(ENTITY_MODULE_MAP);
  });

  it('las opciones del filtro son las mismas', () => {
    expect(DENO_MODULE_OPTIONS).toEqual(MODULE_OPTIONS);
  });

  it('toda opción del filtro (salvo Otros) tiene al menos una tabla', () => {
    const conTabla = new Set(Object.values(ENTITY_MODULE_MAP));
    const sinTabla = MODULE_OPTIONS.filter((m) => m !== 'Otros' && !conTabla.has(m));
    expect(sinTabla).toEqual([]);
  });

  it('todo módulo del mapa se puede elegir en el filtro', () => {
    const opciones = new Set(MODULE_OPTIONS);
    const inalcanzables = [...new Set(Object.values(ENTITY_MODULE_MAP))].filter(
      (m) => !opciones.has(m),
    );
    expect(inalcanzables).toEqual([]);
  });
});
