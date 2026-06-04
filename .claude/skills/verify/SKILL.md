---
name: verify
description: >
  Verificación visual con Playwright MCP. Activar cuando se implemente o modifique
  un componente Angular, se resuelva un fix visual, o antes de cerrar un track SDD con UI.
  El agente usa el navegador real para confirmar renderizado, errores de consola,
  modo oscuro/claro, responsive y cumplimiento del Design System.
  Requiere ng serve activo en localhost:4200.
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash, mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_console_messages, mcp__playwright__browser_snapshot, mcp__playwright__browser_evaluate, mcp__playwright__browser_resize, mcp__playwright__browser_click, mcp__playwright__browser_wait_for, mcp__playwright__browser_hover
---

# Skill: Verificación Visual (Playwright MCP)

El agente ya **tiene ojos**. Este skill define el protocolo canónico para usarlos.

## Prerequisitos

`ng serve` debe estar corriendo en `http://localhost:4200`.
Si no está activo, pedir al usuario que lo lance con `! ng serve`.

## Protocolo Estándar (5 pasos)

### 1. Navegar a la ruta objetivo

```
browser_navigate(url: "http://localhost:4200/<ruta>")
```

Si la ruta requiere autenticación, navegar primero a `/login`, autenticar y luego ir a destino.

### 2. Esperar carga completa

```
browser_wait_for(selector: "app-root", state: "visible")
```

Esperar también que las animaciones GSAP terminen (~1.5s):

```
browser_wait_for(timeout: 1500)
```

### 3. Captura inicial (modo claro)

```
browser_take_screenshot(name: "verify-light", fullPage: false)
```

Observar en la captura:
- ¿Se renderizó el componente objetivo?
- ¿Hay contenido real o skeleton?
- ¿Estructura bento grid correcta?
- ¿Tokens de color visualmente coherentes?

### 4. Verificar consola — Zero Error Policy

```
browser_console_messages()
```

**Tolerancia cero** para `ERROR` o `WARN` con stack trace.
Ignorar: mensajes de HMR, `[vite]`, Angular dev-mode warnings sin stack.

### 5. Captura en modo oscuro

```javascript
// Activar dark mode via atributo (igual que ThemeService)
browser_evaluate(script: `
  document.documentElement.setAttribute('data-mode', 'dark');
`)
browser_wait_for(timeout: 300)
browser_take_screenshot(name: "verify-dark")
// Restaurar
browser_evaluate(script: `
  document.documentElement.removeAttribute('data-mode');
`)
```

## Checks Automatizados del Design System

Ejecutar vía `browser_evaluate` para detección determinista de violaciones:

### Colores hardcodeados en inline styles

```javascript
const violations = [...document.querySelectorAll('[style]')]
  .filter(el => /color\s*:\s*#|background(-color)?\s*:\s*#/i.test(el.getAttribute('style')))
  .map(el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
console.log('Hardcoded colors:', violations);
```

### Emojis en UI

```javascript
const emojiRx = /[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}]/gu;
const hits = [...document.querySelectorAll('button, span, p, h1, h2, h3, a, label')]
  .filter(el => emojiRx.test(el.textContent || ''))
  .map(el => el.tagName + ': ' + el.textContent?.trim().slice(0, 40));
console.log('Emoji violations:', hits);
```

### SVG inline fuera de app-icon

```javascript
const looseSvgs = [...document.querySelectorAll('svg')]
  .filter(svg => !svg.closest('app-icon, lucide-icon'))
  .map(svg => svg.closest('[class]')?.className || 'root');
console.log('Loose SVGs:', looseSvgs);
```

### Estructura bento grid en Smart Components

```javascript
const hasBento = !!document.querySelector('.bento-grid');
console.log('Bento grid present:', hasBento);
```

### AI-Readability (data-llm-action)

```javascript
// Botones de mutación sin data-llm-action
const missing = [...document.querySelectorAll('button[type="submit"], button[class*="primary"]')]
  .filter(btn => !btn.dataset.llmAction)
  .map(btn => btn.textContent?.trim().slice(0, 30));
console.log('Missing data-llm-action:', missing);
```

## Verificación Responsive

```
browser_resize(width: 375, height: 812)    // Mobile
browser_take_screenshot(name: "verify-mobile")

browser_resize(width: 1280, height: 800)   // Desktop (restaurar)
browser_take_screenshot(name: "verify-desktop")
```

## Cuándo ejecutar este skill

| Situación | Obligatorio |
|-----------|-------------|
| Nuevo componente en `shared/` | ✅ |
| Nuevo Smart Component en `features/` | ✅ |
| Fix track con cambios visuales | ✅ |
| `/spec-verify` con ACs de UI | ✅ |
| Cambios en `src/styles/` | ✅ |
| Solo lógica pura (`core/utils/`) | ❌ No aplica |
| Solo migración SQL | ❌ No aplica |

## Formato de Reporte

Al terminar, emitir este bloque:

```
## Verificación Visual — [ComponentName]

### Capturas
- Modo claro: [observaciones breves]
- Modo oscuro: [observaciones breves]
- Mobile 375px: [observaciones breves]

### Consola: ✅ Limpia / ⚠️ N warnings / ❌ N errores

### Design System
- Colores: ✅ Tokens / ❌ [qué elemento]
- Emojis: ✅ Ninguno / ❌ [dónde]
- Íconos: ✅ app-icon / ❌ SVG suelto en [dónde]
- Bento grid: ✅ Presente / ❌ Ausente

### Issues
1. [descripción] — Severidad: High | Medium | Low
```
