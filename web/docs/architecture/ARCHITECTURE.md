# GENKŌ Architecture Guide

> Version: 2.0
>
> Last Updated: 2026-07-31
>
> Status: Active
>
> Document Type: Engineering Handbook

---

# Table of Contents

- Introduction
- Project Vision
- Engineering Philosophy
- Design Principles
- Project Goals
- Non-Goals
- Technology Stack
- High-Level System Architecture
- Core Architectural Principles
- Application Layers
- Documentation Structure

---

# Introduction

Welcome to the official architecture guide for **GENKŌ**.

This document serves as the primary engineering reference for the entire frontend architecture.

Unlike a traditional README, this handbook explains not only **what** the project contains, but also **why** architectural decisions were made and **how** future development should evolve.

Every engineer working on GENKŌ should read this document before contributing.

The goals of this document are to:

- explain the architecture
- describe every major subsystem
- document engineering decisions
- maintain consistency across the codebase
- reduce technical debt
- improve maintainability
- help AI-assisted development
- simplify onboarding for future developers

This document is considered the source of truth for frontend architecture.

Whenever architecture changes, this document must be updated.

---

# What is GENKŌ?

GENKŌ is an AI-powered Japanese learning ecosystem designed to provide a modern, engaging, and scalable language learning experience.

Rather than being only a lesson platform, GENKŌ aims to become a complete educational ecosystem combining:

- structured learning
- adaptive learning
- AI tutoring
- gamification
- community learning
- creator tools
- analytics
- offline support
- future mobile applications

The architecture is intentionally designed for long-term scalability.

The goal is to support years of continuous development without requiring major rewrites.

---

# Vision

Our vision is to build one of the most advanced Japanese learning platforms available.

GENKŌ should feel like the combination of:

- Duolingo
- WaniKani
- Bunpro
- ChatGPT
- Discord
- Notion

inside one unified application.

Every feature should contribute toward a seamless learning experience.

---

# Engineering Philosophy

GENKŌ follows several engineering principles.

## Simplicity

Simple code is preferred over clever code.

If two implementations achieve the same result, choose the one that is easier to understand.

---

## Maintainability

The project is expected to grow significantly.

Architecture decisions prioritize long-term maintenance over short-term convenience.

---

## Scalability

The architecture should comfortably support:

- thousands of lessons
- multiple learning modes
- AI integrations
- community features
- multiple teams of developers

without requiring structural redesign.

---

## Predictability

Developers should always know where new code belongs.

There should be minimal ambiguity.

For example:

- reusable UI belongs in reusable component folders
- business logic belongs inside features
- application startup belongs inside app/
- global utilities belong inside lib/

Predictable organization reduces cognitive load.

---

## Documentation First

Major architectural decisions should be documented before implementation.

Documentation is considered part of the codebase.

If architecture changes, documentation changes.

---

# Project Goals

The primary goals of GENKŌ are:

## Educational Excellence

Provide high-quality Japanese learning experiences.

---

## AI Integration

Integrate AI naturally into learning rather than treating it as an isolated feature.

---

## Performance

Deliver fast interactions with minimal loading times.

---

## Accessibility

Ensure the platform is usable by all learners.

---

## Extensibility

New modules should integrate without large-scale refactoring.

---

## Offline Capability

Support learning even without an internet connection where possible.

---

# Non-Goals

GENKŌ intentionally avoids several architectural patterns.

## Massive Global State

Most state should remain local or server-managed.

Global state should remain minimal.

---

## Business Logic Inside Components

UI components should render data.

Business rules belong elsewhere.

---

## Tight Coupling

Features should remain independent whenever possible.

---

## Premature Optimization

Performance optimizations should be based on profiling and measurement.

---

# Technology Stack

## Frontend Framework

React

Reason:

- mature ecosystem
- component architecture
- strong community
- excellent tooling

---

## Programming Language

TypeScript

Reason:

- static typing
- improved maintainability
- better tooling
- self-documenting code

---

## Build Tool

Vite

Reason:

- fast development server
- optimized production builds
- excellent TypeScript support

---

## Routing

TanStack Router

Responsibilities:

- routing
- layouts
- loaders
- route context
- error boundaries
- type-safe navigation

---

## Server State

TanStack Query

Responsibilities:

- API caching
- background synchronization
- mutations
- optimistic updates
- cache invalidation

---

## Styling

CSS Variables

Design Tokens

Component CSS

Reason:

- framework independent
- highly customizable
- maintainable
- excellent runtime performance

---

# High-Level Architecture

```
                Browser
                    │
                    ▼
             React Application
                    │
                    ▼
           TanStack Router
                    │
                    ▼
              Root App Shell
                    │
      ┌─────────────┼─────────────┐
      │             │             │
      ▼             ▼             ▼
 Dashboard     Learning      Community
      │             │             │
      ▼             ▼             ▼
 Feature      Feature        Feature
 Components   Components     Components
      │             │             │
      └─────────────┼─────────────┘
                    ▼
                Services
                    │
                    ▼
              Backend APIs
                    │
                    ▼
                Database
```

---

# Core Architectural Principles

The architecture follows several core principles.

## Feature Ownership

Every feature owns its own:

- components
- hooks
- services
- types
- API layer

This keeps related code together.

---

## Separation of Concerns

Different layers have different responsibilities.

UI should not perform API requests directly.

Services should not render UI.

Routes should not contain business logic.

---

## Composition

Small reusable components compose larger components.

Large monolithic components are discouraged.

---

## Single Responsibility

Every module should have one primary responsibility.

---

## Explicit Dependencies

Dependencies should be obvious and predictable.

Hidden coupling should be avoided.

---

# Application Layers

The frontend is divided into logical layers.

```
Application Layer

↓

Routing Layer

↓

Feature Layer

↓

Shared UI Layer

↓

Services

↓

Backend
```

Each layer has clearly defined responsibilities.

Later chapters explain every layer in detail.

---

# Documentation Structure

The engineering documentation is divided into multiple documents.

```
docs/

README.md

ARCHITECTURE.md

ROADMAP.md

DECISIONS.md

CODING_STANDARDS.md

DESIGN_SYSTEM.md

STATE_MANAGEMENT.md

API.md

FEATURES.md

CHANGELOG.md
```

Each document has a specific purpose.

Architecture documentation should remain synchronized with the implementation.

---

# Reading Order

For new contributors, the recommended reading order is:

1. README.md
2. ARCHITECTURE.md
3. CODING_STANDARDS.md
4. ROADMAP.md
5. DECISIONS.md

After reading these documents, contributors should have a complete understanding of the project's structure, engineering philosophy, and development workflow.

