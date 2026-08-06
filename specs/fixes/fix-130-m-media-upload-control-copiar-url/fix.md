# Fix: Ícono de enlace en `app-media-upload-control` es decorativo — convertir a botón de copiar
> id: fix-130-m-media-upload-control-copiar-url
> refs: —
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause
`media-upload-control.component.ts` (usado por `hero-tab.component.ts` en "Recurso de Fondo" /
"Recurso Lateral", y potencialmente otros lugares) tiene un ícono `link` posicionado a la derecha
del input de URL manual:

```html
<span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" title="URL manual">
  <app-icon name="link" [size]="14" />
</span>
```

Es un `<span>` sin `(click)`, puramente decorativo (`title="URL manual"` solo indica "este campo
acepta una URL manual a mano"). Visualmente, sin embargo, un ícono de enlace a la derecha de un
input de texto es una convención de UI ampliamente reconocida para "copiar este valor" — el dueño
lo probó esperando que copiara el link y no pasó nada. En vez de solo aclarar que es decorativo,
se decide honrar la expectativa visual: convertirlo en un botón funcional de copiar al
portapapeles.

## ACs Afectados

- AC-1: El ícono de enlace es ahora un `<button type="button">` (no un `<span>` inerte), con
  `(click)` que copia `value()` al portapapeles vía `navigator.clipboard.writeText()`.
- AC-2: Al copiar, se muestra un toast de confirmación vía `ToastService.success()` (mismo patrón
  ya usado por otros shared components, ej. `ajustes-drawer.component.ts`).
- AC-3: Si `value()` está vacío, el botón se deshabilita (no hay nada que copiar).
- AC-4: El ícono cambia de `link` a `copy` (más preciso semánticamente para la acción real).
- AC-5: `data-llm-action="copiar-url-recurso"` en el nuevo botón (convención AI-readability del
  proyecto).

## Cambio
- **Archivo:** `src/app/shared/components/media-upload-control/media-upload-control.component.ts`
  - `<span title="URL manual"><app-icon name="link" /></span>` → `<button type="button"
    (click)="copyValue()" [disabled]="!value()" data-llm-action="copiar-url-recurso"
    title="Copiar URL"><app-icon name="copy" /></button>`.
  - Inyecta `ToastService` (precedente: `ajustes-drawer.component.ts`, shared component).
  - Nuevo método `copyValue()`: `navigator.clipboard.writeText(this.value())`, luego
    `this.toast.success('URL copiada', ...)`.
- **Archivo:** `src/app/app.config.ts` — registro obligatorio del ícono nuevo `Copy` en
  `LucideAngularModule.pick({...})` (regla del proyecto: todo ícono nuevo debe registrarse o la
  app falla en runtime). No es una causa raíz nueva, es un requisito mecánico de AC-4.

## Test de Regresión
`/verify` (Playwright MCP): en `/admin/configuracion-web` → tab "Sección Hero" → sección "2.
Fondo de la Sección" con tipo "Imagen" seleccionado, click en el botón de copiar junto al input
de URL, confirmar toast de éxito. Confirmar que con el campo vacío el botón está deshabilitado.

**Ejecutado 2026-08-06 (Playwright MCP):** `npm run lint:arch`: 0 errores, ícono `Copy` registrado
correctamente en `app.config.ts` (sin error de runtime). Click en "Copiar URL" en ambos controles
(Recurso de Fondo y Multimedia Lateral): `navigator.clipboard.readText()` confirma que la URL
completa quedó en el portapapeles. Confirmado por el dueño visualmente en el navegador real.
