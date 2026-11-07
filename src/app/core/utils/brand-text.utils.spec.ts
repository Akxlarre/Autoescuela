import { describe, it, expect } from 'vitest';
import { PRODUCT_NAME, resolveBrandText } from './brand-text.utils';
import type { BranchOption } from '@core/models/ui/branch.model';

const branches: Pick<BranchOption, 'id' | 'name'>[] = [
  { id: 1, name: 'Autoescuela Chillán' },
  { id: 2, name: 'Conductores Chillán' },
];

describe('resolveBrandText', () => {
  it('el nombre del producto es "Gestor de Autoescuelas" (fix-242-b)', () => {
    expect(PRODUCT_NAME).toBe('Gestor de Autoescuelas');
  });

  it('usa la sede seleccionada cuando el rol es admin', () => {
    expect(resolveBrandText('admin', 2, null, branches)).toBe('Conductores Chillán');
  });

  it('muestra el producto cuando el admin no filtró sede (null = todas)', () => {
    expect(resolveBrandText('admin', null, null, branches)).toBe(PRODUCT_NAME);
  });

  it('ignora la sede seleccionada y usa la propia cuando el rol es secretaria', () => {
    // La secretaria está anclada a su sede: selectedBranchId no debe influir.
    expect(resolveBrandText('secretaria', 2, 1, branches)).toBe('Autoescuela Chillán');
  });

  it('instructores y alumnos ven SU escuela, no el filtro global (fix-242-b)', () => {
    expect(resolveBrandText('instructor', 2, 1, branches)).toBe('Autoescuela Chillán');
    expect(resolveBrandText('alumno', 1, 2, branches)).toBe('Conductores Chillán');
  });

  it('muestra el producto si el instructor o alumno no tiene sede', () => {
    expect(resolveBrandText('instructor', 2, null, branches)).toBe(PRODUCT_NAME);
    expect(resolveBrandText('alumno', 2, undefined, branches)).toBe(PRODUCT_NAME);
  });

  it('muestra el producto para un rol desconocido', () => {
    expect(resolveBrandText('unknown', 2, 1, branches)).toBe(PRODUCT_NAME);
  });

  it('muestra el producto cuando no hay usuario (rol undefined)', () => {
    expect(resolveBrandText(undefined, 2, null, branches)).toBe(PRODUCT_NAME);
  });

  it('muestra el producto si la sede activa no está en la lista cargada', () => {
    // Caso real: BranchFacade todavía no resolvió branches() y el id ya está seteado.
    expect(resolveBrandText('admin', 99, null, branches)).toBe(PRODUCT_NAME);
    expect(resolveBrandText('admin', 1, null, [])).toBe(PRODUCT_NAME);
    expect(resolveBrandText('instructor', null, 1, [])).toBe(PRODUCT_NAME);
  });

  it('muestra el producto si la secretaria no tiene branchId', () => {
    expect(resolveBrandText('secretaria', null, null, branches)).toBe(PRODUCT_NAME);
    expect(resolveBrandText('secretaria', null, undefined, branches)).toBe(PRODUCT_NAME);
  });
});