---

# Source Tree

The `src/` directory contains the entire frontend application.

Every top-level folder has a single responsibility.

Keeping responsibilities clearly separated makes the project easier to navigate, maintain, and scale.

```
src/
│
├── app/
├── assets/
├── components/
├── constants/
├── features/
├── hooks/
├── lib/
├── routes/
├── services/
├── styles/
├── types/
│
├── main.tsx
└── vite-env.d.ts
```

The remainder of this chapter explains each directory in detail.

---

# Overall Folder Hierarchy

The project follows a layered architecture.

```
src
│
├── app
│     ├── Application Bootstrap
│     ├── Providers
│     ├── Layouts
│     └── Configuration
│
├── routes
│     └── URL → Feature Mapping
│
├── features
│     └── Business Logic
│
├── components
│     ├── Layout Components
│     └── Reusable UI
│
├── services
│     └── External Communication
│
├── lib
│     └── Utilities
│
├── styles
│     └── Design System
│
└── types
      └── Shared Models
```

The dependency direction should always flow downward.

```
Routes
    ↓
Features
    ↓
Components
    ↓
Services
    ↓
Utilities
```

Never reverse this dependency chain.

---

# app/

## Purpose

The `app/` directory contains everything required to start and configure the application.

Think of it as the application's operating system.

Nothing inside `app/` should contain feature-specific business logic.

---

## Responsibilities

The app layer is responsible for:

- Application bootstrap
- Global providers
- Root layouts
- Theme initialization
- Authentication initialization
- Router configuration
- Error boundaries
- Global configuration

---

## Recommended Structure

```
app/

layouts/

providers/

config/

router/

index.ts
```

---

## Example

```
app/

layouts/

AppShell.tsx

providers/

QueryProvider.tsx

ThemeProvider.tsx

AuthProvider.tsx

router/

router.ts

config/

env.ts
```

---

## What Belongs Here?

✔ Theme initialization

✔ React Query Provider

✔ Authentication Provider

✔ Global Error Boundary

✔ Root Layout

✔ Router

---

## What Does NOT Belong Here?

✘ Lesson logic

✘ Dashboard logic

✘ AI prompts

✘ Review algorithms

✘ API implementations

Those belong inside Features or Services.

---

## Dependency Rules

Allowed

```
app

↓

components

↓

services

↓

lib
```

Forbidden

```
app

↓

feature-specific business logic
```

---

## Common Mistakes

❌ Calling APIs directly.

❌ Fetching dashboard data.

❌ Managing lesson progress.

❌ Business calculations.

The app layer should only assemble the application.

---

# assets/

## Purpose

The assets directory stores static resources.

These files are not executable code.

---

## Structure

```
assets/

fonts/

icons/

images/

audio/

animations/
```

---

## Examples

```
logo.svg

hero.webp

japan.png

bell.svg

NotoSansJP.ttf
```

---

## Rules

Assets should never contain logic.

Never import application code inside assets.

---

# components/

## Purpose

The components directory contains reusable presentation components.

Components should be generic whenever possible.

---

## Philosophy

A component answers one question:

"Can this component be reused somewhere else?"

If the answer is yes,

it belongs here.

---

## Structure

```
components/

layout/

ui/

feedback/

navigation/
```

---

# components/layout/

Layout components define the application's structure.

Example:

```
AppShell

Sidebar

AppHeader

Footer

Main

Breadcrumbs

CommandPalette
```

Layout components know nothing about lessons or reviews.

They only arrange content.

---

# components/ui/

Contains reusable UI primitives.

Examples:

```
Button

Card

Badge

Input

Avatar

Dialog

Tabs

Progress

Skeleton

Spinner

Tooltip

Modal
```

These components should remain business-agnostic.

---

## Good Example

```
<Button>

<Card>

<Input>
```

---

## Bad Example

```
LessonButton

KanjiInput

ReviewProgressCard
```

These belong inside features.

---

# Component Hierarchy

```
Dashboard Page

↓

Continue Learning Card

↓

Card

↓

Button

↓

Icon
```

Notice that reusable UI sits at the bottom.

---

## Dependency Rules

Allowed

```
Feature

↓

UI Components
```

Forbidden

```
UI Component

↓

Feature
```

UI should never know about business logic.

---

# constants/

## Purpose

Stores immutable application-wide constants.

---

Examples

```
navigation.ts

roles.ts

permissions.ts

languages.ts

routes.ts

theme.ts
```

---

Constants should never contain functions.

They are values only.

---

# hooks/

## Purpose

Global reusable React hooks.

---

Structure

```
hooks/

useTheme()

useSpeech()

useShortcut()

useMediaQuery()

useLocalStorage()
```

---

Rules

Hooks should encapsulate reusable behavior.

If only one feature uses a hook,

move it into that feature.

---

# lib/

## Purpose

General-purpose utilities.

These utilities should be framework-independent whenever possible.

---

Examples

```
cn()

formatDate()

debounce()

sleep()

storage()

validators()

math()

logger()
```

---

Good Utility

```
formatDuration()
```

Bad Utility

```
calculateReviewScore()
```

That belongs inside Review.

---

# routes/

## Purpose

Routes connect URLs to features.

Routes should remain extremely small.

---

Example

```
routes/

__root.tsx

index.tsx

lesson.$id.tsx

study.$id.tsx

review.tsx
```

---

Routes Should

✔ Load data

✔ Configure metadata

✔ Render pages

---

Routes Should NOT

✘ Calculate XP

✘ Validate lessons

✘ Build quizzes

✘ Process AI

---

Ideal Route

```
URL

↓

Loader

↓

Feature Page

↓

Feature Components
```

Routes orchestrate.

Features execute.

---

# services/

## Purpose

Services communicate with systems outside React.

---

Examples

```
API Client

Audio Service

Speech Service

Storage Service

Analytics Service

Notification Service
```

---

Services Should

✔ Fetch data

✔ Upload data

✔ Cache

✔ Handle retries

✔ Process requests

---

Services Should NOT

✘ Render components

✘ Manage layouts

✘ Display dialogs

---

# styles/

## Purpose

Single source of truth for visual design.

---

Structure

```
styles/

colors.ts

spacing.ts

radius.ts

typography.ts

motion.ts

theme.ts

globals.css
```

---

Every visual value should originate here.

Never scatter design values throughout the application.

---

# types/

## Purpose

Contains globally shared TypeScript definitions.

---

Examples

```
User

Session

APIResponse

Pagination

Error

Theme

Locale
```

---

Feature-specific types belong inside their own feature.

---

# main.tsx

