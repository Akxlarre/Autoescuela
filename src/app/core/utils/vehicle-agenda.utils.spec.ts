import { buildVehicleAgenda, type AgendaClassInput } from './vehicle-agenda.utils';

const clase = (hora: string, extra: Partial<AgendaClassInput> = {}): AgendaClassInput => {
  const [hour, minute] = hora.split(':').map(Number);
  return {
    hour,
    minute,
    durationMin: 50,
    status: 'scheduled',
    classNumber: 1,
    studentName: `Alumno ${hora}`,
    ...extra,
  };
};

describe('buildVehicleAgenda (fix-221-b)', () => {
  it('sin clases ni mantenimientos, la agenda queda vacía', () => {
    expect(buildVehicleAgenda([], [])).toEqual([]);
  });

  it('F1: cada clase lleva su hora real de inicio y de término', () => {
    const [slot] = buildVehicleAgenda([clase('11:50', { durationMin: 50, classNumber: 4 })], []);
    expect(slot).toMatchObject({
      type: 'class',
      hour: '11:50',
      endHour: '12:40',
      classNumber: 4,
      studentName: 'Alumno 11:50',
    });
  });

  it('F2: dos clases en la misma hora "en punto" aparecen las dos (antes una pisaba a la otra)', () => {
    const slots = buildVehicleAgenda([clase('11:50'), clase('11:00')], []);
    expect(slots.map((s) => s.hour)).toEqual(['11:00', '11:50']);
  });

  it('F1: las clases de la tarde y de la noche aparecen (antes el día terminaba a las 17)', () => {
    const slots = buildVehicleAgenda(
      [clase('21:30'), clase('18:20'), clase('08:00'), clase('19:10')],
      [],
    );
    expect(slots.map((s) => s.hour)).toEqual(['08:00', '18:20', '19:10', '21:30']);
  });

  it('F3: las clases canceladas no aparecen; las demás sí', () => {
    const slots = buildVehicleAgenda(
      [
        clase('09:00', { status: 'cancelled' }),
        clase('10:00', { status: 'completed' }),
        clase('11:00', { status: 'no_show' }),
        clase('12:00', { status: 'in_progress' }),
      ],
      [],
    );
    expect(slots.map((s) => s.hour)).toEqual(['10:00', '11:00', '12:00']);
  });

  it('F4: los mantenimientos del día van primero, con su descripción', () => {
    const slots = buildVehicleAgenda(
      [clase('09:00')],
      [
        { type: 'Cambio de aceite', description: 'Taller Los Robles' },
        { type: null, description: null },
      ],
    );
    expect(slots.map((s) => s.type)).toEqual(['maintenance', 'maintenance', 'class']);
    expect(slots[0]).toMatchObject({
      hour: 'Día',
      description: 'Cambio de aceite — Taller Los Robles',
    });
    expect(slots[1]).toMatchObject({ hour: 'Día', description: 'Mantenimiento programado' });
  });

  it('sin duración registrada se asume la clase estándar de 50 minutos', () => {
    const [slot] = buildVehicleAgenda([clase('23:30', { durationMin: null })], []);
    expect(slot.endHour).toBe('00:20');
  });

  it('sin nombre de alumno se muestra "Alumno"', () => {
    const [slot] = buildVehicleAgenda([clase('09:00', { studentName: null })], []);
    expect(slot.studentName).toBe('Alumno');
  });
});
