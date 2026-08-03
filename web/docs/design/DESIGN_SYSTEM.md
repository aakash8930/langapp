# GENKŌ Design System

> **Version:** 1.0.0  
> **Status:** Active  
> **Owner:** GENKŌ Frontend Team  
> **Last Updated:** July 2026

---

# Introduction

The GENKŌ Design System defines the visual language, interaction patterns, design principles, reusable components, and accessibility standards used throughout the platform.

It serves as the single source of truth for designers and developers, ensuring that every screen, component, and interaction follows a consistent set of rules.

A design system is more than a collection of UI components—it is the foundation that enables scalable development, predictable user experiences, and efficient collaboration.

Every new feature, page, or interface should be built using this design system before introducing custom solutions.

---

# Purpose

The Design System exists to achieve the following goals:

- Maintain visual consistency across the platform.
- Improve development speed through reusable components.
- Reduce duplicated UI implementations.
- Establish a shared language between design and engineering.
- Improve accessibility and usability.
- Support future expansion without redesigning the entire application.
- Ensure every interface reflects the GENKŌ brand.

---

# Scope

This document defines the standards for:

- Visual Design
- Component Design
- Layout System
- Responsive Design
- Color System
- Typography
- Icons
- Motion
- Accessibility
- Design Tokens
- User Interaction
- Dark Theme
- Future UI Evolution

It does **not** define application architecture or business logic. Those topics are covered in `architecture/ARCHITECTURE.md`.

---

# What is the GENKŌ Design System?

The GENKŌ Design System is a collection of reusable rules rather than reusable screens.

Instead of designing each page independently, every interface is assembled from standardized building blocks.

```
Design Tokens

↓

Foundations

↓

UI Components

↓

Feature Components

↓

Pages

↓

Application
```

Each layer builds upon the previous one.

Changes made to lower layers automatically propagate throughout the system.

---

# Design Philosophy

GENKŌ follows a design philosophy centered around learning rather than decoration.

The interface should help users focus on acquiring knowledge instead of overwhelming them with unnecessary visual complexity.

Every visual decision should answer one question:

> Does this help users learn more effectively?

If the answer is no, the design should be reconsidered.

---

# Core Principles

Every interface should follow these principles.

## Simplicity

Interfaces should present only the information necessary for the current task.

Avoid unnecessary decorations, excessive animations, and visual clutter.

Users should never feel overwhelmed.

---

## Consistency

Buttons should behave the same everywhere.

Cards should look the same everywhere.

Forms should follow identical interaction patterns.

Consistency reduces cognitive load and improves usability.

---

## Predictability

Users should never wonder what happens after clicking a button.

Interactive elements should behave consistently throughout the application.

Unexpected behavior damages trust.

---

## Accessibility

Every interface should be usable by everyone.

Accessibility is not an optional enhancement.

It is a core design requirement.

All components must support:

- Keyboard navigation
- Screen readers
- Focus indicators
- Semantic HTML
- Appropriate contrast ratios

---

## Performance

Beautiful interfaces should also be fast.

Design decisions should consider:

- Loading speed
- Rendering performance
- Mobile devices
- Slow networks
- Battery usage

Performance is part of the user experience.

---

## Scalability

The design system should support future growth.

New modules should fit naturally within the existing visual language without requiring redesigns.

---

# Brand Identity

GENKŌ represents modern language learning powered by technology.

The visual identity should communicate:

- Intelligence
- Simplicity
- Trust
- Focus
- Curiosity
- Progress
- Professionalism

The interface should feel welcoming for beginners while remaining powerful enough for advanced learners.

---

# Design Goals

The design system aims to create interfaces that are:

- Minimal
- Modern
- Clean
- Friendly
- Fast
- Responsive
- Accessible
- Consistent
- Educational
- Professional

These goals influence every design decision.

---

# Design Constraints

To maintain consistency, certain constraints are intentionally imposed.

Examples include:

- Limited color palette
- Fixed spacing scale
- Standardized typography
- Reusable component library
- Consistent iconography
- Unified interaction patterns

Constraints improve maintainability and reduce design debt.

---

# User Experience Principles

Every user interaction should strive to be:

## Clear

The interface should communicate its purpose immediately.

---

## Efficient

Users should accomplish tasks with minimal effort.

---

## Forgiving

Mistakes should be easy to recover from.

Confirmation dialogs, undo actions, and helpful error messages should be used where appropriate.

---

## Informative

The system should always communicate its current state.

Examples include:

- Loading indicators
- Progress bars
- Empty states
- Success messages
- Error messages

---

## Delightful

Small interactions, subtle animations, and thoughtful feedback should create a pleasant experience without distracting users from learning.

