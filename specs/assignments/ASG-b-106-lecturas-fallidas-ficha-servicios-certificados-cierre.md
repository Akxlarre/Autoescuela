# Asignación ASG-b-106 — Lecturas fallidas en ficha del alumno, servicios, certificados B y cierre de 0060-b

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-11-20
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Parte de la spec **`0060-b-lecturas-fallidas-como-ceros`**, ya aprobada y con las etapas 0, 1 y 3a
cerradas. Esta asignación cubre las tareas **T2.3, T2.4 y T2.5** de su `tasks.md` (ficha del
alumno, cursos singulares, servicios especiales y certificación Clase B) y la **fase 5, el cierre
de la spec**. Hoy esas pantallas muestran "Sin disponibilidad", 0 o una lista vacía cuando la
lectura falló. En la ficha, eso lleva a reprogramar o cobrar con datos falsos. El cierre se encarga
de que `PENDING` quede vacío, de que X01 no tenga `knownBug` y de que la ASG-b-102 quede completada.

**No se crea un track nuevo.** Al reclamarla, el track resultante es `0060-b` y se trabaja sobre sus
tareas.

## Alcance sugerido

- **T2.3, `admin-alumno-detalle.facade.ts` y la ficha del alumno.** La grilla de "Reprogramar" no
  puede decir "Sin disponibilidad" ante un error (quedó pendiente de `fix-189-b`).
- **T2.4,** `cursos-singulares` y `servicios-especiales`. Hay que encontrar la causa F3 de Servicios
  especiales: sus lecturas ya lanzan, pero en X01 igual mostró "sin datos".
- **T2.5,** `certificacion-clase-b` y la pantalla de Certificados.
- **T2.6,** validación de la etapa para estas pantallas.
- **Fase 5** (solo cuando ASG-b-104 y ASG-b-105 estén mergeadas):
  - T5.1: `PENDING` vacío y X01 sin `knownBug`. Revisar los `catch` vacíos que queden.
  - T5.2: `/spec-verify` y `acceptance.md` con la evidencia de cada AC.
  - T5.3: actualizar índices y `ROADMAP.md`, completar ASG-b-102 y correr `assignments:sync`.
  - T5.4: crear asignaciones aparte para lo que quedó fuera: el cierre de caja calculado en el
    servidor y las 2 lecturas de `core/services/ui/` (impresión).

## Referencias

- Spec, plan y tareas: `specs/specs/0060-b-lecturas-fallidas-como-ceros/`
- Agenda (`fix-189-b`) como referencia de la grilla de disponibilidad
- Contrato: `.claude/rules/swr-pattern.md` §"Errores de carga"
- Asignación madre: ASG-b-102

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/admin-alumno-detalle.facade.ts`
- `src/app/core/facades/cursos-singulares.facade.ts`
- `src/app/core/facades/servicios-especiales.facade.ts`
- `src/app/core/facades/certificacion-clase-b.facade.ts`
- `src/app/core/facades/unchecked-reads.guard.spec.ts`
- `e2e/transversal-shell.spec.ts`
- `specs/specs/0060-b-lecturas-fallidas-como-ceros/acceptance.md`

## Notas para quien la reclame

- Está asignada a `b` porque Benjamín es el dueño de la spec y le toca cerrarla.
- La fase 5 depende de ASG-b-104 (`i`) y de ASG-b-105 (`m`). Mientras tanto, se pueden avanzar
  T2.3, T2.4 y T2.5.
- `admin-alumno-detalle` comparte la ficha con el bloque de matrícula (rematricular). Si
  ASG-b-104 toca `enrollment.facade.ts` al mismo tiempo, hay que coordinarse con Ignacio.
