# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Koalires is a file management application built with Nuxt 4, Vue 3, and TypeScript. It uses Feature-Sliced Design (FSD) architecture for the frontend, Prisma ORM with libSQL for the database, JWT-based authentication, and Tailwind CSS for styling.

## Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Generate static site
npm run generate

# Type check the project
npm run typecheck

# Run type checking and ESLint
npm run lint

# Fix ESLint issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check code formatting
npm run format:check

# Generate Prisma client
npm run db:generate

# Push schema changes to database
npm run db:push

# Run database migrations
npm run db:migrate

# Open Prisma Studio (database GUI)
npm run db:studio
```

## Architecture

This is a Nuxt 4 project using Feature-Sliced Design (FSD) with `client/` as the source directory:

### Frontend (`client/`)

- **client/app.vue** - Root Vue component (entry point)
- **client/app/** - App layer: layouts, global styles, providers
- **client/pages/** - File-based routing (create files here for new routes)
- **client/widgets/** - Large self-contained UI blocks (app-header, file-editor, file-list, file-tree)
- **client/features/** - Business features (auth, create-item, file-manager, theme)
- **client/entities/** - Business entities (user, file, folder)
- **client/shared/** - Reusable code: ui, api, lib, config, stores
- **client/plugins/** - Nuxt plugins

### Backend (`server/`)

- **server/api/** - API route handlers (auth/, files/, folders/)
- **server/database/** - Prisma schemas and repositories
- **server/middleware/** - Server middleware (auth)
- **server/utils/** - Server utilities (jwt, bcrypt, auth helpers)
- **server/composables/** - Server composables (prisma client)
- **server/plugins/** - Server plugins
- **server/types/** - TypeScript type definitions

### Root

- **public/** - Static assets served at root
- **nuxt.config.ts** - Nuxt configuration with FSD auto-imports
- **tailwind.config.ts** - Tailwind CSS configuration
- **prisma.config.ts** - Prisma configuration
- **koalires.db** - SQLite database file

## Key Conventions

- **Feature-Sliced Design (FSD)**: Frontend uses FSD layers - app → pages → widgets → features → entities → shared. Modules can only import from layers below them.
- **FSD Auto-imports**: Components from `shared/ui`, `entities/**/ui`, `features/**/ui`, `widgets/**/ui` are auto-imported. Composables from `shared/lib`, `shared/api`, `shared/config`, `shared/stores`, and layer model/api folders are auto-imported.
- **Path Aliases**: Use `@app`, `@shared`, `@entities`, `@features`, `@widgets` for clean imports across FSD layers.
- **File-based routing**: Files in `client/pages/` automatically become routes.
- **Pinia Stores**: Global state managed in `shared/stores/` using Pinia with `@pinia/nuxt`.
- **Prisma ORM**: Database access via Prisma client. Schemas in `server/database/schemas/`. Repositories in `server/database/repositories/`.
- **JWT Authentication**: Server-side JWT auth with refresh tokens. Auth middleware in `server/middleware/auth.ts`.
- **TypeScript**: Full TypeScript support enabled with strict mode in ESLint.
- **Tailwind CSS**: Utility-first CSS with dark mode support via class strategy.
- **Nuxt DevTools**: Enabled in development mode via nuxt.config.ts.

## Implementation Rules

- **MANDATORY**: All implementation tasks MUST be delegated to specialized subagents:
  - Frontend Vue/Nuxt work → `vue-expert`
  - Backend API/server work → `backend-developer`
  - UI/visual design work → `ui-designer`
  - WebSocket/real-time features → `websocket-engineer`
  - FSD architecture validation → `fsd-architecture-guardian`
  - ESLint/linting verification → `eslint-guardian`
  - Context storage/retrieval → `context-manager`
  - Updating CLAUDE.md → `context-documenter`
  - Creating CLAUDE skills → `claude-skill-creator`
  - Multi-agent team assembly → `agent-organizer`
  - Complex workflow orchestration → `multi-agent-coordinator`
  - Do NOT implement code directly. Only use Edit/Write for trivial single-line fixes.

## Available Agents

| Agent                       | When to Use                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `vue-expert`                | Vue 3 components, Composition API, Nuxt 3/4 pages, composables, Pinia stores, TypeScript in Vue  |
| `backend-developer`         | Server-side APIs, Node.js/Python/Go services, database operations, microservices, authentication |
| `ui-designer`               | Visual design, UI components, design systems, accessibility, dark mode, responsive layouts       |
| `websocket-engineer`        | Real-time communication, WebSocket connections, Socket.IO, bidirectional messaging, presence     |
| `fsd-architecture-guardian` | FSD architecture validation, layer dependencies, slice/segment organization, public API exports  |
| `eslint-guardian`           | ESLint configuration verification, lint rule testing, code quality tooling validation            |
| `context-manager`           | Information storage/retrieval, state synchronization, data lifecycle, caching strategies         |
| `context-documenter`        | Updating CLAUDE.md, documenting new patterns, adding agents, validating instructions             |
| `agent-organizer`           | Multi-agent team assembly, task decomposition, workflow optimization, agent selection            |
| `multi-agent-coordinator`   | Complex workflow orchestration, inter-agent communication, parallel execution, fault tolerance   |
| `claude-skill-creator`      | Creating CLAUDE skills, SKILL.md files, skill documentation structure                            |

## Agent Selection Guidelines

1. **For Vue/Nuxt frontend work**: Use `vue-expert`
2. **For backend/API work**: Use `backend-developer`
3. **For UI/design work**: Use `ui-designer`
4. **For real-time features**: Use `websocket-engineer`
5. **For FSD architecture validation**: Use `fsd-architecture-guardian`
6. **For ESLint/linting verification**: Use `eslint-guardian`
7. **For context/state management**: Use `context-manager`
8. **For codebase exploration**: Use `Explore` agent (built-in)
9. **For planning complex features**: Use `Plan` agent (built-in) before implementation
10. **For updating this file**: Use `context-documenter`
11. **For creating CLAUDE skills**: Use `claude-skill-creator`
12. **For coordinating multiple agents**: Use `agent-organizer` or `multi-agent-coordinator`
13. **When uncertain**: Ask the user for clarification
