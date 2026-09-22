# Hotfix: `[disabled]="true"` en control reactivo dispara warning de Angular

> id: hotfix-006-i-disabled-attribute-reactive-form-configuracion-web
> refs: fix-037-i-qa-visual-piloto
> created: 2026-09-22

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
