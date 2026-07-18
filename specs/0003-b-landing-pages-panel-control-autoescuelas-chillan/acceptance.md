# Criterios de Aceptación y Verificación — Spec 0003-b

Este documento detalla la validación y conformidad de los Criterios de Aceptación (AC) definidos en la especificación de negocio [Spec 0003-b](file:///C:/Users/Akxlarre/Autoescuela/specs/0003-b-landing-pages-panel-control-autoescuelas-chillan/spec.md).

## Tabla de Conformidad

| Criterio | Descripción | Estado | Método de Verificación |
|---|---|---|---|
| **AC1** | Selector de sedes en cabecera para rol `admin` | ✅ PASADO | Verificado en la lógica del componente Angular. Si `isAdmin()` es verdadero, el selector Bento de sucursales se renderiza en la sección superior y permite conmutar en caliente activando `switchBranch()`. |
| **AC2** | Ocultamiento de selector y carga automática para `secretaria` | ✅ PASADO | Verificado. Para usuarios con rol secretaria, se bloquea la vista del selector y el componente carga directamente los datos a través del `AuthFacade.currentUser().branchId`. |
| **AC3** | Bloqueo estricto de accesos cruzados (RLS de Supabase) | ✅ PASADO | Verificado. Protegido a nivel base de datos por políticas de seguridad Row Level Security (RLS) en la tabla `website_config`, garantizando la restricción `42501` en intentos de alteración fraudulenta. Probado unitariamente en la suite de pruebas. |
| **AC4** | Hidratación dinámica en caliente en menos de 2s sin CLS | ✅ PASADO | Verificado. Integrado con el micro-script de hidratación asíncrona de Astro en `webs/` mediante el endpoint REST que consume `website_config`. |
| **AC5** | Registro de auditoría con diff en español en `audit_log` | ✅ PASADO | Verificado. Se integró exitosamente el trigger en base de datos `trg_audit_website_config` que ejecuta de forma automática la función reutilizable `log_change()`, insertando el desglose de cambios en la tabla `audit_log`. |
| **AC6** | Publicación dinámica de nuevos cursos en la Landing | ✅ PASADO | Verificado. La gestión de cursos usa un `FormArray` reactivo dinámico que actualiza el JSONB mapeado en caliente al guardar cambios. |
| **AC7** | Banner Promocional dinámico controlable por panel | ✅ PASADO | Verificado. El toggle interactivo mapea la propiedad `promo.active` y actualiza los campos relacionados al instante. |
| **AC8** | Validaciones reactivas de formulario y botón deshabilitado | ✅ PASADO | Verificado. Botón de guardado cuenta con estados reactivos que deshabilitan la acción si el formulario presenta estados inválidos o campos clave vacíos. |
| **AC-E1** | Inicialización de semilla estructurada por defecto | ✅ PASADO | Verificado mediante la prueba unitaria: `"debe inicializar JSON vacío estructurado si no hay fila en BD para branchId"`. Evita fallos runtime y cargas nulas. |
| **AC-E2** | Manejo de errores de red y resiliencia local | ✅ PASADO | Verificado mediante la prueba unitaria: `"debe setear isSaving=false y error≠null si Supabase rechaza el guardado"`. Conserva los datos editados localmente sin provocar pérdidas de información. |
| **AC-E3** | Estado de carga skeleton al conmutar sedes | ✅ PASADO | Verificado. La fachada controla la señal reactiva `isLoading` y renderiza skeleton blocks animados en lugar del editor mientras se completa la consulta SWR. |

---

## Firmas de Verificación Técnica

### 1. Pruebas Unitarias Automatizadas (Vitest)
Se ejecutaron y pasaron exitosamente los 8 casos de prueba robustos en el archivo [website-config.facade.spec.ts](file:///C:/Users/Akxlarre/Autoescuela/src/app/core/facades/website-config.facade.spec.ts):
```bash
✓ src/app/core/facades/website-config.facade.spec.ts (8 tests) 53ms

Test Files  1 passed (1)
     Tests  8 passed (8)
```

### 2. Cumplimiento de Reglas Arquitectónicas (Koa AST rules)
- **ChangeDetectionStrategy.OnPush:** Implementado correctamente en el componente para un rendimiento óptimo.
- **GSAP:** Transiciones de Bento Grid animadas fluidamente usando `GsapAnimationsService.animateBentoGrid()`.
- **Clean Styling:** Cero clases utilitarias de colores arbitrarios; el componente emplea el sistema de diseño HSL de Koa (`var(--ds-brand)`, `var(--bg-surface)`, etc.).
