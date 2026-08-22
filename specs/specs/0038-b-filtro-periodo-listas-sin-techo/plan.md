# Plan 0038-b — Ventana de período en listas históricas

> **Spec:** [spec.md](./spec.md)
> **Status:** done
> **Created:** 2026-08-22

---

## 1. Estrategia

Núcleo funcional puro + un Dumb compartido + cableado por superficie. La regla no negociable
("el período nunca atrapa a la búsqueda") vive en **una sola función**, no en cada página.

## 2. Núcleo funcional — `core/utils/period-window.utils.ts` (nuevo)

Funciones puras, sin Angular, testeables sin `TestBed`:

| Export | Rol |
|---|---|
| `PeriodWindow` | `'last-12-months' \| 'all' \| \`year-${string}\`` |
| `PERIOD_WINDOW_MONTHS` / `DEFAULT_PERIOD_WINDOW` | Constantes del contrato |
| `periodCutoffIso(window, cutoffIso?)` | Corte ISO; `null` para `all` y `year-YYYY` (un año es un rango, no un corte) |
| `applyPeriodWindow(items, opts)` | Aplica la ventana. **Si `hasActiveSearch` es `true`, devuelve todo** |

Decisiones:

- **`cutoffIso` inyectable** para tests deterministas, en vez de depender de `new Date()`.
- **Reutiliza `monthsAgoIso()`** de `date.utils.ts` — no se reescribe aritmética de fechas.
- **Los registros sin fecha se conservan** (AC-E1).

## 3. Dumb compartido — `shared/components/period-selector/` (nuevo)

`p-select` + nota condicional. Inputs: `window` (req), `searchActive`, `ariaLabel`, `years`.
Output: `windowChange`. Sin inyección de nada — el recorte lo hace el consumidor.

El input `years` es lo que permite **unificar** el filtro de año de Clase B (AC5) sin que el
componente sepa nada del dominio.

## 4. Cableado por superficie

| # | Superficie | Particularidad |
|---|---|---|
| 1 | `servicios-especiales-content` | Sin buscador de texto libre → `hasActiveSearch: false`, con comentario para cuando gane uno |
| 2 | `admin-ex-alumnos` | **Reemplaza** `filtroAnio` + `yearSelectOptions` (AC5) |
| 3 | `secretaria-ex-alumnos` | Idéntico al 2 — duplicado a sabiendas (`ASG-b-096`) |
| 4 | `ex-alumnos-profesional-content` | Sin filtro de año; sigue el estilo de propiedades planas del archivo, no signals |

## 5. Techo en deudores

`pagos.facade.ts` → `fetchAlumnosConDeuda`: `.limit(200)` (AC6). ⚠️ El método se llamaba
`fetchDeudores` cuando se escribió `ASG-b-087`; la referencia original ya no resolvía.

## 6. Corrección de precisión descubierta al implementar

`EgresadoTableRow` solo exponía `anio`, derivado de `updated_at` **descartando el día**. Con eso,
un egresado de diciembre caía fuera de la ventana de 12 meses por hasta 11 meses de error.
Se agrega `fechaEgreso` (ISO completo) al modelo de UI y al mapeo del Facade (AC-E4).

## 7. Riesgos evaluados

| Riesgo | Resultado |
|---|---|
| Tocar la lista de alumnos **activos** por compartir componente | Descartado: `app-alumnos-list-content` lo usan solo las páginas de activos, no ex-alumnos |
| Export truncado | **No existe**: ex-alumnos no tiene export (ni Facade ni UI); servicios-especiales exporta por Edge Function que solo recibe `format` y `branch_id` |
| Dos controles de tiempo en conflicto | Encontrado y resuelto con la unificación (AC5 / AC-E2) |
