const fs = require('fs');
const path = require('path');

const replacements = [
  { regex: /bg-red-50/g, target: 'bg-[var(--state-error-bg)]' },
  { regex: /bg-red-100/g, target: 'bg-[var(--state-error-bg)]' },
  { regex: /text-red-500/g, target: 'text-[var(--state-error)]' },
  { regex: /text-red-600/g, target: 'text-[var(--state-error)]' },
  { regex: /border-red-500/g, target: 'border-[var(--state-error)]' },
  { regex: /border-red-100/g, target: 'border-[var(--state-error)]' },
  { regex: /bg-red-900\\\/30/g, target: 'bg-[var(--state-error-bg)]' },
  { regex: /bg-red-900/g, target: 'bg-[var(--state-error-bg)]' },

  { regex: /bg-green-50/g, target: 'bg-[var(--state-success-bg)]' },
  { regex: /bg-green-100/g, target: 'bg-[var(--state-success-bg)]' },
  { regex: /text-green-500/g, target: 'text-[var(--state-success)]' },
  { regex: /text-green-600/g, target: 'text-[var(--state-success)]' },
  { regex: /text-green-700/g, target: 'text-[var(--state-success)]' },
  { regex: /border-green-500/g, target: 'border-[var(--state-success)]' },
  { regex: /bg-green-500/g, target: 'bg-[var(--state-success)]' },
  { regex: /bg-green-900\\\/30/g, target: 'bg-[var(--state-success-bg)]' },
  { regex: /bg-green-900/g, target: 'bg-[var(--state-success-bg)]' },

  { regex: /bg-yellow-50/g, target: 'bg-[var(--state-warning-bg)]' },
  { regex: /bg-yellow-100/g, target: 'bg-[var(--state-warning-bg)]' },
  { regex: /text-yellow-500/g, target: 'text-[var(--state-warning)]' },
  { regex: /text-yellow-600/g, target: 'text-[var(--state-warning)]' },
  { regex: /text-yellow-700/g, target: 'text-[var(--state-warning)]' },
  { regex: /bg-yellow-900\\\/30/g, target: 'bg-[var(--state-warning-bg)]' },
  { regex: /bg-yellow-900/g, target: 'bg-[var(--state-warning-bg)]' },

  { regex: /bg-blue-50/g, target: 'bg-brand-muted' },
  { regex: /bg-blue-100/g, target: 'bg-brand-muted' },
  { regex: /text-blue-500/g, target: 'text-brand-primary' },
  { regex: /text-blue-600/g, target: 'text-brand-primary' },
  { regex: /text-blue-700/g, target: 'text-brand-primary' },
  { regex: /bg-blue-500/g, target: 'bg-brand-primary' },
  { regex: /bg-blue-600/g, target: 'bg-brand-primary' },
  { regex: /bg-blue-900\\\/30/g, target: 'bg-brand-muted' },
  { regex: /bg-blue-900/g, target: 'bg-brand-muted' },

  { regex: /bg-amber-500/g, target: 'bg-[var(--state-warning)]' },
  { regex: /bg-emerald-500/g, target: 'bg-[var(--state-success)]' },
  { regex: /bg-purple-500/g, target: 'bg-brand-primary' }
];

function walkDir(dir, callback) {
  try {
    fs.readdirSync(dir).forEach(f => {
      let dirPath = path.join(dir, f);
      let isDirectory = fs.statSync(dirPath).isDirectory();
      isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
  } catch (e) {
    console.error('Error walking', dir, e);
  }
}

const files = [];
walkDir('src/app/features/instructor', p => files.push(p));
files.push('src/app/shared/components/badge/badge.component.ts');
files.push('src/app/features/agenda/agenda-schedule-drawer.component.ts');

files.forEach(file => {
  if (!file.endsWith('.ts')) return;
  try {
     let content = fs.readFileSync(file, 'utf8');
     let changed = false;
     replacements.forEach(rep => {
       if (content.match(rep.regex)) {
         content = content.replace(rep.regex, rep.target);
         changed = true;
       }
     });
     if (changed) {
       fs.writeFileSync(file, content);
       console.log('Fixed', file);
     }
  } catch (e) {}
});
