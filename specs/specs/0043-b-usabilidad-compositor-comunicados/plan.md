# Plan 0043-b — Usabilidad del compositor y el historial de comunicados

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-09-10
> **Talla:** M — sin migraciones ni contratos nuevos; es reorganización de superficie + un preview.

---

## 1. Resumen ejecutivo

Tres frentes, en orden de riesgo decreciente:

1. **Preview del correo** — lo único que agrega capacidad nueva. La decisión que lo ordena es de
   dónde sale el HTML: se genera en el servidor y el cliente lo muestra, para que no existan dos
   plantillas que diverjan.
2. **Lista de destinatarios operable** — buscador, acciones masivas y vista de excluidos. Todo
   cliente, sobre datos que la facade ya tiene en memoria.
3. **Jerarquía del compositor y del historial** — secciones colapsables y separar el estado de los
   metadatos. Es el frente más barato y el que más se nota.

Nada de esto toca la base, el consentimiento ni el envío. **Si aparece una migración, se coló
scope.**

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/core/utils/recipient-filter.utils.ts` | Util (núcleo funcional) | Filtrado por nombre, conteos y semántica de las acciones masivas |
| `src/app/core/utils/recipient-filter.utils.spec.ts` | Test | Tests del núcleo funcional |
| `src/app/features/comunicados/announcement-preview-drawer.component.ts` | Smart (drawer) | Muestra el correo renderizado |

### Archivos a MODIFICAR

| Path | Cambio | AC |
|------|--------|-----|
| `supabase/functions/send-announcement/index.ts` | Acepta `previewOnly` y devuelve el HTML sin enviar | AC1, AC2 |
| `supabase/functions/_shared/announcement-send.ts` | Exporta el armado del HTML para el preview | AC1 |
| `src/app/core/facades/announcements.facade.ts` | `loadPreviewHtml()` | AC1, AC-E2 |
| `src/app/features/comunicados/announcement-composer-drawer.component.ts` | Secciones colapsables, buscador, acciones masivas, botón de preview | AC3–AC6, AC-E1, AC-E3 |
| `src/app/shared/components/announcements-content/announcements-content.component.ts` | Estado con peso propio, cancelar como botón, texto del segmento diferido | AC7, AC8, AC9 |
| `src/app/features/comunicados/template-manager-drawer.component.ts` | Insertar variable en la posición del cursor | AC10 |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

**Los dos patrones que hacen falta ya existen en el proyecto — no se inventa nada:**

- **Buscador local sobre lista**: `ex-alumnos-content.component.ts` usa `searchTerm = signal('')` +
  un `computed` que filtra, con `hasActiveSearch` derivado. Se copia esa forma.
  > De ahí sale además una lección aplicable a AC-E1: en ese componente, **buscar ignora el filtro
  > de período a propósito**, porque un filtro que esconde lo que estás buscando se siente roto.
  > Acá el equivalente es que **filtrar no puede alterar el alcance** — solo la vista.
- **Sección colapsable**: `ajustes-drawer.component.ts` con `showPasswordForm = signal(false)` +
  `@if` + chevron `chevron-up`/`chevron-down`. Mismo patrón para las secciones del compositor.
- **`renderTemplate()`** ya resuelve variables y está testeado (25 casos): el preview lo usa para
  los datos de ejemplo, no reimplementa la sustitución.
- **`<app-badge>`, `<app-empty-state>`, `ConfirmModalService`, `<app-drawer-form>`** — sin cambios.

---

## 4. Modelo de datos

**N/A.** Ninguna migración, ninguna columna, ninguna policy. El único cambio de contrato es el
parámetro `previewOnly` en el body de una Edge Function que ya existe.

---

## 5. Arquitectura

### El preview se genera en el servidor (decisión cerrada)

El wrapper HTML del correo vive hoy en `_shared/announcement-send.ts`, una sola fuente. Un preview
fiel en el cliente necesita el mismo HTML, y hay tres caminos:

| Opción | Problema |
|---|---|
| (a) Duplicar el wrapper en Angular | Dos plantillas que divergen en el primer cambio de marca. El preview empieza a mentir y nadie se entera |
| (b) Módulo compartido cliente ↔ Deno | El build de Angular y el de las Edge Functions no se comparten |
| **(c) `previewOnly` en la EF** ✅ | Cuesta un round-trip |

Se elige **(c)**. Un preview que miente es peor que no tener preview: su valor entero está en que
lo que se ve sea lo que sale.

```
Compositor → facade.loadPreviewHtml(draft)
              └─► send-announcement { previewOnly: true }
                    · NO materializa destinatarios
                    · NO toca SMTP ni notificaciones
                    · resuelve variables con datos de ejemplo
                    · devuelve { html }
