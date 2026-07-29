# Hotfix: Centrar contenido de botones con StableWidthDirective (evitar espacio muerto a la derecha)
> id: hotfix-051-m-centrar-contenido-boton-stable-width
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Problema
Con `[appStableWidth]` el botón ya no se achica en loading, pero su contenido (`flex items-center gap-2`, sin `justify-content`) queda alineado a la izquierda por defecto — al mostrar "Procesando..." (más corto que el label idle), el texto/ícono quedan pegados a la izquierda y sobra espacio vacío a la derecha, en vez de verse centrado/intencional.

## Cambios
- **Archivo:** `src/app/shared/components/async-btn/async-btn.component.ts` — agregado `justify-center` a las clases del `<button>` (componente centralizado, corrige los 15 consumidores).
- **`.btn-primary`** (usado por los botones "Generar PDF" en `secretaria-pagos`/`admin-pagos`) ya centra por defecto (`justify-content: center` confirmado con Playwright) — sin cambios ahí.

## Verificación (Playwright MCP)
- `getComputedStyle(btn).justifyContent === 'center'` en `AsyncBtnComponent` tras el cambio.
- Repetido el test de ancho estable (fix hotfix-050): en frame 0 tras clic, `{ justifyContent: 'center', width: 223, minWidth: '223px', text: 'Procesando...' }` — centrado y sin achicarse.
- `tsc --noEmit` sin errores.
