# Hotfix: Aplicar StableWidthDirective a todos los botones restantes con estado de carga
> id: hotfix-049-m-stable-width-todos-los-botones-loading
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Problema
hotfix-048 creó `StableWidthDirective` (`[appStableWidth]`, `src/app/core/directives/stable-width.directive.ts`) y la aplicó a `AsyncBtnComponent` (15 consumidores) + 2 botones hand-rolled ("Generar PDF" en Pagos admin/secretaría). El dueño pidió extenderlo a **todos** los botones restantes de la app que muestran un ícono `animate-spin` + texto más corto al pasar a estado de carga (mismo defecto: el botón se achica visualmente).

## Cambios
- Revisar los ~48 archivos restantes con `class="animate-spin"` dentro de un `<button>` (listado completo obtenido con `grep -rl 'class="animate-spin"' src/`, excluyendo los 3 ya migrados en hotfix-048: `async-btn.component.ts`, `admin-pagos.component.ts`, `secretaria-pagos.component.ts`).
- Para cada botón: si su ancho es "natural" (no tiene `flex-1`/`w-full`/`flex-grow` que ya lo fuerce a un ancho fijo por el layout padre), agregar `[appStableWidth]="<mismaSeñalDeLoadingQueYaUsaElBoton>"` + import de `StableWidthDirective` en `imports: []` del componente.
- Si el botón ya es `flex-1`/`w-full` (su ancho lo define el contenedor, no el contenido), no aplica — dejarlo sin tocar y no listarlo como migrado.
- Bloques que NO son botones (ej. indicadores de carga inline tipo "Cargando cursos disponibles...", "Sesión en curso") no aplican — no hay botón que se achique.
