#!/usr/bin/env node

/**
 * Context Analyzer Hook - UserPromptSubmit
 * 
 * High-impact context analysis that identifies:
 * - Keywords that suggest code changes
 * - Potential file targets based on prompt content
 * - Relevant architectural patterns to consider
 * 
 * 80/20 Approach: Simple keyword matching with smart suggestions
 */

const fs = require('fs');
const path = require('path');

// Read hook data from stdin
let inputData = '';
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const hookData = JSON.parse(inputData);
    const userPrompt = hookData.data?.message || '';
    
    // 80/20: Simple but effective keyword detection
    const contextHints = analyzeContext(userPrompt);
    
    if (contextHints.length > 0) {
      console.log(JSON.stringify({
        "add_context": [
          {
            "type": "text",
            "content": `🔍 **Context Analysis:**\n${contextHints.join('\n')}\n\n📋 **Remember to follow:**\n- Check CLAUDE.md guidelines before coding\n- Use branded types for IDs\n- Update change logs for significant changes\n- Write tests alongside implementation`
          }
        ]
      }));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Context analyzer error:', error.message);
    process.exit(0); // Don't block on errors
  }
});

function analyzeContext(prompt) {
  const hints = [];
  const lowerPrompt = prompt.toLowerCase();
  
  // High-impact keyword detection
  const patterns = [
    {
      keywords: ['auth', 'login', 'sign in', 'clerk', 'jwt'],
      hint: '• **Authentication context**: Check `editia-core/src/services/auth/` and `ClerkAuthService` patterns'
    },
    {
      keywords: ['video', 'generate', 'render', 'creatomate'],
      hint: '• **Video context**: Review `server-primary/src/services/` for video generation patterns'
    },
    {
      keywords: ['tiktok', 'analyze', 'scraping', 'apify'],
      hint: '• **TikTok Analysis context**: Check `server-analyzer/src/services/` for analysis patterns'
    },
    {
      keywords: ['subscription', 'plan', 'monetization', 'revenuecrat'],
      hint: '• **Monetization context**: Review `editia-core/src/services/monetization/` and usage tracking'
    },
    {
      keywords: ['test', 'testing', 'spec', 'vitest', 'jest'],
      hint: '• **Testing context**: Follow Vitest patterns, place unit tests alongside source files'
    },
    {
      keywords: ['type', 'typescript', 'interface', 'brand'],
      hint: '• **Type Safety context**: Use branded types for domain IDs, prefer `type` over `interface`'
    },
    {
      keywords: ['database', 'supabase', 'migration', 'rls'],
      hint: '• **Database context**: Check RLS policies, use generated types, update migrations'
    },
    {
      keywords: ['mobile', 'react native', 'expo'],
      hint: '• **Mobile context**: Review `mobile/` patterns, use React hooks from editia-core'
    }
  ];
  
  // UI/UX specific context detection
  const uiPatterns = [
    {
      keywords: ['ui', 'interface', 'design', 'component', 'screen', 'layout'],
      hint: '• **UI/UX context**: Check `mobile/.claude/FRONTEND.md` and design system at `mobile/.claude/design-system.json`'
    },
    {
      keywords: ['style', 'stylesheet', 'color', 'theme', 'dark mode'],
      hint: '• **Styling context**: Use design system tokens from `.claude/design-system.json` - dark-first theme'
    },
    {
      keywords: ['button', 'card', 'modal', 'form', 'input'],
      hint: '• **Component context**: Reference existing components like `VideoSettingsSection.tsx` and `script-video-settings.tsx`'
    },
    {
      keywords: ['loading', 'spinner', 'progress', 'waiting'],
      hint: '• **Loading states**: Implement engaging AI loading states with progress indicators and step descriptions'
    },
    {
      keywords: ['animation', 'transition', 'interactive', 'gesture'],
      hint: '• **Interactions**: Use conversational UI patterns - toggles, swipes, live previews, minimal clicks'
    },
    {
      keywords: ['accessibility', 'a11y', 'touch target', 'screen reader'],
      hint: '• **Accessibility**: Follow 44px minimum touch targets, proper contrast, accessibility labels'
    }
  ];
  
  // Check main patterns
  for (const pattern of patterns) {
    if (pattern.keywords.some(keyword => lowerPrompt.includes(keyword))) {
      hints.push(pattern.hint);
    }
  }
  
  // Check UI patterns
  for (const pattern of uiPatterns) {
    if (pattern.keywords.some(keyword => lowerPrompt.includes(keyword))) {
      hints.push(pattern.hint);
    }
  }
  
  // Detect implementation vs planning phases
  if (lowerPrompt.includes('implement') || lowerPrompt.includes('code') || lowerPrompt.includes('write')) {
    hints.push('• **Implementation phase**: Remember TDD approach - write failing test first, then implement');
  }
  
  if (lowerPrompt.includes('plan') || lowerPrompt.includes('design') || lowerPrompt.includes('architecture')) {
    hints.push('• **Planning phase**: Consider existing patterns, check for similar implementations');
  }
  
  // AI-specific context
  if (lowerPrompt.includes('ai') || lowerPrompt.includes('llm') || lowerPrompt.includes('chat') || lowerPrompt.includes('conversation')) {
    hints.push('• **AI/LLM context**: Design conversational interfaces with minimal interactions and engaging loading states');
  }
  
  return hints;
}