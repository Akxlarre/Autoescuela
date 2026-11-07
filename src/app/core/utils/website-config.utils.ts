import { Validators, type ValidatorFn } from '@angular/forms';
import type { CourseConfig, WhyUsConfig } from '@core/models/dto/website-config.model';

/**
 * Controles de una card de curso de la web (fix-493-m). Un solo lugar: antes se repetían en el
 * componente (al cargar) y en la pestaña Cursos (al agregar), y ninguno validaba el precio promo.
 *
 * `overrideEnabled` es la casilla "Personalizar precio": antes se deducía de `priceOverride != null`
 * y al borrar el número para reescribirlo la casilla se desmarcaba sola.
 */
export function courseCardControls(card?: Partial<CourseConfig>) {
  return {
    course_id: [card?.course_id ?? (null as number | null), Validators.required],
    description: [card?.description ?? '', Validators.required],
    priceNote: [card?.priceNote ?? ''],
    duration: [card?.duration ?? '', Validators.required],
    highlighted: [card?.highlighted ?? false],
    badge: [card?.badge ?? ''],
    overrideEnabled: [card?.priceOverride != null],
    priceOverride: [card?.priceOverride ?? (null as number | null), Validators.min(0)],
    displayOrder: [card?.displayOrder ?? 1],
    includes: [card?.includes ? card.includes.join(', ') : '', Validators.required],
  };
}

/** Con "Personalizar precio" marcado, el precio es obligatorio (0 = "Gratis" vale). */
export const courseOverrideValidator: ValidatorFn = (group) => {
  if (!group.get('overrideEnabled')?.value) return null;
  const price = group.get('priceOverride')?.value;
  return price === null || price === undefined || price === '' ? { overrideRequired: true } : null;
};

/** Con la promo activa, título, etiqueta y detalle son obligatorios (llevan "*" en pantalla). */
export const promoTextValidator: ValidatorFn = (group) => {
  if (!group.get('active')?.value) return null;
  const vacio = ['title', 'badge', 'description'].some(
    (k) => !String(group.get(k)?.value ?? '').trim(),
  );
  return vacio ? { promoTextRequired: true } : null;
};

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
