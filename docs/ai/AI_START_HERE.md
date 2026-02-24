# AI Memory System — Start Here

## How This Works

This directory contains AI-optimized documentation for the WAX Wallet Viewer codebase.
Its purpose is to let any new AI session become productive **without scanning the repository**.

## Mandatory Reading Order

When starting any task, read these files **in order** before touching source code:

1. **This file** — understand the system
2. **PROJECT_MAP.md** — understand the project structure, stack, and data flow
3. **CHANGELOG_AI.md** — understand what has changed recently

Only open source files that are **directly relevant** to the specific task at hand.

## When to Read Additional Docs

| Task type                     | Also read                    |
|-------------------------------|------------------------------|
| Adding/changing an API route  | API_CONTRACTS.md             |
| Architecture decisions        | ARCHITECTURE.md              |
| New feature work              | FEATURE_REGISTRY.md          |
| Admin panel changes           | ADMIN_GUIDE.md               |
| Dev setup / build / deploy    | DEV_GUIDE.md                 |

## When to Scan the Repo

Only explore source files directly if:
- The AI docs are missing or clearly outdated
- A specific bug requires reading the exact implementation
- You are asked to refactor something not documented here

Never run full-repo scans by default.

## Maintenance Contract

After **every completed task** you must update:
1. `PROJECT_MAP.md` — if structure/stack changed
2. `FEATURE_REGISTRY.md` — mark features implemented/in-progress/planned
3. `CHANGELOG_AI.md` — append a technical entry
4. `API_CONTRACTS.md` — if any endpoint was added or changed
5. `ADMIN_GUIDE.md` — if admin behaviour changed

**Never skip this.** Stale docs are worse than no docs.

## File Index

| File                | Purpose                                              |
|---------------------|------------------------------------------------------|
| AI_START_HERE.md    | This file — entry point and rules                    |
| PROJECT_MAP.md      | Stack, folder map, feature domains, data flow        |
| ARCHITECTURE.md     | Non-negotiable technical rules and constraints       |
| DEV_GUIDE.md        | How to build, run, test, deploy, and add features    |
| API_CONTRACTS.md    | Every internal API route: params, response, caching  |
| FEATURE_REGISTRY.md | Feature status tracker                               |
| ADMIN_GUIDE.md      | Admin routes, auth model, configurable settings      |
| CHANGELOG_AI.md     | Technical memory log — append after every task       |
