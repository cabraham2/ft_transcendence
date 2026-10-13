*This project has been created as part of the 42 curriculum by lnassar, cabraham, ghoyaux, egaudich, ymoysan.*

# ft_transcendence

## Description
`ft_transcendence` is a secure, containerized, multiplayer Pong platform.
It includes account management, friends, real-time matchmaking, live remote matches, tournament brackets, persistent match history, player statistics, achievements, and configurable game settings.

The project is designed to satisfy the modular `en.subject.pdf` requirements with a realistic and defendable scope focused on quality and evaluation reliability.

## Instructions
### Prerequisites
- Docker + Docker Compose
- Latest stable Google Chrome
- Optional for local non-docker checks: Node.js 22+, npm

### Quick start (single command)
```bash
cp .env.example .env   # then fill in every value (see below)
docker compose up --build
```

The `.env` file is ignored by Git (as required by the subject). `.env.example` lists every
variable with empty values and a hint for each: fill them in before starting
(e.g. `openssl rand -hex 32` for `JWT_SECRET`). The backend refuses to start without `JWT_SECRET`.

### Access
- Application (HTTPS): `https://localhost`
- API docs (Swagger): `https://localhost/api/docs`

### Local development checks (without Docker)
```bash
npm run check
```

### End-to-end checks
A Playwright suite (Chromium, Firefox, WebKit) validating the main subject requirements
lives in `e2e/` (see `e2e/README.md`).

### Backend only
```bash
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix backend run lint
npm --prefix backend run test -- --runInBand
npm --prefix backend run test:e2e -- --runInBand
```

### Frontend only
```bash
npm --prefix frontend run lint
npm --prefix frontend run build
```

## Resources
- NestJS: https://docs.nestjs.com/
- Prisma: https://www.prisma.io/docs/
- React: https://react.dev/
- Vite: https://vite.dev/
- Socket.IO: https://socket.io/docs/v4/
- PostgreSQL: https://www.postgresql.org/docs/
- Nginx: https://nginx.org/en/docs/

AI usage note:
- AI tooling was used for implementation acceleration (architecture drafting, boilerplate generation, refactoring support, and validation assistance).
- All produced code and decisions were reviewed, tested, and manually adjusted to keep full project understanding and ownership.

## Team Information
- `ghoyaux`
  - Assigned role(s): Project Manager, Developer
  - Responsibilities: project management - planning, task distribution, deadlines and team coordination
- `cabraham`
  - Assigned role(s): Developer
  - Responsibilities: authentication - JWT sessions, login/registration security
- `lnassar`
  - Assigned role(s): Developer
  - Responsibilities: public API (API key, rate limiting, documented CRUD endpoints)
- `egaudich`
  - Assigned role(s): Developer
  - Responsibilities: backend (NestJS services, database, real-time game logic)
- `ymoysan`
  - Assigned role(s): Developer
  - Responsibilities: frontend (React application, pages, UI)

The Product Owner and Technical Lead roles are shared by the team and were not assigned to a single person.

## Project Management
- Work organization:
  - backlog split by modules and dependencies
  - implementation order: core auth/user -> real-time game -> tournaments/stats -> frontend integration -> deployment
- Tools:
  - Git history with focused commits
  - issue-style task breakdown for each module
- Communication channels:
  - daily syncs + async review notes

## Technical Stack
- Frontend:
  - React + TypeScript + Vite
  - i18next for multilingual UI
  - Socket.IO client for real-time gameplay
- Backend:
  - NestJS + TypeScript
  - JWT authentication
  - Swagger API docs
  - Socket.IO gateway for matchmaking and live game state
- Database:
  - PostgreSQL
  - Prisma ORM
- Deployment:
  - Docker Compose
  - Nginx reverse proxy with HTTPS (self-signed dev cert auto-generated in container)

## Database Schema
Main entities:
- `User`: identity, auth fields, profile, online state, rating progression
- `UserGameSettings`: per-user customizable Pong settings
- `Friendship`: friend requests and accepted friendships
- `Match`: persistent Pong match records, scores, winner, settings
- `Tournament`: tournament metadata, lifecycle, champion
- `TournamentParticipant`: tournament registrations and seeds
- `TournamentMatch`: bracket nodes, round/position, winner propagation
- `Achievement`: progression milestones unlocked by players
- `PublicHighlight`: public API example CRUD resource

