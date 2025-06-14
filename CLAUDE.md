# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.



## General Guidelines

1. For maximum efficiency, ALWAYS use parallel tool calls wherever possible.
2. always THINK between tool calls, dont cheap out on the reasoning budget.
3. No one likes a yes man! if the user is asking you to do something that doesn't make sense or can be done better, give them the best alternatives


## Git Workflow

- Use conventional commits for all commit messages
- Format: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore
- Example: `feat(scripts): add worktree automation for AI development`
- Example: `fix(setup): resolve GitHub project linking issues`


## Style Guidelines

### Filename sanitisation

#### ❌ Wrong

```js
const INVALID_CHARS = /[<>:"|?*\x00-\x1f]/g;   // fails Biome rule
const safe = raw.replace(INVALID_CHARS, "");
```

#### ✅ Correct

```js
const INVALID_CHARS = /[<>:"|?*\p{Cc}]/gu;     // \p{Cc} = all control chars
const safe = raw.replace(INVALID_CHARS, "");
```

