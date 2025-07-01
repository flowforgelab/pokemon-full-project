# Testing Guide

## Overview

This project uses Jest and React Testing Library for unit and integration testing. The testing infrastructure is set up to support:

- Unit tests for utilities and functions
- Component tests for React components
- API tests for tRPC routers
- Integration tests for complex workflows

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test src/lib/utils/__tests__/index.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="Button"
```

## Test Structure

```
src/
├── components/
│   └── ui/
│       ├── Button.tsx
│       └── __tests__/
│           └── Button.test.tsx
├── lib/
│   └── utils/
│       ├── index.ts
│       └── __tests__/
│           └── index.test.ts
├── server/
│   └── routers/
│       ├── card.ts
│       └── __tests__/
│           └── card.test.ts
└── test-utils/
    ├── index.tsx        # Custom render with providers
    └── mock-data.ts     # Shared mock data
```

## Writing Tests

### Component Tests

```typescript
import { render, screen, fireEvent } from '@/test-utils';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('handles user interaction', () => {
    const handleClick = jest.fn();
    render(<MyComponent onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

### Utility Tests

```typescript
import { myFunction } from '../myUtils';

describe('myFunction', () => {
  it('returns expected value', () => {
    expect(myFunction('input')).toBe('expected output');
  });
});
```

### API Tests

```typescript
import { createInnerTRPCContext } from '@/server/trpc';
import { myRouter } from '../myRouter';

describe('MyRouter', () => {
  it('handles queries', async () => {
    const ctx = createInnerTRPCContext({ userId: 'test-user' });
    const caller = myRouter.createCaller(ctx);
    
    const result = await caller.myQuery({ id: '123' });
    expect(result).toEqual({ /* expected data */ });
  });
});
```

## Test Utilities

### Custom Render

The custom render function in `test-utils/index.tsx` wraps components with necessary providers:

```typescript
import { render } from '@/test-utils';

// Automatically includes QueryClientProvider
render(<MyComponent />);
```

### Mock Data

Shared mock data is available in `test-utils/mock-data.ts`:

```typescript
import { mockCard, mockUser, mockDeck } from '@/test-utils/mock-data';

// Use in tests
const card = mockCard;
const cards = createMockCards(10);
```

## Mocking

### Mocking Modules

```typescript
jest.mock('@/server/db', () => ({
  prisma: {
    card: {
      findMany: jest.fn(),
    },
  },
}));
```

### Mocking Next.js Features

Next.js routing and Clerk authentication are pre-mocked in `jest.setup.js`.

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the component does, not how it does it
2. **Use Descriptive Test Names**: Make it clear what scenario is being tested
3. **Keep Tests Simple**: Each test should verify one specific behavior
4. **Use Data-TestId Sparingly**: Prefer accessible queries like `getByRole`, `getByText`
5. **Mock External Dependencies**: Don't make real API calls or database queries
6. **Test Error States**: Include tests for loading, error, and edge cases
7. **Clean Up After Tests**: Use `beforeEach` and `afterEach` to reset state

## Coverage

Current coverage thresholds:
- Branches: 50%
- Functions: 50%
- Lines: 60%
- Statements: 60%

Run `npm run test:coverage` to see detailed coverage report.

## Debugging Tests

1. **Use console.log**: Add logs to understand test flow
2. **Use screen.debug()**: Print the current DOM state
3. **Run Single Test**: Focus on one test with `.only`
4. **Check Jest Config**: Ensure paths and mocks are correct

## Common Issues

### "Module not found" errors
- Check that the module path matches the Jest moduleNameMapper config
- Ensure Prisma client is generated: `npx prisma generate`

### Component not rendering
- Check that all required props are provided
- Verify providers are set up in test-utils
- Use `screen.debug()` to see what's rendered

### Async tests failing
- Always use `async/await` for async operations
- Use `waitFor` for elements that appear asynchronously
- Check that promises are properly resolved

## Future Improvements

1. **E2E Tests**: Add Playwright or Cypress for end-to-end testing
2. **Visual Regression**: Add visual regression testing
3. **Performance Tests**: Add performance benchmarks
4. **Accessibility Tests**: Add automated a11y testing
5. **Mutation Testing**: Add Stryker for mutation testing