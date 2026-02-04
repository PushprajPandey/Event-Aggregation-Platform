# Sydney Events Aggregator

A production-ready MERN stack application that automatically collects, manages, and displays event data for Sydney, Australia.

## Features

- Automated web scraping of event data from multiple sources
- Public event listing website with responsive design
- Administrative dashboard with Google OAuth authentication
- Email capture system for user engagement
- MongoDB data persistence with proper schemas
- Property-based testing with fast-check
- TypeScript for type safety
- Production-ready deployment configurations

## Tech Stack

**Backend:**

- Node.js with Express.js
- MongoDB with Mongoose ODM
- TypeScript for type safety
- Jest with fast-check for testing
- Passport.js for Google OAuth

**Frontend:**

- React.js with TypeScript
- React Router for navigation
- Tailwind CSS for styling
- Axios for API communication

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or Atlas)
- Google OAuth credentials

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   cd frontend && npm install
   ```

3. Copy environment variables:

   ```bash
   cp .env.example .env
   cp frontend/.env.production frontend/.env.local
   ```

4. Update `.env` with your configuration:
   - MongoDB connection string
   - Google OAuth credentials
   - Session secret

### Development

Start the backend development server:

```bash
npm run dev
```

Start the frontend development server:

```bash
cd frontend
npm start
```

Run tests:

```bash
npm test
```

Build for production:

```bash
npm run build:clean
cd frontend && npm run build
```


## Project Structure

```
src/
├── config/          # Configuration files
├── middleware/      # Express middleware
├── models/          # MongoDB schemas
├── routes/          # API routes
├── scraping/        # Web scraping engine
├── services/        # Business logic services
├── types/           # TypeScript type definitions
├── test/            # Test utilities and generators
├── app.ts           # Express app setup
└── index.ts         # Server entry point

frontend/
├── src/
│   ├── components/  # React components
│   ├── pages/       # Page components
│   ├── services/    # API services
│   ├── types/       # TypeScript types
│   └── utils/       # Utility functions
├── public/          # Static assets
└── build/           # Production build output
```

## API Endpoints

### Public Endpoints

- `GET /health` - Health check
- `GET /api/health` - API health check
- `GET /api/events` - Get event listings
- `POST /api/email-capture` - Capture user emails

### Admin Endpoints

- `GET /api/admin/events` - Admin event management
- `PUT /api/admin/events/:id/import` - Import events
- `GET /api/admin/dashboard-stats` - Dashboard statistics

### Authentication

- `GET /auth/google` - Google OAuth login
- `GET /auth/google/callback` - OAuth callback
- `POST /auth/logout` - Logout
- `GET /auth/user` - Get current user

## Testing

The project uses Jest with fast-check for property-based testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Frontend tests
cd frontend && npm test
```

## Environment Variables

See `.env.example` for all required environment variables.

### Production Environment

For production deployment, ensure these environment variables are set:

- `NODE_ENV=production`
- `MONGODB_URI` - MongoDB Atlas connection string
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `SESSION_SECRET` - Secure session secret (64+ characters)
- `FRONTEND_URL` - Deployed frontend URL
- `TRUST_PROXY=true` - For secure cookies behind proxy
- `SECURE_COOKIES=true` - Enable secure cookies

## Monitoring

The application includes comprehensive health monitoring:

- `/health` - Basic health check
- `/health/detailed` - Detailed system status
- `/health/ready` - Readiness probe for containers
- `/health/live` - Liveness probe for containers

## License

MIT
