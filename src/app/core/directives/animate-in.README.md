# appAnimateIn

Animación de entrada automática para elementos que aparecen condicionalmente.

## Propósito
Animar la aparición de elementos que se crean dinámicamente (ej. mensajes de error, contenido condicional). Usa `GsapAnimationsService.animateSkeletonToContent()` para un fade + slide suave. Respeta `prefers-reduced-motion`.

## Uso

```html
<!-- Mensaje de error que aparece condicionalmente -->
<div class="min-h-5 text-xs text-error">
  @if (form.get('email')?.invalid && form.get('email')?.touched) {
    <span appAnimateIn>El email es requerido</span>
  }
</div>
```

## Cuándo usarlo
- Mensajes de error que aparecen condicionalmente
- Contenido que se muestra/oculta con `@if`
- Elementos que aparecen tras una acción del usuario (ej. mensajes de éxito)

## Cuándo NO usarlo
- Elementos que siempre están visibles (usar `animatePageEnter` o `fadeIn` en `ngAfterViewInit`)
- Contenedores grandes (animar el contenido interno, no el wrapper)
- Elementos que ya tienen animación propia

## Dependencias
- `GsapAnimationsService` — inyectado en la directiva
- `afterNextRender` — para asegurar que el elemento está renderizado antes de animar
