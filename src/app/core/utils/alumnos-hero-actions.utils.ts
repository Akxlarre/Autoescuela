import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

/**
 * Acciones del hero de la Base de Alumnos. Dentro de la Papelera solo se restaura, así que
 * "Nueva Matrícula" no se ofrece ahí (hotfix-119-m).
 */
export function buildAlumnosHeroActions(trashView: boolean): SectionHeroAction[] {
  const papelera: SectionHeroAction = {
    id: 'papelera',
    label: 'Papelera',
    icon: 'trash-2',
    primary: false,
    danger: trashView,
  };
  if (trashView) return [papelera];

  return [
    papelera,
    {
      id: 'nueva-matricula',
      label: 'Nueva Matrícula',
      icon: 'plus',
      primary: true,
    },
  ];
}
