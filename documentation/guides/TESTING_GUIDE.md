# Complete Testing Guide

Comprehensive guide to testing infrastructure, type safety, patterns, and best practices for Cosmic Horizons.

## Quick Start: Common Patterns

### Create Test Data

```typescript
// Comments
const comment = new CommentBuilder().withId('c1').withContent('text').build();

// Posts
const post = new PostBuilder().withId('p1').withTitle('Title').build();

// Reports
const report = new CommentReportBuilder().withId('r1').withReason('Spam').build();

// Logs
const log = new LogEntryBuilder().withType('ACTION').withSeverity('INFO').build();
```

### Mock Repositories

```typescript
const mockRepo = createMockRepository<Comment>();
mockRepo.findById.mockResolvedValue(comment);
mockRepo.find.mockResolvedValue([comment]);
mockRepo.create.mockResolvedValue(comment);
```

### Mock Services

```typescript
const mockService = {
  getComments: jest.fn(),
  createComment: jest.fn(),
} as jest.Mocked<CommentsService>;

mockService.getComments.mockResolvedValue([comment]);
```

## Type Safety Guide

### Principles

1. **Never Use `any` in Tests**: Always use strict types for test data

   ```typescript
   // ❌ Bad
   const mock: any = { id: 'c1' };
   
   // ✅ Good
   const mock = new CommentBuilder().withId('c1').build();
   ```

2. **All Test Data Must Be Complete**: Include all required fields

   ```typescript
   // Use builders to ensure completeness
   const comment = new CommentBuilder()
     .withId('c1')
     .withContent('text')
     .withUserId('u1')
     .withPostId('p1')
     .build();
   ```

3. **Use Type Checkers for Validation**

   ```typescript
   TestDataTypeChecker.validateEntity(comment, ['id', 'content', 'user_id']);
   TestDataTypeChecker.validateEntityArray(comments, ['id', 'post_id']);
   ```

### Test Builders

Builders ensure type safety and completeness:

```typescript
const comment = new CommentBuilder()
  .withId('c1')
  .withContent('Some comment')
  .withUserId('user-123')
  .withPostId('post-456')
  .withCreatedAt(new Date('2026-02-12'))
  .build();
```

### Mock Factory

Create properly typed mocks:

```typescript
const repo = createMockRepository<Comment>();
const mockService = CreateMockService(CommentsService);
```

### Type Assertion Helpers

```typescript
TypeSafeAssertions.assertEntityProperties(comment, ['id', 'content']);
TypeSafeAssertions.assertArrayLength(comments, 3);
```

## Migration Guide: Adding Type Safety to Existing Tests

### Step 1: Identify Tests to Migrate

```bash
# Find test files
find apps/cosmic-horizons-api/src -name "*.spec.ts" | wc -l

# Find files with type issues
grep -r "any" apps/cosmic-horizons-api/src --include="*.spec.ts" | head -20
```

### Step 2: Import Infrastructure

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { CommentBuilder, PostBuilder, TestDataFactory } from '../testing/test-builders';
import { createMockRepository, TypeSafeAssertions } from '../testing/mock-factory';
import { TestDataTypeChecker } from '../testing/type-safety-config';
```

### Step 3: Update Mock Data Creation

**Before:**

```typescript
const mockComment = {
  id: 'comment-1',
  content: 'Test comment',
  // Missing: post, user, replies, etc.
};
```

**After:**

```typescript
const mockComment = new CommentBuilder()
  .withId('comment-1')
  .withContent('Test comment')
  .build(); // All required fields included automatically
