# Hotfix: Quitar botón "← Inicio" redundante del Hero de Servicios Especiales

> id: hotfix-098-m-servicios-especiales-back-button-redundante
> status: done
> closed: 2026-09-04
> created: 2026-09-04

## Qué

`/app/{admin,secretaria}/servicios-especiales` es un destino de nivel superior del sidebar
("Venta Servicios Especiales"), igual que Promociones — que no muestra botón "← Volver" en su
Hero porque no pasa `backRoute` a `app-section-hero`. Servicios Especiales sí lo mostraba
(`backRoute` era `input.required<string>()` en `ServiciosEspecialesContentComponent`, forzando
a ambos Smart wrappers a pasar uno). El dueño lo marcó como redundante viendo la UI: la vista
ya es independiente (accesible directo desde el sidebar), no un sub-paso de otra pantalla.

`app-section-hero` ya soporta "sin botón volver" de forma nativa (`backRoute` ahí es opcional,
`input<string | null>(null)`, el botón solo renderiza `@if (backRoute())`) — el problema estaba
solo en que el wrapper de dominio forzaba el input.

## Cambio

- `servicios-especiales-content.component.ts`: elimina `backRoute`/`backLabel` (inputs y su uso
  en `<app-section-hero>`).
- `admin-servicios-especiales.component.ts` / `secretaria-servicios-especiales.component.ts`:
  quitan el binding `backRoute="..."` (queda sin uso).

## Por qué es hotfix y no fix

El "cómo" es obvio (quitar un input y su binding, mismo patrón ya usado por Promociones) y no
cambia ningún contrato público más allá de esos 3 archivos ya tocados en fix-239-m.
