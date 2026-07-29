# fix-025-m — Fase 2: globalizar tokens de campo y propagar `app-drawer-form`

## Contexto

fix-024 introdujo el shell `app-drawer-form` y migró 2 pilotos (aprobados por el
dueño). Quedaron 2 fuentes de drift por resolver:

1. Las clases `.field-label`/`.field-input`/`.field-error`/`.field-success`/
   `.section-title` están **duplicadas localmente en ~20 componentes** (cada
   `styles:` tiene su propia copia). Cualquier ajuste hay que hacerlo 20 veces.
2. El resto de **drawers de formulario** todavía no usa el shell, así que
   persiste la inconsistencia de fondo/ancho/footer que motivó fix-024.

## Cambio

### Fundación (este primer entregable)

1. **Nuevo global** `src/styles/components/_form-fields.scss` con los tokens de
   campo canónicos (`form-ux §2`), cableado en `src/styles.scss`.
2. Los pilotos (`task-create`, `admin-relator-crear`) **dejan de definir** las
   clases localmente y pasan a consumir las globales (prueba de no-regresión).

### Propagación (lotes siguientes, revisables)

3. Migrar el resto de **drawers de formulario** a `app-drawer-form` + clases
   globales, en lotes. Los drawers de **solo lectura / datos** (ver-detalle,
   agenda, pago-detalle, alerts, recent-activity, horas/horario) **NO** se tocan.
4. Cleanup: remover las copias locales de `.field-*` de los componentes migrados.

## Receta mecánica de migración (por drawer de formulario)

Aplicar a cada componente `*-drawer.component.ts` de formulario:

1. Import: `import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';`
2. Agregar `DrawerFormComponent` al array `imports:` del `@Component`.
3. Envolver el cuerpo en `<app-drawer-form>`:
   - Si usa `app-drawer-content-loader`: insertar `<app-drawer-form>` justo después de `<ng-template #content>` y `</app-drawer-form>` justo antes de `</ng-template>`.
   - Si NO usa content-loader (Patrón B): envolver todo el contenido raíz del template.
4. Footer: reemplazar el `<div>` de acciones (el que tiene `border-top`) por
   `<ng-container ngProjectAs="[drawer-form-footer]"> …botones… </ng-container>`.
   Botones canónicos: `btn-secondary` (Cancelar) + `btn-primary flex items-center gap-2` (acción).
   Quitar `flex-1`/`flex-[2]` de los botones.
5. (Cleanup) borrar de `styles:` las clases `.field-*` y `.section-title` (ahora globales).
   Conservar clases propias del componente (spec-chip, toggle-btn, license-badge, estado-btn, etc.).

Validar el lote con `ng build` (no por archivo). Los de solo-lectura NO se tocan.

### Checklist de propagación

Hechos (fix-024 + fix-025-m): task-create, relator-crear, relator-editar, instructor-crear, instructor-editar.

Pendientes:
- [x] secretarias-crear, secretarias-editar
- [x] promocion-crear, promocion-editar
- [x] registrar-pago, registrar-egreso, registrar-gasto-fijo (contabilidad-reportes), registrar-anticipo
- [x] curso-singular-crear, curso-singular-cobro, curso-singular-inscribir (cobro/inscribir con `[hasFooter]="false"`)
- [x] vehicle-form, maintenance-form, dms-upload, dms-template
- [x] admin-inasistencia, admin-editar-perfil, admin-sesion (`[hasFooter]="false"`), agregar-servicio, registrar-venta
- [~] Evaluar aparte (tabs / UI especial): iniciar-clase, finalizar-clase, configurador-horarios, ajustes, admin-pre-inscrito → **NO migrados** (UI de tabs/settings sin footer canónico; convergencia diferida por el dueño, consistente con la decisión de arquitectura de drawers).

NO tocar (solo lectura / datos): *-ver-drawer, agenda-slot-detail, pago-detalle, alerts, recent-activity, alumnos-por-vencer, instructor-horas/horario, student-drawer-detail, curso-singular-detalle, vehicle-agenda/documents.

## Acceptance Criteria

- [x] Existe `src/styles/components/_form-fields.scss` con `.field-label`,
      `.field-input` (+ `--error`/`--valid`), `.field-hint`, `.field-error`,
      `.field-success`, `.section-title`; cableado en `src/styles.scss`.
- [x] `task-create` y `relator-crear` ya no definen esas clases localmente y se
      ven igual (consumen las globales). `ng build` verde.
- [x] Cada lote de propagación deja `npm run test:ci` sin regresiones y `tsc`
      limpio. `ng build` verde; `npm run test:ci` = 1081 pass / 1 fail
      preexistente y no relacionado (`auth.facade.spec` timeout `whenReady`,
      archivo no tocado). Verificación visual por el dueño pendiente en `ng serve`.

## Cierre

Fase 2 completa: 20 drawers de formulario migrados a `app-drawer-form` (footer
canónico proyectado, o `[hasFooter]="false"` en los de tabs/lista/wizard sin
footer único). El cleanup de las copias locales de `.field-*`/`.section-title`
se **difirió** intencionalmente (local gana sobre global con valores idénticos →
sin regresión visual); queda como tarea de higiene futura. Los drawers de solo
lectura y los de tabs/settings especiales no se tocaron.
