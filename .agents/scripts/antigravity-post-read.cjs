const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
process.chdir(repoRoot);

let inputRaw = '';
process.stdin.on('data', chunk => (inputRaw += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(inputRaw);
    const toolCall = input.toolCall || {};
    const args = toolCall.args || {};
    const conversationId = input.conversationId || 'default';
    const filePath = args.Path || args.path || '';

    const claudePayload = {
      tool_name: 'Read',
      tool_input: {
        file_path: filePath
      }
    };

    const trackerPath = path.join(repoRoot, '.claude', 'hooks', 'discovery-tracker.js');
    if (fs.existsSync(trackerPath)) {
      spawnSync(process.execPath, [trackerPath], {
        input: JSON.stringify(claudePayload),
        env: {
          ...process.env,
          CLAUDE_SESSION_ID: conversationId
        },
        cwd: repoRoot,
        encoding: 'utf8'
      });
    }
  } catch {
    // Silently skip
  }
  console.log('{}');
  process.exit(0);
});
