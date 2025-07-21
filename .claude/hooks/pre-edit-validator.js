#!/usr/bin/env node

/**
 * Pre-Edit Validator Hook - PreToolUse
 * 
 * High-impact validation before file edits:
 * - Detects when adding imports without branded types
 * - Warns about editing generated files
 * - Suggests following existing patterns
 * 
 * 80/20 Approach: Simple pattern matching with actionable warnings
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
    const tool = hookData.tool_name;
    const params = hookData.params || {};
    
    // Get the file being edited
    const filePath = params.file_path;
    if (!filePath) {
      process.exit(0);
    }
    
    const warnings = validateEdit(filePath, params);
    
    if (warnings.length > 0) {
      console.log(JSON.stringify({
        "add_context": [
          {
            "type": "text",
            "content": `⚠️ **Pre-Edit Validation:**\n${warnings.join('\n')}`
          }
        ]
      }));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Pre-edit validator error:', error.message);
    process.exit(0); // Don't block on errors
  }
});

function validateEdit(filePath, params) {
  const warnings = [];
  const fileName = path.basename(filePath);
  const dirName = path.dirname(filePath);
  
  // Check for generated files (high impact)
  if (fileName.includes('.types.ts') || fileName.includes('generated') || fileName.includes('.d.ts')) {
    warnings.push('• **Generated file detected**: Consider if this should be edited manually or regenerated');
  }
  
  // Check for type files - suggest branded types
  if (filePath.includes('/types/') && params.new_string) {
    const newContent = params.new_string;
    if (newContent.includes('string') && (newContent.includes('Id') || newContent.includes('ID'))) {
      warnings.push('• **Type definition**: Consider using branded types for IDs (e.g., `Brand<string, "UserId">`)');
    }
  }
  
  // Check for test files - suggest proper testing patterns
  if (fileName.includes('.test.') || fileName.includes('.spec.')) {
    warnings.push('• **Test file**: Remember to use Vitest patterns, parameterize inputs, avoid magic literals');
  }
  
  // Frontend/UI specific validations
  if (filePath.includes('mobile/') && (fileName.endsWith('.tsx') || fileName.endsWith('.ts'))) {
    warnings.push(...validateFrontendFile(filePath, params));
  }
  
  // Check for React components - suggest following patterns
  if (fileName.endsWith('.tsx') && dirName.includes('components')) {
    warnings.push('• **React component**: Check existing components and `.claude/FRONTEND.md` for patterns');
  }
  
  // Check for service files - suggest following architecture
  if (dirName.includes('/services/') && fileName.endsWith('.ts')) {
    warnings.push('• **Service file**: Follow existing service patterns, consider if logic belongs in editia-core');
  }
  
  // Check for API routes
  if ((dirName.includes('/api/') || dirName.includes('/routes/')) && fileName.endsWith('.ts')) {
    warnings.push('• **API endpoint**: Remember to add authentication middleware and proper error handling');
  }
  
  // Check for database migrations
  if (dirName.includes('migrations') && fileName.endsWith('.sql')) {
    warnings.push('• **Database migration**: Test RLS policies, update generated types after running migration');
  }
  
  return warnings;
}

function validateFrontendFile(filePath, params) {
  const warnings = [];
  const newContent = params.new_string || '';
  const oldContent = params.old_string || '';
  
  // Check for hardcoded colors
  const hardcodedColors = [
    'backgroundColor: \'black\'',
    'backgroundColor: \'white\'',
    'color: \'red\'',
    'color: \'blue\'',
    'color: \'green\'',
    '#ff0000', '#00ff00', '#0000ff', // Basic hex colors
  ];
  
  for (const color of hardcodedColors) {
    if (newContent.includes(color) && !oldContent.includes(color)) {
      warnings.push('• **Hardcoded colors detected**: Use design system colors from `.claude/design-system.json`');
      break;
    }
  }
  
  // Check for StyleSheet usage - suggest design system
  if (newContent.includes('StyleSheet.create') && !oldContent.includes('StyleSheet.create')) {
    warnings.push('• **StyleSheet created**: Reference `.claude/design-system.json` for colors, spacing, and typography');
  }
  
  // Check for missing accessibility props
  if (newContent.includes('<TouchableOpacity') && !newContent.includes('accessibilityRole')) {
    warnings.push('• **Accessibility**: Add `accessibilityRole` and `accessibilityLabel` to TouchableOpacity');
  }
  
  // Check for small touch targets
  if (newContent.includes('width:') || newContent.includes('height:')) {
    const widthMatch = newContent.match(/width:\s*(\d+)/);
    const heightMatch = newContent.match(/height:\s*(\d+)/);
    if (widthMatch && parseInt(widthMatch[1]) < 44 || heightMatch && parseInt(heightMatch[1]) < 44) {
      warnings.push('• **Touch target size**: Ensure interactive elements are at least 44px for accessibility');
    }
  }
  
  // Check for proper loading states
  if (newContent.includes('loading') && !newContent.includes('ActivityIndicator')) {
    warnings.push('• **Loading state**: Consider using ActivityIndicator for loading states');
  }
  
  // Suggest referencing best practices
  if (filePath.includes('/components/') || filePath.includes('/(drawer)/') || filePath.includes('/(onboarding)/')) {
    warnings.push('• **Frontend best practices**: Check `.claude/FRONTEND.md` and existing components for patterns');
  }
  
  return warnings;
}