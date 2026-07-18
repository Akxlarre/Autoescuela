# hotfix-001-m — Date Input UX: prevent free-text + better calendar navigation

## Problema
El campo `app-date-input` (usado en el paso de datos personales de matrícula pública)
permite tipeo libre de texto sin máscara, lo que causa entradas inválidas (ej: "22222222").

## Cambios

### 1. `date-input.component.ts`
- Agregar `readonlyInput = input<boolean>(false)` — previene tipeo directo cuando `true`
- Agregar `showOnFocus = input<boolean>(true)` — abre el calendario al hacer focus/click en el input
- Bindings en el template de `p-datepicker`

### 2. `personal-data.component.html`
- Agregar `[readonlyInput]="true"` en `app-date-input` de fecha de nacimiento
- Agregar `[max]="maxBirthDate"` para prevenir fechas futuras

### 3. `personal-data.component.ts`
- Agregar `readonly maxBirthDate = toISODate(new Date())` para el bound de fecha máxima

## Acceptance Criteria
- [x] El campo fecha de nacimiento no permite tipeo libre — solo el calendar picker
- [x] El calendario se abre al hacer click/focus en cualquier parte del campo
- [x] No se pueden seleccionar fechas futuras (max = hoy)
- [x] `app-date-input` expone `readonlyInput` y `showOnFocus` como inputs opcionales para futuros usos
