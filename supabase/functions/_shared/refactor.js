const fs = require('fs');
const path = require('path');

const functionsDir = 'd:/Autoescuela/supabase/functions';

function refactorFile(funcName, importPath) {
  const filePath = path.join(functionsDir, funcName, 'index.ts');
  if (!fs.existsSync(filePath)) {
    console.log('Not found:', filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not present
  if (!content.includes('import {')) {
    // Actually we just insert it after the supabase import
    const importStr = `\nimport { escapePdfWinAnsi, textWidth, loadPngForPdf, assemblePdf, wrapLines as wrap } from '${importPath}';\n`;
    content = content.replace(/(import \{ createClient \} from '[^']+';)/, `$1\n${importStr}`);
  }

  // Remove the PDF Primitives and Assembler block
  // We look for the start of Primitives and the start of the next section
  const startMarker = '// ══════════════════════════════════════════════════════════════════════════════\n// PDF Primitives';
  const endMarker = '// ══════════════════════════════════════════════════════════════════════════════\n// PDF Builder';

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + content.substring(endIndex);
    fs.writeFileSync(filePath, content);
    console.log('Refactored', funcName);
  } else {
    console.log('Could not find markers in', funcName);
  }
}

// 1. Certificate B
refactorFile('generate-certificate-b-pdf', '../_shared/pdf-utils.ts');

// 2. Certificate Professional
refactorFile('generate-certificate-professional-pdf', '../_shared/pdf-utils.ts');

