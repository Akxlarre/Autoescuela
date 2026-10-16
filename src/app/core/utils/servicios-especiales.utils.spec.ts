import { FormControl } from '@angular/forms';
import type { ServicioEspecial } from '@core/models/ui/servicios-especiales.model';
import {
  buscarServicioDuplicado,
  mensajeServicioDuplicado,
  montoEntero,
  noSoloEspacios,
} from './servicios-especiales.utils';

function servicio(over: Partial<ServicioEspecial> = {}): ServicioEspecial {
  return {
    id: 1,
    nombre: 'Psicotécnico',
    descripcion: '',
    precio: 20000,
    icono: 'brain',
    color: 'indigo',
    activo: true,
    ...over,
  };
}

describe('buscarServicioDuplicado (fix-436-m)', () => {
  const catalogo = [
    servicio({ id: 1, nombre: 'Psicotécnico' }),
    servicio({ id: 2, nombre: 'Uso de Simulador', activo: false }),
  ];

  it('encuentra el mismo nombre sin distinguir mayúsculas ni espacios de más', () => {
    expect(buscarServicioDuplicado(catalogo, '  psicotécnico ')?.id).toBe(1);
    expect(buscarServicioDuplicado(catalogo, 'USO  DE simulador')?.id).toBe(2);
  });

  it('un nombre distinto no es duplicado', () => {
    expect(buscarServicioDuplicado(catalogo, 'Informe médico')).toBeNull();
  });

  it('al editar, el propio servicio no cuenta como duplicado', () => {
    expect(buscarServicioDuplicado(catalogo, 'Psicotécnico', 1)).toBeNull();
    expect(buscarServicioDuplicado(catalogo, 'Psicotécnico', 2)?.id).toBe(1);
  });
});

describe('mensajeServicioDuplicado (fix-436-m)', () => {
  it('si el duplicado está inactivo, sugiere reactivarlo', () => {
    expect(mensajeServicioDuplicado(servicio({ nombre: 'Uso de Simulador', activo: false }))).toBe(
      'Ya existe el servicio "Uso de Simulador", inactivo. Reactívalo desde "Mostrar inactivos" en vez de crear otro.',
    );
  });

  it('si está activo, avisa que ya existe', () => {
    expect(mensajeServicioDuplicado(servicio({ nombre: 'Psicotécnico' }))).toBe(
      'Ya existe un servicio llamado "Psicotécnico".',
    );
  });
});

describe('montoEntero (hotfix-158-m)', () => {
  it('rechaza decimales: las columnas de monto son enteras', () => {
    expect(montoEntero(new FormControl(1500.5))).toEqual({ montoEntero: true });
  });

  it('acepta enteros y deja el vacío a Validators.required', () => {
    expect(montoEntero(new FormControl(1500))).toBeNull();
    expect(montoEntero(new FormControl(null))).toBeNull();
  });
});

describe('noSoloEspacios (fix-436-m)', () => {
  it('rechaza un texto de solo espacios', () => {
    expect(noSoloEspacios(new FormControl('   '))).toEqual({ soloEspacios: true });
  });

  it('acepta texto real y deja el vacío a Validators.required', () => {
    expect(noSoloEspacios(new FormControl(' Simulador '))).toBeNull();
    expect(noSoloEspacios(new FormControl(''))).toBeNull();
    expect(noSoloEspacios(new FormControl(null))).toBeNull();
  });
});
