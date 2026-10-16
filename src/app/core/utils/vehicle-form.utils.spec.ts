import {
  isKmDecrease,
  isValidLicensePlate,
  maxVehicleYear,
  normalizeLicensePlate,
  vehicleSaveErrorMessage,
} from './vehicle-form.utils';

describe('vehicle-form.utils (hotfix-075-b)', () => {
  describe('normalizeLicensePlate', () => {
    it.each([
      ['abcd12', 'ABCD12'],
      ['AB-CD-12', 'ABCD12'],
      [' ab 12.34 ', 'AB1234'],
      ['ABCD·12', 'ABCD12'],
      ['', ''],
    ])('"%s" → "%s"', (raw, esperado) => {
      expect(normalizeLicensePlate(raw)).toBe(esperado);
    });
  });

  describe('isValidLicensePlate', () => {
    it.each([['AB1234'], ['ABCD12'], ['ZZ4103']])('"%s" es válida', (plate) => {
      expect(isValidLicensePlate(plate)).toBe(true);
    });

    it.each([
      ['ABC123', '3 letras + 3 números no existe'],
      ['ABCD123', 'sobra un carácter'],
      ['AB123', 'falta un carácter'],
      ['abcd12', 'sin normalizar'],
      ['AB-1234', 'con guion'],
      ['123456', 'solo números'],
      ['', 'vacía'],
    ])('"%s" no es válida: %s', (plate) => {
      expect(isValidLicensePlate(plate)).toBe(false);
    });

    it('una patente ya guardada que no se cambió se respeta aunque sea de otro formato', () => {
      expect(isValidLicensePlate('SEED101', 'SEED101')).toBe(true);
      expect(isValidLicensePlate('SEED102', 'SEED101')).toBe(false);
    });
  });

  it('maxVehicleYear: el año próximo (los modelos salen un año antes)', () => {
    expect(maxVehicleYear(2026)).toBe(2027);
  });

  describe('isKmDecrease', () => {
    it.each([
      [45000, 44999, true],
      [45000, 45000, false],
      [45000, 45001, false],
      [0, 0, false],
      [null, 100, false], // alta: no hay kilometraje anterior
      [45000, null, false], // campo vacío: lo resuelve la validación de requerido
    ] as [number | null, number | null, boolean][])(
      'registrado %s → nuevo %s: %s',
      (anterior, nuevo, esperado) => {
        expect(isKmDecrease(anterior, nuevo)).toBe(esperado);
      },
    );
  });
});

describe('vehicleSaveErrorMessage (hotfix-078-b)', () => {
  it('patente duplicada (23505) → mensaje con la patente', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "vehicles_license_plate_key"',
    };
    expect(vehicleSaveErrorMessage(error, 'ABCD43')).toBe(
      'Ya existe un vehículo con la patente ABCD43.',
    );
  });

  it('cualquier otro error → null (lo resuelve el sanitizador)', () => {
    expect(vehicleSaveErrorMessage({ code: '42501', message: 'rls' }, 'ABCD43')).toBeNull();
    expect(vehicleSaveErrorMessage(new Error('x'), 'ABCD43')).toBeNull();
    expect(vehicleSaveErrorMessage(null, 'ABCD43')).toBeNull();
  });
});
