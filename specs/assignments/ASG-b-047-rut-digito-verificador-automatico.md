# Asignación ASG-b-047 — Dígito verificador del RUT automático en Matrícula

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P3
> **created:** 2026-07-28
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-07-28
> **resulting_track:** fix-064-b-rut-dv-automatico

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Matrícula: se llena todo, excepto el dígito verificador del rut que se debe poner auto."*

Hoy quien matricula tiene que tipear el DV a mano. Es calculable: **módulo 11** sobre el número
de RUT. Cero decisión de negocio, cero ambigüedad.

## Alcance sugerido

- Función pura de cálculo de DV en `core/utils/` (**no** en el componente ni en el facade — ver
  `.claude/rules/architecture.md` § Núcleo Funcional). Con su `.spec.ts`: es el caso ideal de
  test unitario, incluyendo el caso `K` y el caso `0`.
- Autocompletar el DV al salir del campo de número de RUT, dejándolo **visible pero no
  editable** (o editable con validación) — que el usuario pueda verificar que coincide con el
  carnet.
- Aplicarlo en **todos** los formularios que piden RUT, no solo el de matrícula: revisar
  también alta de instructor, secretaria y el wizard público de inscripción.

## Referencias

- Buscar si ya existe una util de RUT antes de escribirla — revisar `indices/UTILS.md`.
  `create-instructor` ya usa "RUT sin DV" como contraseña inicial, así que en algún lado hay
  manipulación de RUT.
- `special_service_sales.client_rut` también almacena RUT (de no-alumnos): incluirlo si aplica.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/utils/` (util nueva)
- Wizard de matrícula interno + wizard público

## Notas para quien la reclame

- Tarea chica y bien acotada — buen primer track para alguien nuevo en el repo.
- Cuidado con el caso del RUT de empresa y con RUTs viejos de menos de 8 dígitos: el algoritmo
  es el mismo, pero el formateo/padding suele ser donde se rompe.
