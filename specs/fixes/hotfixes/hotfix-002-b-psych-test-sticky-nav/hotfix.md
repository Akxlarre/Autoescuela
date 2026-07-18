# Hotfix: Test psicológico — navegación enterrada en mobile
> id: hotfix-002-b-psych-test-sticky-nav
> status: done
> closed: 2026-06-04
> created: 2026-06-04

## Problema
En mobile (390px) el test EPQ muestra 14 preguntas por página. Los botones "Volver" y "Siguiente"
quedan al final de un scroll de ~2000px. El usuario no puede avanzar sin hacer scroll completo
cada vez que cambia de página. Blocker severo en mobile.

## Causa raíz
El footer de navegación (`div.flex.justify-between`) es `position: static` dentro del card.
No hay `sticky` ni estructura que lo ancle al viewport inferior.

## Cambios
- **Archivo:** `src/app/shared/components/matricula-steps/psych-test/psych-test.component.ts`
  — Hacer el footer de navegación `position: sticky; bottom: 0` con backdrop para que flote
  sobre las preguntas sin perder contexto visual.
