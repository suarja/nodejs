# Claude Code Hooks - EditIA

These hooks implement the 80/20 approach to context engineering and development workflow automation.

## Hook Overview

### 🔍 `context-analyzer.js` (UserPromptSubmit)
**High Impact** - Provides intelligent context before any work begins.

**What it does:**
- Analyzes user prompts for keywords related to authentication, video generation, TikTok analysis, etc.
- Suggests relevant directories and files to consider
- Reminds about following CLAUDE.md guidelines
- Detects implementation vs planning phases

**Example context added:**
```
🔍 Context Analysis:
• Authentication context: Check editia-core/src/services/auth/ and ClerkAuthService patterns
• Implementation phase: Remember TDD approach - write failing test first, then implement
```

### ⚠️ `pre-edit-validator.js` (PreToolUse)
**High Impact** - Prevents common mistakes before file edits.

**What it does:**
- Warns about editing generated files
- Suggests branded types for ID definitions
- Reminds about proper testing patterns for test files
- Flags potential architectural concerns

**Example warnings:**
```
⚠️ Pre-Edit Validation:
• Type definition: Consider using branded types for IDs (e.g., Brand<string, "UserId">)
• Service file: Follow existing service patterns, consider if logic belongs in editia-core
```

### 📝 `post-edit-tracker.js` (PostToolUse)
**High Impact** - Tracks changes and suggests follow-up actions.

**What it does:**
- Automatically logs significant changes to `CHANGES.md` files
- Categorizes changes (API, Type, Database, Component, Service)
- Suggests related actions like updating tests or documentation
- Provides context-aware follow-up recommendations

**Example tracking:**
```
📝 Change Tracking:
• API Change: Consider updating integration tests and API documentation
• Testing: Consider adding unit tests for the new functionality
```

### 🎯 `session-summary.js` (Stop)
**Moderate Impact** - Provides session summaries and continuity.

**What it does:**
- Summarizes what was accomplished in the session
- Tracks file types and services modified
- Suggests next steps based on activity
- Maintains session logs for context continuity

**Example summary:**
```
🎯 Session Summary:

Accomplished:
• Modified 3 files across 2 services
• Worked with: TypeScript, React files
• Updated configuration files

Suggestions for next session:
• Consider running tests to validate changes
• Run type checking to ensure type safety
```

## Files Created

Each hook creates and maintains relevant tracking files:

- **`CHANGES.md`** - Per-service change logs (created in each service root)
- **`.claude/session-log.md`** - Session continuity logs
- **Context additions** - Real-time context provided to Claude

## Impact Philosophy

Following the 80/20 principle, these hooks focus on:

**High Impact (80% of value):**
- Context awareness before changes
- Pattern consistency validation
- Automatic change documentation
- Smart follow-up suggestions

**Simple Implementation (20% of effort):**
- Keyword-based detection
- File path pattern matching
- Basic change categorization
- Non-blocking error handling

## Customization

To modify hook behavior:

1. **Edit keyword patterns** in `context-analyzer.js`
2. **Add validation rules** in `pre-edit-validator.js`
3. **Customize change tracking** in `post-edit-tracker.js`
4. **Adjust summary logic** in `session-summary.js`

All hooks are designed to fail gracefully - they won't block Claude Code if there are errors, but will provide valuable context and automation when working correctly.