---

# Visual Language

The GENKŌ visual language emphasizes clarity and hierarchy.

Its characteristics include:

- Generous whitespace
- Clear typography
- Consistent spacing
- Soft shadows
- Rounded corners
- Simple iconography
- Meaningful color usage
- Minimal visual noise

Visual hierarchy should guide users naturally through each interface.

---

# Relationship with the Architecture

The Design System complements the frontend architecture.

```
Architecture

↓

Design Tokens

↓

Reusable Components

↓

Feature Components

↓

Pages

↓

User Interface
```

Architecture defines how the application is built.

The Design System defines how the application looks and behaves visually.

Together, they provide the foundation for building scalable, maintainable, and consistent interfaces.

---

# Design System Principles Summary

The GENKŌ Design System is guided by the following principles:

- Design for learning.
- Keep interfaces simple.
- Prioritize accessibility.
- Maintain consistency.
- Reuse components whenever possible.
- Prefer composition over duplication.
- Build scalable systems rather than isolated screens.
- Let design support functionality rather than compete with it.

These principles should be considered whenever new components or features are introduced.

# Foundations

The Foundations layer defines the visual building blocks used throughout the entire application.

Every component, page, and layout is constructed using these foundational rules.

```
Foundations

↓

Design Tokens

↓

Reusable Components

↓

Feature Components

↓

Pages
```

Changing a foundational rule should automatically improve the entire interface rather than requiring individual updates.

---

# Design Tokens

Design Tokens are the smallest reusable design decisions.

Instead of hardcoding colors, spacing, or typography throughout the application, these values are centralized into reusable tokens.

Examples include:

- Colors
- Font Sizes
- Font Weights
- Line Heights
- Spacing
- Border Radius
- Shadows
- Animation Duration
- Z-Index
- Breakpoints

This creates a consistent and maintainable visual language.

---

# Token Hierarchy

```
Primitive Tokens

↓

Semantic Tokens

↓

Component Tokens

↓

UI Components
```

Primitive tokens define raw values.

Semantic tokens define meaning.

Component tokens define how a component uses those values.

---

# Color Philosophy

Color should communicate meaning before aesthetics.

Every color must have a purpose.

Examples include:

- Brand identity
- User actions
- System feedback
- Status indicators
- Accessibility
- Visual hierarchy

Color should never be used purely for decoration.

---

# Color Categories

GENKŌ organizes colors into semantic categories.

```
Brand

Neutral

Success

Warning

Danger

Info

Background

Surface

Border

Text
```

Every interface should reference semantic colors instead of raw hexadecimal values.

---

# Brand Colors

Brand colors establish recognition and identity.

They are primarily used for:

- Primary buttons
- Navigation highlights
- Links
- Active states
- Progress indicators
- Interactive elements

Brand colors should be used consistently across the application.

---

# Neutral Colors

Neutral colors create structure without distracting users.

Typical usage includes:

- Backgrounds
- Cards
- Borders
- Dividers
- Disabled states
- Secondary text

Neutral colors should occupy most of the interface.

---

# Semantic Colors

Semantic colors communicate application state.

## Success

Examples:

- Lesson completed
- Goal achieved
- Correct answer
- Saved successfully

---

## Warning

Examples:

- Incomplete lesson
- Unsaved changes
- Approaching limits

---

## Danger

Examples:

- Delete actions
- Errors
- Failed requests
- Invalid forms

---

## Information

Examples:

- Tips
- Notifications
- Announcements
- Helpful guidance

---

# Background System

The interface should use layered backgrounds.

```
Application Background

↓

Section Background

↓

Card Surface

↓

Component Surface

↓

Interactive Elements
```

This creates clear visual hierarchy.

---

# Surface Levels

Surfaces distinguish content through subtle elevation.

Recommended hierarchy:

```
Surface 0

Application Background

↓

Surface 1

Cards

↓

Surface 2

Dialogs

↓

Surface 3

Popovers

↓

Surface 4

Critical Overlays
```

Elevation should remain subtle.

---

# Typography Philosophy

Typography is one of the most important learning tools.

Users spend most of their time reading.

Typography should prioritize:

- Readability
- Hierarchy
- Comfort
- Consistency

Decorative fonts should be avoided.

---

# Typography Scale

The application should define a consistent type scale.

```
Display

Heading 1

Heading 2

Heading 3

Heading 4

Body Large

Body

Body Small

Caption

Label

Code
```

Each level has a clearly defined purpose.

---

# Font Weight

Recommended weights:

```
Regular

Medium

SemiBold

Bold
```

Avoid excessive font weight variations.

