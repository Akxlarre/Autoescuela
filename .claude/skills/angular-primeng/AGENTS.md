# Angular PrimeNG Best Practices

> Usar junto con el skill `angular-component`.

---

## 1. Tree-Shake PrimeNG Imports

**Impact: MEDIUM** (Reduce bundle size)

Importar componentes PrimeNG individualmente usando la API standalone. No importar módulos completos.

**Incorrecto:**

```typescript
import { ButtonModule } from 'primeng/button';
@NgModule({ imports: [ButtonModule, TableModule, DialogModule] })
```

**Correcto:**

```typescript
@Component({
  imports: [Button, Select, Table], // Solo lo que se necesita
})
```

---

## 2. PrimeNG Table con Lazy Loading

**Impact: HIGH** (Maneja 100k+ registros eficientemente)

Usar `[lazy]="true"` con `(onLazyLoad)` para paginación, ordenamiento y filtrado server-side.

**Incorrecto:**

```html
<p-table [value]="allData"></p-table>
```

**Correcto:**

```html
<p-table [value]="data" [lazy]="true" [totalRecords]="total"
         (onLazyLoad)="load($event)" [paginator]="true" [rows]="20">
</p-table>
```

---

## 3. Sistema de Theming de PrimeNG

**Impact: MEDIUM** (Diseño consistente con tokens)

Usar el styled mode con presets Aura o Lara. Customizar vía design tokens en `providePrimeNG()`.

**Incorrecto:**

```css
.p-button { background: #1976d2 !important; }
```

**Correcto:**

```typescript
providePrimeNG({
  theme: { preset: Aura, options: { darkModeSelector: '.dark' } }
})
```

---

## 4. Dark Mode en este proyecto

El dark mode se controla con `ThemeService` y `[data-mode='dark']` en el documentElement.

Para evitar conflictos con PrimeNG, usar `darkModeSelector: '.fake-dark-mode'` (clase inexistente) en `providePrimeNG()`. Los estilos dark de PrimeNG se aplican vía `_primeng-overrides.scss` con `[data-mode='dark']`.
