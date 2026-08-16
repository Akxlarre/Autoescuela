# Anexo de Transferencia Internacional de Datos — Sociedad Comercial Chillán Capacita Limitada

**Versión:** 1.0 · **Fecha:** 2026-08-16

> Ampara el envío de datos personales fuera de Chile. Se firma o se incorpora por referencia con **cada
> proveedor extranjero**. Mecanismo: **Cláusulas Contractuales Modelo** aprobadas por el Ministerio de
> Economía (Resolución RAEX202503748, Diario Oficial 19-12-2025).

---

## 1. Partes

- **Exportador de datos:** Sociedad Comercial Chillán Capacita Limitada, RUT 77.940.120-0, domicilio en
  Carrera 74, Chillán, Región de Ñuble (Chile).
- **Importadores de datos:** los proveedores individualizados en la sección 3.

## 2. Mecanismo de transferencia

Las partes adoptan las **Cláusulas Contractuales Modelo** del Ministerio de Economía como garantía
adecuada conforme a la Ley 21.719. El texto oficial se encuentra en
`.claude/skills/compliance-cl/sources/clausulas-modelo-transferencia-economia.pdf` y debe anexarse
íntegro o incorporarse por referencia expresa en el contrato con cada proveedor.

> **Importante:** el DPA estándar que ofrece cada proveedor **no basta por sí solo**. La transferencia
> debe estar respaldada por estas cláusulas modelo, o por otro mecanismo válido: decisión de adecuación
> del país de destino, normas corporativas vinculantes, o consentimiento expreso del titular para la
> transferencia específica.

## 3. Inventario de transferencias

| # | Importador | País de destino | Qué recibe | Finalidad | Rol | Mecanismo | Estado |
|---|---|---|---|---|---|---|---|
| 1 | **Supabase Inc.** | Estados Unidos `[CONFIRMAR la región concreta del proyecto en el panel de Supabase — puede ser EE.UU. o Sudamérica; si el proyecto está en São Paulo, el destino es Brasil]` | La totalidad de la base de datos: identificación de alumnos y trabajadores, expedientes con **certificado médico y cédula**, académicos, pagos, registros de auditoría con IP | Infraestructura de base de datos, almacenamiento de archivos y autenticación | Encargado | Cláusulas modelo | ❌ **Pendiente de incorporar** |
| 2 | **Google LLC** | Estados Unidos | Nombre y correo de alumnos, contenido de los correos enviados | Correo electrónico corporativo saliente | Encargado | Cláusulas modelo | ❌ **Pendiente de incorporar** |
| 3 | **Zoom Video Communications, Inc.** | Estados Unidos | Nombre, correo y registro de conexión | Clases en línea | Encargado | Cláusulas modelo | ❌ **Pendiente de incorporar** `[CONFIRMAR que efectivamente se usa Zoom y bajo qué plan]` |
| 4 | Proveedor del sistema de videovigilancia | `[COMPLETAR]` | Imágenes de las instalaciones | Seguridad | `[COMPLETAR]` | `[COMPLETAR]` | ❓ **Por determinar** — si las cámaras solo graban en un equipo local dentro del recinto, **no hay transferencia internacional** y esta fila se elimina. Si suben a la nube, hay que completarla |

## 4. Compromisos del importador

Cada importador se obliga a: tratar los datos **solo según las instrucciones** del exportador; aplicar
medidas de seguridad equivalentes a las exigidas por la ley chilena; **no transferir a terceros** sin
garantías equivalentes; **notificar sin dilación** cualquier vulneración de seguridad al exportador; y
colaborar ante las solicitudes de los titulares y de la Agencia de Protección de Datos Personales.

## 5. Declaración en la política de privacidad

Estas transferencias están declaradas en la sección 4 de `21719-politica-privacidad.md` ("Con quién
compartimos los datos"), como exige el deber de información del Art. 14 ter.

## 6. Qué hacer, en concreto

1. **Confirmar la región** del proyecto Supabase en el panel de administración. Es el dato que define el
   país de destino. Si es una región sudamericana, ajustar la fila 1.
2. Con cada proveedor: revisar si ya ofrece un adendum de tratamiento de datos y **anexarle las cláusulas
   modelo chilenas**. Con proveedores grandes como Supabase, Google y Zoom, esto normalmente se hace
   aceptando su adendum en línea y **archivando la constancia**, más la incorporación por referencia de
   las cláusulas modelo.
3. **Archivar la evidencia** de cada aceptación en esta carpeta. Ante una fiscalización, lo que se pide
   es el documento, no la afirmación de que existe.
4. Repetir el paso al **contratar cualquier proveedor nuevo** y al renovar los existentes.

---
*Borrador generado con compliance-cl (pack ley-21719). No constituye asesoría legal; es un borrador fundado en la normativa chilena vigente.*
