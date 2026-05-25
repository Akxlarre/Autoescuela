const http = require('http');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// CONFIGURACIÓN (Ajusta estos valores según tus carpetas en cPanel)
const PORT = process.env.PORT || 9000;
const SECRET_TOKEN = process.env.PUBLISH_SECRET || 'mi-clave-super-secreta-123';

// Rutas absolutas del servidor cPanel
const PROJECT_DIR = path.resolve(__dirname, '..');
const WEBS_DIR = path.join(PROJECT_DIR, 'webs');

// Rutas de destino públicas de tu cPanel para cada marca (donde apunta el dominio)
const DEST_DIR_AZUL = process.env.DEST_DIR_AZUL || '/home/akxlarre/public_html/autoescuelachillan.cl';
const DEST_DIR_ROJA = process.env.DEST_DIR_ROJA || '/home/akxlarre/public_html/conductoreschillan.cl';

let isBuilding = false;

// Función para copiar archivos de forma recursiva
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Función principal de compilación y despliegue local
function runBuildAndDeploy() {
  if (isBuilding) {
    console.log('[cPanel Webhook] Ya hay una compilación en curso. Ignorando.');
    return;
  }

  isBuilding = true;
  console.log('[cPanel Webhook] Iniciando sincronización y compilación local...');

  // 1. Alinea las configuraciones locales con Supabase
  const alignScript = path.join(PROJECT_DIR, 'scratch', 'align_configs.js'); // Usamos el script existente
  
  // Determinamos qué script usar (el de scratch o copiamos uno local en scripts)
  const alignCmd = fs.existsSync(alignScript) 
    ? `node "${alignScript}"`
    : `node -e "console.log('No align script found')"`;

  const buildCmd = `npm run build:all`;

  exec(`${alignCmd} && ${buildCmd}`, { cwd: WEBS_DIR }, (error, stdout, stderr) => {
    if (error) {
      console.error('[cPanel Webhook] ❌ Error durante la compilación:', error);
      isBuilding = false;
      return;
    }

    console.log('[cPanel Webhook] ✅ Compilación exitosa.');
    console.log(stdout);

    try {
      // 2. Mover archivos compilados localmente a sus carpetas públicas en cPanel
      const distAzul = path.join(WEBS_DIR, 'dist', 'azul');
      const distRoja = path.join(WEBS_DIR, 'dist', 'roja');

      if (fs.existsSync(distAzul) && fs.existsSync(DEST_DIR_AZUL)) {
        console.log(`[cPanel Webhook] Desplegando Sede Azul a: ${DEST_DIR_AZUL}`);
        copyRecursiveSync(distAzul, DEST_DIR_AZUL);
      } else {
        console.log('[cPanel Webhook] ⚠️ Directorio destino u origen de Sede Azul no disponible.');
      }

      if (fs.existsSync(distRoja) && fs.existsSync(DEST_DIR_ROJA)) {
        console.log(`[cPanel Webhook] Desplegando Sede Roja a: ${DEST_DIR_ROJA}`);
        copyRecursiveSync(distRoja, DEST_DIR_ROJA);
      } else {
        console.log('[cPanel Webhook] ⚠️ Directorio destino u origen de Sede Roja no disponible.');
      }

      console.log('[cPanel Webhook] 🎉 ¡Despliegue local completado exitosamente!');
    } catch (err) {
      console.error('[cPanel Webhook] ❌ Error copiando archivos estáticos:', err);
    } finally {
      isBuilding = false;
    }
  });
}

// Servidor HTTP
const server = http.createServer((req, res) => {
  // Solo aceptamos peticiones POST a la ruta /publish
  if (req.method === 'POST' && req.url === '/publish') {
    const incomingSecret = req.headers['x-publish-secret'];

    // Validar token de seguridad
    if (!incomingSecret || incomingSecret !== SECRET_TOKEN) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No autorizado. Token inválido.' }));
    }

    // Responder inmediatamente a Supabase para evitar timeout
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Compilación iniciada en segundo plano en cPanel.' }));

    // Ejecutar el build en segundo plano
    runBuildAndDeploy();
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Ruta no encontrada.' }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor de compilación cPanel escuchando en el puerto ${PORT}`);
});
