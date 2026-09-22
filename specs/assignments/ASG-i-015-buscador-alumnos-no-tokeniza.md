# Asignación ASG-i-015 — Buscador de listados no tokeniza "nombre + apellido"

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-09-22
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Encontrado durante el QA de `fix-037-i-qa-visual-piloto` (ASG-i-012). En Base Alumnos B,
buscar "Camila Reyes" (nombre + apellido, el orden natural en que cualquiera buscaría) da "No
se encontraron alumnos" aunque la alumna "Reyes Muñoz Camila Andrea" exista — porque
`filteredAlumnos` compara `nombre` y `apellido` **por separado** contra el término completo
(`a.nombre.includes(term) || a.apellido.includes(term)`), en vez de tokenizar el término y
exigir que cada token matchee en algún campo.

**Importante — alcance a re-verificar antes de implementar:** el track lista 7 archivos con el
mismo patrón (grep de `a.nombre...includes(term) || a.apellido...includes(term)`), pero al
probar `admin-secretarias.component.ts` (uno de los 7) buscando "Lola SECRETARIA" **sí
encontró el resultado** — ese componente parece comparar contra un nombre ya concatenado, no
contra nombre/apellido separados. Confirmar archivo por archivo cuál realmente reproduce el
bug antes de aplicar la utilidad compartida a los 7.

## Alcance sugerido

Ver `specs/fixes/fix-039-i-buscador-alumnos-no-tokeniza/fix.md` (Root Cause, Cambio propuesto
— función pura `matchesSearchTokens` en `core/utils/`, Test de Regresión) — el track ya está
redactado.

## Archivos involucrados

- `alumnos-list-content.component.ts` (confirmado afectado)
- `alumnos-profesional-list-content.component.ts`, `ex-alumnos-content.component.ts`,
  `ex-alumnos-profesional-content.component.ts`, `admin-secretarias.component.ts` (NO
  reproducido, ver nota arriba), `admin-profesional-relatores.component.ts`,
  `admin-ex-alumnos-comentarios-drawer.component.ts` (alcance a confirmar)

## Notas para quien la reclame

El track `fix-039-i-buscador-alumnos-no-tokeniza` ya existe en estado `draft` — no hace falta
generarlo de nuevo. Lee el archivo, corre `/spec-activate fix-039-i-buscador-alumnos-no-
tokeniza`, confirma qué archivos realmente reproducen el síntoma y continúa el flujo SDD
normal.
