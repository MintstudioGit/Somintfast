# Database Setup Guide

Complete guide for setting up your LeadFinder database in development and production.

## Development (SQLite)

SQLite is perfect for local development - zero configuration needed!

### Setup

```bash
# Create database and run migrations
npx prisma migrate dev --name init

# Open Prisma Studio to view data
npx prisma studio
```

Your database file is located at `prisma/dev.db`.

### Environment Variables

```env
DATABASE_URL="file:./prisma/dev.db"
```

## Production (PostgreSQL)

For production, we recommend PostgreSQL for better performance and scalability.

### Option 1: Local PostgreSQL

```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE leadfinder;
CREATE USER leadfinder WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE leadfinder TO leadfinder;
\q
```

### Option 2: Docker PostgreSQL

```bash
# Start PostgreSQL container
docker run --name leadfinder-db \
  -e POSTGRES_USER=leadfinder \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=leadfinder \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### Option 3: Managed Database (Recommended for Production)

Popular options:
- **Vercel Postgres**: https://vercel.com/storage/postgres
- **Supabase**: https://supabase.com
- **Railway**: https://railway.app
- **Neon**: https://neon.tech

### Environment Variables (PostgreSQL)

```env
DATABASE_URL="postgresql://leadfinder:your_secure_password@localhost:5432/leadfinder"
```

## Running Migrations

### Development

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Reset database (⚠️ deletes all data)
npx prisma migrate reset
```

### Production

```bash
# Deploy migrations (no prompts)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

## Database Schema

### Tables

1. **Lead** - Original lead management
2. **ScrapedLead** - Data from website scraping
3. **EmailVerification** - Email verification results
4. **QualityMetrics** - Historical quality tracking

### Key Relationships

- ScrapedLead → EmailVerification (1:1)
- All tables indexed for performance

## Seeding Data

Create sample data for testing:

```bash
# Run seed script
npx prisma db seed
```

## Backup & Restore

### SQLite

```bash
# Backup
cp prisma/dev.db prisma/dev.db.backup

# Restore
cp prisma/dev.db.backup prisma/dev.db
```

### PostgreSQL

```bash
# Backup
pg_dump leadfinder > backup.sql

# Restore
psql leadfinder < backup.sql
```

## Performance Optimization

### Indexes

All critical fields are indexed:
- `ScrapedLead.tier`
- `ScrapedLead.scrapedAt`
- `EmailVerification.status`
- `EmailVerification.isValid`
- `QualityMetrics.tier`
- `QualityMetrics.periodStart`

### Connection Pooling

For production, use connection pooling:

```typescript
// src/lib/prisma.ts already configured for this
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});
```

## Monitoring

### Check Database Size

```sql
-- PostgreSQL
SELECT pg_size_pretty(pg_database_size('leadfinder'));

-- SQLite
.dbinfo
```

### Monitor Active Connections

```sql
-- PostgreSQL
SELECT count(*) FROM pg_stat_activity;
```

## Troubleshooting

### Migration Conflicts

```bash
# Mark migrations as applied without running
npx prisma migrate resolve --applied <migration_name>

# Mark as rolled back
npx prisma migrate resolve --rolled-back <migration_name>
```

### Connection Pool Exhausted

Increase pool size in `DATABASE_URL`:

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10"
```

### Schema Drift Detection

```bash
# Check if schema matches database
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma
```

## Best Practices

1. **Always backup before migrations**
2. **Use transactions for data integrity**
3. **Monitor database size and performance**
4. **Regularly update Prisma Client**: `npm update @prisma/client`
5. **Keep migrations in version control**

## Migration Strategy

### Development
- Use `prisma migrate dev` for iterative changes
- Migrations create and apply automatically

### Production
- Review migrations before deploying
- Use `prisma migrate deploy` in CI/CD
- Never run `migrate dev` in production

## Security

1. **Never commit .env files**
2. **Use strong database passwords**
3. **Restrict database access by IP**
4. **Enable SSL for remote connections**
5. **Regular security updates**

For more help, see Prisma documentation: https://www.prisma.io/docs