The application's entry point.

Responsibilities

- Create React root
- Mount App
- Import global styles
- Initialize providers

Nothing else.

---

# Folder Responsibility Matrix

| Folder | Responsibility |
|---------|----------------|
| app | Application bootstrap |
| assets | Static resources |
| components | Reusable UI |
| constants | Shared constants |
| features | Business domains |
| hooks | Reusable hooks |
| lib | Utilities |
| routes | URL mapping |
| services | External systems |
| styles | Design system |
| types | Shared types |

---

# Dependency Graph

```
main.tsx
      │
      ▼
app
      │
      ▼
routes
      │
      ▼
features
      │
      ▼
components
      │
      ▼
services
      │
      ▼
lib
```

Dependencies should always flow in this direction.

Avoid circular dependencies.

---

# Migration Strategy

As the project grows:

- Keep adding new business functionality inside `features/`.
- Keep `components/` generic and reusable.
- Extract repeated logic into `lib/` or `services/` only when it is truly shared.
- Avoid creating large "miscellaneous" folders.
- Refactor incrementally instead of performing large rewrites.

Every new folder should have a clearly defined responsibility before it is introduced.

---

# Feature Architecture

The `features/` directory is the heart of the GENKŌ application.

Every business capability lives inside a feature.

A feature owns everything required to implement its functionality, including:

- Components
- Pages
- Hooks
- Services
- API Layer
- Types
- Validation
- Business Logic
- Tests
- Documentation

The goal is to keep related code together while minimizing coupling between different business domains.

---

# Why Feature-First?

Many applications begin with folders such as:

```
components/
pages/
hooks/
services/
utils/
```

While this works for small projects, it becomes difficult to maintain as the application grows.

Instead of organizing by **file type**, GENKŌ organizes by **business domain**.

This approach provides several advantages:

- Better discoverability
- Easier maintenance
- Clear ownership
- Reduced coupling
- Simpler onboarding
- Easier testing
- Better scalability

---

# Feature Hierarchy

```
Application
│
├── Dashboard
├── Learning
├── Review
├── AI
├── Social
├── Creator
├── Authentication
└── Settings
```

Each feature behaves like a mini application.

---

# Recommended Feature Structure

Every feature should follow the same internal organization.

```
features/

dashboard/

components/

pages/

hooks/

services/

api/

types/

constants/

utils/

tests/

README.md

index.ts
```

Not every feature will need every folder.

Only create folders when necessary.

---

# Responsibilities

## components/

Contains UI specific to this feature.

Example:

```
DashboardHeader

ContinueLearning

RecentActivity

XPProgress

DailyGoal

AchievementGrid
```

These components should not be reused outside the Dashboard unless they become generic enough.

---

## pages/

Contains feature entry pages.

Example:

```
DashboardPage.tsx

StatisticsPage.tsx

AchievementsPage.tsx
```

Pages compose feature components.

Pages should contain very little business logic.

---

## hooks/

Contains reusable hooks specific to the feature.

Example

```
useDashboard()

useAchievements()

useDailyGoal()

useRecentActivity()
```

If another feature needs the hook, evaluate whether it belongs in `hooks/` or should remain feature-specific.

---

## services/

Contains business rules.

Examples

```
calculateXP()

calculateStreak()

calculateLevel()

generateRecommendations()

unlockAchievement()
```

Business rules belong here.

Never inside UI components.

---

## api/

Responsible for backend communication.

Example

```
dashboardApi.ts

achievementApi.ts

statisticsApi.ts
```

The API layer should:

- Fetch data
- Submit data
- Handle HTTP errors
- Transform API responses if necessary

The API layer should NOT:

- Render UI
- Store React state
- Calculate business rules

---

## types/

Contains feature-specific TypeScript definitions.

Example

```
DashboardStats

Achievement

XPHistory

DailyGoal

LeaderboardEntry
```

Shared models belong inside `src/types`.

---

## constants/

Contains feature-specific constants.

Example

```
XP values

Achievement IDs

Difficulty Levels

Progress Thresholds
```

---

## utils/

Contains helper functions used only by this feature.

Example

```
formatXP()

groupAchievements()

sortLeaderboard()
```

If utilities become reusable, move them into `src/lib`.

---

## tests/

Contains unit and integration tests.

Example

```
Dashboard.test.tsx

AchievementCard.test.tsx

calculateXP.test.ts
```

Tests should mirror the production structure whenever possible.

---

# Feature Ownership

Every feature owns its own code.

Example:

```
Learning

↓

Vocabulary

Grammar

Kanji

Lessons

Progress
```

Another feature should not modify Learning internals.

Communication should happen through shared services or APIs.

---

# Feature Independence

Good

```
Dashboard

↓

Shared UI

↓

Button
```

Bad

```
Dashboard

↓

Learning

↓

Review

↓

AI
```

Direct feature-to-feature imports create tight coupling.

Avoid them whenever possible.

---

# Standard Communication Flow

```
Feature

↓

Hook

↓

Service

↓

API

↓

Backend
```

Data always flows downward.

---

# Dashboard Feature

Purpose

Provide an overview of the learner's activity.

Typical Structure

```
dashboard/

components/

DashboardHeader

ContinueLearning

DailyGoal

RecentActivity

Achievements

XPCard

hooks/

useDashboard()

useAchievements()

services/

calculateXP()

calculateDailyGoal()

api/

dashboardApi.ts

pages/

DashboardPage.tsx
```

Dashboard should not contain lesson logic.

---

# Learning Feature

Purpose

Manage the complete learning experience.

Example

```
learning/

components/

LessonCard

VocabularyCard

GrammarCard

KanjiCard

QuizCard

hooks/

useLesson()

useVocabulary()

services/

buildLesson()

calculateProgress()

unlockLesson()

api/

lessonApi.ts

vocabularyApi.ts
```

Learning owns everything related to studying.

---

# Review Feature

Purpose

Manage spaced repetition and practice.

Example

```
review/

components/

ReviewCard

Flashcard

ReviewSummary

ReviewProgress

services/

buildQueue()

calculateReview()

scheduleNextReview()

api/

reviewApi.ts
```

Review should never know about Dashboard.

---

# AI Feature

Purpose

Provide intelligent learning assistance.

Example

```
ai/

components/

AITutor

ConversationWindow

GrammarExplanation

VocabularyAssistant

hooks/

useTutor()

useConversation()

services/

PromptBuilder

ResponseFormatter

MemoryManager

api/

aiApi.ts
```

AI should remain isolated.

This makes replacing providers easier in the future.

---

# Social Feature

Purpose

Handle community interactions.

Example

