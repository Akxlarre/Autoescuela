# Hotfix: Skeleton de Flota dispara NG0955 por track key duplicado

> id: hotfix-005-i-skeleton-flota-track-duplicado
> refs: fix-037-i-qa-visual-piloto, ASG-i-019
> status: done
> created: 2026-09-22
> closed: 2026-09-24

## Problema

`flota-list-content.component.ts:174` renderiza el header del skeleton desktop con:

```html
@for (w of ['15%', '20%', '15%', '10%', '10%', '12%']; track w) {
  <app-skeleton-block variant="text" [width]="w" height="11px" />
}
```

El array literal tiene valores repetidos ('15%' en índices 0 y 2, '10%' en índices 3 y 4) y
`track w` usa el propio valor como key. Angular no puede diferenciar los items duplicados y
emite `NG0955` en consola cada vez que el skeleton se renderiza (confirmado 3 veces seguidas al
cargar `/app/admin/flota` con datos aún cargando).

Encontrado durante `fix-037-i-qa-visual-piloto` (QA del piloto), Bloque B recorrido "Flota":
sin impacto visual (el skeleton se ve igual), pero ensucia la consola y es una violación del
Sistema Visual (`visual-system.md`) que exige tracking correcto en todo `@for`.

## Cambio

- `flota-list-content.component.ts:174` — cambiar `track w` por `track $index`, ya que los
  anchos son puramente decorativos (placeholders de skeleton) y no representan entidades con
  identidad propia.
- Revisar si el mismo patrón (`@for` sobre un array literal de strings/números con valores
  repetidos, trackeando por valor) se repite en otros skeletons del proyecto — de ser así,
  aplicar el mismo fix ahí.

## Test de Regresión

- Verificación manual: `/verify` en `/app/admin/flota` con red simulada lenta (para capturar el
  estado de loading) confirmando 0 warnings NG0955 en consola.

## Evidencia de Verificación

- **2026-09-24:** confirmado que el mismo patrón (`@for` sobre array literal con valores
  repetidos, trackeando por valor) NO se repite en ningún otro skeleton del proyecto — grep de
  `@for (\w+ of [...]; track \w+)` sobre todo `src/app` muestra que el resto usa enteros
  secuenciales únicos (`[1, 2, 3]`, etc.), sin colisión posible. Cambio acotado a la única
  línea afectada (`flota-list-content.component.ts:174`, `track w` → `track $index`).
  `tsc --noEmit` limpio. Verificado en vivo con Playwright en `/app/admin/flota`: 0 mensajes
  `NG0955` en toda la consola de la sesión (110 mensajes debug/log revisados, ninguno es
  warning ni error).
