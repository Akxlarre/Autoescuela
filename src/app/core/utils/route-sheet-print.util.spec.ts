import { describe, it, expect } from 'vitest';
import { buildRouteSheetHtml } from './route-sheet-print.util';

describe('buildRouteSheetHtml', () => {
  it('incluye las 11 filas de la grilla horaria 08:00–18:00', () => {
    const html = buildRouteSheetHtml();
    const rowCount = (html.match(/class="sheet-row"/g) ?? []).length;
    expect(rowCount).toBe(11);
    expect(html).toContain('>08:00<');
    expect(html).toContain('>18:00<');
  });

  it('incluye la patente, el vehículo, el instructor y la sede cuando se proporcionan', () => {
    const html = buildRouteSheetHtml({
      licensePlate: 'ABCD43',
      vehicleLabel: 'Kia Morning 2018',
      instructorName: 'Juan Carlos González',
      branchLabel: 'Autoescuela Chillán',
    });
    expect(html).toContain('ABCD43');
    expect(html).toContain('Kia Morning 2018');
    expect(html).toContain('Juan Carlos González');
    expect(html).toContain('Autoescuela Chillán');
  });

  it('deja líneas en blanco cuando faltan los datos del vehículo/instructor/sede', () => {
    const html = buildRouteSheetHtml();
    // Vehículo vacío + instructor vacío + sede vacía = 3 "blank"
    const blanks = (html.match(/class="blank"/g) ?? []).length;
    expect(blanks).toBe(3);
  });

  it('no incluye el paréntesis del vehículo si falta vehicleLabel', () => {
    const html = buildRouteSheetHtml({ licensePlate: 'XXYZ34' });
    expect(html).toContain('XXYZ34');
    expect(html).not.toContain('XXYZ34 (');
  });

  it('escapa caracteres HTML para evitar inyección', () => {
    const html = buildRouteSheetHtml({ instructorName: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