```
social/

components/

FriendCard

Leaderboard

GroupCard

Discussion

pages/

CommunityPage

LeaderboardPage

hooks/

useFriends()

useLeaderboard()

api/

socialApi.ts
```

---

# Creator Studio

Purpose

Provide lesson creation tools.

Example

```
creator/

components/

LessonEditor

QuizBuilder

KanjiBuilder

Preview

services/

Validator

Exporter

Importer

api/

creatorApi.ts
```

---

# Feature Lifecycle

Every feature should follow the same lifecycle.

```
Requirements

↓

Architecture

↓

Implementation

↓

Testing

↓

Documentation

↓

Review

↓

Release
```

Skipping documentation should not be considered acceptable.

---

# Dependency Rules

Allowed

```
Feature

↓

components/ui

↓

lib

↓

services

↓

types
```

Allowed

```
Feature

↓

Own Components
```

Forbidden

```
Feature A

↓

Feature B
```

Forbidden

```
Feature

↓

App Bootstrap
```

Forbidden

```
Feature

↓

Route Internals
```

---

# Import Strategy

Prefer importing from the feature root.

Good

```ts
import { DashboardPage } from "@/features/dashboard";
```

Avoid

```ts
import DashboardPage from "@/features/dashboard/pages/DashboardPage";
```

Expose public APIs through `index.ts`.

---

# Public API Pattern

Every feature should define what is publicly accessible.

Example

```
dashboard/

index.ts

export * from "./pages/DashboardPage";
export * from "./hooks/useDashboard";
```

Everything else remains internal.

---

# Common Mistakes

❌ Sharing business logic through UI components.

❌ Creating circular dependencies.

❌ Putting API calls inside components.

❌ Using another feature's internal utilities.

❌ Exposing every file publicly.

❌ Mixing dashboard logic with learning logic.

❌ Creating giant "common" folders without clear ownership.

---

# Best Practices

✅ Keep features independent.

✅ Keep business logic inside services.

✅ Keep pages lightweight.

✅ Keep UI reusable.

✅ Keep APIs isolated.

✅ Export only public interfaces.

✅ Document every feature.

✅ Write tests alongside the feature.

---

# Future Growth

As GENKŌ evolves, new features should follow exactly the same architecture.

Future examples:

```
features/

marketplace/

events/

certifications/

offline/

notifications/

analytics/

payments/

organizations/
```

No architectural changes should be required to support these additions.

The feature-first architecture is intentionally designed to scale with the platform for many years.

---

# Application Architecture

The application layer is responsible for transforming a browser request into an interactive user interface.

Unlike feature modules, the application layer contains **no business logic**.

Its responsibility is orchestration.

It initializes the application, configures global providers, sets up routing, mounts layouts, and renders the correct feature.

---

# Application Startup

Every React application begins from a single entry point.

```
Browser
    │
    ▼
main.tsx
    │
    ▼
<App />
```

For GENKŌ, the startup process follows a predictable sequence.

```
Browser
    │
    ▼
main.tsx
    │
    ▼
React Root
    │
    ▼
Global Providers
    │
    ▼
TanStack Router
    │
    ▼
Root Layout
    │
    ▼
Feature Route
    │
    ▼
Feature Page
```

Every screen ultimately begins from this flow.

---

# Entry Point

The application starts in:

```
src/main.tsx
```

Responsibilities:

- Create the React root
- Import global styles
- Render the application
- Register global providers

Example

```tsx
createRoot(document.getElementById("root")!).render(
    <App />
)
```

Nothing else should happen here.

Avoid:

- API calls
- Authentication logic
- Feature initialization
- Business calculations

---

# Application Bootstrap

The bootstrap process prepares the environment before rendering.

Typical responsibilities include:

- Theme initialization
- React Query initialization
- Router creation
- Motion configuration
- Authentication restoration
- Global event listeners

Diagram

```
main.tsx
    │
    ▼
Initialize Providers
    │
    ▼
Restore Session
    │
    ▼
Create Router
    │
    ▼
Render App
```

---

# Global Providers

Providers wrap the application with global functionality.

Typical providers include:

```
<QueryProvider>

<ThemeProvider>

<AuthProvider>

<MotionProvider>

<NotificationProvider>
```

Hierarchy

```
App

│

├── Query Provider

├── Theme Provider

├── Auth Provider

├── Router Provider

└── Application
```

Each provider should have one responsibility.

---

# Why Providers?

Instead of passing data manually through every component,

React Providers expose shared functionality throughout the application.

Examples:

- Theme
- Authentication
- Notifications
- Query Client

Business logic should **not** live inside providers.

---

# Routing Architecture

GENKŌ uses **TanStack Router**.

Responsibilities:

- URL mapping
- Nested layouts
- Loaders
- Error boundaries
- Route metadata
- Navigation
- Type-safe routing

---

# Route Structure

```
routes/

__root.tsx

index.tsx

study.$id.tsx

lesson.$id.tsx

practice.tsx

review.tsx

social.tsx

creator.tsx
```

Routes map URLs to features.

---

# Route Lifecycle

Whenever a user visits a page:

```
URL

↓

Match Route

↓

Execute Loader

↓

Prepare Data

↓

Render Layout

↓

Render Feature

↓

Render Components
```

---

# Example Flow

```
User visits

/lesson/12

↓

lesson.$id.tsx

↓

Loader executes

↓

Lesson API

↓

Lesson Feature

↓

Lesson Components

↓

UI
```

---

# Route Responsibilities

Routes should:

✔ Match URLs

✔ Execute loaders

✔ Configure metadata

✔ Render layouts

✔ Handle route errors

Routes should NOT:

✘ Build quizzes

✘ Calculate XP

✘ Validate lessons

✘ Perform AI prompts

Those belong inside features.

---

# App Shell

The App Shell is the persistent structure of the application.

Unlike pages, the App Shell remains mounted while navigating.

Diagram

```
┌───────────────────────────────────────┐
│ App Header                            │
├───────────────┬───────────────────────┤
│ Sidebar       │                       │
│               │                       │
│               │ Main Content          │
│               │                       │
│               │                       │
├───────────────┴───────────────────────┤
│ Footer                                │
└───────────────────────────────────────┘
```

Only the **Main Content** changes during navigation.

---

# App Shell Responsibilities

The App Shell provides:

- Global navigation
- Layout consistency
- Responsive behavior
- Persistent UI
- Keyboard shortcuts
- Global dialogs
- Command palette
- Theme switching

It should never contain lesson logic.

---

# Layout Hierarchy

