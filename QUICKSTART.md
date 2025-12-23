# Quick Start Guide

Get your LeadFinder application up and running in 5 minutes!

## Prerequisites

- Node.js 20+ installed
- npm or yarn package manager
- (Optional) Docker for containerized deployment

## Step 1: Clone and Install

```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate
```

## Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your configuration
# At minimum, set DATABASE_URL
```

## Step 3: Setup Database

```bash
# Run database migrations
npx prisma migrate dev

# Seed with sample data (optional)
npx prisma db seed
```

## Step 4: Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000 to see your application!

## Step 5: Test the API

### Scrape a German website:

```bash
curl -X POST http://localhost:3000/api/leadfinder/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "websiteUrl": "https://example-german-company.de",
    "tier": "TEAM",
    "verifyEmail": true
  }'
```

### Get quality metrics:

```bash
curl http://localhost:3000/api/leadfinder/quality/metrics?days=30
```

## Docker Deployment

```bash
# Using docker-compose
docker-compose up -d

# Or build manually
docker build -t leadfinder .
docker run -p 3000:3000 leadfinder
```

## Next Steps

- Read [DATABASE_SETUP.md](./DATABASE_SETUP.md) for production database setup
- Check [SETUP_COMPLETE.md](./SETUP_COMPLETE.md) for all features
- Configure Reoon API key for email verification

## Troubleshooting

### Database connection errors
- Check DATABASE_URL in .env
- Ensure Prisma Client is generated: `npx prisma generate`

### Build errors
- Clear .next folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### Email verification not working
- Add REOON_API_KEY to .env
- Only TEAM tier and above support email verification

## Support

For issues, check the GitHub repository or open an issue.
