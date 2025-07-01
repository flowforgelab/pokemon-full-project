# User Creation Scripts

These scripts help diagnose and fix issues with user creation in the Pokemon TCG Deck Builder database.

## The Problem

The deck creation is failing because the user record doesn't exist in our database even though the user is authenticated with Clerk. This happens when:
- A user signs in with Clerk for the first time
- The webhook to create the database user fails
- There's a mismatch between Clerk user ID and database records

## Available Scripts

### 1. Quick Fix (Recommended First)
```bash
npm run script:quick-fix
```
This script will:
- Check if user exists with Clerk ID `user_2zBVzMNfGI9ntqrZBG2pKjKu1V1`
- Create the user if missing
- Update the Clerk ID if the email already exists with a different ID

### 2. Debug User Creation
```bash
npm run script:debug-user
```
This comprehensive script will:
- Test database connection
- Check for users by Clerk ID and email
- Show all users with similar emails
- Attempt to create the user
- Display recent deck creation attempts

### 3. Ensure User Exists
```bash
npm run script:ensure-user
```
Basic script that:
- Checks if user exists
- Creates user with full profile information
- Handles unique constraint errors

### 4. Test Deck Creation
```bash
npm run script:test-deck
```
This script will:
- Ensure user exists (creates if needed)
- List available formats
- Test deck creation through the deck builder manager
- Fall back to direct database creation if needed
- Show all user's decks

## Usage Instructions

1. First, run the quick fix script:
   ```bash
   npm run script:quick-fix
   ```

2. If that doesn't work, run the debug script to get more information:
   ```bash
   npm run script:debug-user
   ```

3. After fixing the user issue, test deck creation:
   ```bash
   npm run script:test-deck
   ```

## Manual Database Check

You can also check the database directly:
```bash
npm run prisma:studio
```

Then look for:
- Users table: Check if user with email `greg.lester@gmail.com` exists
- Check the `clerkUserId` field matches `user_2zBVzMNfGI9ntqrZBG2pKjKu1V1`

## Expected User Data

- **Clerk ID**: `user_2zBVzMNfGI9ntqrZBG2pKjKu1V1`
- **Email**: `greg.lester@gmail.com`
- **Username**: `greg.lester`
- **Display Name**: Greg Lester
- **Subscription**: FREE tier

## Troubleshooting

If scripts fail with database connection errors:
1. Ensure `.env.local` exists with correct `DATABASE_URL`
2. Check database is running and accessible
3. Run `npm run prisma:generate` to ensure Prisma client is up to date

If user creation still fails:
1. Check for existing users with the same email
2. Check for existing users with the same username
3. Look for Clerk webhook configuration issues