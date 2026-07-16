import { signal } from '@angular/core';
import type { AlertaFaltaConsecutiva } from '@core/models/ui/asistencia-clase-b.model';
import { TestBed } from '@angular/core/testing';
import { AsistenciaClaseBContentComponent } from './asistencia-clase-b-content.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { ClasePracticaRow } from '@core/models/ui/asistencia-clase-b.model';

function makeRow(over: Partial<ClasePracticaRow> = {}): ClasePracticaRow {
  return {
    id: 1,
    enrollmentId: 10,
    studentId: 5,
    classNumber: 1,
    horaInicio: '09:00',
    horaInicioReal: null,
    horaFinReal: null,
    instructorId: 3,
    instructorName: 'Inst',
    alumnoName: 'Juan Pérez',
    status: 'ausente',
    justificacion: null,
    branchId: 1,
    branchName: 'Chillán',
    scheduledAt: '2026-06-30T09:00:00',
    kmStart: null,
    vehiclePlate: null,
    vehicleBrand: null,
    vehicleModel: null,
    vehicleId: null,
    vehicleCurrentKm: null,
    ...over,
  };
}

describe('AsistenciaClaseBContentComponent — badge de estado', () => {
  let component: AsistenciaClaseBContentComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AsistenciaClaseBContentComponent],
      providers: [
        {
          provide: GsapAnimationsService,
          useValue: { animateBentoGrid: vi.fn() },
        },
      ],
    });
    component = TestBed.createComponent(AsistenciaClaseBContentComponent).componentInstance;
  });

  it('etiqueta una inasistencia sin justificar como "Ausente"', () => {
    const row = makeRow({ status: 'ausente', justificacion: null });
    expect((component as any).isJustificada(row)).toBe(false);
    expect((component as any).statusBadgeLabel(row)).toBe('Ausente');
  });

  it('etiqueta una inasistencia justificada como "Justificada"', () => {
    const row = makeRow({ status: 'ausente', justificacion: 'Certificado médico' });
    expect((component as any).isJustificada(row)).toBe(true);
    expect((component as any).statusBadgeLabel(row)).toBe('Justificada');
    expect((component as any).statusBadgeIcon(row)).toBe('shield-check');
  });

  it('no confunde "presente" con justificada aunque tenga texto residual', () => {
    const row = makeRow({ status: 'presente', justificacion: null });
    expect((component as any).isJustificada(row)).toBe(false);
    expect((component as any).statusBadgeLabel(row)).toBe('Presente');
  });
});

function makeAlerta(over: Partial<AlertaFaltaConsecutiva> = {}): AlertaFaltaConsecutiva {
  return {
    studentId: 1,
    enrollmentId: 10,
    alumnoName: 'Erling Haaland',
    faltasConsecutivas: 2,
    nivel: 'danger',
    ultimaFechaFalta: '2026-07-14T09:33:41.902234+00:00',
    horarioActivo: true,
    branchId: 1,
    branchName: 'Chillán',
    ...over,
  };
}

describe('AsistenciaClaseBContentComponent — alerta compacta (fix post-QA visual, spec 0030)', () => {
  let component: AsistenciaClaseBContentComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AsistenciaClaseBContentComponent],
      providers: [
        {
          provide: GsapAnimationsService,
          useValue: { animateBentoGrid: vi.fn() },
        },
      ],
    });
    component = TestBed.createComponent(AsistenciaClaseBContentComponent).componentInstance;
  });

  it('formatIsoDate acepta un timestamp ISO completo (timestamptz real de Supabase)', () => {
    // Bug real encontrado en QA: recorded_at/scheduled_at son timestamptz,
    // no date-only — un split('-') ingenuo producía "07T09:33:41...-07-2026".
    expect((component as any).formatIsoDate('2026-07-14T09:33:41.902234+00:00')).toBe('14-07-2026');
  });

  it('formatIsoDate sigue aceptando date-only "YYYY-MM-DD" (compatibilidad)', () => {
    expect((component as any).formatIsoDate('2026-07-14')).toBe('14-07-2026');
  });

  it('alertaTooltip de nivel danger incluye última falta y política', () => {
    const tooltip = (component as any).alertaTooltip(makeAlerta({ nivel: 'danger' }));
    expect(tooltip).toContain('Erling Haaland — 2 faltas consecutivas');
    expect(tooltip).toContain('Última falta: 14-07-2026');
    expect(tooltip).toContain('acción manual requerida');
  });

  it('alertaTooltip de nivel warning no incluye última falta ni política', () => {
    const tooltip = (component as any).alertaTooltip(
      makeAlerta({ nivel: 'warning', faltasConsecutivas: 1 }),
    );
    expect(tooltip).toContain('1 falta consecutiva');
    expect(tooltip).not.toContain('Última falta');
    expect(tooltip).toContain('Próxima inasistencia');
  });
});

