# ConfirmModalService

## Propósito

Modal de confirmación con promesa. Muestra un diálogo confirmar/cancelar y devuelve `Promise<boolean>` (true = confirmado, false = cancelado).

## API pública

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `config` | `Signal<ConfirmConfig \| null>` | Configuración actual (null = cerrado) |
| `isOpen` | `ComputedSignal<boolean>` | true si el modal está visible |
| `confirm(config)` | `Promise<boolean>` | Muestra el modal y devuelve la promesa |
| `accept()` | `void` | Resuelve con true (llamado por el botón confirmar) |
| `cancel()` | `void` | Resuelve con false (llamado por el botón cancelar) |

### ConfirmConfig

```typescript
interface ConfirmConfig {
  title: string;
  message: string;
  severity?: 'danger' | 'warn' | 'success' | 'info' | 'secondary';
  confirmLabel?: string;
  cancelLabel?: string;
}
```

## Cuándo usarlo

- Eliminar registro ("¿Eliminar alumno X?")
- Confirmar acción destructiva o irreversible
- Cualquier flujo que requiera confirmación explícita del usuario

## Cuándo no usarlo

- Para modales genéricos con contenido custom → `app-modal`
- Para alertas informativas → `app-alert-card` o PrimeNG Message

## Dependencias

- Ninguna. El host `app-confirm-modal` debe estar en el layout para renderizar el modal.
