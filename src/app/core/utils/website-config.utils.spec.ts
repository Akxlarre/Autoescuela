import { describe, expect, it } from 'vitest';

import { FormBuilder, FormControl } from '@angular/forms';

import {
  configTabsWithErrors,
  courseCardControls,
  courseOverrideValidator,
  DEFAULT_WHY_US,
  domainValidator,
  googleMapsEmbedValidator,
  httpUrlValidator,
  promoTextValidator,
  whatsappValidator,
  whyUsToPublish,
} from './website-config.utils';

// fix-493-m: precio promocional y promo activa con la validación que la pantalla promete.
describe('fix-493-m', () => {
  const fb = new FormBuilder();
  const card = (priceOverride: number | null = null) =>
    fb.group(
      courseCardControls({
        course_id: 1,
        description: 'd',
        duration: '4 semanas',
        includes: ['a'],
        priceOverride,
      }),
      { validators: courseOverrideValidator },
    );

  it('una card sin precio promo arranca con la casilla desmarcada y es válida', () => {
    const g = card();
    expect(g.get('overrideEnabled')?.value).toBe(false);
    expect(g.valid).toBe(true);
  });

  it('una card con precio promo guardado arranca con la casilla marcada', () => {
    expect(card(150000).get('overrideEnabled')?.value).toBe(true);
    expect(card(0).get('overrideEnabled')?.value).toBe(true);
  });

  it('casilla marcada sin precio es inválida', () => {
    const g = card();
    g.get('overrideEnabled')?.setValue(true);
    expect(g.hasError('overrideRequired')).toBe(true);
  });

  it('un precio negativo es inválido; 0 ("Gratis") vale', () => {
    const g = card(-5000);
    expect(g.get('priceOverride')?.hasError('min')).toBe(true);
    g.get('priceOverride')?.setValue(0);
    expect(g.valid).toBe(true);
  });

  it('casilla desmarcada no exige precio', () => {
    const g = card(-5000);
    g.get('overrideEnabled')?.setValue(false);
    g.get('priceOverride')?.setValue(null);
    expect(g.valid).toBe(true);
  });

  const promo = (v: Record<string, unknown>) =>
    fb.group(
      { active: [false], title: [''], badge: [''], description: [''], ...v },
      { validators: promoTextValidator },
    );

  it('promo inactiva no exige texto', () => {
    expect(promo({}).valid).toBe(true);
  });

  it('promo activa exige título, etiqueta y detalle', () => {
    expect(
      promo({ active: [true], title: ['15%'], badge: ['Oferta'] }).hasError('promoTextRequired'),
    ).toBe(true);
    expect(promo({ active: [true], title: ['  '], badge: ['b'], description: ['d'] }).valid).toBe(
      false,
    );
    expect(promo({ active: [true], title: ['t'], badge: ['b'], description: ['d'] }).valid).toBe(
      true,
    );
  });
});

// fix-492-m: el pie y las pestañas dicen dónde está el error (P02 de fix-485-m).
describe('configTabsWithErrors', () => {
  const form = (invalid: string[]) => ({
    controls: Object.fromEntries(
      [
        'brand',
        'social',
        'hero',
        'courses',
        'pricingFooter',
        'promo',
        'contact',
        'hours',
        'faqs',
      ].map((k) => [k, { invalid: invalid.includes(k) }]),
    ),
  });

  it('sin errores no marca ninguna pestaña', () => {
    expect(configTabsWithErrors(form([]))).toEqual([]);
  });

  it('cada sección marca su pestaña, en el orden de la pantalla', () => {
    expect(configTabsWithErrors(form(['hours', 'social']))).toEqual(['general', 'contacto']);
    expect(configTabsWithErrors(form(['pricingFooter']))).toEqual(['cursos']);
    expect(configTabsWithErrors(form(['faqs', 'promo', 'hero']))).toEqual([
      'hero',
      'promo',
      'faqs',
    ]);
  });
});

// fix-491-m: publicar ya no pisa "Por qué elegirnos" (S16 de fix-485-m, decisión D3).
describe('whyUsToPublish', () => {
  it('conserva lo que la sede tiene guardado', () => {
    const propio = [{ icon: 'star', title: 'Propio', description: 'Texto de la sede' }];
    expect(whyUsToPublish(propio)).toEqual(propio);
  });

  it('sin nada guardado usa los textos por defecto', () => {
    expect(whyUsToPublish(undefined)).toEqual(DEFAULT_WHY_US);
    expect(whyUsToPublish([])).toEqual(DEFAULT_WHY_US);
  });

  it('los textos por defecto usan íconos Lucide, no emojis', () => {
    for (const item of DEFAULT_WHY_US) {
      expect(item.icon).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

// fix-500-m: URLs y formatos de la web. La landing pone estas URLs en un iframe y en enlaces:
// un "javascript:" se ejecutaba en la página pública.
describe('validadores de formato (fix-500-m)', () => {
  const ctrl = (value: unknown) => new FormControl(value);

  it('dominio: nombre sin protocolo, sin espacios ni rutas', () => {
    expect(domainValidator(ctrl('autoescuelachillan.cl'))).toBeNull();
    expect(domainValidator(ctrl('www.conductores-chillan.cl'))).toBeNull();
    expect(domainValidator(ctrl('https://autoescuelachillan.cl'))).toEqual({ domain: true });
    expect(domainValidator(ctrl('autoescuela chillan.cl'))).toEqual({ domain: true });
    expect(domainValidator(ctrl('autoescuelachillan'))).toEqual({ domain: true });
    expect(domainValidator(ctrl(''))).toBeNull(); // vacío lo cubre "required"
  });

  it('URL http(s): rechaza javascript: y texto suelto; vacío vale', () => {
    expect(httpUrlValidator(ctrl('https://facebook.com/autoescuela'))).toBeNull();
    expect(httpUrlValidator(ctrl(''))).toBeNull();
    expect(httpUrlValidator(ctrl("javascript:alert('x')"))).toEqual({ httpUrl: true });
    expect(httpUrlValidator(ctrl('facebook.com/autoescuela'))).toEqual({ httpUrl: true });
  });

  it('WhatsApp: 8 a 15 dígitos, con + y espacios opcionales', () => {
    expect(whatsappValidator(ctrl('+56912345678'))).toBeNull();
    expect(whatsappValidator(ctrl('56 9 1234 5678'))).toBeNull();
    expect(whatsappValidator(ctrl('9123abc'))).toEqual({ whatsapp: true });
    expect(whatsappValidator(ctrl('1234'))).toEqual({ whatsapp: true });
  });

  it('mapa: solo el embed de Google Maps por https', () => {
    expect(googleMapsEmbedValidator(ctrl('https://www.google.com/maps/embed?pb=!1m18'))).toBeNull();
    expect(googleMapsEmbedValidator(ctrl("javascript:alert('x')"))).toEqual({ mapEmbed: true });
    expect(googleMapsEmbedValidator(ctrl('https://evil.example/maps/embed'))).toEqual({
      mapEmbed: true,
    });
  });
});
