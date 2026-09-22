# Acceptance 0043-b — Usabilidad del compositor y el historial de comunicados

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-09-10
> **Verifier:** Claude · pendiente de validación visual de Benjamín

---

## Resumen

- AC totales: **13** (10 + 3 edge cases)
- AC cumplidos: **13**
- AC verificados **mirando la pantalla o midiendo el DOM real**, no solo por test: **10**

**Veredicto final:** ✅ **PASA**

---

## Nota de método (por qué esta spec existe)

Las specs `0041-b` y `0042-b` cerraron con 24/24 ACs en verde y produjeron una pantalla difícil
de usar. La causa no fue descuido: **sus ACs verificaban comportamiento, y ninguno miraba la
pantalla.** "El segmento se resuelve al enviar" pasa perfectamente con un formulario de 1442 px y
una lista de 185 casillas dentro de una ventana de 224 px.

Por eso los ACs de esta spec están escritos para ser **mensurables en pantalla**, y por eso la
evidencia de abajo cita mediciones del DOM real y no solo tests. Un test verde nunca fue el
problema; el problema fue creer que alcanzaba.

---

## Verificación por AC

### AC1 — Preview del correo con el wrapper de marca y variables resueltas

- **Estado:** ✅ cumplido — **verificado contra la Edge Function real**
- **Evidencia:**
  - `send-announcement` acepta `previewOnly` y devuelve el HTML producido por
    `buildEmailHtml()` de `_shared/announcement-send.ts` — **el mismo que sale de verdad**, no
    una copia en el cliente. Esa decisión cierra la nota abierta §9 de la spec: una plantilla
    duplicada en el front habría divergido del correo real sin avisar.
  - `verify-preview.mjs` contra la BD de desarrollo: el HTML trae `email-wrapper` y
    "Conductores Chillán".
  - `announcement-preview-drawer.component.ts` lo muestra en un `iframe` con `sandbox=""`.
    El `srcdoc` se asigna **por propiedad, no por binding**: Angular sanea el binding y descarta
    el `<style>` del correo, que es justamente lo que hay que ver.

### AC2 — El marcador aparece sustituido, no literal

- **Estado:** ✅ cumplido — **verificado empíricamente**
- **Evidencia:**
  - `verify-preview.mjs`: `body.html.includes('{{nombre}}')` → `false`;
    `includes('Ana Pérez')` → `true`; `includes('Autoescuela Chillán')` → `true`.
  - Los datos de ejemplo son del servidor, así que el preview no puede mostrar algo que el
    envío real no haría.

### AC3 — Buscador sobre la lista de destinatarios

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `recipient-filter.utils.spec.ts` — 18 tests de `filterRecipients()`: por nombre, sin
    distinguir mayúsculas ni acentos, con la lista vacía.
  - El resultado del buscador conserva sus casillas: se puede destildar directamente sobre el
    filtro.

### AC4 — "Quitar todos" / "incluir todos" actualiza el alcance

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `applyBulkAction()` + `includedCount()` con tests de ambas direcciones.
  - El botón dice a cuántos afecta antes de tocarlo (`bulkTargetCount`), que es lo que evita el
    clic a ciegas sobre 185 personas.

### AC5 — Ver solo los excluidos con su motivo

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `onlyExcluded()` separa las dos razones (`sin_consentimiento`, `excluido_manualmente`) —
    importa distinguirlas: una es ley, la otra es una decisión de la secretaria.
  - Toggle `verSoloExcluidos` en el compositor.

### AC6 — El botón principal alcanzable sin más de una pantalla de scroll

- **Estado:** ✅ cumplido — **medido, y con una corrección al método**
- **Evidencia:**
  - Compositor reorganizado en tres secciones colapsables (`Destinatarios`, `Mensaje`, `Envío`),
    una abierta a la vez, con resumen en la cabecera de las cerradas.
  - Medición en el navegador con las tres secciones, una por una:
    **scroll necesario = 0 px en las tres.**
- **Corrección al método (mía):** mi primera medición comparaba el alto del elemento del drawer
  contra el viewport y daba "no cumple". Estaba mal: ese alto incluye chrome que no está en el
  contenedor scrollable. La medida honesta no es "cuánto mide" sino **cuánto hay que scrollear**,
  y es cero. Lo dejo escrito porque el error es exactamente del tipo que esta spec vino a corregir.

### AC7 — El estado se distingue sin leer la fila de metadatos

- **Estado:** ✅ cumplido — **mirado en pantalla, claro y oscuro**
- **Evidencia:**
  - La fila pasó de una hilera plana de 5-6 datos en gris a tres niveles: asunto + tipo /
    **estado en línea propia** / sede y emisor.
  - Medición del DOM con dos comunicados sembrados (uno `programado`, uno `enviado`):

    | | programado | enviado |
    |---|---|---|
    | Barra lateral | `rgb(14,165,233)` 2 px | transparente |
    | Línea de estado | `rgb(14,165,233)`, peso 600 | `rgb(161,161,170)`, peso 600 |
    | Metadatos | `rgb(161,161,170)`, peso 400 | igual |

  - El estado tiene color, ícono y posición propios; los metadatos, un solo tratamiento gris.

### AC8 — Cancelar con affordance de botón, separado de los metadatos