```

### Step 4: Update Repository Mocks

**Before:**

```typescript
const mockRepo = {
  findById: jest.fn(),
  find: jest.fn(),
};
```

**After:**

```typescript
const mockRepo = createMockRepository<Comment>();
mockRepo.findById.mockResolvedValue(comment);
mockRepo.find.mockResolvedValue([comment]);
```

### Step 5: Validate Test Data

```typescript
// At test setup
beforeEach(() => {
  TestDataTypeChecker.validateEntity(mockComment, ['id', 'content', 'user_id']);
});
```

### Step 6: Update Assertions

**Before:**

```typescript
expect(result).toEqual(mockComment);
```

**After:**

```typescript
TypeSafeAssertions.assertEntityProperties(result, ['id', 'content', 'user_id']);
expect(result.id).toBe(mockComment.id);
```

## Configuration & Setup

### Test Data Builders Location

Located in: `apps/cosmic-horizons-api/src/testing/test-builders.ts`

Key builders:

- `CommentBuilder`
- `PostBuilder`
- `CommentReportBuilder`
- `LogEntryBuilder`
- `UserBuilder`

### Mock Factory Location

Located in: `apps/cosmic-horizons-api/src/testing/mock-factory.ts`

Key functions:

- `createMockRepository<T>()`
- `CreateMockService<T>()`
- `TypeSafeAssertions`

### Type Safety Config

Located in: `apps/cosmic-horizons-api/src/testing/type-safety-config.ts`

Provides:

- `TestDataTypeChecker`
- Type validation utilities

## Best Practices

### 1. Use Builders for All Test Data

```typescript
// ✅ Good: Type-safe, complete
const comment = new CommentBuilder().withId('c1').build();

// ❌ Avoid: Manual objects prone to errors
const comment = { id: 'c1' } as Comment;
```

### 2. Keep Tests DRY

```typescript
// Create helper fixtures
const createTestComment = (overrides?: Partial<Comment>) => 
  new CommentBuilder().withId('c1').merge(overrides).build();

// Usage in tests
const comment1 = createTestComment();
const comment2 = createTestComment({ content: 'Different' });
```

### 3. Validate Mock Completeness

```typescript
beforeEach(() => {
  // Validate test data structure at setup
  TestDataTypeChecker.validateEntity(testComment, REQUIRED_FIELDS);
});
```

### 4. Use Specific Assertions

```typescript
// ✅ Good: Specific property checks
expect(result.id).toBe(expected.id);
expect(result.content).toContain('expected');

// ❌ Avoid: Generic object comparison
expect(result).toEqual(expected);
```

### 5. Document Complex Test Data

```typescript
/**
 * Creates a comment with moderation report and multiple replies
 * Used to test: complex moderation workflows
 */
const complexScenario = () => ({
  comment: new CommentBuilder().withId('c1').build(),
  report: new CommentReportBuilder().withId('r1').build(),
  replies: [/* ... */],
});
```

## Running Tests with Type Safety

```bash
# Run all tests
pnpm nx test cosmic-horizons-api

# Run specific test file
pnpm nx test cosmic-horizons-api -- comments.service.spec.ts

# Run with coverage
pnpm nx test cosmic-horizons-api --coverage

# Run e2e with type safety
pnpm nx run cosmic-horizons-api-e2e:test
```

## Common Issues & Solutions

### Issue: Missing Required Fields

**Symptom**: Test passes locally but fails in CI

**Solution**: Use TestDataTypeChecker to validate completeness

```typescript
TestDataTypeChecker.validateEntity(data, ['id', 'required_field']);
```

### Issue: Mock Return Value Type Mismatch

**Symptom**: `TypeError: Cannot read property 'X' of undefined`

**Solution**: Use createMockRepository to ensure proper types

```typescript
const mockRepo = createMockRepository<Comment>();
```

### Issue: Flaky Tests Due to Incomplete Mocks

**Symptom**: Tests pass/fail intermittently

**Solution**: Use builders to ensure consistent complete data

```typescript
const data = new CommentBuilder().build(); // Always complete
```

## References

- [Jest Testing Documentation](https://jestjs.io/)
- [NestJS Testing Guide](https://docs.nestjs.com/fundamentals/testing)
- [TypeScript Testing Best Practices](https://www.typescriptlang.org/docs/handbook/testing.html)

---

**Related Documentation**:

- [Testing Strategy](../quality/TESTING-STRATEGY.md)
- [E2E Code Coverage](../quality/E2E_CODE_COVERAGE_GUIDE.md)
