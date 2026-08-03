# Architecture Decision Record (ADR)

> This document records significant architectural decisions made during the development of GENKŌ. Every major technical decision should include the context, the decision itself, and the reasoning behind it.

---

# ADR-001 — Feature-First Architecture

## Status

Accepted

## Date

2026-07-31

## Context

As the platform grows, organizing code by technical type (components, hooks, services) becomes difficult to maintain.

## Decision

Organize business logic around features.

```
features/

    dashboard/

    learning/

    review/

    social/

    ai/

    creator/
```

## Consequences

### Benefits

- Better scalability
- Easier maintenance
- Clear ownership
- Faster onboarding

### Trade-offs

- Slightly deeper folder structure

---

# ADR-002 — TanStack Router

## Status

Accepted

## Context

The application requires:

- Nested layouts
- Route loaders
- Type-safe routing
- Route-level data loading

## Decision

Use TanStack Router.

## Consequences

### Benefits

- Type safety
- Excellent data loading
- Modern architecture
- Nested layouts

---

# ADR-003 — TanStack Query

## Status

Accepted

## Context

The application contains:

- User progress
- Lessons
- AI responses
- Social features

All require server synchronization and caching.

## Decision

Use TanStack Query as the primary server-state library.

## Consequences

### Benefits

- Automatic caching
- Background refetching
- Optimistic updates
- Excellent developer experience

---

# ADR-004 — CSS Variables + Design Tokens

## Status

Accepted

## Context

The platform requires a custom design system with consistent theming.

## Decision

Use CSS variables backed by TypeScript design tokens.

## Consequences

### Benefits

- Framework-independent
- Easy theming
- Consistent styling
- No dependency on utility CSS frameworks

---

# ADR-005 — App Shell

## Status

Accepted

## Context

Every page shares common layout elements such as navigation and header.

## Decision

Use a persistent App Shell integrated into the root route.

```
Root Route

    AppShell

        Header

        Sidebar

        Main

            Route Content

        Footer
```

## Consequences

### Benefits

- Shared layout
- Better performance
- Cleaner routing
- Easier feature integration

---

# ADR-006 — Shared vs Feature Components

## Status

Accepted

## Decision

Reusable UI belongs in shared components.

Business-specific components belong inside feature folders.

Examples

Shared

- Button
- Card
- Avatar
- Modal

Feature

- LessonQuiz
- SpeechQuiz
- ReviewQueue
- AIChat

---

# ADR-007 — Incremental Development

## Status

Accepted

## Decision

Every feature must follow the same workflow.

1. Architecture
2. Planning
3. Implementation
4. Testing
5. Documentation
6. Commit

No feature is considered complete until all steps are finished.

---

# Future ADRs

Examples:

- Offline-first synchronization
- AI provider abstraction
- Plugin architecture
- Mobile strategy
- Analytics platform
- Payment provider
- Storage strategy
- Search implementation