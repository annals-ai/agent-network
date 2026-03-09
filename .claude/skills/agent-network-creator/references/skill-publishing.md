# Skill Publishing

Package and publish standalone skills to [agents.hot](https://agents.hot). Works like `npm` for AI skills — `SKILL.md` with YAML frontmatter is the single source of truth.

Skills use **author-scoped naming**: `author/slug` (like npm `@scope/package`). Two authors can publish skills with the same slug without conflict.

## 1. Initialize

```bash
agent-network skills init [path] --name <name> --description "What this skill does"
```

Creates a `SKILL.md` template with YAML frontmatter. If a `SKILL.md` with a `name` in frontmatter already exists, skips without modification.

## 2. Develop

Edit `SKILL.md` with the skill content. Add supporting files (e.g. `references/`) as needed. All files in the directory (excluding hidden dirs and `node_modules`) are automatically included when packing.

## 3. Version

```bash
agent-network skills version patch [path]     # 1.0.0 → 1.0.1
agent-network skills version minor [path]     # 1.0.0 → 1.1.0
agent-network skills version major [path]     # 1.0.0 → 2.0.0
agent-network skills version 2.5.0 [path]    # Set exact version
```

Version is read from and written to the `version` field in SKILL.md frontmatter.

## 4. Pack (optional preview)

```bash
agent-network skills pack [path]              # Creates {name}-{version}.zip locally
```

## 5. Publish

```bash
agent-network skills publish [path]           # Pack + upload to agents.hot
```

Flags: `--stdin` (pipe SKILL.md content), `--name` (override), `--version` (override), `--private`.

Output includes `author_login` and URL in format: `https://agents.hot/authors/{author}/skills/{slug}`

## 6. Manage

```bash
agent-network skills info <author/slug>       # View remote details
agent-network skills list                     # List your published skills
agent-network skills unpublish <author/slug>  # Remove from platform
```

## 7. Install & Update

```bash
agent-network skills install <author/slug> [path]   # Install to .claude/skills/
agent-network skills install <author/slug> --force   # Overwrite existing
agent-network skills update [author/slug] [path]     # Update one or all installed skills
agent-network skills remove <slug> [path]            # Remove locally installed skill
agent-network skills installed [path]                # List installed skills
agent-network skills installed --check-updates       # Check for available updates
```

Install downloads skills to `.claude/skills/<slug>/` (or `.agents/skills/<slug>/` if that convention exists).

Published skills appear on your developer profile at [agents.hot/settings](https://agents.hot/settings?tab=developer).

All `skills` commands output JSON to stdout. Human-readable logs go to stderr.

## SKILL.md Frontmatter Spec

```yaml
---
name: my-skill
description: "What this skill does"
version: 1.0.0
category: development
tags: [code-review, ai]
author: your-github-login
private: false
---
```

- `name` (required) — kebab-case identifier
- `description` (recommended) — what this skill does and when to use it
- `version` — semver (defaults to `1.0.0` if omitted)
- `author` — your GitHub login (used for author-scoped identification)
- All other fields are optional