```
Browser

↓

AppShell

├── AppHeader

├── Sidebar

├── Main

│      ↓

│   Route Content

│

└── Footer
```

This hierarchy remains stable throughout the application.

---

# Header

Responsibilities:

- User profile
- Notifications
- Search
- Settings
- Theme switcher

The Header should not know about:

- Lessons
- Reviews
- AI
- Dashboard logic

---

# Sidebar

Responsibilities:

- Navigation
- Active route
- Expand/collapse
- Responsive behavior

Navigation items should come from shared constants.

Avoid hardcoded links.

---

# Main Content

The Main component is responsible for rendering route content.

```
Main

↓

Outlet

↓

Feature Page

↓

Feature Components
```

The Main component should not perform API requests.

---

# Footer

Contains:

- Copyright
- Version
- Useful links
- Status indicators

Keep the Footer lightweight.

---

# Navigation Flow

```
Click Navigation

↓

Router

↓

Match Route

↓

Loader

↓

Feature

↓

Render
```

Navigation should never reload the application.

---

# Nested Layouts

Some features may require their own layouts.

Example

```
AppShell

↓

Creator Layout

↓

Lesson Editor

↓

Editor Components
```

Nested layouts avoid duplication.

---

# Route Metadata

Each route may define metadata.

Examples:

- Title
- Description
- Breadcrumb
- Authentication
- Permissions

Example

```
Lesson

↓

Title

↓

Breadcrumb

↓

Permission

↓

Render
```

---

# Error Boundaries

Every route should be protected.

```
Route

↓

Error Boundary

↓

Fallback UI
```

Unexpected failures should never crash the application.

---

# Loading States

Every route should define loading behavior.

Good examples:

- Skeletons
- Progress indicators
- Placeholder cards

Avoid blank screens.

---

# Request Lifecycle

The complete lifecycle of a page request:

```
User

↓

Click Link

↓

Router

↓

Loader

↓

Service

↓

Backend API

↓

Response

↓

React Query Cache

↓

Feature Hook

↓

Feature Components

↓

UI
```

Every request follows this pattern.

---

# Rendering Lifecycle

```
Route

↓

Page

↓

Feature

↓

Components

↓

UI Components

↓

DOM
```

Rendering should always flow downward.

---

# State Flow

```
Backend

↓

API

↓

React Query

↓

Feature Hook

↓

Component

↓

UI
```

Avoid bypassing this flow.

---

# Dependency Flow

```
App

↓

Routes

↓

Features

↓

Components

↓

Services

↓

Lib
```

Higher layers may depend on lower layers.

Lower layers should never depend on higher layers.

---

# Common Mistakes

❌ Business logic inside routes.

❌ API calls inside layout components.

❌ Feature state inside App Shell.

❌ Hardcoded navigation.

❌ Large route files.

❌ Duplicating layouts.

❌ Fetching the same data multiple times.

---

# Best Practices

✅ Keep routes thin.

✅ Keep layouts reusable.

✅ Keep providers focused.

✅ Use nested layouts.

✅ Let features own business logic.

✅ Cache server data with React Query.

✅ Keep the App Shell persistent.

---

# Future Expansion

The current architecture supports future additions without structural changes.

Possible future layouts include:

```
Admin Layout

Creator Layout

Marketplace Layout

Organization Layout

Analytics Layout

Settings Layout
```

Each layout can extend the App Shell while maintaining a consistent user experience.

---

# State Management

State management is one of the most important architectural decisions in GENKŌ.

As the application grows, different types of state emerge, each with unique characteristics and lifecycle requirements.

Instead of storing everything in one global store, GENKŌ separates state into logical categories.

This approach improves maintainability, scalability, and performance.

---

# State Categories

The application uses four primary categories of state.

```
Application State

├── Server State
├── UI State
├── Session State
└── Persistent State
```

Each category has different ownership, update frequency, and storage location.

---

# State Architecture

```
                Backend
                    │
                    ▼
             API Layer (services)
                    │
                    ▼
            TanStack Query Cache
                    │
                    ▼
             Feature Hooks
                    │
                    ▼
           Feature Components
                    │
                    ▼
             Presentation UI
```

Data always flows downward.

---

# Server State

Server State refers to data owned by the backend.

Examples include:

- Lessons
- Vocabulary
- Kanji
- Grammar
- User Progress
- Achievements
- Leaderboards
- Notifications
- Friends
- Review Queue

Characteristics:

- Lives on the backend
- Can become stale
- Shared across devices
- Requires synchronization
- Requires caching

---

# Why TanStack Query?

GENKŌ uses TanStack Query to manage server state.

Responsibilities:

- Request deduplication
- Automatic caching
- Background refetching
- Retry failed requests
- Pagination
- Infinite queries
- Optimistic updates
- Cache invalidation

Without React Query, these features would need to be implemented manually.

---

# Server State Lifecycle

```
Component

↓

Feature Hook

↓

React Query

↓

API Service

↓

Backend

↓

Response

↓

Cache

↓

UI Update
```

---

# Example Flow

```
Dashboard

↓

useDashboard()

↓

dashboardApi()

↓

Backend

↓

Cache

↓

Dashboard Components
```

Business components should never fetch data directly.

---

# Cache Strategy

Every request passes through the Query Cache.

```
Request

↓

Cache Available?

├── Yes
│      │
│      ▼
│   Return Cached Data
│
└── No
       │
       ▼
     Backend
       │
       ▼
     Store Cache
       │
       ▼
       UI
```

The cache becomes the single source of truth for server data.

---

# Cache Invalidation

Whenever data changes:

```
Mutation

↓

Backend Update

↓

Invalidate Query

↓

Refetch

↓

Refresh UI
```

Never manually synchronize server data.

Always invalidate the relevant query.

---

# UI State

UI State exists only while the application is running.

Examples

- Modal visibility
- Sidebar open/closed
- Selected tab
- Active dropdown
- Accordion state
- Search input
- Wizard step

Characteristics

- Temporary
- Local
- Not shared
- Not persisted
- Component-owned

---

# UI State Flow

```
Button Click

↓

Component State

↓

Re-render

↓

Updated UI
```

React's built-in state management is sufficient.

---

# Session State

Session State represents the authenticated user.

Examples

- Logged-in user
- Access token
- Refresh token
- User permissions
- Roles
- Subscription

Session State is initialized during application startup.

```
Browser

↓

Restore Session

↓

Authentication Provider

↓

Application
```

---

# Persistent State

Persistent state survives page refreshes.

Examples

- Theme
- Language
- Sidebar preference
- User settings
- Accessibility preferences

Persistence options include:

- Local Storage
- IndexedDB
- Secure Cookies

