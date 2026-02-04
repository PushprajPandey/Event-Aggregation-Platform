# Sydney Events Aggregator - Frontend

A modern, responsive React + TypeScript frontend for the Sydney Events Aggregator Platform.

## 🚀 Features

- **Event Discovery**: Browse live events in Sydney with beautiful card-based UI
- **Real-Time Updates**: Dynamic data fetching from backend API
- **Offline Support**: Cached data with graceful degradation
- **Email Capture**: Modal-based email collection before ticket redirect
- **Admin Dashboard**: System overview and event statistics
- **Responsive Design**: Mobile-first design that works on all devices
- **System Resilience**: Loading states, error handling, and offline mode

## 🧱 Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Router v6** - Navigation
- **Axios** - HTTP client
- **Local Storage** - Client-side caching

## 📁 Project Structure

```
frontend/
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── DataSourceBadge.tsx
│   │   ├── EmailModal.tsx
│   │   ├── ErrorMessage.tsx
│   │   ├── EventCard.tsx
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   ├── Layout.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── OfflineBanner.tsx
│   ├── hooks/
│   │   ├── useEvents.ts
│   │   └── useOnlineStatus.ts
│   ├── pages/
│   │   ├── AdminDashboard.tsx
│   │   └── EventsPage.tsx
│   ├── services/
│   │   └── api.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── index.css
│   ├── index.tsx
│   └── react-app-env.d.ts
├── .env
├── .env.example
├── .gitignore
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── tsconfig.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm
- Backend API running (default: http://localhost:3000)

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set your API URL:
```env
REACT_APP_API_URL=http://localhost:3000
```

4. Start the development server:
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## 🏗️ Build for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` folder.

## 📱 Pages & Routes

### `/` - Events Landing Page
- Hero section with CTAs
- Events grid with filtering
- Real-time data fetching
- Event cards with details

### `/admin` - Admin Dashboard
- System status overview
- Event statistics
- Category breakdown
- Health monitoring

## 🎨 Components

### Core Components

- **Layout**: Main layout wrapper with header and footer
- **Header**: Sticky navigation bar with logo and links
- **Footer**: Site footer with links and social media
- **EventCard**: Individual event display with ticket CTA
- **EmailModal**: Email capture before ticket redirect

### UI State Components

- **LoadingSpinner**: Animated loading indicator
- **ErrorMessage**: Error display with retry option
- **OfflineBanner**: Offline mode notification
- **DataSourceBadge**: Visual indicator of data source

## 🔧 API Integration

The frontend connects to the backend via the API service (`src/services/api.ts`):

### Endpoints Used

```typescript
GET /events?city=Sydney
```

Response structure:
```json
{
  "events": [
    {
      "_id": "string",
      "title": "string",
      "description": "string",
      "dateTime": "ISO string",
      "venueName": "string",
      "venueAddress": "string",
      "imageUrl": "string | null",
      "categoryTags": ["Music", "Workshop"],
      "sourceWebsite": "string",
      "ticketUrl": "string"
    }
  ]
}
```

### Caching Strategy

- Events are cached in localStorage
- Cache duration: 5 minutes
- Automatic fallback on API failure
- Clear cache on data refresh

## 🎯 Key Features Implementation

### 1. System Resilience

- **Loading States**: Spinner during data fetch
- **Error Handling**: User-friendly error messages with retry
- **Offline Mode**: Cached data when offline
- **Data Source Indicators**: Live/Cache/Offline badges

### 2. Email Capture Flow

1. User clicks "Get Tickets"
2. Modal opens requesting email
3. Email submitted to backend
4. User redirected to ticket URL
5. Skip option available

### 3. Responsive Design

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px)
- Grid layouts: 1 column (mobile) → 3 columns (desktop)
- Touch-friendly interactions

## 🎨 Customization

### Tailwind Theme

Customize colors in `tailwind.config.js`:

```javascript
colors: {
  primary: { /* Blue palette */ },
  accent: { /* Purple palette */ }
}
```

### API URL

Update in `.env`:
```env
REACT_APP_API_URL=https://your-api-url.com
```

## 📊 Performance

- Code splitting with React lazy loading
- Optimized images with error handling
- Efficient state management with hooks
- Minimal re-renders

## 🧪 Testing

```bash
npm test
```

## 📦 Deployment

### Static Hosting (Netlify, Vercel)

1. Build the project:
```bash
npm run build
```

2. Deploy the `build/` folder

3. Set environment variable:
```
REACT_APP_API_URL=https://your-production-api.com
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
RUN npm install -g serve
CMD ["serve", "-s", "build", "-l", "3000"]
```

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API URL | `http://localhost:3000` |

## 🐛 Troubleshooting

### API Connection Issues

1. Check backend is running
2. Verify API URL in `.env`
3. Check browser console for CORS errors
4. Ensure backend allows frontend origin

### Build Errors

1. Clear node_modules: `rm -rf node_modules && npm install`
2. Clear cache: `npm cache clean --force`
3. Check Node.js version: `node --version` (requires 16+)

## 📝 License

MIT

## 👥 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 🆘 Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ for the Sydney community
