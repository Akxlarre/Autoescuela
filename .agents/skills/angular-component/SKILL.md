---
name: angular-component
description: >
  Crear o refactorizar componentes Angular standalone v20+.
  Activar cuando se pida crear un componente nuevo, migrar @Input/@Output a signal API,
  agregar host bindings, implementar content projection o lifecycle hooks.
  Incluye: OnPush, signal inputs/outputs, control flow nativo (@if, @for), accesibilidad ARIA.
user-invocable: false
allowed-tools: Read, Edit, Write, Glob, Grep
---

# Angular Component — v20+ Standalone

Crea componentes standalone para Angular v20+. Los componentes son standalone por defecto — **NO** incluir `standalone: true`.

## Estructura base

```typescript
import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-user-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'user-card',
    '[class.active]': 'isActive()',
    '(click)': 'handleClick()',
  },
  template: `
    <img [src]="avatarUrl()" [alt]="name() + ' avatar'" />
    <h2>{{ name() }}</h2>
    @if (showEmail()) {
      <p>{{ email() }}</p>
    }
  `,
  styles: `:host { display: block; }`,
})
export class UserCard {
  name = input.required<string>();
  email = input<string>('');
  showEmail = input(false);
  isActive = input(false, { transform: booleanAttribute });
  avatarUrl = computed(() => `https://api.example.com/avatar/${this.name()}`);
  selected = output<string>();

  handleClick() {
    this.selected.emit(this.name());
  }
}
```

## Signal Inputs

```typescript
name = input.required<string>();         // Requerido
count = input(0);                        // Opcional con default
label = input<string>();                 // Opcional sin default (undefined)
size = input('medium', { alias: 'buttonSize' });
disabled = input(false, { transform: booleanAttribute });
value = input(0, { transform: numberAttribute });
```

## Signal Outputs

```typescript
clicked = output<void>();
selected = output<Item>();
valueChange = output<number>({ alias: 'change' });
```

## Host Bindings

Usar el objeto `host` en `@Component` — **NO** usar `@HostBinding` ni `@HostListener`.

```typescript
host: {
  'role': 'button',
  '[class.primary]': 'variant() === "primary"',
  '[class.disabled]': 'disabled()',
  '[attr.aria-disabled]': 'disabled()',
  '[attr.tabindex]': 'disabled() ? -1 : 0',
  '(click)': 'onClick($event)',
  '(keydown.enter)': 'onClick($event)',
}
```

## Template — Control Flow nativo

**PROHIBIDO** `*ngIf`, `*ngFor`, `*ngSwitch`, `ngClass`, `ngStyle`.

```html
@if (isLoading()) {
  <app-spinner />
} @else if (error()) {
  <app-error [message]="error()" />
} @else {
  <app-content [data]="data()" />
}

@for (item of items(); track item.id) {
  <app-item [item]="item" />
} @empty {
  <p>No items found</p>
}

@switch (status()) {
  @case ('pending') { <span>Pending</span> }
  @case ('active') { <span>Active</span> }
  @default { <span>Unknown</span> }
}
```

## Class y Style bindings

```html
<div [class.active]="isActive()">Single class</div>
<div [style.color]="textColor()">Styled text</div>
<div [style.width.px]="width()">With unit</div>
```

## Content Projection

```typescript
@Component({
  selector: 'app-card',
  template: `
    <header><ng-content select="[card-header]" /></header>
    <main><ng-content /></main>
    <footer><ng-content select="[card-footer]" /></footer>
  `,
})
export class Card {}
```

## Lifecycle

```typescript
constructor() {
  afterNextRender(() => { /* DOM manipulation, SSR-safe */ });
}
ngOnInit() { /* Component initialized */ }
ngOnDestroy() { /* Cleanup */ }
```

## Accesibilidad (obligatorio)

- ARIA attributes en elementos interactivos
- Keyboard navigation (`keydown.enter`, `keydown.space`)
- Focus visible indicators
- WCAG AA compliance

```typescript
host: {
  'role': 'switch',
  '[attr.aria-checked]': 'checked()',
  '[attr.aria-label]': 'label()',
  'tabindex': '0',
  '(keydown.space)': 'toggle(); $event.preventDefault()',
}
```

Ver patrones avanzados en `references/component-patterns.md`.
