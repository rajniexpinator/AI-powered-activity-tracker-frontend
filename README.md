# AI Powered Internal Activity Tracking & Operational Assistant System

Web-based internal activity tracking platform for manufacturing: AI chat logging, barcode scanning, quality reports, and Microsoft 365 email integration.

## Tech Stack

| Layer        | Technologies                          |
|-------------|----------------------------------------|
| Frontend    | React.js, Vite, PWA, Camera Barcode     |
| Backend     | Node.js, Express.js, REST API, RBAC    |
| Database    | MongoDB, MongoDB Atlas                 |
| AI          | OpenAI API                             |
| Email       | Microsoft 365 Outlook, Graph API      |
| Storage     | AWS S3                                 |
| Deployment  | AWS Server, MongoDB Atlas              |

## Project Structure

```
├── frontend/          # React + Vite + PWA
├── backend/            # Node.js + Express REST API
├── docs/               # Schema & API planning (optional)
└── README.md
```

## Phase 1: System Architecture & Setup ✓

- Frontend project (React, Vite, PWA)
- Backend server (Express, REST, security)
- Database schema planning (MongoDB/Mongoose)
- API architecture & base routes

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and settings
npm run dev
```

### Environment

- **Frontend:** See `frontend/.env.example`
- **Backend:** See `backend/.env.example`

## Brand Colors

- Primary: `#3f4b9d`
- Accent: `#E22637`

## License

Proprietary — Client: Mr. John Magre. Date: February 23, 2026.
