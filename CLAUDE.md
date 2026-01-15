# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Koalires is a Nuxt 4 application built with Vue 3 and TypeScript.

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
```

## Architecture

This is a Nuxt 4 project using the `app/` directory structure:

- **app/app.vue** - Root Vue component (entry point)
- **app/pages/** - File-based routing (create files here for new routes)
- **app/components/** - Auto-imported Vue components
- **app/composables/** - Auto-imported composable functions
- **app/layouts/** - Layout templates
- **public/** - Static assets served at root

## Key Conventions

- **Auto-imports**: Components in `app/components/` and composables in `app/composables/` are automatically imported
- **File-based routing**: Files in `app/pages/` automatically become routes
- **TypeScript**: Full TypeScript support enabled throughout
- **Nuxt DevTools**: Enabled in development mode via nuxt.config.ts

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
