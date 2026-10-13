import { matchesVehicleSearch } from './vehicle-search.utils';

const YARIS = { licensePlate: 'ABCD43', brand: 'Toyota', model: 'Yaris Sedán' };

describe('matchesVehicleSearch (hotfix-073-b)', () => {
  it('sin texto, todos coinciden', () => {
    expect(matchesVehicleSearch(YARIS, '')).toBe(true);
    expect(matchesVehicleSearch(YARIS, '   ')).toBe(true);
  });

  it.each([
    ['abcd', 'patente, sin distinguir mayúsculas'],
    ['AB-CD 43', 'patente escrita con guion y espacios'],
    ['toyo', 'marca'],
    ['yaris', 'modelo'],
    ['sedan', 'modelo sin tilde'],
    ['toyota yaris', 'marca y modelo juntos'],
    ['yaris abcd', 'cada palabra puede caer en un campo distinto'],
  ])('"%s" coincide: %s', (term) => {
    expect(matchesVehicleSearch(YARIS, term)).toBe(true);
  });

  it.each([['nissan'], ['zz99'], ['toyota versa']])('"%s" no coincide', (term) => {
    expect(matchesVehicleSearch(YARIS, term)).toBe(false);
  });

  it('tolera marca o modelo vacíos', () => {
    expect(matchesVehicleSearch({ licensePlate: 'ZZ4103', brand: '', model: '' }, '4103')).toBe(
      true,
    );
  });
});
