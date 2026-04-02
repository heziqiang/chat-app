# Gradual Chat

A channel-based messaging app with real-time sync, built with React, GraphQL, and Socket.io.

## Tech Stack

- Frontend: React + TypeScript + Vite + Apollo Client
- Backend: Node.js + TypeScript + Express + Apollo Server + Socket.io
- Database: MongoDB + Mongoose

## Project Structure

- `client/` — React frontend
- `server/` — GraphQL API, seed script, backend tests
- `docs/` — external technical design

## Local Development

Prerequisite: MongoDB running at `mongodb://localhost:27017/gradual-chat`.

Install dependencies:

```bash
npm install
npm run install:all
```

Seed data:

```bash
npm run seed
```

Start backend and frontend in separate terminals:

```bash
cd server && npm run dev
```

```bash
cd client && npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Testing

Backend tests:

```bash
cd server && npm test
```

## Docker

Current [docker-compose.yml](/Users/heziqiang/code/gradual-chat-app/docker-compose.yml) only starts MongoDB:

```bash
docker compose up -d mongodb
```

It does not yet run the frontend and backend containers.

## Docs

- [Technical Design](./docs/technical-design.md)