Only persist data that improves user experience.

---

# What Should NOT Be Persisted?

Avoid storing:

- Temporary forms
- Loading states
- Server cache
- API responses
- Sensitive information
- Business calculations

Persistent storage should remain minimal.

---

# State Ownership

Every piece of state should have one clear owner.

```
Lesson Progress

↓

Learning Feature

NOT

Dashboard
```

Ownership prevents duplication and conflicting updates.

---

# State Flow

```
Backend

↓

API Service

↓

Query Cache

↓

Feature Hook

↓

Component

↓

UI
```

Avoid bypassing intermediate layers.

---

# Feature Hooks

Every feature exposes hooks that encapsulate state management.

Example

```
useDashboard()

↓

React Query

↓

Dashboard API

↓

Cache

↓

Dashboard UI
```

Hooks provide a clean interface for components.

---

# Why Hooks?

Hooks separate business logic from presentation.

Instead of:

```
Component

↓

API

↓

Transform Data

↓

Render
```

We use:

```
Component

↓

Hook

↓

Business Logic

↓

API

↓

Backend
```

Components become significantly simpler.

---

# Services Layer

The services layer communicates with external systems.

Examples:

```
services/

api/

audio/

speech/

storage/

analytics/

notifications/
```

Services should remain framework-independent whenever possible.

---

# Service Responsibilities

A service may:

- Fetch data
- Upload data
- Retry requests
- Transform responses
- Handle authentication
- Handle errors

A service should never:

- Render components
- Access JSX
- Manage UI state
- Display dialogs

---

# API Layer

Every feature owns its own API module.

Example

```
learning/

api/

lessonApi.ts

grammarApi.ts

kanjiApi.ts
```

This keeps API contracts close to the feature.

---

# API Flow

```
Feature

↓

Feature Hook

↓

API Module

↓

HTTP Client

↓

Backend
```

Never call the HTTP client directly from UI components.

---

# Error Handling

Errors should be handled at multiple levels.

```
Backend

↓

API Layer

↓

React Query

↓

Feature

↓

UI
```

Each layer has different responsibilities.

---

# Error Categories

Examples:

```
Network Error

Authentication Error

Validation Error

Permission Error

Server Error

Unknown Error
```

Different errors require different UI responses.

---

# Error Recovery

Preferred strategy:

```
Request

↓

Failed

↓

Retry?

├── Yes
│      │
│      ▼
│   Retry
│
└── No
       │
       ▼
    Show Error UI
```

Avoid crashing the application.

---

# Loading States

Every asynchronous operation should expose loading state.

Examples:

- Skeleton cards
- Loading spinners
- Progress bars
- Placeholder content

Avoid blank pages.

---

# Optimistic Updates

For actions such as:

- Completing lessons
- Liking posts
- Marking notifications
- Updating settings

The UI may update immediately.

```
User Action

↓

Temporary Update

↓

Backend

↓

Success

↓

Keep State
```

If the request fails:

```
Rollback

↓

Show Error

↓

Restore Previous State
```

---

# Offline Considerations

Future versions of GENKŌ will support offline learning.

Architecture already accounts for this.

```
User

↓

Offline Cache

↓

Sync Queue

↓

Internet Available

↓

Backend
```

The synchronization layer will replay queued operations.

---

# Data Synchronization

Future synchronization flow:

```
Local Change

↓

Queue

↓

Connection Available

↓

Sync Service

↓

Backend

↓

Invalidate Cache

↓

Refresh UI
```

This architecture supports offline-first expansion without changing feature implementations.

---

# Performance Considerations

To reduce unnecessary rendering:

- Keep state local whenever possible.
- Avoid prop drilling.
- Split large queries.
- Use memoization only when beneficial.
- Keep components focused.

Performance optimizations should be driven by profiling rather than assumptions.

---

# Common Mistakes

❌ Fetching data directly inside UI components.

❌ Storing server state in React Context.

❌ Duplicating the same state across features.

❌ Mixing UI state with server state.

❌ Making API requests inside reusable UI components.

❌ Persisting unnecessary state.

❌ Updating cached data manually instead of invalidating queries.

---

# Best Practices

✅ Let TanStack Query manage server state.

✅ Keep UI state local.

✅ Keep business logic inside feature hooks and services.

✅ Use optimistic updates carefully.

✅ Invalidate queries after successful mutations.

✅ Design for offline support from the beginning.

✅ Separate concerns between presentation, state, and networking.

---

# State Management Summary

```
Backend
    │
    ▼
Services
    │
    ▼
Feature APIs
    │
    ▼
TanStack Query
    │
    ▼
Feature Hooks
    │
    ▼
Components
    │
    ▼
Reusable UI
```

Every layer has a clear responsibility.

Maintaining this separation ensures the application remains scalable, testable, and easy to evolve as new features are added.

---

# UI Architecture & Design System

A consistent user interface is essential for creating a professional learning experience.

The Design System is the single source of truth for all visual elements across GENKŌ.

Rather than treating each page as a separate design, every screen should be composed from reusable building blocks.

The design system ensures:

- Consistency
- Accessibility
- Scalability
- Maintainability
- Faster development
- Easier onboarding

Every UI decision should originate from this system.

---

# Design Philosophy

GENKŌ follows several design principles.

## Consistency

Users should never have to relearn the interface.

Buttons should look and behave the same across every page.

Cards should share the same spacing.

Animations should follow consistent timing.

Typography should remain predictable.

---

## Simplicity

Avoid unnecessary visual complexity.

Every element should have a purpose.

If removing an element improves clarity, remove it.

---

## Accessibility

Every learner should be able to use GENKŌ regardless of ability.

Accessibility is a core requirement—not an optional enhancement.

---

## Responsiveness

The application must adapt to:

- Mobile
- Tablet
- Laptop
- Desktop
- Ultra-wide monitors

Layouts should remain usable at every screen size.

---

## Reusability

Every UI element should be reusable whenever possible.

Avoid creating similar components multiple times.

---

# Design System Structure

```
styles/

colors.ts

spacing.ts

typography.ts

radius.ts

motion.ts

breakpoints.ts

theme.ts

globals.css
```

Reusable UI components consume these design tokens instead of hardcoding values.

---

# Component Architecture

Every screen is built using a hierarchy of components.

```
Page

↓

Section

↓

Card

↓

Component

↓

UI Primitive
```

Example

```
Dashboard

↓

Continue Learning Section

↓

Lesson Card

↓

Button

↓

Icon
```

The higher the component sits in the hierarchy, the more specialized it becomes.

---

# UI Component Categories

