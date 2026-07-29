# Asignación ASG-b-008 — Decisión de diseño: modificador btn-sm + aplicar a 3 archivos ARCH-16

> **status:** completada
> **owner:** m
> **tipo_sugerido:** spec (reasignado a `fix` al reclamar — ver Notas)
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-07-28
> **resulting_track:** fix-086-m-btn-sm-arch16-restante

---

## Contexto / Objetivo

El linter `lint:arch` (regla ARCH-16) detectó que 3 archivos (`asistencia-clase-b-content.component.ts`, `certificacion-clase-b-content.component.ts`, `certificacion-profesional-content.component.ts`) montan utilities de tamaño de Tailwind directamente sobre clases `btn-*`, lo cual está prohibido por el Design System. El patrón está replicado en ~120 instancias en todo el repo (backlog ya documentado). La causa raíz es que el DS no tiene un modificador de tamaño compacto — hoy la única forma de conseguir un botón chico es "mutilando" la utilidad base.

## Alcance sugerido

- Diseñar un modificador componible `btn-sm` (o similar) en `src/tailwind.css` — **NO crear `btn-primary-sm`/`btn-danger-sm`/… por tipo** (explosión combinatoria ya descartada en el backlog).
- Una vez que exista el primitivo, aplicarlo a los 3 archivos deferidos como primer caso de uso real.
- Fuera de scope: no hace falta migrar las ~120 instancias del repo en esta asignación — solo los 3 archivos que bloquearon el fix original.

## Referencias

- `docs/BACKLOG-DEUDA-TECNICA.md`, línea 86-88 (ya documenta esta necesidad).
- `indices/FLOWS-QA-AUDIT.md`, Fase 5, iteración 17 (detalle de por qué se deferieron estos 3 archivos).
- `specs/fix-054-b-arch16-ratchet-btn-utilities/fix.md` (el fix que sí resolvió los otros 3 archivos "limpios" de la misma regresión ARCH-16).

## Archivos involucrados (opcional, para detectar solapes)

- `src/tailwind.css`
- `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
- `src/app/shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts`
- `src/app/shared/components/certificacion-profesional-content/certificacion-profesional-content.component.ts`

## Notas para quien la reclame

- Es una decisión de diseño primero, implementación después — por eso el tipo sugerido es `spec`, no `fix` directo.
- Prioridad baja — es deuda técnica conocida y trackeada, no un bug visible para usuarios.
- **Reasignado a `fix` al reclamar (2026-07-28, Matías):** el alcance es acotado (1 primitivo CSS
  + migrar 3 archivos ya identificados), sin stakeholders de producto que ameriten User Stories
  formales — es la continuación directa de `fix-054-b-arch16-ratchet-btn-utilities`, que dejó
  estos mismos 3 archivos deferidos. La "decisión de diseño" se documenta en `fix.md` en vez de
  en `spec.md`.
