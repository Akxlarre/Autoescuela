# Registro de Pipes

> **Regla de Actualización:** La tabla auto-generada se refresca con `npm run indices:sync`.
> Consultar ANTES de crear un pipe nuevo: si ya existe uno que resuelve la transformación, **reutilizar**.

## Pipes del proyecto (auto-detectados)

<!-- AUTO-GENERATED:BEGIN -->
| Pipe | Clase | Pure | Archivo |
|------|-------|------|---------|
| `safe` | `SafePipe` | ✅ | `src/app/core/pipes/safe.pipe.ts` |
| `chileDate` | `ChileDatePipe` | ✅ | `src/app/shared/pipes/chile-date.pipe.ts` |
| `relativeTime` | `RelativeTimePipe` | ❌ impure | `src/app/shared/pipes/relative-time.pipe.ts` |
| `shortCurrency` | `ShortCurrencyPipe` | ✅ | `src/app/shared/pipes/short-currency.pipe.ts` |

<!-- AUTO-GENERATED:END -->

## Notas manuales

- `SafePipe` (`safe`) bypassea la sanitización de Angular (HTML, URL, ResourceUrl) — usar solo con contenido controlado. Param: `type`.
- `RelativeTimePipe` (`relativeTime`) — texto relativo ("hace 5 min", "ayer"), locale default `'es'`.
- `ChileDatePipe` (`chileDate`) — fecha u hora con la zona de Chile fija; reemplaza al pipe `date` de Angular, que usa la zona del navegador. Acepta los patrones `yyyy`, `MM`, `MMM`, `MMMM`, `dd`, `d`, `EEE`, `EEEE`, `HH`, `mm`, `ss` y texto entre comillas simples. Una fecha pura no se desplaza; sin fecha devuelve `null` (permite `?? '—'`). Default `'dd/MM/yyyy'`.

## Pipes Nativos de Angular (Recordatorio)

> No reinventes estos — Angular ya los incluye:

| Pipe | Uso | Ejemplo |
|------|-----|---------|
| ~~`DatePipe`~~ | **Prohibido (ARCH-27)** — usa `chileDate` | Formatea con la zona del navegador, no con la de Chile |
| `CurrencyPipe` | `{{ amount \| currency:'CLP' }}` | Formateo de moneda |
| `DecimalPipe` | `{{ value \| number:'1.0-2' }}` | Formateo numérico |
| `TitleCasePipe` | `{{ text \| titlecase }}` | Capitalización |
| `AsyncPipe` | `{{ obs$ \| async }}` | Suscripción a observables |
