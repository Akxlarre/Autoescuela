# Hotfix: Textos de Certificados Profesional (ficha, historial y selectores)
> id: hotfix-167-m-textos-certificados-profesional
> refs: fix-480-m-testing-certificacion-profesional
> status: done
> closed: 2026-10-22
> created: 2026-10-22

## Problema
Detalles de texto vistos en el testing de Certificados Profesional:

- Ficha del alumno Profesional: el panel central dice que "el certificado de Clase Profesional" se
  registra en módulos no disponibles, pero el certificado ya se emite (`fix-465-m`). Y el botón
  "Ver/Generar Certificado" queda solo en una grilla de 2 columnas y se corta ("Ver Certifi…").
- Historial de emisiones: con un curso elegido muestra solo ese curso, pero dice "N registros de
  emisión de certificados Clase Profesional", como si fuera el total.
- Selectores: "278 — Promoción 278 (…)" y "Profesional A2 (A2)" repiten datos, y los cursos salen
  en el orden de la base (A3, A2, A4, A5).

## Cambios
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — el
  texto deja de mencionar el certificado; la grilla de acciones usa una columna cuando hay una sola.
- **Archivo:** `src/app/features/admin/profesional-certificados/drawers/historial-emisiones-prof-drawer.component.ts`
  — el texto dice si son los registros del curso elegido o los más recientes.
- **Archivo:** `src/app/core/facades/certificacion-profesional.facade.ts` (+ spec) — al elegir o
  quitar un curso se recarga el historial: antes solo se recargaba al emitir, así que mostraba el
  curso de la última emisión o todas las promociones según lo último que se hizo.
- **Archivo:** `src/app/core/utils/professional-certificate.utils.ts` (+ spec) —
  `promocionCertLabel()` y `cursoCertLabel()`; el facade las usa y ordena los cursos por clase.

## Verificación
- Tests: utils + facade + ficha 98/98; `tsc` limpio; `lint:arch` 0 errores.
- Navegador (2026-10-22): selectores "Promoción 277 (…)" / "103 — Promoción 15 de Junio 2026" y
  cursos A2, A3, A4, A5; historial del curso A2 "2 registros de emisión del curso seleccionado";
  ficha 0099 con "Ver Certificado" a todo el ancho y el texto sin mencionar el certificado.
