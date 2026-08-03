# GENKŌ Development Roadmap

> This roadmap defines the long-term vision, implementation phases, and release milestones for the GENKŌ platform.

---

# Project Vision

Build the most modern AI-powered Japanese learning platform with:

- Structured learning
- Personalized learning paths
- AI tutoring
- Gamification
- Community features
- Creator tools
- Offline-first support
- Cross-platform experience

---

# Current Status

## Version

v2.0 (Architecture Phase)

### Completed

- Project initialization
- TanStack Router integration
- React Query integration
- Session management
- Motion system
- PWA setup
- Design tokens
- UI primitives
- Initial App Shell architecture
- Documentation structure

---

# Phase 1 — Core Foundation

## Goal

Establish a scalable frontend architecture.

### Tasks

- [x] Design Tokens
- [x] UI Primitives
- [x] Routing
- [x] React Query
- [ ] App Shell integration
- [ ] Sidebar
- [ ] Navigation
- [ ] Responsive layout
- [ ] Breadcrumbs
- [ ] Command Palette

### Success Criteria

- Every page uses a unified layout.
- Navigation is responsive.
- No duplicated layout code.

---

# Phase 2 — Dashboard

## Goal

Deliver a personalized home experience.

### Features

- Continue Learning
- Daily Goal
- XP Progress
- Streak
- Achievements
- Recent Activity
- Recommended Lessons
- Quick Actions

### Success Criteria

- Dashboard loads in under 1 second (cached).
- Learners can resume study in one click.

---

# Phase 3 — Learning Engine

## Goal

Build the core learning experience.

### Modules

- Lesson Viewer
- Vocabulary
- Grammar
- Kanji
- Listening
- Reading
- Writing
- Speaking
- Review Queue
- Checkpoints

### Success Criteria

- Complete lesson flow from start to finish.
- Progress automatically saved.
- Review system fully integrated.

---

# Phase 4 — AI Tutor

## Goal

Provide intelligent learning assistance.

### Features

- AI Chat
- Grammar Explanation
- Kanji Lookup
- Vocabulary Assistant
- Conversation Practice
- Pronunciation Feedback
- Personalized Recommendations

### Success Criteria

- AI available from any learning screen.
- Context-aware assistance.

---

# Phase 5 — Social Learning

## Goal

Increase engagement through community.

### Features

- Friends
- Messaging
- Study Groups
- Leaderboards
- Challenges
- Shared Progress

### Success Criteria

- Users can interact without leaving the learning experience.

---

# Phase 6 — Creator Studio

## Goal

Allow educators to create and publish content.

### Features

- Lesson Builder
- Quiz Builder
- Asset Manager
- Course Publishing
- Content Versioning

### Success Criteria

- New lessons can be created without code.

---

# Phase 7 — Production

## Goal

Prepare for public release.

### Tasks

- Performance Optimization
- Accessibility
- Testing
- Analytics
- Monitoring
- Security Review
- CI/CD
- Documentation Review

### Success Criteria

- Production-ready release candidate.

---

# Future Ideas

- Mobile Apps
- Desktop App
- Browser Extension
- AI Voice Tutor
- Live Classes
- Marketplace
- Plugin System
- Public API

---

# Development Workflow

Every feature follows this lifecycle:

1. Architecture
2. Planning
3. Implementation
4. Testing
5. Documentation
6. Code Review
7. Release

---

# Definition of Done

A feature is considered complete only when:

- Code is implemented.
- TypeScript passes.
- Production build passes.
- Responsive behavior verified.
- Documentation updated.
- Commit completed.