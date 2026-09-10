# Spec 0043-b — Usabilidad del compositor y el historial de comunicados

> **Status:** done
> **Created:** 2026-09-10
> **Owner:** Benjamín
> **Priority:** P1 — el feature funciona pero la pantalla principal es impracticable con datos reales

---

## 1. Contexto de negocio

**Origen:** revisión visual del owner el 2026-09-10, tras cerrar `0042-b`. Las specs `0041-b` y
`0042-b` cerraron con 24/24 ACs en verde y la superficie que producen es difícil de usar. Eso no
es una casualidad: **los ACs de esas specs verificaban comportamiento, no usabilidad.** Cosas como
"el segmento se resuelve al enviar" o "una fecha pasada bloquea el envío" pasan perfectamente con
un formulario de 1442px y una lista de 185 casillas que nadie puede operar.

**Persona afectada:** Secretaria (usa el compositor), Admin.

**Problema que resuelve:**
Medido en el navegador con los datos reales de desarrollo:

| Síntoma | Medición |
|---|---|
| Formulario del compositor | **1442 px** de alto en un viewport de 620 px — 2,3 pantallas hasta el botón de enviar |
| Lista de destinatarios | **185 casillas** dentro de una ventana de 224 px, sin buscador ni "todos/ninguno" |
| Preview del correo | **No existe.** `0041-b` §7 lo describía y nunca se construyó |
| Fila del historial | 5-6 datos con peso visual idéntico, en 12 px gris |
| Acción de cancelar | Link rojo al final de esa fila de metadatos — acción destructiva escondida |

**Hipótesis de valor:**
La secretaria puede mandar un comunicado sin scrollear a ciegas, ver cómo se verá antes de que
salga, y encontrar lo que está programado sin leer una fila de metadatos.

---

## 2. User Stories

- **US1**: Como secretaria, quiero ver cómo se verá el correo antes de confirmarlo, para no
  descubrir un error cuando ya salió a cientos de personas.
- **US2**: Como secretaria, quiero encontrar y destildar un alumno puntual sin recorrer 185
  casillas, para poder ajustar la lista de verdad.
- **US3**: Como secretaria, quiero que el compositor quepa en la pantalla, para no perder de vista
  lo que ya completé.
- **US4**: Como secretaria, quiero distinguir de un vistazo lo programado de lo enviado, y
  cancelar sin cazar un link entre metadatos.

---

## 3. Acceptance Criteria (Gherkin)

> Estos ACs son deliberadamente **mensurables en pantalla**, no solo funcionales — es la
> corrección al método que dejó pasar el problema.

- **AC1**: Given un comunicado con asunto y cuerpo escritos, When la secretaria pide previsualizar,
  Then ve el correo renderizado con el wrapper de marca **y las variables resueltas con datos de
  ejemplo**, tal como lo recibirá un alumno.
- **AC2**: Given un preview abierto de un comunicado con `{{nombre}}`, When se muestra, Then el
  marcador aparece sustituido (no como `{{nombre}}` literal), para que se vea el resultado real.
- **AC3**: Given una lista de más de 20 destinatarios, When la secretaria escribe en el buscador,
  Then la lista se filtra por nombre y puede destildar directamente el resultado.
- **AC4**: Given una lista de destinatarios, When usa "quitar todos" / "incluir todos", Then el
  conteo de alcance se actualiza en consecuencia.
- **AC5**: Given una lista con destinatarios excluidos, When la secretaria lo pide, Then puede ver
  **solo los excluidos** con su motivo, sin recorrer toda la lista.
- **AC6**: Given el compositor abierto en un viewport de 700 px de alto, When se mide el formulario,
  Then **el botón de acción principal es alcanzable sin más de una pantalla de scroll** desde
  cualquier paso (medido: el contenido visible por paso no excede el alto del viewport).
- **AC7**: Given el historial con un comunicado programado y uno enviado, When se listan, Then el
  estado se distingue **sin leer la fila de metadatos** (posición o peso visual propio, no un badge
  más entre otros).
- **AC8**: Given un comunicado programado, When la secretaria quiere cancelarlo, Then la acción
  tiene affordance de botón (no un link entre texto gris) y está separada de los metadatos.
- **AC9**: Given un comunicado programado que todavía no resolvió su segmento, When se muestra en
  el historial, Then **no dice "0 destinatarios"** sino que indica que la lista se calcula al
  enviar.
