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
    - Do NOT implement code directly. Only use Edit/Write for trivial single-line fixes.

## Available Agents

| Agent | When to Use |
|-------|-------------|
| `vue-expert` | Vue 3 components, Composition API, Nuxt 3/4 pages, composables, Pinia stores, TypeScript in Vue, reactivity patterns |
| `backend-developer` | Server-side APIs, Node.js/Python/Go services, database operations, microservices, authentication, caching |
| `ui-designer` | Visual design, UI components, design systems, accessibility, dark mode, responsive layouts, design tokens |
| `websocket-engineer` | Real-time communication, WebSocket connections, Socket.IO, bidirectional messaging, presence systems |
| `context-manager` | Information storage/retrieval, state synchronization, data lifecycle, caching strategies |
| `context-documenter` | Updating CLAUDE.md, documenting new patterns, adding agents to this file, validating instructions |
| `agent-organizer` | Multi-agent team assembly, task decomposition, workflow optimization, agent selection |
| `multi-agent-coordinator` | Complex workflow orchestration, inter-agent communication, parallel execution, fault tolerance |
| `claude-skill-creator` | Creating CLAUDE skills, SKILL.md files, skill documentation structure |

## Agent Selection Guidelines

1. **For Vue/Nuxt frontend work**: Use `vue-expert`
2. **For backend/API work**: Use `backend-developer`
3. **For UI/design work**: Use `ui-designer`
4. **For real-time features**: Use `websocket-engineer`
5. **For codebase exploration**: Use `Explore` agent (built-in)
6. **For planning complex features**: Use `Plan` agent (built-in) before implementation
7. **For updating this file**: Use `context-documenter`
8. **For coordinating multiple agents**: Use `agent-organizer` or `multi-agent-coordinator`
9. **When uncertain**: Ask the user for clarification