---

# Line Height

Comfortable reading requires appropriate spacing.

Guidelines:

- Large headings → tighter spacing
- Paragraphs → comfortable spacing
- Small labels → compact spacing

Proper line height significantly improves readability.

---

# Letter Spacing

Letter spacing should remain subtle.

Use:

- Slight tightening for large headings.
- Default spacing for body text.
- Slight expansion for uppercase labels.

Avoid excessive tracking.

---

# Text Hierarchy

```
Display

↓

Page Title

↓

Section Title

↓

Card Title

↓

Body

↓

Caption
```

Users should immediately understand the importance of each piece of information.

---

# Spacing Philosophy

Spacing creates rhythm.

Consistent spacing improves readability more than additional visual decoration.

Avoid arbitrary spacing values.

---

# Spacing Scale

The design system uses a predefined spacing scale.

Examples:

```
XXS

XS

SM

MD

LG

XL

2XL

3XL
```

Every margin, padding, and gap should use this scale.

---

# Layout Spacing

Spacing exists at multiple levels.

```
Page

↓

Section

↓

Grid

↓

Card

↓

Component

↓

Element
```

Each level should follow the same spacing rhythm.

---

# Border Radius

Rounded corners communicate friendliness while maintaining professionalism.

Corner sizes should remain consistent.

Suggested categories:

```
None

Small

Medium

Large

Extra Large

Full
```

Different components should not invent their own radius values.

---

# Borders

Borders define separation rather than decoration.

Typical usage:

- Inputs
- Cards
- Tables
- Dividers
- Panels

Borders should remain subtle.

---

# Shadows

Shadows indicate elevation.

Not decoration.

```
No Shadow

↓

Small

↓

Medium

↓

Large

↓

Extra Large
```

Higher surfaces receive stronger shadows.

---

# Elevation System

Elevation communicates interaction.

```
Background

↓

Cards

↓

Dropdown

↓

Dialog

↓

Modal

↓

Toast

↓

Tooltip
```

Elevation should feel natural and predictable.

---

# Grid System

GENKŌ follows a responsive grid layout.

```
Container

↓

Rows

↓

Columns

↓

Components
```

Grids create alignment and consistency.

---

# Containers

Content should never stretch across the full viewport unnecessarily.

Containers maintain readable line lengths and balanced layouts.

Different page types may use different maximum widths.

---

# Responsive Philosophy

The interface should adapt naturally to different screen sizes.

Users should receive the same experience regardless of device.

Design should prioritize:

- Mobile
- Tablet
- Desktop
- Wide Displays

---

# Breakpoints

The design system defines standardized responsive breakpoints.

```
Mobile

↓

Tablet

↓

Laptop

↓

Desktop

↓

Large Desktop
```

Components should respond consistently at each breakpoint.

---

# Responsive Behavior

Components should adapt by:

- Reflowing layouts
- Collapsing navigation
- Adjusting spacing
- Scaling typography
- Resizing grids

Responsiveness should preserve usability rather than merely shrinking content.

---

# CSS Variables

The design system exposes tokens through CSS Variables.

```
Design Tokens

↓

CSS Variables

↓

Components

↓

Pages
```

Components should reference variables instead of hardcoded values.

---

# Theme Architecture

```
Primitive Tokens

↓

Semantic Tokens

↓

Theme Variables

↓

Components

↓

Application
```

This allows themes to change globally without modifying component implementations.

---

# Foundation Principles Summary

Every foundation in GENKŌ follows these principles:

- Consistency over customization.
- Semantic meaning over raw values.
- Reusability over duplication.
- Accessibility over aesthetics.
- Simplicity over complexity.
- Scalability over convenience.

These foundations provide the visual rules upon which the entire interface is built.

# Component System

The Component System defines the reusable building blocks used to construct every interface in GENKŌ.

Rather than designing pages individually, every screen is assembled from standardized components that share consistent behavior, appearance, and accessibility.

```
Design Tokens

↓

Primitive Components

↓

Composite Components

↓

Feature Components

↓

Pages

↓

Application
```

This layered approach ensures consistency and maintainability throughout the platform.

---

# Component Philosophy

Components should solve one problem well.

Every component should be:

- Reusable
- Predictable
- Accessible
- Maintainable
- Composable
- Testable

Components should not contain unrelated business logic.

---

# Component Hierarchy

```
Primitive Components

↓

Layout Components

↓

Composite Components

↓

Feature Components

↓

Pages
```

Each level builds upon the previous one.

---

# Primitive Components

Primitive components are the smallest reusable UI elements.

Examples include:

