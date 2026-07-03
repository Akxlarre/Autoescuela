# Registro de Pipes

> **Regla de Actualización:** La tabla auto-generada se refresca con `npm run indices:sync`.
> Consultar ANTES de crear un pipe nuevo: si ya existe uno que resuelve la transformación, **reutilizar**.

## Pipes del proyecto (auto-detectados)

<!-- AUTO-GENERATED:BEGIN -->
| Pipe | Clase | Pure | Archivo |
|------|-------|------|---------|
| `safe` | `SafePipe` | ✅ | `src/app/core/pipes/safe.pipe.ts` |
| `relativeTime` | `RelativeTimePipe` | ❌ impure | `src/app/shared/pipes/relative-time.pipe.ts` |
| `shortCurrency` | `ShortCurrencyPipe` | ✅ | `src/app/shared/pipes/short-currency.pipe.ts` |

<!-- AUTO-GENERATED:END -->

## Notas manuales

- `SafePipe` (`safe`) bypassea la sanitización de Angular (HTML, URL, ResourceUrl) — usar solo con contenido controlado. Param: `type`.
- `RelativeTimePipe` (`relativeTime`) — texto relativo ("hace 5 min", "ayer"), locale default `'es'`.

## Pipes Nativos de Angular (Recordatorio)

> No reinventes estos — Angular ya los incluye:

| Pipe | Uso | Ejemplo |
|------|-----|---------|
| `DatePipe` | `{{ date \| date:'dd/MM/yyyy' }}` | Formateo de fechas |
| `CurrencyPipe` | `{{ amount \| currency:'CLP' }}` | Formateo de moneda |
| `DecimalPipe` | `{{ value \| number:'1.0-2' }}` | Formateo numérico |
| `TitleCasePipe` | `{{ text \| titlecase }}` | Capitalización |
| `AsyncPipe` | `{{ obs$ \| async }}` | Suscripción a observables |
