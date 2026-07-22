# Asignación ASG-028 — 3 fixes cosméticos: label Agenda, texto RBAC, chips ambiguos

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

3 hallazgos cosméticos pequeños, sin relación entre sí, agrupados por conveniencia (bajo esfuerzo cada uno):
- **H-010**: en Agenda, el selector de instructor muestra "Todos los instructores" al entrar, pero en realidad ya cargó un instructor específico (el primero de la lista) — label inconsistente con el estado real.
- **H-014**: en `/app/secretaria/contabilidad/reportes`, la sección "Gastos Fijos del Período" dice en su propio subtítulo "solo visible para admin", pero se muestra igual a la secretaria (incluido el botón "Registrar Gasto Fijo") — o sobra la sección (fuga RBAC) o el texto miente.
- **H-018**: en el Dashboard del alumno, "Asistencia reciente" muestra chips "P" sobre fechas que en "Mis Clases" figuran como Inasistencia — ambiguo si "P" significa "Práctica" o "Presente" (y en este último caso, sería incorrecto).

## Alcance sugerido

- H-010: cambiar el label inicial para reflejar el instructor realmente cargado, o cargar "todos" de verdad si eso es lo esperado.
- H-014: decidir con el owner si la sección debe ocultarse para secretaría (fuga RBAC real) o si el texto está desactualizado y debe corregirse.
- H-018: aclarar el significado de "P" (cambiar a texto completo o un ícono sin ambigüedad) y verificar que coincida con el estado real de asistencia.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgos H-010, H-014, H-018.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/features/admin/agenda/admin-agenda.component.ts` (H-010)
- `src/app/features/secretaria/contabilidad-reportes/secretaria-contabilidad-reportes.component.ts` (H-014)
- `src/app/features/alumno/dashboard/alumno-dashboard.component.ts` (H-018)

## Notas para quien la reclame

- Buen paquete para alguien con poco tiempo — cada uno es un cambio aislado y de bajo riesgo.
