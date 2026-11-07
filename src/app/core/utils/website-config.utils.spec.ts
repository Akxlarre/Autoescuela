import { describe, expect, it } from 'vitest';

import { configTabsWithErrors, DEFAULT_WHY_US, whyUsToPublish } from './website-config.utils';

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