```

**`previewOnly` corta antes de cualquier efecto.** Es la primera guarda de la función, no una rama
al final: un preview no puede, ni por error de orden, materializar destinatarios ni mandar un
correo.

### El compositor pasa a secciones colapsables, no a wizard

El proyecto tiene precedente de wizard (`secretaria-matricula`), pero un wizard obliga a un orden
y a navegación propia. Colapsables cumple AC6 con mucho menos: cada sección se pliega al
completarse y muestra un resumen de una línea. **Solo una abierta a la vez** — eso es lo que acota
el alto, no el colapsable en sí.

### Filtrar no es excluir (AC-E1, AC-E3)

El buscador solo cambia **qué se ve**. El alcance lo determinan las exclusiones manuales, que son
otra cosa. De ahí:

- Buscar sin resultados → se avisa, el conteo de alcance **no se mueve**.
- "Quitar todos" con un filtro activo → afecta **solo a los visibles**, y el botón lo dice
  explícitamente ("Quitar los 12 visibles"), porque un botón que dice "todos" y toca 185 cuando ves
  12 es una trampa.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — OnPush, Signals; filtrado y conteos como funciones puras en `core/utils/`
- [x] `models.md` — sin DTOs nuevos; el componente no importa de `dto/`
- [x] `visual-system.md` — `.card`, tokens, `<app-icon>`; **sin sumar al ratchet de ARCH-25**
- [x] `testing-tdd.md` — `.spec.ts` primero para el núcleo funcional
- [x] `ai-readability.md` — `data-llm-action` en preview, acciones masivas y cancelar
- [x] `form-ux.md` — es la regla central de esta spec: anatomía de campos, secciones y footers

---

## 7. Plan de testing

**Unitarios (`recipient-filter.utils.spec.ts`):**
- Filtra por nombre sin distinguir mayúsculas ni acentos; sin coincidencias → lista vacía.
- **El conteo de alcance no cambia al filtrar** (AC-E1) — el test que protege la regla de §5.
- "Quitar todos" sobre un subconjunto filtrado excluye solo esos (AC-E3).
- "Incluir todos" no puede incluir a quien está excluido por falta de consentimiento.

**Unitarios (facade):** `loadPreviewHtml()` devuelve el HTML; con cuerpo vacío no llama a la EF
(AC-E2).

**Verificación server-side:** `previewOnly: true` **no crea filas** en `announcement_recipients`
ni en `notifications`, y no envía. Se verifica contando antes y después contra la BD real.

**QA manual (`/verify`) — con las mediciones que definen los ACs:**
- AC6: medir el alto del formulario por sección en un viewport de 700 px.
- AC1/AC2: abrir el preview de un comunicado con `{{nombre}}` y ver el nombre sustituido.
- AC7/AC8/AC9: historial con un programado y un enviado, mirados como usuario.

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|---|---|---|
| **`previewOnly` termina enviando por un error de orden** | Media | Es la primera guarda de la función, y se verifica contando filas contra la BD real |
| El preview del cliente diverge del correo real | Media | Resuelto por diseño: el HTML lo genera el servidor, una sola fuente |
| Los colapsables esconden un campo obligatorio vacío | **Alta** | El resumen plegado marca la sección incompleta; el botón de enviar sigue deshabilitado y se indica cuál falta |
| "Quitar todos" con filtro activo borra 185 en vez de 12 | Alta | El botón nombra el número exacto que va a afectar |
| Tocar el compositor rompe lo verificado en 0041-b/0042-b | Media | 82 tests de esas specs como red; se corren antes de dar por buena cada fase |

---

## 9. Orden de implementación

1. **Núcleo funcional** de filtrado — tests primero.
2. **`previewOnly` en la EF** + verificación server-side de que no produce efectos.
3. **`loadPreviewHtml()` + drawer de preview.**
4. **Lista de destinatarios**: buscador, acciones masivas, vista de excluidos.
5. **Secciones colapsables** del compositor (el cambio más invasivo del formulario, va último de los
   del compositor).
6. **Historial**: estado, cancelar, texto del segmento diferido.
7. **Plantillas**: insertar en la posición del cursor.
8. `lint:arch` + `test:ci` + `ng build` + `/verify` **con las mediciones de los ACs**.
9. Sincronizar índices + `acceptance.md`.

---

## 10. Estimación

**M.** Los pasos 2-3 concentran el riesgo; 4-6 son volumen de UI; 1 y 7 son mecánicos.

---

## Decisiones que este plan cierra (venían abiertas en spec §9)

1. **El preview se genera en el servidor** (`previewOnly` en `send-announcement`). Una sola fuente
   del HTML.
2. **Secciones colapsables, no wizard**, con una sola abierta a la vez.
3. **"Quitar todos" opera sobre lo visible** y el botón nombra el número exacto.

---

## Changelog

- 2026-09-10 — plan inicial. Cierra las 3 decisiones abiertas de la spec.
