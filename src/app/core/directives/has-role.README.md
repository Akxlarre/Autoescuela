# HasRoleDirective

## Propósito

Directiva estructural para ocultar elementos según el rol del usuario. Permite RBAC declarativo sin lógica en el componente.

## Selector

`*appHasRole`

## Uso

```html
<button *appHasRole="'admin'">Solo administradores</button>
<div *appHasRole="['admin', 'member']">Visible para admin o member</div>
```

## Input

| Input | Tipo | Descripción |
|-------|------|-------------|
| `appHasRole` | `UserRole \| UserRole[]` | Rol o lista de roles permitidos (`'admin'` \| `'member'`) |

## Cuándo usarla

- Ocultar botones o secciones según rol
- Evitar lógica `*ngIf="auth.currentUser()?.role === 'admin'"` en templates

## Cuándo no usarla

- Para proteger rutas → usar `authGuard` y guards de rol en el router
- Para datos sensibles → la directiva solo oculta UI; la seguridad debe estar en el backend (RLS)
