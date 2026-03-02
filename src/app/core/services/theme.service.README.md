# ThemeService

## Propósito

Gestión del modo claro/oscuro. Actualiza `data-mode` en el DOM y persiste en localStorage. Usa `GsapAnimationsService` para transición suave al cambiar. Solo existe un color de marca (Azul Rey) definido en los tokens.

## API pública

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `darkMode` | `Signal<boolean>` | Si modo oscuro está activo |
| `isThemeTransitioning` | `Signal<boolean>` | true durante transición — para deshabilitar botón |
| `cycleColorMode(clickEvent?)` | `void` | Alterna light ↔ dark. Un clic. |
| `setColorMode(mode)` | `void` | Establece modo: 'light' \| 'dark' |

## Uso

```typescript
readonly themeService = inject(ThemeService);
readonly darkMode = this.themeService.darkMode;

// Cambiar modo
this.themeService.cycleColorMode(event);
this.themeService.setColorMode('dark');
```

## Cuándo usarlo

- Selector de modo claro/oscuro en el topbar
- Componentes que reaccionan al modo oscuro (colores, contraste)

## Cuándo no usarlo

- Para tokens de diseño → usar variables CSS que dependen de `data-mode` (light/dark)

## Dependencias

- `GsapAnimationsService` (para `animateThemeChange`)
- `PLATFORM_ID` (SSR-safe)
