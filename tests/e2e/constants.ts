// Test-only account used by the end-to-end tests and by manual checks on a LOCAL
// database. It is created by `npm run e2e:setup` and exists nowhere else: it is
// not in the migrations, not in the demo seed and never touches production.
export const E2E_USERNAME = 'e2e-user'
export const E2E_PASSWORD = 'e2e-local-only-password'
