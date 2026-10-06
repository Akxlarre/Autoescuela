import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdminAlumnosProfesionalComponent } from './admin-alumnos-profesional.component';
import { AdminAlumnosProfesionalFacade } from '@core/facades/admin-alumnos-profesional.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { CLASE_B_ARCHIVE_WARNING } from '@core/utils/archive-confirmation.utils';

/**
 * fix-333-m (D8): archivar desde la Base Profesional archiva a la persona completa. Si también
 * tiene Clase B, la confirmación lo avisa; con clases B agendadas no se abre (regla de fix-277-m);
 * y un error al archivar no deja una promesa rechazada.
 */
describe('AdminAlumnosProfesionalComponent — archivar (fix-333-m)', () => {
  let facade: any;
  const alumno = { id: '7335', nombre: 'E2E-ProfConB', apellido: 'Prueba Profesional' };

  function create(): any {
    TestBed.overrideComponent(AdminAlumnosProfesionalComponent, { set: { template: '' } });
    return TestBed.createComponent(AdminAlumnosProfesionalComponent).componentInstance as any;
  }

  beforeEach(() => {
    facade = {
      alumnos: signal([alumno]),
      prepararArchivado: vi.fn(),
      archivarAlumno: vi.fn(),
      initialize: vi.fn(),
      dispose: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [AdminAlumnosProfesionalComponent],
      providers: [
        { provide: AdminAlumnosProfesionalFacade, useValue: facade },
        {
          provide: BranchFacade,
          useValue: { selectedBranchId: signal(2), setProfessionalOnly: vi.fn() },
        },
      ],
    });
  });

  it('si la persona también tiene Clase B, la confirmación lo avisa', async () => {
    facade.prepararArchivado.mockResolvedValue({
      permitido: true,
      hasHistory: false,
      hasClaseB: true,
    });
    const c = create();

    await c.requestArchivar('7335');

    expect(c.deleteTarget()).toEqual(alumno);
    expect(c.archiveWarning()).toBe(CLASE_B_ARCHIVE_WARNING);
  });

  it('sin Clase B no hay aviso extra', async () => {
    facade.prepararArchivado.mockResolvedValue({
      permitido: true,
      hasHistory: true,
      hasClaseB: false,
    });
    const c = create();

    await c.requestArchivar('7335');

    expect(c.archiveWarning()).toBeNull();
    expect(c.hasHistory()).toBe(true);
  });

  it('con clases de Clase B agendadas no abre la confirmación', async () => {
    facade.prepararArchivado.mockResolvedValue({
      permitido: false,
      hasHistory: false,
      hasClaseB: true,
    });
    const c = create();

    await c.requestArchivar('7335');

    expect(c.deleteTarget()).toBeNull();
  });

  it('si el archivado falla, cierra el modal sin lanzar', async () => {
    facade.prepararArchivado.mockResolvedValue({
      permitido: true,
      hasHistory: false,
      hasClaseB: true,
    });
    facade.archivarAlumno.mockResolvedValue(false);
    const c = create();
    await c.requestArchivar('7335');

    await expect(c.onConfirmArchivar()).resolves.toBeUndefined();
    expect(c.deleteTarget()).toBeNull();
    expect(c.archiveWarning()).toBeNull();
  });
});