- Button
- Input
- Text
- Icon
- Badge
- Avatar
- Checkbox
- Radio
- Switch
- Spinner
- Divider

Primitive components should have no knowledge of application features.

---

# Composite Components

Composite components combine multiple primitive components into reusable UI patterns.

Examples include:

- Search Bar
- User Card
- Notification Item
- Lesson Card
- Progress Card
- Quiz Option
- Leaderboard Row

Composite components remain generic and reusable.

---

# Feature Components

Feature components belong to a specific module.

Examples

Learning

- Vocabulary Card
- Kanji Grid
- Grammar Timeline

AI

- Conversation Panel
- AI Suggestion Card
- Correction Bubble

Dashboard

- XP Widget
- Daily Goal
- Continue Learning

Feature components should never be reused outside their feature unless intentionally generalized.

---

# Layout Components

Layout components organize content without defining business behavior.

Examples

- App Shell
- Header
- Sidebar
- Footer
- Container
- Grid
- Stack
- Section
- Page Wrapper

Their primary responsibility is positioning and spacing.

---

# Component Responsibilities

Every component should have a clearly defined responsibility.

A component should avoid:

- Fetching unrelated data
- Managing unrelated state
- Rendering unrelated features

Single Responsibility improves maintainability.

---

# Component Naming

Component names should clearly describe their purpose.

Good

```
PrimaryButton

LessonCard

ProgressRing

ProfileAvatar

NotificationItem

AchievementBadge
```

Avoid vague names.

Bad

```
Component

Box

Item

Widget

Container2
```

---

# File Organization

Each reusable component should live inside its own directory.

Example

```
Button/

Button.tsx

Button.types.ts

Button.styles.ts

Button.test.tsx

index.ts
```

Large components may also include:

```
hooks/

utils/

constants/
```

This keeps implementations organized.

---

# Component Composition

Composition is preferred over inheritance.

Good

```
<Card>

<Card.Header />

<Card.Body />

<Card.Footer />

</Card>
```

Avoid deeply nested configuration props when composition provides better flexibility.

---

# Props Design

Props should remain simple and predictable.

Good examples:

- variant
- size
- disabled
- loading
- icon
- children

Avoid large configuration objects unless necessary.

---

# Component Variants

Variants define visual styles while preserving consistent behavior.

Example variants:

Button

- Primary
- Secondary
- Ghost
- Outline
- Destructive

Badge

- Success
- Warning
- Danger
- Info

Card

- Elevated
- Flat
- Interactive

Variants should remain limited and meaningful.

---

# Component Sizes

Components should expose standardized sizes.

Example

```
Extra Small

Small

Medium

Large

Extra Large
```

Every component should use the same sizing language.

---

# Button System

Buttons represent user actions.

Hierarchy

```
Primary

↓

Secondary

↓

Outline

↓

Ghost

↓

Text
```

Only one primary action should appear within a major interface section.

---

# Button States

Buttons should support:

- Default
- Hover
- Focus
- Active
- Loading
- Disabled

Every state should remain visually consistent.

---

# Input System

Inputs should share identical interaction behavior.

Supported controls include:

- Text Input
- Password
- Email
- Search
- Text Area
- Number
- Date
- Select
- Checkbox
- Radio
- Switch

Every control should follow the same spacing and validation rules.

---

# Input Validation

Validation should clearly communicate:

- Success
- Warning
- Error
- Required
- Disabled

Messages should be concise and actionable.

---

# Card System

Cards group related content.

Common card structure:

```
Card

↓

Header

↓

Content

↓

Actions
```

Cards should avoid excessive nesting.

---

# Navigation Components

Navigation provides orientation throughout the application.

Examples:

- Sidebar
- Top Navigation
- Tabs
- Breadcrumbs
- Pagination
- Bottom Navigation

Navigation should remain consistent across all modules.

---

# Feedback Components

Feedback communicates application state.

Examples:

- Alert
- Toast
- Snackbar
- Progress
- Skeleton
- Empty State
- Error State
- Success State

Feedback should be immediate and informative.

---

# Modal Components

Overlays temporarily interrupt workflow.

Examples:

- Dialog
- Drawer
- Modal
- Popover
- Tooltip
- Command Palette

Overlays should minimize disruption while maintaining focus.

---

# Tables

Tables present structured information.

Support:

- Sorting
- Filtering
- Pagination
- Selection
- Responsive behavior

Avoid horizontal scrolling whenever possible.

---

# Lists

Lists display collections of related information.

Examples

- Lesson List
- Notifications
- Messages
- Courses
- Vocabulary

Lists should support loading, empty, and error states.

---

# Empty States

Every feature should define an empty state.

