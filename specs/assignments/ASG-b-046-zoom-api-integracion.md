# Asignación ASG-b-046 — Integración con Zoom API para clases teóricas Profesional

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P3
> **created:** 2026-07-28
> **created_by:** b

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Ver cómo conectar el zoom a la app vía ZOOM API."*

Las clases teóricas de Clase Profesional se dictan por Zoom: `professional_theory_sessions` ya
tiene una columna **`zoom_link` (TEXT)** que hoy se llena a mano.

## ⚠️ Antecedente importante — esto ya se intentó y se difirió

Esto **no es una tarea nueva**. En la **spec 0027** (Notificaciones Ola 4, cerrada 2026-07-10)
el ítem *"D2 — Zoom automático"* se difirió explícitamente, con este motivo registrado:

> *fork de `pg_net` sin precedente*

Es decir: el bloqueo no fue de prioridad sino **técnico** — llamar a la API de Zoom desde
Postgres requería un camino que nadie había recorrido. Quien reclame esta asignación **debe
leer primero el cierre de la spec 0027** antes de rediseñar desde cero.

## Alcance sugerido — decidir primero el "dónde", no el "cómo"

La pregunta de arquitectura es dónde vive la llamada a Zoom:

- **Edge Function** (recomendado): el proyecto ya tiene varias (`public-enrollment`,
  `create-instructor`, generadores de PDF). Es territorio conocido, con `SERVICE_ROLE_KEY` y
  manejo de secretos resuelto. Evita el problema de `pg_net` por completo.
- **Desde Postgres con `pg_net`**: es el camino que se intentó y bloqueó. No reintentarlo sin
  una razón nueva.

Funcionalidad mínima a definir con el cliente: ¿crear la reunión automáticamente al programar
la sesión teórica? ¿traer la asistencia real desde Zoom (hoy `professional_theory_attendance`
es **marcado manual**, RF-078)? Lo segundo es mucho más valioso y mucho más caro.

## Referencias

- `specs/specs/0027-b-notificaciones-ola-4/` — cierre con el diferimiento de D2 documentado
- `indices/DATABASE.md` → `professional_theory_sessions` (`zoom_link`),
  `professional_theory_attendance` (marcado manual)
- Recordar la preferencia del proyecto: **cero dependencias externas que el cliente deba
  administrar**. Zoom API implica credenciales y una cuenta que alguien tiene que mantener —
  confirmar con el cliente que está dispuesto a eso antes de construir.

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/functions/` (Edge Function nueva)

## Notas para quien la reclame

- Empezar por la **decisión de alcance con el cliente** (¿crear reuniones? ¿leer asistencia?
  ¿ambas?). El esfuerzo entre una y otra difiere en un orden de magnitud.
- Si el objetivo real resulta ser la asistencia automática, eso reemplaza un flujo manual que
  hoy hace secretaría — verificar que no rompa `professional_weekly_signatures`.
