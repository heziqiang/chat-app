# Gradual Chat

A channel-based messaging app with real-time sync, built with React, GraphQL, and Socket.io.

## Quick Start

1. Install dependencies:

```bash
npm install && npm run install:all
```

2. Start MongoDB:

```bash
docker compose up -d
```

3. Seed data and start dev servers:

```bash
npm run seed && npm run dev
```

App runs at `http://localhost:5173`.

## Tech Stack

- Frontend: React + TypeScript + Vite + Apollo Client
- Backend: Node.js + TypeScript + Express + Apollo Server + Socket.io
- Database: MongoDB + Mongoose

## Project Structure

- `client/` — Frontend application
- `server/` — Backend service
- `docs/` — Technical design documents

## Docs

- [Technical Design](./docs/technical-design.md)
