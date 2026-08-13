# Acceptance 0037-b — Reevaluación de la excepción app-like en Evaluación Práctica

> **Spec:** [spec.md](./spec.md)
> **Verified:** 2026-08-12
> **Verifier:** b (lectura directa de `instructor-evaluacion.component.ts`, sin plan.md/tasks.md — spec de solo documentación/decisión, sin código a implementar)

---

## Resumen

- AC totales: 2 (+ 1 edge case)
- AC cumplidos: 2
- AC con evidencia: 2

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — `indices/APP-LIKE-ROLLOUT.md` actualizado con la re-confirmación

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `indices/APP-LIKE-ROLLOUT.md`, tabla "No aplica — excepciones justificadas": fila de
    `/instructor/alumnos/:id/evaluacion/:sessionId` actualizada con criterio #1+#2 y nota
    "Re-confirmado 2026-08-12 (spec 0037-b)" explicando por qué el espacio vacío no es un
    bug.
- **Notas:** La causa raíz del espacio vacío se identificó leyendo el template completo de
  `instructor-evaluacion.component.ts` — `<div class="px-6 py-6 pb-20 max-w-4xl mx-auto
  space-y-6">` en la raíz, un patrón deliberado de contenedor angosto centrado.

### AC2 — Ajuste cosmético opcional decidido en plan (condicional)

- **Estado:** ✅ cumplido (rama "no aplica" del AC)
- **Evidencia:** El owner no pidió ningún ajuste cosmético adicional tras la
  investigación — la recomendación ("dejar como está") fue aceptada implícitamente al no
  objetar y decir "continue". No se tocó código de `instructor-evaluacion.component.ts`.
- **Notas:** Si en el futuro se pide un ajuste cosmético menor (ej. reducir `max-w-4xl`),
  es un fix autónomo de 1 línea, no requiere reabrir esta spec.

### AC-E1 — Reevaluación futura si cambia el contexto de uso

- **Estado:** ✅ cumplido (documentado como fuera de alcance)
- **Evidencia:** Sección "Out of scope" de `spec.md` deja explícito que un cambio futuro
  de contexto de uso requiere spec nueva, no reabrir ésta.

---

## Out-of-scope respetado

- ❌ Aplicar `.bento-grid--fill-screen` a la ruta — confirmado: no se aplicó (la
  investigación concluyó que sería contraproducente).
- ❌ Rediseñar el wizard de 3 pasos — confirmado: no se tocó.
- ❌ `/instructor/clase/:id` / `/instructor/clase/iniciar` — confirmado: no se tocaron,
  mismas excepciones documentadas sin cambios.

---

## Deuda técnica detectada

- Ninguna — spec de documentación pura, sin deuda generada.

---

## Cambios en índices

- `indices/APP-LIKE-ROLLOUT.md` — fila de excepción de
  `/instructor/alumnos/:id/evaluacion/:sessionId` actualizada con la re-confirmación.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (sin código tocado — N/A)
- [x] `lint:arch` limpio (sin código tocado — N/A)
- [x] Sin deuda crítica abierta

**Cerrado por:** b
**Fecha:** 2026-08-12
