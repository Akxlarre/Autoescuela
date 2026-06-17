const fs = require('fs');
const path = require('path');

function refactorFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if file uses .message in an error context
  const hasMessageCall = /\b(error|err|dbError|uploadError|contractError|paymentError|discountError|updateError|sessionsError|lvError|delError|insError|uploadErr|branchRes\.error)\.message\b/.test(content);
  
  if (!hasMessageCall) return false;

  const originalContent = content;

  // 1. Add ErrorSanitizerService import if not present
  if (!content.includes('ErrorSanitizerService')) {
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfLastImport = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, endOfLastImport + 1) + 
                `import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';\n` + 
                content.slice(endOfLastImport + 1);
    }
  }

  // 2. Ensure inject is imported from @angular/core
  if (!content.includes('inject(') && !content.includes('inject,')) {
      content = content.replace(/import\s+{([^}]*)}\s+from\s+'@angular\/core';/, (match, p1) => {
          if (!p1.includes('inject')) {
              return `import { ${p1.trim()}, inject } from '@angular/core';`;
          }
          return match;
      });
  }

  // 3. Inject sanitizer in class if not present
  if (!content.includes('sanitizer = inject(ErrorSanitizerService)')) {
    content = content.replace(/(export class \w+(?: implements \w+)? {\s*)/, `$1  private readonly sanitizer = inject(ErrorSanitizerService);\n`);
  }

  // 4. Replace variable.message with this.sanitizer.sanitize(variable).message
  const regex = /\b(error|err|dbError|uploadError|contractError|paymentError|discountError|updateError|sessionsError|lvError|delError|insError|uploadErr|branchRes\.error)\.message\b/g;
  
  content = content.replace(regex, (match, p1) => {
    return `this.sanitizer.sanitize(${p1}).message`;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Refactored: ${filePath}`);
    return true;
  }
  return false;
}

function walkDir(dir) {
  let count = 0;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      count += walkDir(fullPath);
    } else if (fullPath.endsWith('.ts') && !fullPath.endsWith('.spec.ts')) {
      if (refactorFile(fullPath)) {
        count++;
      }
    }
  }
  return count;
}

console.log('Starting mass refactor...');
let total = 0;
const targetDirs = [
  path.join(__dirname, 'src/app/core/facades'),
  path.join(__dirname, 'src/app/features')
];

for (const dir of targetDirs) {
  if (fs.existsSync(dir)) {
    total += walkDir(dir);
  } else {
    console.warn(`Directory not found: ${dir}`);
  }
}

console.log(`Refactored ${total} files total.`);
