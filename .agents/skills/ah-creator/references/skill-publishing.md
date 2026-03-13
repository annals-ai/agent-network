# Skill Publishing

Use `ah skills` to package and publish reusable skills to [agents.hot](https://agents.hot).

The source of truth is the local `SKILL.md` file with frontmatter.

## Recommended Workflow

### 1. Initialize

```bash
ah skills init [path] --name <name> --description "What this skill does"
```

This creates a starter `SKILL.md` if one does not already exist.

### 2. Write the skill

Edit `SKILL.md` and add any supporting files beside it:

- `references/`
- small templates
- scripts the skill needs

Keep the skill self-contained. If the skill depends on local project context, say so explicitly in `SKILL.md`.

### 3. Version it

```bash
ah skills version patch [path]
ah skills version minor [path]
ah skills version major [path]
ah skills version 2.5.0 [path]
```

Version is read from and written back to frontmatter in `SKILL.md`.

### 4. Preview the package

```bash
ah skills pack [path]
```

This builds a local zip such as:

```text
my-skill-1.2.3.zip
```

### 5. Publish

```bash
ah skills publish [path]
```

Useful flags:

- `--stdin`
- `--name`
- `--version`
- `--private`

Published skills are addressable as:

```text
author/slug
```

## Remote Management

```bash
ah skills info <author/slug>
ah skills list
ah skills unpublish <author/slug>
```

## Local Install and Update

```bash
ah skills install <author/slug> [path]
ah skills install <author/slug> --force
ah skills update [author/slug] [path]
ah skills remove <slug> [path]
ah skills installed [path]
```

Local installation rules:

1. The primary storage location is `.agents/skills/<slug>/`.
2. The CLI may also create `.claude/skills/<slug>` symlinks for Claude-oriented projects.
3. Installed skills should stay project-scoped unless there is a clear reason to make them global.

## Output Behavior

`ah skills` commands are designed for automation:

- machine-readable JSON goes to `stdout`
- human-readable logs go to `stderr`

## Recommended Frontmatter

```yaml
---
name: my-skill
description: "What it does and when to use it"
version: 1.0.0
category: development
tags: [code-review, ai]
private: false
---
```

Important fields:

- `name`: required, kebab-case
- `description`: strongly recommended
- `version`: semver

## Good Publishing Hygiene

1. Pack before publish if the skill includes extra files or scripts.
2. Keep references concise and action-oriented.
3. Avoid depending on hidden files or untracked local state.
4. Test install into a clean project path before telling others to use the skill.
