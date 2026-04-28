# appScrollReveal

Revela elementos con fade + slide-up al entrar al viewport via GSAP ScrollTrigger.

## Uso básico

```html
<!-- Reveal estándar (32px, 0ms delay, 15% threshold) -->
<div appScrollReveal class="card p-5">...</div>

<!-- Personalizado: más desplazamiento y delay -->
<div [appScrollReveal]="{ y: 48, delay: 0.15 }">...</div>
```

## Stagger en listas

```html
@for (item of items; track item.id; let i = $index) {
  <div [appScrollReveal]="{ delay: i * 0.06 }">{{ item.label }}</div>
}
```

## Opciones

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `y` | `number` | `32` | Píxeles de desplazamiento vertical inicial |
| `delay` | `number` | `0` | Delay en segundos antes de animar |
| `threshold` | `number` | `0.15` | Fracción del elemento visible para disparar (0–1) |

## Notas

- Se auto-limpia en `ngOnDestroy` vía DestroyRef
- Respeta `prefers-reduced-motion` automáticamente
- Usa `once: true` — la animación solo ocurre una vez por sesión
