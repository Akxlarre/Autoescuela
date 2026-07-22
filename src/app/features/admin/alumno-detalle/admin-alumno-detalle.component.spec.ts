import { resolveListadoRoute, resolveListadoLabel } from './admin-alumno-detalle.component';

describe('resolveListadoRoute — botón "volver" consciente del contexto', () => {
  it('admin + alumno class_b vuelve al listado de Clase B', () => {
    expect(resolveListadoRoute(true, 'class_b')).toBe('/app/admin/alumnos');
  });

  it('admin + alumno professional vuelve al listado de Profesionales', () => {
    expect(resolveListadoRoute(true, 'professional')).toBe('/app/admin/clase-profesional/alumnos');
  });

  it('secretaria + alumno class_b vuelve a su listado de Clase B', () => {
    expect(resolveListadoRoute(false, 'class_b')).toBe('/app/secretaria/alumnos');
  });

  it('secretaria + alumno professional vuelve a su listado de Profesionales', () => {
    expect(resolveListadoRoute(false, 'professional')).toBe('/app/secretaria/profesional/alumnos');
  });

  it('sin licenseGroup resuelto (carga/error) cae al listado por defecto del rol', () => {
    expect(resolveListadoRoute(true, undefined)).toBe('/app/admin/alumnos');
    expect(resolveListadoRoute(false, undefined)).toBe('/app/secretaria/alumnos');
  });
});

describe('resolveListadoLabel', () => {
  it('etiqueta "Listado de Alumnos Profesionales" para professional', () => {
    expect(resolveListadoLabel('professional')).toBe('Listado de Alumnos Profesionales');
  });

  it('etiqueta "Listado de Alumnos" para class_b o sin resolver', () => {
    expect(resolveListadoLabel('class_b')).toBe('Listado de Alumnos');
    expect(resolveListadoLabel(undefined)).toBe('Listado de Alumnos');
  });
});
