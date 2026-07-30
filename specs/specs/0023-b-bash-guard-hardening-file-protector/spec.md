# Spec 0023-b — Hardening del Bash Guard: File Protector para comandos de shell

> **Status:** draft
> **Created:** 2026-07-01
> **Owner:** Akxlarre
> **Priority:** P2
> **Modelo Claude:** `claude-fable-5` (Fable 5) — razonamiento adversarial de seguridad: hay que pensar como el agente que hace el bypass (variantes de PowerShell, redirecciones, encodings) y calibrar la heurística sin bloquear el trabajo legítimo. ⚠️ Además, TODO el cambio vive en `.claude/hooks/` (protegido): **el agente redacta el diff, el humano lo aplica**.

---

## 1. Contexto de negocio

**Origen:** Demostración práctica del 2026-07-01: el agente editó `scripts/architect.js`
(protegido por File Protector) vía PowerShell con `[System.IO.File]::WriteAllText`, con
autorización explícita del humano — pero el episodio probó que **el guard no cubre el canal
Bash/PowerShell en absoluto**.

**Persona afectada:** El humano dueño de los guardrails: hoy su protección es efectiva solo
contra Edit/Write, que es justamente el canal donde el agente es más obediente.

**Problema que resuelve:**
El File Protector intercepta Edit/Write/MultiEdit; el Bash Guard solo bloquea la *creación*
de `.ts/.html/.scss`. Un agente (o un prompt-injection en contenido que el agente procese)
puede modificar `architect.js`, `settings.json` o los hooks mismos con una línea de shell.
El objetivo NO es un sandbox hermético (parsear shell perfectamente es imposible): es **subir
el costo de un bypass accidental o casual**, que pase de "una línea obvia" a "ofuscación
deliberada" — y que la ofuscación deliberada quede fuera del comportamiento esperable de un
agente alineado.

**Hipótesis de valor:**
El canal de escritura por shell queda al mismo nivel de fricción que Edit/Write para los
paths protegidos, cerrando el hueco demostrado.

---

## 2. User Stories

- **US1**: Como humano, quiero que un comando de shell que escriba sobre un path protegido
  sea bloqueado con el mismo mensaje del File Protector, para que la protección sea coherente
  entre canales.
- **US2**: Como agente, quiero poder seguir **leyendo** los archivos protegidos por shell
  (`Select-String`, `git diff`, `Get-Content`), para diagnosticar sin fricción.
- **US3**: Como humano, quiero un mecanismo de override explícito y auditable (variable de
  entorno o flag que solo yo seteo), para autorizar una edición puntual sin editar el hook.

---

## 3. Acceptance Criteria (Gherkin)

> El hook PreToolUse de Bash/PowerShell recibe el comando como string. La detección es
> heurística por diseño; estos ACs definen el piso, no el techo.

- **AC1 (escritura directa bloqueada)**: Given un comando que contiene un path protegido
  (`scripts/architect.js`, `.claude/hooks/`, `.claude/settings*.json`) junto a un verbo de
  escritura conocido (`Set-Content`, `Out-File`, `Add-Content`, `WriteAllText`, `WriteAllLines`,
  `Copy-Item`/`Move-Item`/`Remove-Item` con el path como destino, `>`/`>>` redirect, `tee`,
  `sed -i`, `mv`/`cp`/`rm` en bash), When el hook lo evalúa, Then exit 2 con el mensaje del
  File Protector.
- **AC2 (el bypass histórico muere)**: Given el comando literal usado el 2026-07-01
  (`[System.IO.File]::WriteAllText('scripts/architect.js', ...)`), Then queda bloqueado.
- **AC3 (lectura pasa)**: Given comandos de solo lectura sobre paths protegidos
  (`Select-String ... architect.js`, `Get-Content .claude/settings.json`, `git diff --
  scripts/architect.js`, `node scripts/architect.js`), Then pasan sin fricción.
- **AC4 (override auditable)**: Given la variable `KOA_GUARD_OVERRIDE=1` en el entorno (u
  otro mecanismo que solo el humano setea fuera de la sesión del agente), Then el bloqueo se
  omite y el hook imprime una línea de auditoría indicando que corrió con override.
- **AC5 (fail-open ante error interno)**: Given un error interno del hook (JSON malformado,
  excepción), Then permite la operación (consistente con el fail-open actual de
  `pre-write-guard.js`) — el guard nunca debe romper el trabajo normal.
- **AC6 (test suite del hook)**: Given una lista de ≥15 comandos fixture (bloqueables,
  legítimos y ambiguos), When corre el test del hook (script node standalone, sin framework),
  Then cada uno produce el veredicto esperado — y la suite queda como regresión para futuras
  ediciones del hook.

### Edge cases obligatorios

- **AC-E1 (path con separadores mixtos)**: Given `scripts\architect.js` (backslash) o path
  absoluto `C:\...\scripts\architect.js`, Then también se detecta (normalizar antes de
  comparar).
- **AC-E2 (honestidad sobre límites)**: Given técnicas de ofuscación (variables intermedias,
  base64, concatenación de strings), Then NO se pretende detectarlas: el límite queda
  documentado en el propio hook y en HOOKS-SYSTEM.md.
- **AC-E3 (npm scripts)**: Given `npm run lint:arch` (que *ejecuta* architect.js), Then pasa —
  ejecutar no es escribir.

---

## 4. Out of scope

- ❌ Sandbox real de shell o parsing completo de PowerShell/bash.
- ❌ Proteger paths nuevos (la lista de protegidos no cambia en esta spec).
- ❌ Cubrir otros canales (MCP filesystem, NotebookEdit) — spec futura si se detecta uso.

---

## 5. Dependencias

### Specs previas
- Ninguna.

### Capacidades del proyecto que se asumen existentes
- Hook system con PreToolUse sobre Bash en `.claude/settings.json` + `.claude/hooks/`.
- `pre-write-guard.js` con la lista `protectedPatterns` (se extrae a constante compartida o
  se duplica con comentario de sincronía — decidir en plan.md).

### Capacidades nuevas requeridas
- ⚠️ **Constraint estructural:** todos los archivos a tocar están protegidos por el propio
  File Protector. Flujo obligado: el agente entrega el diff completo + la suite de fixtures
  (AC6) en el track; **el humano aplica los cambios a mano** y corre la suite para verificar.

---

## 6. Datos y modelo (preliminar)

No aplica.

---

## 7. UX y flujos (preliminar)

Mensaje de bloqueo idéntico en tono al File Protector actual, agregando: "Canal shell
bloqueado para paths protegidos. Para autorizar una edición puntual: KOA_GUARD_OVERRIDE=1
(solo el humano)."

---

## 8. Métricas de éxito post-launch

- El comando del bypass del 2026-07-01 reproducido tal cual → bloqueado (AC2 verificado).
- Cero falsos positivos reportados en el trabajo diario durante la primera semana.

---

## 9. Notas / decisiones abiertas

- [ ] ¿El override (AC4) es variable de entorno, archivo-flag temporal en `.claude/temp/`, o
  edición manual del hook? (Propuesta: archivo-flag `koa-guard-override.flag` que el humano
  crea y el hook borra tras un uso — autoexpira.)
- [ ] ¿Vale la pena avisar (warning no bloqueante) cuando un comando *lee* settings.json,
  como telemetría de intentos? (Propuesta: no — ruido.)

---

## Changelog

- 2026-07-01 — draft inicial por Akxlarre (redactado por Claude a partir del bypass demostrado en sesión).