An effective empty state includes:

- Explanation
- Illustration (optional)
- Primary Action
- Helpful Guidance

Avoid blank screens.

---

# Loading States

Loading should communicate progress.

Examples:

- Skeletons
- Spinners
- Progress Bars
- Placeholder Cards

Prefer skeletons for content-heavy interfaces.

---

# Error States

Error states should:

- Explain what happened
- Offer recovery
- Avoid technical jargon

Good

```
Unable to load lessons.

Please try again.
```

Bad

```
HTTP 500

Unhandled Exception
```

---

# Accessibility Requirements

Every component must support:

- Keyboard navigation
- Screen readers
- Focus management
- ARIA attributes where appropriate
- High contrast compatibility

Accessibility is part of every component's definition.

---

# Responsive Components

Components should adapt gracefully.

Possible adaptations:

- Resize
- Reflow
- Collapse
- Stack vertically
- Hide secondary content

Responsiveness should preserve usability.

---

# Component Documentation

Every reusable component should document:

- Purpose
- Props
- Variants
- Sizes
- Accessibility
- Examples
- Known limitations

Documentation should evolve alongside the component.

---

# Component Lifecycle

```
Design

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

↓

Maintenance

↓

Deprecation
```

Every reusable component follows this lifecycle.

---

# Anti-Patterns

Avoid:

- Duplicate components
- Hardcoded colors
- Inline spacing
- Business logic inside UI
- Inconsistent naming
- Deep prop drilling
- Massive components
- Copy-pasted implementations

These practices increase maintenance costs.

---

# Component Principles Summary

The GENKŌ Component System is guided by these principles:

- Reuse before creating.
- Compose before duplicating.
- Keep components focused.
- Separate presentation from business logic.
- Prioritize accessibility.
- Prefer consistency over customization.
- Document every reusable component.
- Build components for long-term scalability.

These principles ensure that the UI remains consistent, maintainable, and scalable as GENKŌ continues to grow.

# Interaction System

The Interaction System defines how users communicate with the GENKŌ platform.

While the Component System defines **what users see**, the Interaction System defines **how users experience those components**.

Every interaction should feel natural, predictable, responsive, and accessible.

The goal is to minimize cognitive effort while maximizing learning efficiency.

---

# Interaction Philosophy

GENKŌ interactions follow five principles:

- Predictable
- Responsive
- Accessible
- Forgiving
- Delightful

Users should never need to guess how the interface behaves.

Every interaction should reinforce confidence.

---

# Interaction Hierarchy

```
User

↓

Input

↓

Component

↓

Feedback

↓

Updated State

↓

Next Action
```

Every interaction follows the same lifecycle.

---

# Navigation Principles

Navigation should answer three questions immediately.

```
Where am I?

↓

Where can I go?

↓

How do I get back?
```

Users should never feel lost inside the application.

---

# Global Navigation

Global navigation provides access to the application's major areas.

Examples:

- Dashboard
- Learn
- Review
- AI Tutor
- Community
- Creator Studio
- Settings
- Profile

Global navigation remains consistent throughout the application.

---

# Local Navigation

Each feature may expose its own navigation.

Examples:

Learning

```
Courses

↓

Lessons

↓

Exercises

↓

Review
```

Creator Studio

```
Dashboard

↓

Lessons

↓

Quizzes

↓

Publish
```

Local navigation should never replace global navigation.

---

# Breadcrumb Navigation

Breadcrumbs communicate location within complex hierarchies.

Example

```
Dashboard

>

Japanese

>

N5

>

Lesson 4
```

Breadcrumbs improve orientation and simplify navigation.

---

# Tab Navigation

Tabs organize related content without changing context.

Examples

```
Overview

Lessons

Vocabulary

Grammar

Resources
```

Tabs should remain lightweight.

Large workflows should use dedicated pages instead.

---

# Search Experience

Search should be available wherever users manage large amounts of content.

Examples

- Lessons
- Vocabulary
- Community
- Creator Studio
- Settings

Search should support:

- Instant results
- Keyboard shortcuts
- Suggestions
- Recent searches
- Empty results guidance

---

# Command Palette

GENKŌ should provide a universal command palette.

Examples

```
Search Lessons

Open Dashboard

Review Vocabulary

Open AI Tutor

Settings

Profile
```

The command palette improves efficiency for power users.

---

# Forms

Forms should minimize user effort.

Every form should provide:

- Clear labels
- Logical grouping
- Validation
- Helpful hints
- Recovery options

Long forms should be divided into sections.

---

# Form Layout

Recommended flow

```
Section

↓

Input

↓

Description

↓

Validation

↓

Next Input
```

