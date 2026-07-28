# Asignación ASG-049 — El número de matrícula debe ser más principal que el nombre del alumno

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P3
> **created:** 2026-07-28
> **created_by:** b

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Número matrícula debe ser más principal que el nombre del alumno."*

El cliente identifica a los alumnos por **número de matrícula**, no por nombre — es lo que
figura en el libro físico y lo que usan para buscar. Hoy la interfaz jerarquiza al revés.

## Alcance sugerido

- Invertir la jerarquía visual donde se muestra un alumno: número de matrícula como dato
  primario, nombre como secundario. Aplica a listados, cards, heros de ficha y drawers.
- Que el número de matrícula sea **seleccionable/copiable** — si es el identificador operativo,
  la gente lo va a querer copiar.
- Revisar que el buscador encuentre por número de matrícula (ver solape abajo).

## Referencias — usar el design system, no tamaños ad-hoc

- `.claude/rules/visual-system.md` § Tipografía de Datos: `.kpi-value` / `.kpi-label` son las
  clases canónicas para jerarquizar un dato sobre su etiqueta. **Prohibido** `text-4xl
  font-bold` a mano.
- Lección ya aprendida en la spec 0030: *"jerarquía por ancho, no por tamaño de fuente"* — si
  algo se siente mal jerarquizado, revisar la distribución del espacio antes de agrandar
  tipografías.
- El número se genera con `get_next_enrollment_number(course_id)`.

## Archivos involucrados (opcional, para detectar solapes)

- Listados y fichas de alumnos (admin, secretaría), drawers

## Notas para quien la reclame

- ⚠️ **Se solapa con ASG-024** (el buscador global no indexa alumnos). Si el número de
  matrícula pasa a ser el identificador principal, el buscador **tiene** que encontrarlo por
  ese número. Coordinar.
- ⚠️ **Se solapa con ASG-045** (imprimir libro de Registro de Alumnos), que gira en torno a la
  misma idea. Mirarlas juntas.
- Cambio puramente visual: cerrar con `/verify` (Playwright), en claro **y** oscuro.