describe('AsistenciaClaseBContentComponent — presupuesto de densidad (spec 0030)', () => {
  let component: AsistenciaClaseBContentComponent;
  let rowsSig: ReturnType<typeof signal<ClasePracticaRow[]>>;
  let maxSig: ReturnType<typeof signal<number | null>>;

  /** 15 filas: ids 1..15 — 10 'pendiente' + 5 'ausente'; instructor 3 (impares) / 4 (pares). */
  const rows = Array.from({ length: 15 }, (_, i) =>
    makeRow({
      id: i + 1,
      status: i < 10 ? 'pendiente' : 'ausente',
      instructorId: (i + 1) % 2 === 1 ? 3 : 4,
      alumnoName: `Alumno ${i + 1}`,
    }),
  );

  const visible = () => (component as any).visiblePracticas() as ClasePracticaRow[];
  const hasMore = () => (component as any).hasMorePracticas() as boolean;

  /**
   * Los signal inputs no son escribibles en esta infra (JIT sin el transform
   * de initializer APIs: ComponentRef.setInput y los bindings de host los
   * descartan — misma razón por la que los component specs con setInput están
   * excluidos en vitest.config). Se stubean con signal() locales: los
   * computeds leen `this.input()` en cada evaluación, así que el wiring real
   * (setters + computeds) queda cubierto sin renderizar template.
   */
  const stubInput = <T>(name: string, initial: T) => {
    const s = signal<T>(initial);
    Object.defineProperty(component, name, { value: s });
    return s;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AsistenciaClaseBContentComponent],
      providers: [
        {
          provide: GsapAnimationsService,
          useValue: { animateBentoGrid: vi.fn() },
        },
      ],
    });
    component = TestBed.createComponent(AsistenciaClaseBContentComponent).componentInstance;
    rowsSig = stubInput<ClasePracticaRow[]>('clasesPracticas', rows);
    maxSig = stubInput<number | null>('maxVisible', null);
    stubInput('selectedDate', '2026-07-12');
  });

  const setBudget = (n: number | null) => {
    maxSig.set(n);
  };

  it('sin límite (maxVisible=null, desktop) muestra todas las filas y no ofrece "Cargar más"', () => {
    setBudget(null);
    expect(visible().length).toBe(15);
    expect(hasMore()).toBe(false);
  });

  it('con maxVisible=6 recorta a 6 filas y ofrece "Cargar más"', () => {
    setBudget(6);
    expect(visible().length).toBe(6);
    expect(hasMore()).toBe(true);
    expect((component as any).remainingPracticas()).toBe(9);
  });

  it('"Cargar más" incrementa en pasos del presupuesto hasta el tope', () => {
    setBudget(6);
    (component as any).loadMorePracticas();
    expect(visible().length).toBe(12);
    (component as any).loadMorePracticas();
    expect(visible().length).toBe(15); // tope: no hay más de 15
    expect(hasMore()).toBe(false);
  });

  it('cambiar el filtro de estado resetea el contador al presupuesto base', () => {
    setBudget(6);
    (component as any).loadMorePracticas(); // 12 visibles
    (component as any).setStatusFilter('pendiente'); // 10 filtradas
    expect(visible().length).toBe(6);
  });

  it('cambiar el filtro de instructor resetea el contador al presupuesto base', () => {
    setBudget(6);
    (component as any).loadMorePracticas(); // 12 visibles
    (component as any).setInstructorFilter(3); // 8 filtradas (ids impares)
    expect(visible().length).toBe(6);
  });

  it('cambiar la fecha resetea el contador al presupuesto base', () => {
    setBudget(6);
    (component as any).loadMorePracticas(); // 12 visibles
    (component as any).onDateChange('2026-07-14');
    expect(visible().length).toBe(6);
  });

  it('salir y volver al tab Prácticas resetea el contador (roundtrip de tab)', () => {
    setBudget(6);
    (component as any).loadMorePracticas(); // 12 visibles
    (component as any).selectTab('ciclos');
    (component as any).selectTab('practicas');
    expect(visible().length).toBe(6);
  });

  it('con menos filas que el presupuesto no ofrece "Cargar más" (AC-E2)', () => {
    rowsSig.set(rows.slice(0, 4));
    setBudget(6);
    expect(visible().length).toBe(4);
    expect(hasMore()).toBe(false);
  });

  it('con cero filas no ofrece "Cargar más" (AC-E1)', () => {
    rowsSig.set([]);
    setBudget(6);
    expect(visible().length).toBe(0);
    expect(hasMore()).toBe(false);
  });

  it('los contadores de filtros siguen calculándose sobre el total, no sobre lo visible', () => {
    setBudget(6);
    expect((component as any).countByStatus('todos')).toBe(15);
    expect((component as any).countByStatus('pendiente')).toBe(10);
    expect((component as any).countByStatus('ausente')).toBe(5);
  });
});
