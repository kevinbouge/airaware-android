# Testing

Every change must be validated before completion.

## Required Validation

Always run:

```sh
npm run validate
npx expo-doctor
```

`npm run validate` executes:

- TypeScript type checking
- Jest unit tests
- ESLint
- Knip unused code detection
- Prettier formatting verification

Do not skip any validation step.

---

## Test Coverage

Ensure:

- New business logic is covered by unit tests.
- Bug fixes include a regression test whenever practical.
- Existing tests continue to pass.
- Test coverage remains reasonable for the modified code.
- Avoid reducing overall coverage without justification.

When adding:

- environmental calculations
- provider normalization
- personalization logic
- forecast logic
- notification logic
- utility functions

add or update unit tests.

---

## Code Quality

Before considering a task complete, ensure:

- TypeScript reports no errors.
- ESLint reports no errors.
- Knip reports no unused code.
- Prettier reports correctly formatted code.
- Expo Doctor reports no issues.
- No unnecessary dependencies have been introduced.
- No dead code remains.

---

## Completion Criteria

A task is complete only if:

- `npm run validate` succeeds.
- `npx expo-doctor` succeeds.
- All new functionality is tested.
- Existing functionality has not regressed.
- The repository is left in a clean, releasable state.