#!/usr/bin/env node

/**
 * Post-Edit Tracker Hook - PostToolUse
 * 
 * High-impact change tracking after file edits:
 * - Logs significant changes to CHANGES.md files
 * - Suggests related actions (tests, docs, etc.)
 * - Tracks architectural changes
 * 
 * 80/20 Approach: Simple change detection with smart categorization
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
    const params = hookData.params || {};
    const success = hookData.response?.success !== false;
    
    if (!success) {
      process.exit(0); // Don't track failed edits
    }
    
    const filePath = params.file_path;
    if (!filePath) {
      process.exit(0);
    }
    
    const suggestions = trackChange(filePath, params);
    
    if (suggestions.length > 0) {
      console.log(JSON.stringify({
        "add_context": [
          {
            "type": "text",
            "content": `📝 **Change Tracking:**\n${suggestions.join('\n')}`
          }
        ]
      }));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Post-edit tracker error:', error.message);
    process.exit(0); // Don't block on errors
  }
});

function trackChange(filePath, params) {
  const suggestions = [];
  const fileName = path.basename(filePath);
  const dirName = path.dirname(filePath);
  const oldContent = params.old_string || '';
  const newContent = params.new_string || '';
  
  // Detect type of change
  const changeType = detectChangeType(filePath, oldContent, newContent);
  const changeDate = new Date().toISOString().split('T')[0];
  
  // Log change to appropriate CHANGES.md (simple approach)
  logChange(filePath, changeType, changeDate);
  
  // Generate context-aware suggestions
  if (changeType.includes('API')) {
    suggestions.push('• **API Change**: Consider updating integration tests and API documentation');
  }
  
  if (changeType.includes('Type')) {
    suggestions.push('• **Type Change**: Run type checking across all services to ensure compatibility');
  }
  
  if (changeType.includes('Database')) {
    suggestions.push('• **Database Change**: Test RLS policies and update related type definitions');
  }
  
  if (changeType.includes('Component')) {
    suggestions.push('• **Component Change**: Consider updating Storybook docs and component tests');
  }
  
  if (changeType.includes('Service')) {
    suggestions.push('• **Service Change**: Verify if changes affect editia-core or other services');
  }
  
  // Suggest testing based on file type
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
    const hasTest = fs.existsSync(filePath.replace(/\.tsx?$/, '.spec.ts')) || 
                   fs.existsSync(filePath.replace(/\.tsx?$/, '.test.ts'));
    
    if (!hasTest && !fileName.includes('.spec.') && !fileName.includes('.test.')) {
      suggestions.push('• **Testing**: Consider adding unit tests for the new functionality');
    }
  }
  
  return suggestions;
}

function detectChangeType(filePath, oldContent, newContent) {
  const types = [];
  
  // Simple pattern detection
  if (filePath.includes('/api/') || filePath.includes('/routes/')) {
    types.push('API');
  }
  
  if (filePath.includes('/types/') || newContent.includes('type ') || newContent.includes('interface ')) {
    types.push('Type');
  }
  
  if (filePath.includes('migrations') || newContent.includes('CREATE TABLE') || newContent.includes('ALTER TABLE')) {
    types.push('Database');
  }
  
  if (filePath.includes('/components/') || fileName.endsWith('.tsx')) {
    types.push('Component');
  }
  
  if (filePath.includes('/services/')) {
    types.push('Service');
  }
  
  if (newContent.includes('export') && oldContent && !oldContent.includes('export')) {
    types.push('Export');
  }
  
  return types.length > 0 ? types.join('/') : 'General';
}

function logChange(filePath, changeType, date) {
  // Simple change logging (80/20 approach)
  const serviceRoot = findServiceRoot(filePath);
  if (!serviceRoot) return;
  
  const changesFile = path.join(serviceRoot, 'CHANGES.md');
  const logEntry = `## [${date}] ${changeType} Change\n- **File**: \`${path.relative(serviceRoot, filePath)}\`\n- **Type**: ${changeType}\n\n`;
  
  // Append to changes file (create if doesn't exist)
  try {
    let existingContent = '';
    if (fs.existsSync(changesFile)) {
      existingContent = fs.readFileSync(changesFile, 'utf8');
    } else {
      existingContent = '# Change Log\n\nThis file tracks significant changes to maintain context and avoid duplication.\n\n';
    }
    
    // Simple duplicate prevention - don't log if same file changed today
    if (!existingContent.includes(`[${date}]`) || !existingContent.includes(path.basename(filePath))) {
      fs.writeFileSync(changesFile, existingContent + logEntry);
    }
  } catch (error) {
    // Don't fail if can't write changes
    console.error('Could not log change:', error.message);
  }
}

function findServiceRoot(filePath) {
  // Find the service root directory (editia-core, mobile, server-*, web)
  const parts = filePath.split('/');
  for (let i = 0; i < parts.length; i++) {
    if (['editia-core', 'mobile', 'server-analyzer', 'server-primary', 'web'].includes(parts[i])) {
      return parts.slice(0, i + 1).join('/');
    }
  }
  return null;
}