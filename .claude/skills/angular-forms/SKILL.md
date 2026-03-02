---
name: angular-forms
description: >
  Implementar formularios en Angular v20+.
  Activar cuando se pida crear un formulario, agregar validación, implementar
  formularios multi-step o con campos condicionales.
  Usa Signal Forms (experimental v21+) para proyectos nuevos, Reactive Forms para producción estable.
user-invocable: false
allowed-tools: Read, Edit, Write, Glob, Grep
---

# Angular Forms — Signal Forms & Reactive Forms

## Signal Forms (Angular v21+ experimental)

```typescript
import { Component, signal } from '@angular/core';
import { form, FormField, required, email } from '@angular/forms/signals';

interface LoginData { email: string; password: string; }

@Component({
  selector: 'app-login',
  imports: [FormField],
  template: `
    <form (submit)="onSubmit($event)">
      <input type="email" [formField]="loginForm.email" />
      @if (loginForm.email().touched() && loginForm.email().invalid()) {
        <p class="error">{{ loginForm.email().errors()[0].message }}</p>
      }
      <input type="password" [formField]="loginForm.password" />
      <button type="submit" [disabled]="loginForm().invalid()">Login</button>
    </form>
  `,
})
export class Login {
  loginModel = signal<LoginData>({ email: '', password: '' });

  loginForm = form(this.loginModel, (s) => {
    required(s.email, { message: 'Email requerido' });
    email(s.email, { message: 'Email inválido' });
    required(s.password, { message: 'Password requerido' });
  });

  onSubmit(event: Event) {
    event.preventDefault();
    submit(this.loginForm, async () => {
      await this.authService.login(this.loginModel());
    });
  }
}
```

## Validadores built-in

```typescript
import { required, email, min, max, minLength, maxLength, pattern, validate } from '@angular/forms/signals';

const userForm = form(this.userModel, (s) => {
  required(s.name, { message: 'Nombre requerido' });
  email(s.email);
  min(s.age, 18, { message: 'Debe ser mayor de edad' });
  minLength(s.password, 8, { message: 'Mínimo 8 caracteres' });
  pattern(s.phone, /^\d{3}-\d{3}-\d{4}$/, { message: 'Formato: 555-123-4567' });

  // Validación condicional
  required(s.promoCode, {
    message: 'Código requerido para descuentos',
    when: ({ valueOf }) => valueOf(s.applyDiscount),
  });

  // Validación cruzada
  validate(s.confirmPassword, ({ value, valueOf }) => {
    if (value() !== valueOf(s.password)) {
      return { kind: 'mismatch', message: 'Las contraseñas no coinciden' };
    }
    return null;
  });
});
```

## Estado de campo

```typescript
const f = this.form.email();
f.valid()     // pasa validación
f.invalid()   // tiene errores
f.errors()    // array de errores
f.touched()   // focus + blur
f.dirty()     // modificado por el usuario
f.disabled()  // campo deshabilitado
f.pending()   // validación async en progreso
```

## Mostrar errores

```html
@if (form.email().touched() && form.email().invalid()) {
  <ul class="errors">
    @for (error of form.email().errors(); track error) {
      <li>{{ error.message }}</li>
    }
  </ul>
}
```

## Reactive Forms (producción estable)

Para producción usar `ReactiveFormsModule` con `FormBuilder`:

```typescript
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <input formControlName="email" />
      @if (form.get('email')?.touched && form.get('email')?.invalid) {
        <p>Email inválido</p>
      }
      <button type="submit" [disabled]="form.invalid">Enviar</button>
    </form>
  `,
})
export class LoginForm {
  private fb = inject(FormBuilder);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  onSubmit() {
    if (this.form.valid) {
      console.log(this.form.value);
    }
  }
}
```

Ver patrones avanzados en `references/form-patterns.md`.