```
components/

ui/

layout/

feedback/

navigation/

overlays/
```

Each category has a specific purpose.

---

# UI Components

These are generic building blocks.

Examples

```
Button

Input

Textarea

Card

Badge

Avatar

Tooltip

Dialog

Tabs

Accordion

Progress

Spinner

Skeleton
```

These components must not contain business logic.

---

# Layout Components

Layout components define page structure.

Examples

```
AppShell

Sidebar

AppHeader

Footer

Main

Container

Section

Grid
```

Responsibilities:

- Position content
- Control spacing
- Responsive layouts

They should not fetch data or manage business rules.

---

# Feedback Components

Used to communicate system status.

Examples

```
Toast

Alert

Empty State

Error State

Loading State

Progress Indicator
```

Every asynchronous operation should provide user feedback.

---

# Navigation Components

Examples

```
Sidebar

Breadcrumb

Tabs

Pagination

Navigation Menu

Search Bar
```

Navigation should remain consistent across the application.

---

# Overlay Components

Examples

```
Dialog

Modal

Drawer

Popover

Command Palette

Dropdown Menu
```

Overlays should be accessible and keyboard-friendly.

---

# Design Tokens

Design tokens define reusable design values.

```
Color

Spacing

Typography

Border Radius

Elevation

Motion

Opacity

Breakpoints
```

Components consume tokens instead of hardcoded values.

---

# Colors

Use semantic colors instead of raw values.

Good

```
Primary

Secondary

Surface

Background

Success

Warning

Danger

Info
```

Avoid

```
#4CAF50

rgb(20,200,50)
```

Semantic names make theme changes easier.

---

# Typography

Define a limited typography scale.

Example

```
Display

Heading 1

Heading 2

Heading 3

Body Large

Body

Caption

Label
```

Avoid arbitrary font sizes.

---

# Spacing

Spacing should follow a consistent scale.

Example

```
4

8

12

16

24

32

48

64
```

Never invent random spacing values.

---

# Border Radius

Use predefined radius values.

Example

```
Small

Medium

Large

Extra Large

Full
```

Consistent shapes improve visual harmony.

---

# Shadows

Use elevation levels instead of custom shadows.

Example

```
None

Small

Medium

Large

Extra Large
```

Avoid manually creating shadows in components.

---

# Motion

Animations should feel natural.

Motion tokens define:

- Duration
- Delay
- Easing

Example

```
Fast

Normal

Slow
```

Animations should reinforce interactions rather than distract from them.

---

# Responsive Design

Layouts should adapt smoothly to different screen sizes.

Example

```
Mobile

↓

Tablet

↓

Laptop

↓

Desktop
```

Avoid designing only for desktop.

---

# Responsive Layout Principles

- Flexible grids
- Fluid spacing
- Responsive typography
- Adaptive navigation
- Touch-friendly controls

---

# Accessibility

Accessibility is built into every component.

Requirements:

- Keyboard navigation
- Focus indicators
- Screen reader support
- Color contrast
- Semantic HTML
- Accessible labels

Every interactive element must be reachable without a mouse.

---

# Dark Mode

Themes should be token-driven.

```
Theme

↓

Design Tokens

↓

CSS Variables

↓

Components
```

Components should never know whether they are in light or dark mode.

---

# Icon System

Icons should be:

- Consistent
- Minimal
- Recognizable
- Accessible

Avoid mixing icon libraries unnecessarily.

---

# Images

Guidelines:

- Use optimized formats
- Lazy load when appropriate
- Provide descriptive alt text
- Avoid oversized assets

---

# Empty States

Every feature should define meaningful empty states.

Example

```
No Lessons

No Friends

No Reviews

No Notifications
```

An empty page should guide the user toward the next action.

---

# Loading States

Never leave users staring at a blank screen.

Preferred patterns:

- Skeleton loaders
- Placeholder cards
- Progress indicators

Avoid infinite spinners without context.

---

# Error States

Every recoverable error should provide:

- Clear explanation
- Suggested action
- Retry option

Users should never be left wondering what happened.

---

# Animation Guidelines

Animations should:

- Be subtle
- Reinforce interactions
- Improve usability

Avoid excessive animations that slow down learning.

---

# Component Design Principles

Every component should:

- Have one responsibility
- Be reusable
- Accept clear props
- Avoid hidden side effects
- Remain predictable

Small focused components are easier to test and maintain.

---

# Naming Conventions

Examples

```
Button.tsx

LessonCard.tsx

ProgressRing.tsx

AchievementBadge.tsx
```

Use PascalCase for component names.

Avoid ambiguous names like:

```
Item

Box

Thing

Widget
```

Names should describe purpose.

---

# Composition Over Configuration

Prefer composing simple components.

Good

```
<Card>

    <CardHeader />

    <CardBody />

    <CardFooter />

</Card>
```

Avoid creating highly configurable components that attempt to solve every use case.

---

# Common Mistakes

❌ Hardcoding colors.

❌ Hardcoding spacing.

❌ Duplicating UI components.

❌ Mixing layout and business logic.

❌ Creating oversized components.

❌ Ignoring accessibility.

❌ Inconsistent typography.

❌ Using multiple visual styles for the same interaction.

---

# Best Practices

✅ Build from reusable primitives.

✅ Use design tokens.

✅ Keep layouts responsive.

✅ Prioritize accessibility.

✅ Keep animations subtle.

✅ Compose instead of duplicate.

✅ Design mobile-first.

✅ Maintain visual consistency across every feature.

---

# UI Architecture Summary

```
Design Tokens
      │
      ▼
Reusable UI Components
      │
      ▼
Feature Components
      │
      ▼
Feature Pages
      │
      ▼
App Shell
      │
      ▼
Application
```

Every visual element in GENKŌ should ultimately derive from the Design System. This ensures a cohesive, maintainable, and scalable interface that can evolve without introducing inconsistencies.

---

# Security Architecture

Security is a foundational aspect of GENKŌ's architecture.

Security should not be considered a feature added later. Every module, API, component, and user interaction should be designed with security in mind.

The application follows the principle of **defense in depth**, where multiple independent layers work together to reduce risk.

```
Browser
    │
Authentication
    │
Authorization
    │
API Validation
    │
Business Rules
    │
Database Validation
```

If one layer fails, another layer should still protect the system.

---

# Security Principles

GENKŌ follows these principles:

- Least Privilege
- Zero Trust
- Secure by Default
- Explicit Permissions
- Input Validation
- Output Sanitization
- Principle of Separation

Every new feature should follow these principles.

---

# Authentication

Authentication answers one question:

> Who is the current user?

Authentication is handled globally during application startup.