Avoid overcrowding forms.

---

# Validation Strategy

Validation should occur progressively.

```
Typing

↓

Field Validation

↓

Form Validation

↓

Server Validation

↓

Confirmation
```

Users should receive feedback as early as possible.

---

# Error Prevention

The best error is one that never happens.

Prevent errors by using:

- Input masks
- Suggestions
- Defaults
- Auto-complete
- Confirmation dialogs
- Smart validation

Design should reduce mistakes instead of merely reporting them.

---

# Confirmation

Confirmation dialogs should only appear for destructive or irreversible actions.

Examples

- Delete Lesson
- Remove Account
- Publish Course
- Reset Progress

Avoid unnecessary confirmations.

---

# Notifications

Notifications communicate system events.

Categories

```
Information

Success

Warning

Error
```

Notifications should be concise and actionable.

---

# Toast Notifications

Toast notifications are used for temporary feedback.

Examples

```
Lesson Saved

Progress Updated

Settings Changed

Course Published
```

Toasts should disappear automatically after a reasonable duration.

---

# Modal Behavior

Modals interrupt workflow to request focused attention.

Rules

- One modal at a time
- Easy to dismiss
- Keyboard accessible
- Trap keyboard focus
- Restore focus when closed

Avoid nested modals.

---

# Drawer Behavior

Drawers are suitable for secondary workflows.

Examples

- Filters
- Notifications
- User Profile
- AI Assistant

Drawers should not replace primary navigation.

---

# Tooltips

Tooltips explain unfamiliar controls.

They should:

- Be concise
- Appear on hover/focus
- Never block important content

Tooltips supplement—not replace—good interface design.

---

# Loading Experience

Users should always know that work is in progress.

Preferred hierarchy:

```
Skeleton

↓

Progress Bar

↓

Spinner
```

Skeleton screens provide the best perceived performance.

---

# Progress Indicators

Long-running operations should communicate progress.

Examples

- AI generation
- Lesson uploads
- Course publishing
- File imports

Users should understand:

- Current progress
- Remaining work
- Completion state

---

# Empty States

Empty states should encourage action.

Every empty state should include:

- Explanation
- Illustration (optional)
- Primary action
- Helpful guidance

Example

```
No lessons yet.

Create your first lesson.
```

---

# Success States

Successful actions deserve clear confirmation.

Examples

```
Lesson Published

Course Saved

Goal Completed

Profile Updated
```

Success feedback should reinforce user confidence.

---

# Motion Philosophy

Motion should support understanding.

Animation should communicate:

- Cause
- Effect
- Continuity
- Hierarchy

Motion should never distract from learning.

---

# Animation Principles

Animations should be:

- Fast
- Purposeful
- Consistent
- Subtle

Avoid excessive motion.

---

# Transition Types

Common transitions include:

- Fade
- Slide
- Scale
- Collapse
- Expand

Transitions should remain consistent throughout the application.

---

# Micro-Interactions

Micro-interactions improve usability.

Examples

- Button hover
- Toggle animation
- Progress update
- Card selection
- Correct answer feedback

Small interactions create a polished experience.

---

# Gesture Support

Touch devices should support natural gestures.

Examples

- Tap
- Long Press
- Swipe
- Pull to Refresh
- Drag
- Pinch (where applicable)

Desktop and touch interactions should remain functionally equivalent.

---

# Keyboard Navigation

Every feature should be usable without a mouse.

Support:

- Tab Navigation
- Shift + Tab
- Arrow Keys
- Escape
- Enter
- Space

Keyboard users should have complete functionality.

---

# Focus Management

Visible focus indicators are mandatory.

Focus should:

- Follow logical order
- Never disappear
- Return appropriately after dialogs
- Remain clearly visible

Good focus management significantly improves accessibility.

---

# Accessibility Feedback

Assistive technologies should receive meaningful updates.

Examples

- Validation messages
- Progress updates
- Notifications
- Dynamic content changes

Users relying on screen readers should receive the same information as visual users.

---

# Learning Experience

The interface should support uninterrupted learning.

Examples

- Resume where users stopped
- Preserve scroll position
- Save progress automatically
- Minimize interruptions

Learning should remain the primary focus.

---

# AI Interaction Guidelines

AI should behave like a helpful learning companion.

Responses should be:

- Fast
- Context-aware
- Educational
- Encouraging
- Transparent

AI should clearly distinguish between generated suggestions and user-created content.

---

# Gamification Feedback

Achievements should feel rewarding without becoming distracting.

Examples

- XP gained
- Daily streak
- Badge unlocked
- Level up

Celebrate progress while maintaining focus on learning.