Relations are normalized and explicitly linked through foreign keys.

## Features List
- Authentication and user management:
  - secure register/login (hashed password + JWT)
  - profile update
  - avatar upload + default avatar fallback
  - online/offline status exposure
- Friends:
  - send request, accept request, remove friend
  - online state visible from friends list
- Real-time Pong:
  - live matchmaking queue
  - remote 1v1 matches with server-authoritative game loop
  - disconnection grace period + reconnection flow
  - customizable settings (theme, map, paddle size, ball speed, power-ups, winning score)
- Tournament system:
  - create/register/start tournament
  - generated rounds/brackets
  - next-match retrieval for participants
  - integration with live game completion and winner propagation
- Stats and history:
  - persistent match history
  - wins/losses/elo/xp/level updates
  - achievements
  - leaderboard endpoint + dashboard panel
- Public API module:
  - API-key secured public endpoints
  - rate limiting guard
  - documented endpoints via Swagger
  - CRUD resource with GET/POST/PUT/DELETE coverage
- Advanced search module:
  - user search with text query, filters, sorting, and pagination
  - integrated in frontend friends page for discoverability
- UX and compliance:
  - multilingual interface: French, English, Spanish
  - privacy policy and terms pages integrated in app navigation
  - responsive layout for desktop/mobile

## Modules
### Validated scope (19 points target)
- Web (Major) - framework frontend + backend: 2 pts
- Web (Major) - real-time features: 2 pts
- Web (Major) - public API with API key + rate limiting + docs + CRUD endpoints: 2 pts
- User Management (Major) - standard user management/authentication: 2 pts
- Gaming and UX (Major) - complete web-based game: 2 pts
- Gaming and UX (Major) - remote players in real time: 2 pts
- Web (Minor) - ORM usage: 1 pt
- Gaming and UX (Minor) - tournament system: 1 pt
- User Management (Minor) - game stats and match history: 1 pt
- Accessibility & i18n (Minor) - 3 languages: 1 pt
- Accessibility (Minor) - additional browser support target: 1 pt
- Gaming and UX (Minor) - game customization options: 1 pt
- Web (Minor) - advanced search with filters/sorting/pagination: 1 pt

Total: **19 points**

### Excluded by scope choice
- AI category modules
- OAuth / 2FA
- Spectator mode
- Additional second game
- DevOps heavy modules (ELK, Prometheus/Grafana)
- Blockchain modules

## Browser Compatibility
Tested end to end with Playwright (`e2e/`): Chromium (Google Chrome engine), Firefox and WebKit (Safari engine).
Registration, login, language switch, legal pages, profile/avatar and tournaments run without console errors in all three;
the real-time match flow (matchmaking, forfeit, stats) is covered in Chromium.
Known limitation: the development HTTPS certificate is self-signed, so browsers show a warning on first visit.

## Individual Contributions
- `ghoyaux` - project management: planning, task distribution, tracking and coordination of the team.
- `cabraham` - JWT authentication: token signing and verification, login/registration flow, protected routes and WebSocket authentication.
- `lnassar` - public API: API-key protected endpoints, rate limiting, Swagger documentation and the CRUD resource.
- `egaudich` - backend: NestJS modules and services, database access, matchmaking, game loop, tournaments and statistics.
- `ymoysan` - frontend: React application, pages, game rendering, internationalization and responsive layout.

## Known Limitations
- HTTPS uses a self-signed development certificate generated by the Nginx container.
- Login has no brute-force throttling (only the public API is rate limited).
- Game input is keyboard only (W/S or arrow keys).

## Compliance Notes
- Subject: strictly based on `en.subject.pdf` in this repository.
- Norm: `fr.norm.pdf` is the C Norm; this project is TypeScript/Nest/React, so C-only syntax constraints do not directly apply. Code quality conventions were still enforced (clear naming, modularity, maintainability, concise comments).
