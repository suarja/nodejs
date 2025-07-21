#!/usr/bin/env node

/**
 * Session Summary Hook - Stop
 * 
 * Moderate-impact session tracking:
 * - Summarizes what was accomplished
 * - Suggests next steps
 * - Updates session logs for context continuity
 * 
 * 80/20 Approach: Simple activity detection with helpful summaries
 */

const fs = require('fs');
const path = require('path');

let inputData = '';
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const hookData = JSON.parse(inputData);
    const toolUses = hookData.tool_uses || [];
    
    const summary = generateSessionSummary(toolUses);
    
    if (summary.accomplishments.length > 0 || summary.suggestions.length > 0) {
      // Simple session logging
      logSession(summary);
      
      console.log(JSON.stringify({
        "add_context": [
          {
            "type": "text",
            "content": `🎯 **Session Summary:**\n\n**Accomplished:**\n${summary.accomplishments.join('\n')}\n\n**Suggestions for next session:**\n${summary.suggestions.join('\n')}`
          }
        ]
      }));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Session summary error:', error.message);
    process.exit(0); // Don't block on errors
  }
});

function generateSessionSummary(toolUses) {
  const accomplishments = [];
  const suggestions = [];
  const fileTypes = new Set();
  const services = new Set();
  
  let editCount = 0;
  let testCount = 0;
  let configCount = 0;
  
  for (const toolUse of toolUses) {
    const { tool_name, params } = toolUse;
    
    if (['Edit', 'MultiEdit', 'Write'].includes(tool_name) && params.file_path) {
      editCount++;
      const filePath = params.file_path;
      const fileName = path.basename(filePath);
      
      // Track file types and services
      if (fileName.endsWith('.ts')) fileTypes.add('TypeScript');
      if (fileName.endsWith('.tsx')) fileTypes.add('React');
      if (fileName.endsWith('.json')) fileTypes.add('Config');
      if (fileName.includes('.test.') || fileName.includes('.spec.')) testCount++;
      if (fileName.includes('config') || fileName.includes('settings')) configCount++;
      
      // Track services
      if (filePath.includes('editia-core')) services.add('editia-core');
      if (filePath.includes('mobile')) services.add('mobile');
      if (filePath.includes('server-analyzer')) services.add('server-analyzer');
      if (filePath.includes('server-primary')) services.add('server-primary');
      if (filePath.includes('web')) services.add('web');
    }
    
    if (tool_name === 'Bash' && params.command) {
      const cmd = params.command.toLowerCase();
      if (cmd.includes('test')) testCount++;
      if (cmd.includes('npm') || cmd.includes('yarn') || cmd.includes('pnpm')) {
        accomplishments.push('• Managed dependencies and packages');
      }
      if (cmd.includes('git')) {
        accomplishments.push('• Git operations performed');
      }
    }
  }
  
  // Generate accomplishments
  if (editCount > 0) {
    accomplishments.push(`• Modified ${editCount} file${editCount > 1 ? 's' : ''} across ${services.size} service${services.size > 1 ? 's' : ''}`);
  }
  
  if (fileTypes.size > 0) {
    accomplishments.push(`• Worked with: ${Array.from(fileTypes).join(', ')} files`);
  }
  
  if (testCount > 0) {
    accomplishments.push(`• ${testCount} test-related operation${testCount > 1 ? 's' : ''}`);
  }
  
  if (configCount > 0) {
    accomplishments.push(`• Updated configuration files`);
  }
  
  // Generate suggestions based on activity
  if (editCount > 0 && testCount === 0) {
    suggestions.push('• Consider running tests to validate changes');
  }
  
  if (services.has('editia-core') && services.size > 1) {
    suggestions.push('• Check if editia-core changes affect other services');
  }
  
  if (fileTypes.has('TypeScript') && !fileTypes.has('Config')) {
    suggestions.push('• Run type checking to ensure type safety');
  }
  
  if (editCount > 3) {
    suggestions.push('• Consider creating a commit with your changes');
  }
  
  return { accomplishments, suggestions };
}

function logSession(summary) {
  try {
    const sessionLog = path.join(process.cwd(), '.claude', 'session-log.md');
    const date = new Date().toISOString();
    const logEntry = `## ${date}\n\n**Accomplished:**\n${summary.accomplishments.join('\n')}\n\n**Suggestions:**\n${summary.suggestions.join('\n')}\n\n---\n\n`;
    
    let existingContent = '';
    if (fs.existsSync(sessionLog)) {
      existingContent = fs.readFileSync(sessionLog, 'utf8');
    } else {
      existingContent = '# Claude Code Session Log\n\nThis log tracks development sessions for context continuity.\n\n';
    }
    
    fs.writeFileSync(sessionLog, existingContent + logEntry);
  } catch (error) {
    // Don't fail if can't write log
    console.error('Could not write session log:', error.message);
  }
}