---

# Mobile Interaction

Mobile interfaces should prioritize:

- Large touch targets
- Comfortable spacing
- Thumb-friendly navigation
- Reduced typing
- Smooth scrolling

Design for one-handed usage whenever possible.

---

# Interaction Anti-Patterns

Avoid:

- Unexpected navigation
- Hidden actions
- Excessive confirmations
- Blocking dialogs
- Infinite loading indicators
- Auto-playing media
- Inconsistent gestures
- Confusing animations

These patterns reduce trust and usability.

---

# Interaction Principles Summary

The GENKŌ Interaction System follows these principles:

- Keep interactions predictable.
- Provide immediate feedback.
- Minimize user effort.
- Prioritize accessibility.
- Support keyboard and touch equally.
- Use animation to explain, not decorate.
- Help users recover from mistakes.
- Keep learning uninterrupted.

These principles ensure that every interaction contributes to a consistent, intuitive, and enjoyable learning experience.

# Theming & Accessibility

The GENKŌ Design System is built to support multiple visual themes while maintaining a consistent user experience.

Themes should change the visual presentation without affecting component behavior, layout, or functionality.

Users should be able to switch themes seamlessly while preserving familiarity and usability.

---

# Theme Philosophy

Themes are visual representations of the same design system.

Changing a theme should never require rewriting components.

```
Design Tokens

↓

Theme Tokens

↓

CSS Variables

↓

Components

↓

Application
```

Every component consumes semantic tokens instead of hardcoded values.

---

# Theme Architecture

The application follows a layered theming architecture.

```
Primitive Colors

↓

Semantic Colors

↓

Theme Variables

↓

Components

↓

Pages

↓

Application
```

This architecture allows the appearance of the application to evolve without changing component implementations.

---

# Supported Themes

GENKŌ currently supports:

- Light Theme
- Dark Theme

Future themes may include:

- High Contrast
- AMOLED Dark
- Seasonal Themes
- Custom Organization Branding

The architecture should remain flexible enough to accommodate additional themes.

---

# Light Theme

The Light Theme is optimized for daytime usage.

Characteristics include:

- Bright backgrounds
- Soft neutral surfaces
- High readability
- Clear visual hierarchy
- Minimal visual noise

Light mode serves as the default experience.

---

# Dark Theme

Dark Theme reduces eye strain in low-light environments.

Characteristics include:

- Dark backgrounds
- Elevated surfaces
- Reduced glare
- Comfortable contrast
- Preserved hierarchy

Dark mode should not simply invert colors; it should be intentionally designed.

---

# Theme Switching

Users should be able to switch themes manually or follow the operating system preference.

Priority order:

```
User Preference

↓

System Preference

↓

Default Theme
```

Theme changes should occur instantly without requiring a page reload.

---

# Theme Persistence

The selected theme should persist between sessions.

Typical flow:

```
User Selects Theme

↓

Save Preference

↓

Restore on Startup

↓

Apply Theme

↓

Render Application
```

The application should remember user preferences across devices whenever account synchronization is available.

---

# Semantic Theme Tokens

Components should reference semantic values rather than specific colors.

Examples include:

- Primary
- Secondary
- Background
- Surface
- Border
- Success
- Warning
- Danger
- Text Primary
- Text Secondary

Semantic naming improves maintainability and enables effortless theme switching.

---

# Iconography

Icons should support comprehension rather than decoration.

Icons should:

- Reinforce actions
- Improve recognition
- Reduce reading effort
- Maintain consistency

Icons should never replace clear labels when clarity would suffer.

---

# Icon Style

The icon system should remain visually consistent.

Guidelines:

- Outline-first style
- Consistent stroke width
- Uniform corner radius
- Balanced visual weight
- Pixel-aligned rendering

Avoid mixing multiple icon styles throughout the application.

---

# Icon Usage

Icons should be used for:

- Navigation
- Actions
- Status indicators
- Notifications
- File types
- Categories

Avoid excessive decorative icons.

---

# Illustrations

Illustrations should support learning and communication.

Appropriate use cases include:

- Empty states
- Onboarding
- Error pages
- Success screens
- Marketing pages

Illustrations should never interfere with educational content.

---

# Imagery

Images should prioritize educational value.

Examples:

- Learning diagrams
- Language examples
- Course thumbnails
- Community content

Images should remain optimized and responsive.

---

# Accessibility Philosophy

Accessibility is a core requirement—not an optional enhancement.

Every interface should be usable regardless of:

- Ability
- Device
- Input method
- Environment

Accessibility benefits every user.

---

# Accessibility Standards

GENKŌ aims to follow the Web Content Accessibility Guidelines (WCAG).

