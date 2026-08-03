# GENKŌ Coding Standards

> This document defines the coding conventions used throughout the GENKŌ project. Following these standards ensures consistency, maintainability, and readability across the codebase.

---

# Philosophy

Code should be:

- Readable
- Predictable
- Type-safe
- Testable
- Reusable
- Documented

Always optimize for long-term maintainability rather than short-term speed.

---

# General Principles

## 1. Keep Components Small

A component should have one responsibility.

✅ Good

Button

Avatar

LessonCard

ReviewQueue

❌ Bad

DashboardPageHandlingEverything

---

## 2. Composition Over Inheritance

Prefer composing small components instead of creating large configurable ones.

---

## 3. Business Logic

Business logic must never live inside reusable UI components.

UI components should only render data.

---

# Folder Naming

Use lowercase.

Examples

```
features/
learning/
review/
social/
dashboard/
```

Never use:

```
Learning/
ReviewModule/
```

---

# File Naming

React Components

```
LessonCard.tsx
ReviewQueue.tsx
```

Hooks

```
useLesson.ts
useSpeech.ts
```

Utilities

```
formatDate.ts
calculateXp.ts
```

Types

```
lesson.ts
review.ts
```

Constants

```
navigation.ts
colors.ts
```

---

# Component Structure

Recommended order:

```tsx
Imports

Types

Constants

Component

Helper functions (if local)

Export
```

Example

```tsx
import type { Props } from "./types";

interface ButtonProps {}

export function Button() {
    return ...
}
```

---

# Import Order

Always order imports consistently.

```tsx
// React
import { useEffect } from "react";

// Third-party
import { Link } from "@tanstack/react-router";

// Internal libraries
import { cn } from "../../lib";

// Types
import type { ButtonProps } from "./types";

// Styles
import "./Button.css";
```

---

# TypeScript Rules

Always use explicit types.

Prefer

```ts
interface User {}
```

Avoid

```ts
type User = { ... }
```

unless unions or mapped types are required.

Never use

```ts
any
```

Use

```ts
unknown
```

or proper interfaces.

---

# React Rules

Prefer

```tsx
function Component()
```

over

```tsx
const Component = () =>
```

Use named exports.

Avoid default exports unless required.

---

# CSS Rules

Use CSS variables.

Never hardcode values like

```
padding: 16px;
```

Instead

```
padding: var(--space-md);
```

Group declarations logically:

```css
Layout

Box Model

Typography

Visual

Animation
```

---

# State Management

Use:

- React Query → Server state
- Local component state → UI state
- Router → Navigation state

Avoid unnecessary global state.

---

# Feature Organization

Each feature owns:

```
components/

hooks/

services/

types/

api/
```

Business logic stays inside the feature.

---

# Shared Components

Reusable components belong in shared UI.

Examples

- Button
- Card
- Modal
- Avatar
- Progress

Shared components must never know about lessons, AI, or users.

---

# Error Handling

Never silently ignore errors.

Always:

- Log meaningful information (development)
- Display user-friendly messages (production)
- Preserve type safety

---

# Accessibility

Every interactive element must:

- Support keyboard navigation
- Have appropriate labels
- Meet WCAG color contrast requirements

---

# Performance

Avoid premature optimization.

Measure first.

Optimize when data shows a bottleneck.

Use:

- Lazy loading
- Route splitting
- Memoization only when beneficial

---

# Documentation

Every major feature should include:

- Purpose
- Architecture
- Public API
- Known limitations

Update documentation whenever architecture changes.

---

# Git Workflow

Every change follows:

1. Create branch (if applicable)
2. Implement
3. Typecheck
4. Build
5. Manual verification
6. Commit

Commit messages follow Conventional Commits.

Examples

```
feat(learning): add lesson progress tracking

fix(review): resolve incorrect review queue sorting

refactor(layout): simplify app shell structure

docs(architecture): update feature organization
```

---

# Definition of Done

A task is complete only when:

- Code builds successfully
- TypeScript passes
- Existing functionality still works
- Documentation updated
- Commit created
- Ready for production