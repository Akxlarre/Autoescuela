#!/usr/bin/env node
// PostToolUse hook: runs prettier on edited .ts, .html, .scss files
// Receives tool use context as JSON via stdin

import { execSync } from 'child_process';

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  try {
    const tool = JSON.parse(data);
    const filePath =
      tool.tool_input?.file_path ||
      tool.tool_input?.path ||
      tool.tool_input?.new_file_path ||
      '';

    if (filePath && /\.(ts|html|scss|css)$/.test(filePath)) {
      execSync(`npx prettier --write "${filePath}" --log-level warn`, {
        stdio: 'inherit',
        timeout: 15000,
      });
    }
  } catch {
    // Prettier not installed, file not found, or invalid JSON — silently skip
  }
});
