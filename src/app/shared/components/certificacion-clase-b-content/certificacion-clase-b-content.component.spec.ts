import { TestBed } from '@angular/core/testing';
import { CertificacionClaseBContentComponent } from './certificacion-clase-b-content.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { CertificacionAlumnoRow } from '@core/models/ui/certificacion-clase-b.model';

/** Input signals no se pueden mutar vía setInput() sin detectChanges (excluido en vitest.config.ts
 *  por la limitación de compilación de templates) — se reemplaza el signal directamente. */
function stubIsAdmin(component: CertificacionClaseBContentComponent, value: boolean): void {
  (component as unknown as { isAdmin: () => boolean }).isAdmin = () => value;
}

function makeAlumno(over: Partial<CertificacionAlumnoRow> = {}): CertificacionAlumnoRow {
  return {
    enrollmentId: 1,
    studentId: 1,
    nombre: 'Juan Pérez',
    rut: '11.111.111-1',
    curso: 'Clase B',
    clasesCompletadas: 12,
    clasesTotales: 12,
    fechaTermino: '2026-01-01',
    pctAsistenciaTeoria: null,
    certificadoId: null,
    certificadoFolio: null,
    certificadoStatus: 'pendiente',
    storagePath: null,
    emailEnviado: false,
    email: 'juan@test.cl',
    ...over,
  };
}

describe('CertificacionClaseBContentComponent — bypass de prácticas incompletas', () => {
  let component: CertificacionClaseBContentComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CertificacionClaseBContentComponent],
      providers: [{ provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } }],
    });
    component = TestBed.createComponent(CertificacionClaseBContentComponent).componentInstance;
  });

  it('con prácticas completas, emite directamente sin importar el rol', () => {
    stubIsAdmin(component, false);
    const emitSpy = vi.spyOn(component.generarCertificado, 'emit');
    const alumno = makeAlumno({ clasesCompletadas: 12, clasesTotales: 12 });

    component.onClickGenerar(alumno);

    expect(emitSpy).toHaveBeenCalledWith(alumno.enrollmentId);
    expect(component.pendingConfirmId()).toBeNull();
  });

  it('con prácticas incompletas y admin, abre la confirmación en vez de emitir de inmediato', () => {
    stubIsAdmin(component, true);
    const emitSpy = vi.spyOn(component.generarCertificado, 'emit');
    const alumno = makeAlumno({ clasesCompletadas: 1, clasesTotales: 12 });

    component.onClickGenerar(alumno);

    expect(emitSpy).not.toHaveBeenCalled();
    expect(component.pendingConfirmId()).toBe(alumno.enrollmentId);
  });

  it('confirmarGenerar tras el bypass admin sí emite y limpia el estado', () => {
    stubIsAdmin(component, true);
    const emitSpy = vi.spyOn(component.generarCertificado, 'emit');
    const alumno = makeAlumno({ clasesCompletadas: 1, clasesTotales: 12 });

    component.onClickGenerar(alumno);
    component.confirmarGenerar();

    expect(emitSpy).toHaveBeenCalledWith(alumno.enrollmentId);
    expect(component.pendingConfirmId()).toBeNull();
  });

  it('con prácticas incompletas y secretaria (no admin), bloquea sin emitir ni abrir confirmación', () => {
    stubIsAdmin(component, false);
    const emitSpy = vi.spyOn(component.generarCertificado, 'emit');
    const alumno = makeAlumno({ clasesCompletadas: 1, clasesTotales: 12 });

    component.onClickGenerar(alumno);

    expect(emitSpy).not.toHaveBeenCalled();
    expect(component.pendingConfirmId()).toBeNull();
  });
});
