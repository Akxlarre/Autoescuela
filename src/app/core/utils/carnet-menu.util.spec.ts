import { buildCarnetMenu } from './carnet-menu.util';

describe('buildCarnetMenu', () => {
  const byId = (menu: ReturnType<typeof buildCarnetMenu>, id: string) =>
    menu.find((i) => i.id === id)!;

  it('emite dos headers + cuatro acciones (6 ítems)', () => {
    const menu = buildCarnetMenu({ initialPath: null, fullPath: null, primeras6Completadas: 0 });
    expect(menu).toHaveLength(6);
    expect(byId(menu, 'carnet-6-header').header).toBe(true);
    expect(byId(menu, 'carnet-12-header').header).toBe(true);
  });

  describe('carnet de 6 clases', () => {
    it('label "Generar" cuando aún no existe y "Ver" deshabilitado', () => {
      const menu = buildCarnetMenu({ initialPath: null, fullPath: null, primeras6Completadas: 0 });
      expect(byId(menu, 'generar-carnet-6').label).toBe('Generar Carnet 6 clases');
      expect(byId(menu, 'ver-carnet-6').disabled).toBe(true);
    });

    it('label "Volver a generar" y "Ver" habilitado cuando ya existe', () => {
      const menu = buildCarnetMenu({
        initialPath: 'path/6.pdf',
        fullPath: null,
        primeras6Completadas: 0,
      });
      expect(byId(menu, 'generar-carnet-6').label).toBe('Volver a generar Carnet 6 clases');
      expect(byId(menu, 'ver-carnet-6').disabled).toBe(false);
    });
  });

  describe('carnet de 12 clases', () => {
    it('está bloqueado e informa cuántas faltan si no completó las primeras 6', () => {
      const menu = buildCarnetMenu({ initialPath: null, fullPath: null, primeras6Completadas: 4 });
      const gen12 = byId(menu, 'generar-carnet-12');
      expect(gen12.disabled).toBe(true);
      expect(gen12.hint).toBe('faltan 2 de las primeras 6 clases');
    });

    it('se habilita (sin hint) al completar exactamente las primeras 6', () => {
      const menu = buildCarnetMenu({ initialPath: null, fullPath: null, primeras6Completadas: 6 });
      const gen12 = byId(menu, 'generar-carnet-12');
      expect(gen12.disabled).toBe(false);
      expect(gen12.hint).toBeUndefined();
      expect(gen12.label).toBe('Generar Carnet 12 clases');
    });

    it('"Ver 12" sólo se habilita cuando el carnet completo ya existe', () => {
      const sinFull = buildCarnetMenu({
        initialPath: 'p6.pdf',
        fullPath: null,
        primeras6Completadas: 6,
      });
      expect(byId(sinFull, 'ver-carnet-12').disabled).toBe(true);

      const conFull = buildCarnetMenu({
        initialPath: 'p6.pdf',
        fullPath: 'p12.pdf',
        primeras6Completadas: 12,
      });
      expect(byId(conFull, 'ver-carnet-12').disabled).toBe(false);
      expect(byId(conFull, 'generar-carnet-12').label).toBe('Volver a generar Carnet 12 clases');
    });
  });

  describe('Refuerzo Clase B (isReinforcement) — spec 0006-m', () => {
    it('omite por completo la sección de 12 clases (solo 3 ítems, sin headers de 12)', () => {
      const menu = buildCarnetMenu({
        initialPath: null,
        fullPath: null,
        primeras6Completadas: 0,
        isReinforcement: true,
      });
      expect(menu).toHaveLength(3);
      expect(menu.find((i) => i.id === 'carnet-12-header')).toBeUndefined();
      expect(menu.find((i) => i.id === 'generar-carnet-12')).toBeUndefined();
      expect(menu.find((i) => i.id === 'ver-carnet-12')).toBeUndefined();
    });

    it('el carnet de 6 clases se comporta idéntico a Clase B estándar', () => {
      const menu = buildCarnetMenu({
        initialPath: 'path/6.pdf',
        fullPath: null,
        primeras6Completadas: 6,
        isReinforcement: true,
      });
      expect(byId(menu, 'generar-carnet-6').label).toBe('Volver a generar Carnet 6 clases');
      expect(byId(menu, 'ver-carnet-6').disabled).toBe(false);
    });

    it('isReinforcement=false (default) mantiene el comportamiento previo — regresión', () => {
      const menu = buildCarnetMenu({ initialPath: null, fullPath: null, primeras6Completadas: 0 });
      expect(menu).toHaveLength(6);
    });
  });
});
