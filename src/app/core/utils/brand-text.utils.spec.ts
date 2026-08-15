import { describe, it, expect } from 'vitest';
import { resolveBrandText } from './brand-text.utils';
import type { BranchOption } from '@core/models/ui/branch.model';

const branches: Pick<BranchOption, 'id' | 'name'>[] = [
  { id: 1, name: 'Autoescuela Chillán' },
  { id: 2, name: 'Conductores Chillán' },
];

describe('resolveBrandText', () => {
  it('usa la sede seleccionada cuando el rol es admin', () => {
    expect(resolveBrandText('admin', 2, null, branches)).toBe('Conductores Chillán');
  });

  it('cae a "Autoescuela" cuando el admin no filtró sede (null = todas)', () => {
    expect(resolveBrandText('admin', null, null, branches)).toBe('Autoescuela');
  });

  it('ignora la sede seleccionada y usa la propia cuando el rol es secretaria', () => {
    // La secretaria está anclada a su sede: selectedBranchId no debe influir.
    expect(resolveBrandText('secretaria', 2, 1, branches)).toBe('Autoescuela Chillán');
  });

  it('cae a "Autoescuela" para roles sin scope de sede', () => {
    expect(resolveBrandText('instructor', 2, 1, branches)).toBe('Autoescuela');
    expect(resolveBrandText('alumno', 2, 1, branches)).toBe('Autoescuela');
  });

  it('cae a "Autoescuela" cuando no hay usuario (rol undefined)', () => {
    expect(resolveBrandText(undefined, 2, null, branches)).toBe('Autoescuela');
  });

  it('cae a "Autoescuela" si la sede activa no está en la lista cargada', () => {
    // Caso real: BranchFacade todavía no resolvió branches() y el id ya está seteado.
    expect(resolveBrandText('admin', 99, null, branches)).toBe('Autoescuela');
    expect(resolveBrandText('admin', 1, null, [])).toBe('Autoescuela');
  });

  it('cae a "Autoescuela" si la secretaria no tiene branchId', () => {
    expect(resolveBrandText('secretaria', null, null, branches)).toBe('Autoescuela');
    expect(resolveBrandText('secretaria', null, undefined, branches)).toBe('Autoescuela');
  });
});
