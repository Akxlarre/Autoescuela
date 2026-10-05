import { hasUnsavedPersonalData } from './enrollment-unsaved.utils';
import type { EnrollmentPersonalData } from '@core/models/ui/enrollment-personal-data.model';

function form(overrides: Partial<EnrollmentPersonalData> = {}): EnrollmentPersonalData {
  return {
    rut: '',
    firstNames: '',
    paternalLastName: '',
    maternalLastName: '',
    email: '',
    phone: '',
    birthDate: '',
    gender: 'M',
    address: '',
    courseCategory: 'non-professional',
    courseType: 'class_b',
    singularCourseCode: null,
    senceCode: null,
    currentLicense: null,
    licenseDate: null,
    convalidatesSimultaneously: false,
    historicalPromotionId: null,
    validationBook: null,
    courses: [],
    ...overrides,
  };
}

describe('hasUnsavedPersonalData (fix-310-m)', () => {
  it('un formulario igual al guardado no tiene nada sin guardar', () => {
    expect(hasUnsavedPersonalData(form(), form())).toBe(false);
    expect(
      hasUnsavedPersonalData(form({ rut: '11.111.111-1' }), form({ rut: '11.111.111-1' })),
    ).toBe(false);
  });

  it.each([
    ['rut', '11.111.111-1'],
    ['firstNames', 'Ana'],
    ['paternalLastName', 'Soto'],
    ['maternalLastName', 'Rojas'],
    ['email', 'ana@ejemplo.cl'],
    ['phone', '+56911112222'],
    ['birthDate', '1995-01-15'],
    ['address', 'Calle 1'],
    ['senceCode', '12-3456-78'],
    ['licenseDate', '2020-05-01'],
  ] as const)('escribir en %s cuenta como dato sin guardar', (field, value) => {
    expect(hasUnsavedPersonalData(form({ [field]: value }), form())).toBe(true);
  });

  it('borrar un dato que estaba guardado también cuenta', () => {
    expect(hasUnsavedPersonalData(form(), form({ firstNames: 'Ana' }))).toBe(true);
  });

  it('solo espacios, o vacío contra null, no es haber escrito algo', () => {
    expect(hasUnsavedPersonalData(form({ firstNames: '   ', senceCode: '' }), form())).toBe(false);
  });

  it('elegir sexo, tipo de licencia o curso no cuenta: no es texto escrito', () => {
    const elegido = form({
      gender: 'F',
      courseCategory: 'professional',
      courseType: 'professional_a2',
      currentLicense: 'B',
      convalidatesSimultaneously: true,
    });

    expect(hasUnsavedPersonalData(elegido, form())).toBe(false);
  });

  it('la lista de cursos cargada no cuenta', () => {
    const conCursos = form({ courses: [{ id: 1 } as EnrollmentPersonalData['courses'][number]] });

    expect(hasUnsavedPersonalData(conCursos, form())).toBe(false);
  });
});
