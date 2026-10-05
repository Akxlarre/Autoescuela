import {
  resolveCertificadoBAction,
  resolveListadoRoute,
  resolveListadoLabel,
  shouldShowEnrollmentSelector,
} from './admin-alumno-detalle.component';

describe('shouldShowEnrollmentSelector (fix-314-m)', () => {
  const cargada = { isLoading: false, hasError: false, hasAlumno: true, enrollmentCount: 2 };

  it('ficha cargada con dos o más matrículas: hay selector', () => {
    expect(shouldShowEnrollmentSelector(cargada)).toBe(true);
    expect(shouldShowEnrollmentSelector({ ...cargada, enrollmentCount: 3 })).toBe(true);
  });

  it('con una sola matrícula no hay selector', () => {
    expect(shouldShowEnrollmentSelector({ ...cargada, enrollmentCount: 1 })).toBe(false);
  });

  it('mientras carga no hay selector aunque las matrículas ya hayan llegado', () => {
    expect(shouldShowEnrollmentSelector({ ...cargada, isLoading: true })).toBe(false);
  });

  it('con error de carga o sin alumno no hay selector', () => {
    expect(shouldShowEnrollmentSelector({ ...cargada, hasError: true })).toBe(false);
    expect(shouldShowEnrollmentSelector({ ...cargada, hasAlumno: false })).toBe(false);
  });
});

describe('resolveCertificadoBAction (fix-289-m)', () => {
  it('con las prácticas completas genera sin confirmación, sea admin o secretaria', () => {
    expect(resolveCertificadoBAction(12, 12, true)).toBe('generate');
    expect(resolveCertificadoBAction(12, 12, false)).toBe('generate');
  });

  it('con prácticas incompletas el admin debe confirmar y el pedido va forzado', () => {
    expect(resolveCertificadoBAction(5, 12, true)).toBe('confirm-forced');
  });

  it('con prácticas incompletas la secretaria no puede generar', () => {
    expect(resolveCertificadoBAction(5, 12, false)).toBe('blocked');
  });

  it('un curso de refuerzo usa su propio total de clases', () => {
    expect(resolveCertificadoBAction(6, 6, false)).toBe('generate');
    expect(resolveCertificadoBAction(5, 6, true)).toBe('confirm-forced');
  });
});

// fix-278-m: "Ver todo el historial" ya no navega al listado de Pagos (resolvePagosRoute,
// fix-235-m): abre el estado de cuenta de la matrícula sin salir de la ficha.

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

  // ─── fix-084: llegó desde Ex-Alumnos → "volver" va a Ex-Alumnos, no a Base Alumnos ──
  it('admin + class_b + cameFromExAlumnos vuelve a Ex-Alumnos B (admin)', () => {
    expect(resolveListadoRoute(true, 'class_b', true)).toBe('/app/admin/ex-alumnos');
  });

  it('admin + professional + cameFromExAlumnos vuelve a Ex-Alumnos Profesional (admin)', () => {
    expect(resolveListadoRoute(true, 'professional', true)).toBe(
      '/app/admin/ex-alumnos-profesional',
    );
  });

  it('secretaria + class_b + cameFromExAlumnos vuelve a Ex-Alumnos B (secretaria)', () => {
    expect(resolveListadoRoute(false, 'class_b', true)).toBe('/app/secretaria/ex-alumnos');
  });

  it('secretaria + professional + cameFromExAlumnos vuelve a Ex-Alumnos Profesional (secretaria)', () => {
    expect(resolveListadoRoute(false, 'professional', true)).toBe(
      '/app/secretaria/ex-alumnos-profesional',
    );
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

  it('cameFromExAlumnos: etiqueta "Ex-Alumnos B" / "Ex-Alumnos Profesional" (fix-084)', () => {
    expect(resolveListadoLabel('class_b', true)).toBe('Ex-Alumnos B');
    expect(resolveListadoLabel('professional', true)).toBe('Ex-Alumnos Profesional');
  });
});
