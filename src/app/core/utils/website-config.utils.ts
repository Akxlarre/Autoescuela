import type { WhyUsConfig } from '@core/models/dto/website-config.model';

/** Pestañas de Configuración web, en el orden de la pantalla. */
export type ConfigWebTab = 'general' | 'hero' | 'cursos' | 'promo' | 'contacto' | 'faqs';

/** Secciones del formulario que muestra cada pestaña. */
const TAB_SECTIONS: readonly [ConfigWebTab, readonly string[]][] = [
  ['general', ['brand', 'social']],
  ['hero', ['hero']],
  ['cursos', ['courses', 'pricingFooter']],
  ['promo', ['promo']],
  ['contacto', ['contact', 'hours']],
  ['faqs', ['faqs']],
];

/**
 * Pestañas con algún campo inválido (fix-492-m). Antes el pie solo decía "existen errores" y no
 * había cómo saber en qué pestaña buscar.
 */
export function configTabsWithErrors(form: {
  controls: Record<string, { invalid: boolean } | undefined>;
}): ConfigWebTab[] {
  return TAB_SECTIONS.filter(([, sections]) => sections.some((s) => form.controls[s]?.invalid)).map(
    ([tab]) => tab,
  );
}

/**
 * Textos de "Por qué elegirnos" para una sede que todavía no tiene ninguno guardado.
 * Son los mismos que Configuración web publicaba fijos antes de fix-491-m.
 */
export const DEFAULT_WHY_US: readonly WhyUsConfig[] = [
  {
    icon: 'shield-check',
    title: 'Seguridad Primero',
    description: 'Pedaleras de doble comando homologadas para tu total seguridad.',
  },
  {
    icon: 'target',
    title: 'Alta Aprobación',
    description:
      'Métodos prácticos diseñados para aprobar a la primera en la Dirección de Tránsito de Chillán.',
  },
  {
    icon: 'map-pin',
    title: 'Cerca del Examen',
    description:
      'Nuestras clases de conducción cubren los recorridos y calles de examen habituales.',
  },
  {
    icon: 'calendar',
    title: 'Horarios Flexibles',
    description:
      'Programamos tus horas prácticas de lunes a sábado en bloques que se acomodan a ti.',
  },
  {
    icon: 'car',
    title: 'Flota Moderna',
    description: 'Vehículos nuevos y confortables, garantizando un aprendizaje ameno y seguro.',
  },
  {
    icon: 'credit-card',
    title: 'Facilidades de Pago',
    description: 'Paga con tarjeta de crédito, débito o transferencia electrónica.',
  },
];

/**
 * "Por qué elegirnos" que se publica al guardar Configuración web (fix-491-m).
 *
 * El panel no edita esa sección: se publica lo que la sede ya tiene. Antes se reemplazaba en
 * cada guardado por textos fijos y se perdía cualquier contenido propio.
 */
export function whyUsToPublish(guardado: readonly WhyUsConfig[] | null | undefined): WhyUsConfig[] {
  return guardado && guardado.length > 0
    ? guardado.map((item) => ({ ...item }))
    : DEFAULT_WHY_US.map((item) => ({ ...item }));
}