- **AC10**: Given el editor de plantillas con el cursor a mitad del cuerpo, When se inserta una
  variable desde los botones, Then se inserta **en la posición del cursor**, no al final.

### Edge cases obligatorios

- **AC-E1**: Given un buscador de destinatarios sin coincidencias, When no hay resultados, Then se
  informa explícitamente y el conteo de alcance **no cambia** (filtrar no es excluir).
- **AC-E2**: Given un preview de un comunicado sin cuerpo, When se intenta abrir, Then se avisa que
  falta contenido en vez de mostrar un correo vacío.
- **AC-E3**: Given una lista filtrada por el buscador, When se usa "quitar todos", Then afecta
  **solo a los visibles del filtro**, no a los 185 — o se aclara explícitamente el alcance de la
  acción.

---

## 4. Out of scope

- ❌ **Rediseñar el envío, el consentimiento o la programación.** El comportamiento de `0041-b` y
  `0042-b` no se toca: esto es solo la superficie.
- ❌ **Cambiar el canal, agregar recurrencia o adjuntos.**
- ❌ **Envío de archivos** — sigue diferido, ahora como `0044-b` en el backlog.
- ❌ **Editor de texto enriquecido.** El cuerpo sigue siendo texto plano.
- ❌ **Rediseño del módulo Comunicación completo** (tabs, hero, KPIs). Solo compositor, historial
  y editor de plantillas.

---

## 5. Dependencias

### Specs previas
- `0041-b` y `0042-b` (✅ done) — esta spec corrige la superficie que ambas produjeron.

### Capacidades existentes que se asumen
- `AnnouncementsFacade` con `preview()`, `send()`, `schedule()`, `cancelScheduled()`.
- `renderTemplate()` en `core/utils/announcement-template.utils.ts` — **ya resuelve variables y
  está testeado**; el preview lo reutiliza en vez de reimplementar.
- El wrapper HTML de marca vive en `_shared/announcement-send.ts` (lado servidor).
- `<p-paginator>`, `<app-badge>`, `<app-empty-state>`, `ConfirmModalService`.

### Capacidades nuevas requeridas
- Renderizado del preview en el cliente. **Decisión abierta**: replicar el wrapper en el cliente
  duplica una plantilla que hoy tiene una sola fuente, en el servidor. Ver §9.

---

## 6. Datos y modelo

**Ninguno.** Esta spec no toca la base ni los contratos. Si aparece la necesidad de una migración,
es señal de que se coló scope que no corresponde.

---

## 7. UX y flujos (preliminar)

- **Compositor**: reorganizar en pasos o secciones colapsables para cumplir AC6. La lista de
  destinatarios pasa a tener buscador, acciones masivas y vista de excluidos.
- **Preview**: panel o modal que muestre el correo tal como llegará, con datos de ejemplo.
- **Historial**: separar el estado de los metadatos; cancelar con affordance de botón.
- **Plantillas**: insertar variable en la posición del cursor.

---

## 8. Métricas de éxito post-launch

- Alto del formulario del compositor por paso, medido en el navegador (AC6).
- ¿La secretaria usa el buscador de destinatarios? Si nunca lo toca, el problema era otro.
- Comunicados cancelados antes de salir: si sube, es señal de que el preview está atajando errores.

---

## 9. Notas / decisiones abiertas

- [ ] **¿Dónde vive la plantilla HTML del correo?** Hoy está en `_shared/announcement-send.ts`
      (servidor). Un preview fiel en el cliente la necesita también. Opciones: (a) duplicarla —
      barato pero dos fuentes que divergen; (b) extraerla a un módulo compartido — más limpio pero
      el cliente Angular y las Edge Functions de Deno no comparten build; (c) que el preview lo
      genere una Edge Function y el cliente solo lo muestre — una fuente sola, pero cuesta un
      round-trip. **Propuesta a validar: (c)**, porque un preview que miente es peor que no tener
      preview.
- [ ] **¿Pasos (wizard) o secciones colapsables en el compositor?** El proyecto tiene precedente de
      wizard (`secretaria-matricula`). Colapsables es menos invasivo.
- [ ] **AC-E3**: ¿"quitar todos" sobre el filtro o sobre el total? Definir antes de implementar.

---

## Changelog

- 2026-09-10 — draft inicial por Benjamín. Origen: revisión visual del owner. Los ACs se
  redactaron deliberadamente mensurables en pantalla, porque el problema que esta spec corrige
  nació de ACs que solo verificaban comportamiento.
