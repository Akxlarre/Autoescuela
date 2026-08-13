# Spec 0037-b — Reevaluación de la excepción app-like en Evaluación Práctica

> **Status:** done
> **Created:** 2026-08-12
> **Closed:** 2026-08-12
> **Owner:** b
> **Priority:** P3

---

## 1. Contexto de negocio

**Origen:** QA manual del owner post-cierre de fix-139-b — preguntó si
`/instructor/alumnos/:id/evaluacion/:sessionId` (`InstructorEvaluacionComponent`) debería
ajustarse al patrón app-like, notando que "ni siquiera sigue el canon" y señalando el
espacio vacío alrededor del formulario en desktop.

**Persona afectada:** Instructor.

**Problema que resuelve:**
`indices/APP-LIGHT-ROLLOUT.md` (sic, ver nota) documenta esta ruta como **excepción
justificada** al rollout app-like bajo el criterio #2 ("uso real mobile/tablet-first por
el contexto físico de la tarea" — el instructor califica dentro del vehículo, recién
terminada la clase práctica). Esta spec existe para **re-confirmar o revertir** esa
decisión con evidencia fresca, no para asumir que estaba mal.

**Hipótesis de valor:**
Si el criterio sigue vigente, evitar trabajo innecesario (aplicar fill-screen a un
formulario que se usa en el celular, no en desktop, no aporta). Si el contexto de uso
cambió (ej. ahora se llena desde el dashboard de la escuela en un monitor grande), vale la
pena revisar.

---

## 2. Investigación (hecha en esta sesión, 2026-08-11/12)

Se leyó `src/app/features/instructor/evaluacion/instructor-evaluacion.component.ts`
completo. Hallazgo: el "espacio vacío" que se ve en desktop **no es un fill-screen roto**
— es `<div class="px-6 py-6 pb-20 max-w-4xl mx-auto space-y-6">` en la raíz del template:
un contenedor `max-w-4xl` (56rem/896px) **centrado deliberadamente**, patrón estándar de
Tailwind para formularios/páginas de contenido angosto (mismo patrón que usan páginas de
configuración o detalle en incontables proyectos, incluido este). El "vacío" a los lados
en una pantalla de 1440px es el margen esperado de un formulario corto que no necesita
llenar todo el ancho — no hay tabla ni lista que se beneficie de más ancho.

Esto **confirma** el criterio #1 ya citado en la excepción original ("contenido corto sin
overflow real"): 1 formulario reactivo de 3 pasos (Checklist y Nota / Observaciones /
Firmas), sin tabla ni lista, sin razón funcional para ocupar 100vh.

**Conclusión de la investigación:** el criterio de exclusión **sigue vigente** y aplica
doblemente (criterio #1 Y #2, no solo #2 como decía el audit original). No se recomienda
aplicar `--fill-screen`/`.bento-grid` a esta página — hacerlo estiraría un formulario
corto a pantalla completa, dejando MÁS espacio vacío visual dentro del `.bento-fill`
(peor, no mejor).

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given la investigación de la sección 2, When se documenta la decisión, Then
  `indices/APP-LIKE-ROLLOUT.md` (sección "No aplica — excepciones justificadas") queda
  actualizado con la re-confirmación 2026-08-12 y el detalle de por qué el espacio vacío
  observado no es un bug.
- **AC2**: Given que el owner puede preferir un ajuste cosmético menor igual (reducir
  `max-w-4xl` a algo más angosto, o centrar verticalmente además de horizontalmente en
  pantallas muy altas), When se decide en `/spec-plan`, Then se implementa como cambio
  puntual acotado — NO como aplicación del patrón fill-screen completo.

### Edge cases obligatorios

- **AC-E1**: Given que el criterio de uso físico (instructor en el vehículo) cambiara en
  el futuro (ej. flujo se mueve a "calificar después, desde la oficina"), When se
  reevalúe, Then debe ser una spec nueva — esta spec no lo cubre, solo confirma el estado
  actual.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Aplicar `.bento-grid--fill-screen` a esta ruta — la investigación concluye que NO
  corresponde.
- ❌ Rediseñar el wizard de 3 pasos (Checklist/Observaciones/Firmas) — fuera de alcance,
  esta spec es solo sobre el layout de contenedor, no sobre el formulario en sí.
- ❌ `/instructor/clase/:id` ni `/instructor/clase/iniciar` — mismas excepciones
  documentadas (criterio #2), no se tocan acá.

---

## 5. Dependencias

### Specs previas
- Ninguna — depende del audit original en `indices/APP-LIKE-ROLLOUT.md` (2026-08-02),
  no de un track SDD previo.

### Capacidades del proyecto que se asumen existentes
- N/A.

### Capacidades nuevas requeridas
- Ninguna.

---

## 6. Datos y modelo (preliminar)

N/A — no toca persistencia.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `/instructor/alumnos/:id/evaluacion/:sessionId`.
- Flujo principal: sin cambios — se documenta que el layout actual es intencional.
- Estados especiales: sin cambios.

---

## 8. Métricas de éxito post-launch

N/A — spec de documentación/decisión, no de producto.

---

## 9. Notas / decisiones abiertas

- [ ] Confirmar con el owner si la recomendación ("dejar como está, es intencional") es
      aceptable, o si prefiere igual la opción "Solo arreglar el espacio vacío visual"
      (ajuste cosmético menor de `max-w-4xl`) mencionada en el chat que originó esta spec.
- Nota de nomenclatura: el archivo real se llama `indices/APP-LIKE-ROLLOUT.md` (con K, no
  "LIGHT") — typo corregido acá en la sección 1, no en el nombre del archivo.

---

## Changelog

- 2026-08-12 — draft inicial por b, con investigación de causa raíz ya hecha (sección 2)
  a partir de una pregunta del owner en QA manual.
