# Hotfix: `[disabled]="true"` en control reactivo dispara warning de Angular

> id: hotfix-006-i-disabled-attribute-reactive-form-configuracion-web
> refs: fix-037-i-qa-visual-piloto, ASG-i-020
> status: done
> created: 2026-09-22
> closed: 2026-09-24

## Problema

`general-tab.component.ts:81` usa `[disabled]="true"` en el atributo del template de un
`p-select` que además tiene `formControlName="theme"` (control de un Reactive Form):

```html
<p-select
  formControlName="theme"
  [options]="temaOptions"
  optionLabel="label"
  optionValue="value"
  styleClass="w-full opacity-80"
  [disabled]="true"
/>
```

Angular emite el warning conocido `NG01050`-style de `ReactiveFormsModule` (`"It looks like
you're using the disabled attribute with a reactive form directive..."`) porque el estado
`disabled` de un control de Reactive Forms debe fijarse en el `FormControl`
(`{value: ..., disabled: true}` o `.disable()`), no vía el atributo `[disabled]` del template —
si no, hay riesgo de desincronización entre el DOM y el estado del control.

Encontrado durante `fix-037-i-qa-visual-piloto` (QA del piloto), Bloque C recorrido
"Configuración Web": sin impacto funcional visible (el select efectivamente se muestra
deshabilitado), pero ensucia la consola en cada carga de la pestaña "General".

## Cambio

- **`general-tab.component.ts`** — quitar `[disabled]="true"` del template y, en su lugar,
  crear el `FormControl` de `theme` ya deshabilitado en el `FormGroup`
  (`theme: new FormControl({ value: ..., disabled: true })`) o llamar
  `.get('theme')?.disable()` tras construir el form. El comportamiento visual/funcional no
  cambia — el campo sigue bloqueado, solo se fija correctamente en el control en vez del DOM.

## Test de Regresión

- Verificación manual: `/verify` en `admin/configuracion-web` pestaña "General", confirmando
  0 warnings de consola y que el selector de Tema Visual sigue mostrándose deshabilitado con el
  texto "El tema visual está fijado para cada sede."

## Evidencia de Verificación

- **2026-09-24:** el control `theme` vive en `admin-configuracion-web.component.ts:385`
  (`fb.group` raíz, no en `general-tab.component.ts` donde solo se consume vía `[formGroup]`).
  Cambiado a `[{ value: 'azul', disabled: true }, Validators.required]` y removido
  `[disabled]="true"` del template en `general-tab.component.ts`. Confirmado que
  `form.patchValue()` (línea 613) y `form.getRawValue()` (línea 702) siguen poblando/leyendo
  el valor de `theme` correctamente pese a estar deshabilitado — `patchValue`/`getRawValue`
  de Angular siempre incluyen controles disabled, a diferencia de `.value`, así que no hay
  regresión funcional.
  - `tsc --noEmit` limpio. `npm run test:ci`: 2670/2670 verdes (5 skipped, sin relación).
  - **Verificado en vivo con Playwright** en `/app/admin/configuracion-web`, sede
    "Autoescuela Chillán": el selector "Tema Visual" sigue mostrándose deshabilitado (opacidad
    reducida) con el valor correcto precargado ("Roja (Red/Orange)") y el texto explicativo
    intacto. 0 mensajes de warning/error en toda la consola de la sesión.
