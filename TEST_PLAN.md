# Pokemon TCG Deck Builder - Test Plan

## Overview

This document outlines the comprehensive testing strategy for the Pokemon TCG Deck Builder application. The testing approach follows a pyramid structure with unit tests at the base, integration tests in the middle, and E2E tests at the top.

## Test Environment Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (test database)
- Redis (for queue testing)
- Environment variables configured

### Test Database Strategy
- Use separate test database with `.env.test`
- Reset database before each test suite
- Seed with minimal test data

## 1. Unit Tests (Foundation)

### Testing Framework
- **Jest** for test runner
- **React Testing Library** for component testing
- **MSW (Mock Service Worker)** for API mocking
- **jest-dom** for DOM assertions

### Setup Tasks
1. Install testing dependencies:
   ```bash
   npm install -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event
   npm install -D @types/jest jest-environment-jsdom
   npm install -D msw @mswjs/data
   ```

2. Configure Jest (`jest.config.js`):
   ```javascript
   const nextJest = require('next/jest')
   
   const createJestConfig = nextJest({
     dir: './',
   })
   
   const customJestConfig = {
     setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
     testEnvironment: 'jest-environment-jsdom',
     moduleNameMapper: {
       '^@/(.*)$': '<rootDir>/src/$1',
     },
   }
   
   module.exports = createJestConfig(customJestConfig)
   ```

### Areas to Test

#### Components (`/src/components`)
- [ ] **UI Components**
  - Button (all variants, states, sizes)
  - Input, Select, Textarea (validation states)
  - Toast notifications
  - Modal behavior
  - Skeleton loading states

- [ ] **Card Components**
  - PokemonCard rendering
  - CardDetailModal functionality
  - Card grid/list views
  - Card interactions (click, hover)

- [ ] **Deck Components**
  - DeckCard display
  - DeckBuilder drag-and-drop
  - DeckSearch functionality
  - Deck statistics display

- [ ] **Auth Components**
  - PermissionGate behavior
  - FeatureGate upgrade prompts
  - Sign-in/sign-up forms

#### Utilities (`/src/lib`)
- [ ] **Validation Functions**
  - All Zod schemas
  - sanitizeInput()
  - sanitizeHtml()
  - URL validation

- [ ] **Permission Utilities**
  - hasPermission() logic
  - getSubscriptionFeatures()
  - Role hierarchy checks

- [ ] **Deck Utilities**
  - DeckValidator rules
  - Deck statistics calculations
  - Card counting logic

- [ ] **Price Calculations**
  - Price formatting
  - Currency conversion
  - Total value calculations

#### Hooks (`/src/hooks`)
- [ ] useMediaQuery breakpoints
- [ ] usePermission access checks
- [ ] useFeature availability
- [ ] Custom form hooks

### Example Unit Tests

```typescript
// Button.test.tsx
describe('Button', () => {
  it('renders with correct variant styles', () => {
    render(<Button variant="primary">Click me</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-primary')
  })
  
  it('handles click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

// permissions.test.ts
describe('hasPermission', () => {
  it('allows admin users all permissions', () => {
    const adminUser = { features: ['admin'], subscriptionTier: 'FREE' }
    expect(hasPermission(adminUser, 'deck', 'delete')).toBe(true)
  })
  
  it('restricts free users to own resources', () => {
    const freeUser = { subscriptionTier: 'FREE' }
    expect(hasPermission(freeUser, 'deck', 'create', { own: true })).toBe(true)
    expect(hasPermission(freeUser, 'deck', 'create', { own: false })).toBe(false)
  })
})
```

## 2. Integration Tests (API Layer)

### Testing Framework
- **Jest** with tRPC testing utilities
- **Prisma** test client
- **SuperTest** for HTTP testing

### Setup Tasks
1. Create test database setup
2. Configure tRPC test client
3. Create test data factories

### Areas to Test

#### tRPC Routers
- [ ] **User Router**
  - Profile creation/updates
  - Preference management
  - Privacy settings

- [ ] **Deck Router**
  - CRUD operations
  - Permission checks
  - Deck limits
  - Public/private access

- [ ] **Collection Router**
  - Add/remove cards
  - Bulk operations
  - Collection limits
  - Value calculations

- [ ] **Analysis Router**
  - Deck analysis
  - Premium feature access
  - Caching behavior

- [ ] **Admin Router**
  - Admin-only access
  - User management
  - Audit logging

#### Database Operations
- [ ] Transaction integrity
- [ ] Cascade deletes
- [ ] Unique constraints
- [ ] Index performance

#### External API Integration
- [ ] Pokemon TCG API mocking
- [ ] Rate limiting behavior
- [ ] Error handling
- [ ] Retry logic

### Example Integration Tests

```typescript
// deck.router.test.ts
describe('Deck Router', () => {
  it('enforces deck limits for free users', async () => {
    const user = await createTestUser({ subscriptionTier: 'FREE' })
    const caller = createCaller({ user })
    
    // Create 3 decks (limit for free tier)
    for (let i = 0; i < 3; i++) {
      await caller.deck.create({ name: `Deck ${i}` })
    }
    
    // 4th deck should fail
    await expect(
      caller.deck.create({ name: 'Deck 4' })
    ).rejects.toThrow('deck limit')
  })
  
  it('validates ownership before updates', async () => {
    const owner = await createTestUser()
    const otherUser = await createTestUser()
    const deck = await createTestDeck(owner)
    
    const caller = createCaller({ user: otherUser })
    await expect(
      caller.deck.update({ id: deck.id, name: 'Stolen' })
    ).rejects.toThrow('permission')
  })
})
```