Design decisions should prioritize:

- Perceivability
- Operability
- Understandability
- Robustness

Accessibility reviews should be part of the design and development process.

---

# Color Accessibility

Color should never be the sole method of conveying information.

Examples:

Good

- Color + Icon
- Color + Label
- Color + Pattern

Bad

- Color only

Interfaces should remain understandable for users with color vision deficiencies.

---

# Contrast

Text and interactive elements should maintain sufficient contrast against their backgrounds.

Contrast should support readability across:

- Light Theme
- Dark Theme
- Mobile Devices
- Outdoor Environments

Poor contrast reduces usability and accessibility.

---

# Typography Accessibility

Typography should prioritize readability.

Guidelines:

- Avoid excessively small text.
- Maintain comfortable line heights.
- Limit line length.
- Use clear font weights.
- Preserve spacing between paragraphs.

Readable typography improves learning outcomes.

---

# Focus Indicators

Interactive elements must display a visible focus state.

Focus indicators should:

- Be easy to identify.
- Remain visible in all themes.
- Clearly indicate keyboard position.

Never remove focus outlines without providing an accessible alternative.

---

# Keyboard Accessibility

All functionality should be available using only the keyboard.

Users should be able to:

- Navigate
- Select
- Submit
- Cancel
- Open dialogs
- Close dialogs

Keyboard navigation should follow a logical order.

---

# Screen Reader Support

Interfaces should expose meaningful information to assistive technologies.

Important content includes:

- Labels
- Validation messages
- Navigation landmarks
- Dialog announcements
- Dynamic updates

Visual-only communication should be avoided.

---

# Motion Accessibility

Animations should remain subtle and optional.

The application should respect system preferences for reduced motion.

When reduced motion is enabled:

- Simplify transitions.
- Disable unnecessary animations.
- Preserve usability without visual effects.

---

# Localization

GENKŌ is designed for multilingual education.

The interface should support localization from the beginning.

Examples include:

- Language switching
- Date formatting
- Number formatting
- Time formatting
- Currency formatting (where applicable)

Text should never be hardcoded within reusable components.

---

# Japanese Typography

As a Japanese learning platform, special consideration should be given to Japanese text.

Guidelines:

- Maintain comfortable line spacing.
- Avoid truncating Kanji unnecessarily.
- Support Furigana where appropriate.
- Display mixed Japanese and Latin text cleanly.
- Ensure fonts provide comprehensive Japanese glyph coverage.

The interface should treat Japanese as a first-class language rather than a translated afterthought.

---

# Responsive Accessibility

Accessibility should remain consistent across all devices.

Considerations include:

- Touch target sizes
- Orientation changes
- Zoom support
- Screen magnification
- Mobile screen readers

Responsive layouts should not reduce accessibility.

---

# Design System Governance

The Design System should evolve in a controlled manner.

New components should:

- Solve a reusable problem.
- Follow existing design principles.
- Be documented.
- Include accessibility considerations.
- Be reviewed before adoption.

Avoid introducing one-off design patterns that cannot be reused.

---

# Versioning

The Design System should be versioned alongside the application.

Each release should document:

- New components
- Updated tokens
- Deprecated patterns
- Accessibility improvements
- Breaking changes

Clear versioning simplifies long-term maintenance.

---

# Future Evolution

The Design System is intended to grow with GENKŌ.

Potential future enhancements include:

- Organization-specific themes
- Plugin UI extensions
- Advanced motion library
- Design token automation
- Cross-platform component library
- Native mobile design guidelines
- Wearable interface adaptations
- AI-assisted interface customization

Growth should remain consistent with the system's core principles.

---

# Design System Summary

```
Brand Identity

↓

Foundations

↓

Design Tokens

↓

Themes

↓

Primitive Components

↓

Composite Components

↓

Feature Components

↓

Pages

↓

Application
```

Every visual element in GENKŌ originates from this hierarchy.

By maintaining a shared design language, reusable components, semantic tokens, and accessibility-first principles, the Design System enables the platform to remain consistent, scalable, and user-focused as it continues to evolve.

---

# Conclusion

The GENKŌ Design System is more than a collection of colors and components—it is the visual foundation of the platform.

It provides a shared language for designers and developers, ensures consistency across every interface, and establishes standards that support long-term growth.

Every new screen, feature, and component should align with the principles defined in this document.

When new requirements emerge, the Design System should evolve thoughtfully, preserving consistency while adapting to the needs of learners, creators, and future contributors.

This document serves as the authoritative reference for the visual and interaction design of GENKŌ and should be maintained alongside the application's architecture and development standards.

---