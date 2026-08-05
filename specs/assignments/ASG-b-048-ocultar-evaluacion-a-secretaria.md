# Asignación ASG-b-048 — Secretaría no debe ver calificación ni aspectos a evaluar en Iniciar Clase

> **status:** reclamada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P3
> **created:** 2026-07-28
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-08-05
> **resulting_track:** fix-115-m-ocultar-evaluacion-secretaria-admin

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"En Iniciar Clase, calificación general y aspectos a evaluar no lo ve la secretaria."*

La evaluación del alumno es materia del instructor. La secretaría no debe verla en esa pantalla.

## ⚠️ Aviso técnico — ocultar en UI no es esconder

La policy `select_class_b_sessions` le entrega a secretaría **la fila completa** de
`class_b_sessions`, incluidos `evaluation_grade`, `evaluation_checklist` y `performance_notes`.
Ocultar los campos en el template los saca de la vista, pero **no de la API**: una secretaria
con la consola del navegador abierta los sigue viendo.

Para una nota de clase eso probablemente alcanza — es una regla de higiene de interfaz, no de
secreto. Pero **decidirlo conscientemente**, no por omisión:

- **Ocultar en UI** (recomendado): barato, resuelve el pedido tal como fue formulado.
- **RLS a nivel de columna**: candado real, bastante más caro (vista aparte o `GRANT` por
  columna) y con riesgo de romper pantallas donde secretaría sí necesita el dato.

Si el cliente lo pidió por **privacidad del alumno** y no por orden visual, la respuesta cambia.
Vale una pregunta.

## Alcance sugerido

- Ocultar `evaluation_grade` / `evaluation_checklist` / notas de desempeño en la pantalla de
  Iniciar Clase cuando el rol es `secretaria`.
- Revisar si esos campos se filtran en **otras** vistas de secretaría (ficha del alumno, libro
  de clases) — el pedido nombra una pantalla, pero la intención probablemente abarca más.

## Referencias

- `indices/DATABASE.md` → `class_b_sessions` (`evaluation_grade`, `evaluation_checklist` JSONB,
  `performance_notes`), policy `select_class_b_sessions`
- `docs/RBAC.md` — nomenclatura dual BD↔frontend (`secretary` ↔ `secretaria`), el mapeo vive
  solo en `auth.facade.ts`

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/instructor-clases.facade.ts`
- Pantalla de Iniciar Clase

## Notas para quien la reclame

- ⚠️ **Se solapa con ASG-b-036** (ciclo de vida de la clase), que toca la misma pantalla y el
  mismo facade. Coordinar o tomarlas juntas.
- **2026-08-05 (al reclamar):** el dueño confirmó que el alcance no es solo secretaría — admin
  tampoco debe ver ni completar evaluación en Iniciar/Finalizar Clase (usan el mismo
  componente, `AdminFinalizarClaseDrawerComponent`). Además, la evaluación nunca debe ser
  requisito para cerrar una clase para ninguno de los 3 roles — solo el kilometraje. Ver
  `fix-115-m-ocultar-evaluacion-secretaria-admin/fix.md`.
