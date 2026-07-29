# Asignación ASG-b-043 — Drawers muestran datos de todas las sedes en vez de una

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-28
> **created_by:** b

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Corrección Drawers respecto a la información que muestran de las sedes."*

Aclarado con el owner (2026-07-28): **los drawers muestran datos de todas las sedes cuando
deberían mostrar los de una sola.**

## La investigación es parte de la tarea

El owner fue explícito: **qué drawers exactamente están afectados es parte del entregable**, no
un dato que venga dado. Quien reclame esto tiene que auditar los drawers de la app y determinar
cuáles no están respetando el scope de sede.

## Alcance sugerido

1. **Auditar** todos los drawers de la app y detectar cuáles muestran datos sin filtrar por sede.
2. Corregirlos aplicando el patrón canónico ya establecido en el proyecto.
3. Dejar el listado de lo auditado (afectados y sanos) en el track, para que no haya que
   repetir la barrida.

## Referencias — el patrón ya existe, no inventarlo

- `.claude/rules/facades.md` § "Facades Multi-Sede (Branch-Scoped)": inyectar `BranchFacade`,
  leer `selectedBranchId()` dentro de cada `fetchData()`, aplicar
  `if (branchId !== null) query = query.eq('branch_id', branchId)`.
  **`null` significa "Admin ve todas" → sin filtro.** Ese `null` es probablemente la causa: si
  un drawer se abre para una secretaria pero el facade resuelve `null`, muestra todo.
- Ya hubo un fix del mismo tipo: **fix-027** cerró la fuga de sede en Base Alumnos B e
  Instructores usando `resolveBranchScope()` / `getActiveBranchId()` en 6 facades. Ver
  `indices/SECRETARIA-AUDIT.md`. Reusar ese helper, no escribir uno nuevo.

## Archivos involucrados (opcional, para detectar solapes)

- Sin declarar — depende de lo que arroje la auditoría.

## Notas para quien la reclame

- Antes de tocar nada, correr el flujo como **secretaria** y como **admin con sede
  seleccionada**: son dos escenarios distintos y el bug puede aparecer solo en uno.
- Ojo con la regresión inversa: **fix-002-b** fue exactamente eso (los instructores
  desaparecieron al aplicar branch filter donde no correspondía). Filtrar de más también es un
  bug.