```
Application

↓

Restore Session

↓

Validate Token

↓

Load User

↓

Application Ready
```

Once authenticated, user information becomes available throughout the application.

---

# Authorization

Authentication identifies the user.

Authorization determines what the user is allowed to do.

Examples

```
Student

↓

Can Study

Can Review

Can Chat

Cannot Access Admin
```

```
Creator

↓

Can Create Lessons

Can Edit Lessons

Can Publish Lessons
```

```
Administrator

↓

Can Manage Users

Can Manage Reports

Can Manage Platform
```

Permissions should always be checked on the backend.

Frontend authorization improves UX but should never be trusted as the only security layer.

---

# Session Management

The authenticated session contains:

```
User

Access Token

Refresh Token

Roles

Permissions

Preferences
```

The application should restore the session automatically whenever possible.

Expired sessions should redirect users to authentication.

---

# Protected Routes

Some pages require authentication.

```
User

↓

Request Route

↓

Authenticated?

├── Yes
│      │
│      ▼
│   Continue
│
└── No
       │
       ▼
 Login Page
```

Routes should define their authentication requirements explicitly.

---

# Input Validation

Every user input must be validated.

Examples

- Forms
- Search
- Lesson Creation
- Comments
- AI Prompts

Validation should happen in multiple layers.

```
User

↓

Frontend Validation

↓

Backend Validation

↓

Database Constraints
```

Never trust client input.

---

# API Security

All communication should happen through secure APIs.

Responsibilities include:

- Authentication
- Authorization
- Rate limiting
- Request validation
- Response validation

The frontend should never expose secrets.

---

# Sensitive Data

Examples of sensitive information:

- Tokens
- Passwords
- Payment Information
- Private Messages

Sensitive data should never be:

- Logged
- Stored unnecessarily
- Embedded in source code
- Exposed through URLs

---

# Error Security

Error messages should help users without revealing implementation details.

Good

```
Unable to load lesson.

Please try again.
```

Bad

```
Database connection failed.

Mongo authentication exception...

Stack trace...
```

Internal errors belong in logs.

---

# Performance Architecture

Performance is considered part of the user experience.

Every feature should be designed for responsiveness.

Goals:

- Fast startup
- Fast navigation
- Minimal re-rendering
- Efficient network usage

---

# Performance Strategy

```
Lazy Loading

↓

Caching

↓

Code Splitting

↓

Memoization

↓

Virtualization
```

Each optimization should solve a measurable problem.

Avoid premature optimization.

---

# Code Splitting

Large applications should load code on demand.

Example

```
Dashboard

↓

Load Dashboard Bundle

Learning

↓

Load Learning Bundle

Creator

↓

Load Creator Bundle
```

Users should download only what they need.

---

# Lazy Loading

Heavy modules should be loaded only when required.

Examples

- Creator Studio
- Analytics
- AI Chat
- Settings

Avoid loading every module during startup.

---

# Asset Optimization

Guidelines

- Compress images
- Lazy load media
- Minify assets
- Remove unused code
- Optimize fonts

Large assets directly affect user experience.

---

# Rendering Performance

Reduce unnecessary renders by:

- Keeping components focused
- Splitting state
- Memoizing expensive calculations
- Avoiding unnecessary prop changes

Measure performance before optimizing.

---

# Accessibility

Accessibility is a requirement for every feature.

Support:

- Keyboard navigation
- Screen readers
- Focus indicators
- Color contrast
- Semantic HTML

Every interactive component should be accessible without a mouse.

---

# Internationalization

GENKŌ is designed for multilingual support.

Potential languages include:

- English
- Japanese
- Hindi
- Portuguese
- Spanish

Text should never be hardcoded inside reusable components.

---

# Logging

Logging helps developers understand system behavior.

Log categories include:

```
Application

↓

Authentication

↓

API

↓

Errors

↓

Performance
```

Avoid logging sensitive information.

---

# Monitoring

Future monitoring may include:

- Crash Reporting
- Performance Metrics
- User Analytics
- Error Tracking
- API Health

Monitoring should support operational insights without exposing personal information.

---

# Testing Strategy

Testing improves confidence in the codebase.

GENKŌ follows a testing pyramid.

```
            E2E
             ▲
      Integration
             ▲
         Unit Tests
```

Most tests should be unit tests.

---

# Unit Testing

Test:

- Utilities
- Services
- Hooks
- Components

Unit tests should be fast and isolated.

---

# Integration Testing

Integration tests verify communication between modules.

Examples

- Feature + API
- Component + Hook
- Hook + Service

---

# End-to-End Testing

End-to-end tests simulate real user workflows.

Examples

- Login
- Complete Lesson
- Review Vocabulary
- Publish Lesson

These tests verify the complete application flow.

---

# Continuous Integration

Every change should pass automated checks.

Typical pipeline

```
Push

↓

Lint

↓

Type Check

↓

Unit Tests

↓

Build

↓

Deploy Preview
```

Broken builds should never be merged.

---

# Deployment Architecture

Future deployment pipeline

```
Developer

↓

Git

↓

GitHub

↓

CI/CD

↓

Build

↓

Production
```

The deployment process should be automated whenever possible.

---

# Environment Configuration

Different environments may include:

```
Development

Testing

Staging

Production
```

Environment-specific values should be managed through configuration files rather than hardcoded values.

---

# Backup & Recovery

Critical application data should support:

- Regular backups
- Recovery procedures
- Disaster planning

The frontend should gracefully handle temporary backend failures.

---

# Future Evolution

The current architecture is designed to support future expansion without major restructuring.

Potential additions include:

- Mobile Applications
- Desktop Client
- Offline Synchronization
- Plugin System
- Marketplace
- Organization Accounts
- AI Agents
- Public API
- Enterprise Features

The architecture should evolve incrementally while preserving existing design principles.

---

# Architecture Summary

```
Browser
    │
    ▼
Application
    │
    ▼
Routing
    │
    ▼
App Shell
    │
    ▼
Features
    │
    ▼
Services
    │
    ▼
Backend
    │
    ▼
Database
```

Every layer has a single responsibility.

By maintaining clear boundaries, consistent documentation, and predictable development practices, GENKŌ can continue to grow without sacrificing maintainability or developer experience.

---

## Conclusion

Architecture is not a one-time activity.

It is a continuous process of designing, documenting, reviewing, and improving the system.

Every new feature should reinforce the principles described in this handbook.

If an implementation requires violating these principles, the architecture should be reviewed before the implementation proceeds.

This document serves as the authoritative reference for the frontend architecture of GENKŌ and should evolve alongside the project.