## 3. End-to-End Tests (User Flows)

### Testing Framework
- **Playwright** for browser automation
- **@playwright/test** for test runner

### Setup Tasks
1. Install Playwright:
   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

2. Configure Playwright (`playwright.config.ts`)

### Critical User Flows

- [ ] **Authentication Flow**
  - Sign up → Onboarding → Dashboard
  - Sign in → Redirect to previous page
  - Sign out → Clear session

- [ ] **Deck Building Flow**
  - Browse cards → Add to deck
  - Validate deck rules
  - Save deck
  - Share publicly

- [ ] **Collection Management**
  - Add cards to collection
  - Set card conditions
  - Track collection value
  - Export collection

- [ ] **Trading Flow**
  - Create trade offer
  - Counter offer
  - Accept/reject trade
  - Update collections

- [ ] **Subscription Upgrade**
  - Hit feature limit
  - View pricing
  - Select plan
  - Access premium features

### Example E2E Tests

```typescript
// deck-building.spec.ts
test('user can build and save a deck', async ({ page }) => {
  // Sign in
  await page.goto('/signin')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'Test123!')
  await page.click('button[type="submit"]')
  
  // Navigate to deck builder
  await page.goto('/decks/new')
  
  // Search and add cards
  await page.fill('[placeholder="Search cards..."]', 'Pikachu')
  await page.waitForSelector('.card-grid')
  await page.click('.card-item:first-child')
  await page.click('button:has-text("Add to Deck")')
  
  // Save deck
  await page.fill('[name="deckName"]', 'My Pikachu Deck')
  await page.click('button:has-text("Save Deck")')
  
  // Verify success
  await expect(page).toHaveURL(/\/decks\/[a-z0-9-]+/)
  await expect(page.locator('h1')).toContainText('My Pikachu Deck')
})
```

## 4. Performance Tests

### Tools
- **Lighthouse CI** for web vitals
- **k6** for load testing
- **React DevTools Profiler**

### Metrics to Track
- [ ] Core Web Vitals (LCP, FID, CLS)
- [ ] Time to Interactive (TTI)
- [ ] API response times
- [ ] Database query performance
- [ ] Memory usage

### Performance Benchmarks
- Page load: < 3s
- API responses: < 200ms
- Search results: < 500ms
- Image loading: Progressive

## 5. Security Tests

### Areas to Test
- [ ] **Authentication**
  - Session management
  - Token expiration
  - Password requirements

- [ ] **Authorization**
  - Permission boundaries
  - Role escalation attempts
  - Resource access control

- [ ] **Input Validation**
  - XSS prevention
  - SQL injection
  - File upload validation

- [ ] **API Security**
  - Rate limiting
  - CORS configuration
  - CSP headers

## 6. Accessibility Tests

### Tools
- **axe-core** for automated testing
- **NVDA/JAWS** for screen reader testing
- **Keyboard navigation** testing

### Requirements
- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation for all features
- [ ] Screen reader announcements
- [ ] Color contrast ratios
- [ ] Focus indicators

## Test Execution Strategy

### Continuous Integration
1. **Pre-commit**: Linting, type checking
2. **Pull Request**: Unit tests, integration tests
3. **Pre-deploy**: Full test suite
4. **Post-deploy**: E2E smoke tests

### Test Commands
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --testMatch='**/*.integration.test.ts'",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:a11y": "jest --testMatch='**/*.a11y.test.ts'"
  }
}
```

## Coverage Goals

### Phase 1 (MVP)
- Unit tests: 60% coverage
- Integration tests: Critical paths only
- E2E tests: 5 main user flows

### Phase 2 (Post-MVP)
- Unit tests: 80% coverage
- Integration tests: All API endpoints
- E2E tests: 15+ user flows
- Performance monitoring
- Security audit

## Test Data Management

### Strategies
1. **Factory Functions** for consistent test data
2. **Seed Scripts** for complex scenarios
3. **Database Snapshots** for E2E tests
4. **Mock Data** for external APIs

### Example Factory
```typescript
// factories/user.factory.ts
export const createTestUser = (overrides = {}) => {
  return prisma.user.create({
    data: {
      email: faker.internet.email(),
      username: faker.internet.userName(),
      subscriptionTier: 'FREE',
      ...overrides,
    },
  })
}
```

## Monitoring & Reporting

### Tools
- **GitHub Actions** for CI/CD
- **Codecov** for coverage tracking
- **Sentry** for error monitoring
- **Datadog** for performance monitoring

### Reports
- Daily test execution summary
- Weekly coverage trends
- Monthly performance metrics
- Quarterly security audits

## Next Steps

1. **Immediate** (Week 1)
   - Set up Jest and testing infrastructure
   - Write unit tests for critical utilities
   - Create test data factories

2. **Short-term** (Week 2-3)
   - Add integration tests for tRPC routers
   - Set up Playwright for E2E tests
   - Implement CI pipeline

3. **Medium-term** (Month 2)
   - Achieve 60% unit test coverage
   - Add performance monitoring
   - Conduct security audit

4. **Long-term** (Month 3+)
   - Achieve 80% coverage goal
   - Implement visual regression testing
   - Add mutation testing