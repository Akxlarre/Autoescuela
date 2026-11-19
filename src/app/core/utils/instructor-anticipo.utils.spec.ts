import { revisarInstructorAnticipo } from './instructor-anticipo.utils';

describe('revisarInstructorAnticipo (hotfix-189-b)', () => {
  const lista = (over = {}) => ({
    instructores: [{ id: 7, nombre: 'Ana Díaz' }],
    cargando: false,
    conError: false,
    ...over,
  });

  it('mientras carga queda bloqueado, aunque el instructor no esté en la lista vacía', () => {
    expect(revisarInstructorAnticipo(7, lista({ instructores: [], cargando: true }))).toBe(
      'bloqueado',
    );
  });

  it('con error de carga queda bloqueado', () => {
    expect(revisarInstructorAnticipo(7, lista({ instructores: [], conError: true }))).toBe(
      'bloqueado',
    );
  });

  it.each([null, ''] as const)('sin instructor elegido (%j) no hay nada que limpiar', (id) => {
    expect(revisarInstructorAnticipo(id, lista())).toBe('sin-elegir');
  });

  it('un instructor de la lista está vigente', () => {
    expect(revisarInstructorAnticipo(7, lista())).toBe('vigente');
  });

  it('un instructor que no está en la lista queda fuera', () => {
    expect(revisarInstructorAnticipo(8, lista())).toBe('fuera-de-lista');
  });

  it('con la carga terminada, una lista vacía deja fuera al instructor elegido', () => {
    expect(revisarInstructorAnticipo(7, lista({ instructores: [] }))).toBe('fuera-de-lista');
  });
});
