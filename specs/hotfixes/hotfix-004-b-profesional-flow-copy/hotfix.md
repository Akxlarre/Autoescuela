# Hotfix: Copy incorrecto en flujo Clase Profesional
> id: hotfix-004-b-profesional-flow-copy
> status: done
> closed: 2026-06-04
> created: 2026-06-04

## Problema
Dos issues de comunicación en el flujo Clase Profesional:

**M5 — Jargon interno "Profesional A2" en el banner de contexto:**
El banner muestra el `courseType` interno (`professional_a2`, `professional_a3`, etc.)
en vez de la etiqueta amigable "Clase Profesional". El usuario eligió "Clase Profesional"
y el banner le dice "Profesional A2" — confusión total.

**M6 — El flujo profesional no comunica que es una pre-inscripción:**
El usuario selecciona "Clase Profesional" creyendo que se matriculará, pero el flujo
es solo una pre-inscripción. Nunca se le informa que habrá un paso posterior con la escuela.

## Causa raíz
**M5:** `context()` computed en `PublicEnrollmentComponent` usa `course.label` que viene
del catálogo interno de cursos. Para profesional, ese label es "Profesional A2", etc.

**M6:** No existe ningún aviso/banner en el flujo profesional que aclare la naturaleza
de pre-inscripción antes de que el usuario complete los 4 pasos.

## Cambios
- **Archivo:** `src/app/features/public-enrollment/public-enrollment.component.ts`
  M5: En el computed `context()`, cuando `flow === 'professional'`, forzar
  `courseName: 'Clase Profesional'` en vez de usar el label interno del catálogo.

- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-license-type/public-license-type.component.ts`
  M6: Agregar un badge/nota informativa en la card "Clase Profesional" que indique
  "Pre-inscripción · La escuela te contactará para completar la matrícula."