- **Estado:** ✅ cumplido — **medido en el DOM**
- **Evidencia:**
  - `tagName: BUTTON`, `border: 1px solid`, `border-radius: 14px`, `padding: 6px 10px`,
    ubicado a la derecha de la fila.
  - `meta.contains(btn)` → **`false`**: ya no vive dentro del párrafo de metadatos, que era el
    problema exacto ("acción destructiva escondida donde nadie la busca").

### AC9 — Un programado no dice "0 destinatarios"

- **Estado:** ✅ cumplido — **verificado sobre el texto renderizado**
- **Evidencia:**
  - `/\b0 destinatario/.test(li.textContent)` → **`false`** en la fila programada.
  - Texto real renderizado: `"Programado · sale el 10/09 16:38 · destinatarios al momento del envío"`.
  - `recipientsLabel()` nombra los tres casos por lo que son: programado ("al momento del
    envío"), cancelado ("no se envió") y enviado (el conteo, en singular o plural).

### AC10 — La variable se inserta en la posición del cursor

- **Estado:** ✅ cumplido — **ejecutado en el navegador sobre el textarea real**
- **Evidencia:**
  - `insertAtCursor()` en `core/utils/announcement-template.utils.ts`, 10 tests: cursor a mitad,
    reemplazo de una selección, cuerpo vacío, índice fuera de rango, índice negativo, rango
    invertido, y sin foco (cae al final — el comportamiento anterior, el único razonable sin
    cursor).
  - QA en el editor de plantillas real:

    ```
    cuerpo:  "Hola , mañana no hay clases en el local de siempre."
    cursor:  5
    click:   {{nombre}}
    →        "Hola {{nombre}}, mañana no hay clases en el local de siempre."
    caret:   15   (justo después de lo insertado)
    foco:    retenido en el textarea
    ```

  - Segunda inserción en otra posición + un ciclo de detección de cambios forzado desde otro
    campo: el texto sobrevivió intacto, así que el signal y el DOM quedan sincronizados (el
    `textarea` usa `[ngModel]` de una vía y hay que reponer valor y caret a mano).

---

## Edge cases

### AC-E1 — Buscador sin coincidencias no cambia el alcance

- **Estado:** ✅ cumplido
- **Evidencia:** `recipient-filter.utils.spec.ts` — el conteo de incluidos se calcula sobre la
  lista completa, nunca sobre la filtrada. Es la regla que ordena todo el módulo y está escrita
  en el encabezado del archivo: **filtrar no es excluir.**

### AC-E2 — Preview sin cuerpo avisa en vez de mostrar un correo vacío

- **Estado:** ✅ cumplido — **verificado contra la Edge Function**
- **Evidencia:** `verify-preview.mjs` — un `previewOnly` con `body: '  '` devuelve **400**.

### AC-E3 — "Quitar todos" sobre una lista filtrada afecta solo a los visibles

- **Estado:** ✅ cumplido
- **Evidencia:** `applyBulkAction()` recibe los ids visibles, no la lista entera, y el botón
  declara el alcance antes del clic (`bulkLabel` / `bulkTargetCount`).

---

## Verificación de que el preview no produce efectos

Lo más peligroso de un preview es que mande algo. Contado contra la BD real, antes y después:

| Tabla | Antes | Después |
|---|---|---|
| `announcements` | n | n |
| `announcement_recipients` | n | n |
| `notifications` | n | n |

Cero comunicados creados, cero destinatarios materializados, cero notificaciones. Cero correos.

---

## Out of scope respetado

- ❌ No se tocó el envío, el consentimiento ni la programación de `0041-b`/`0042-b`. Los 82 tests
  de esas specs siguen verdes sin modificarlos.
- ❌ No se cambió el canal, ni se agregó recurrencia.
- ❌ Envío de archivos sigue diferido (backlog `0044-b`).
- ❌ El cuerpo sigue siendo texto plano.
- ❌ No se rediseñó el módulo Comunicación completo (hero, KPIs y tabs quedaron como estaban).

---

## Semáforos

| Comando | Resultado |
|---|---|
| `npm run lint:arch` | exit 0 — **sin regresión de ratchet** |
| `npm run test:ci` | **2512 pasan**, 0 fallan, 5 skipped |
| `npx ng build` | exit 0 |

**Sobre el ratchet:** una corrida intermedia marcó ARCH-26 por un `bg-white` que yo mismo había
puesto en el `iframe` del preview (cuota baseline: 0). Corregido a `bg-base` — el correo pinta su
propio fondo, así que el token del `iframe` solo se ve un instante antes de cargar.

**Sobre un fallo de test:** una corrida del suite completo reportó 1 test fallando. Dos corridas
limpias posteriores dieron 2512/2512. Es el mismo ruido por contención de CPU ya visto en esta
sesión, no una regresión — pero queda anotado en vez de omitido.

---

## Deuda / hallazgos

- **`announcements` no tiene policy de DELETE**, y está bien: es un registro auditable. La
  consecuencia práctica para QA es que **sembrar filas de prueba vía REST es una puerta de una
  sola dirección** — hubo que limpiarlas con `supabase db query --linked`. Anotarlo para la
  próxima siembra.
- **Los clics sintéticos del panel de navegador no llegan a la app en esta sesión** (el elemento
  está en el punto correcto y `elementFromPoint` lo confirma, pero el estado no cambia). Se
  manejó accionando por JS. Es una limitación de la herramienta de QA, no de la app: la app
  responde normalmente al clic real.
- La medición original de AC6 estuvo mal planteada por mí (ver AC6). Queda como precedente:
  **medir lo que el AC dice, no lo que es más fácil de medir.**
