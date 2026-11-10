---
name: angular-primeng
description: >
  Usar componentes PrimeNG correctamente en Angular v20+.
  Activar cuando se usen p-table, p-dropdown, p-dialog, p-calendar, p-button u otros componentes PrimeNG.
  Incluye: tree-shaking de imports, lazy loading en tablas, theming con tokens, dark mode.
  Usar siempre junto con angular-component y design-system.
user-invocable: false
allowed-tools: Read, Edit, Glob
---

# Angular + PrimeNG — Best Practices v20+

Ver reglas completas en [AGENTS.md](AGENTS.md).

## Resumen de reglas críticas

### 1. Tree-shaking de imports (obligatorio)

```typescript
// INCORRECTO: import de módulo completo
import { ButtonModule } from 'primeng/button';

// CORRECTO: standalone components individuales
@Component({
  imports: [Button, Select, Table],
})
```

### 2. PrimeNG Table con lazy loading

```html
<!-- Para 1000+ registros, usar lazy loading -->
<p-table [value]="data" [lazy]="true" [totalRecords]="total"
         (onLazyLoad)="load($event)" [paginator]="true" [rows]="20">
</p-table>
```

### 3. Theming con tokens (no overrides CSS)

```typescript
// app.config.ts
providePrimeNG({
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.fake-dark-mode', // Dark mode controlado por ThemeService
      cssLayer: { name: 'primeng', order: 'tailwind-base, primeng, tailwind-utilities' }
    }
  }
})
```

### 4. Dark mode en este proyecto

- PrimeNG usa `darkModeSelector: '.fake-dark-mode'` (clase que nunca existe)
- Los estilos dark de PrimeNG se aplican vía `src/styles/vendors/_primeng-overrides.scss`
- El selector SCSS es `[data-mode='dark']` para consistencia con `ThemeService`
