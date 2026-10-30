import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { E2E_PASSWORD, E2E_USERNAME } from './constants'

test.describe.configure({ mode: 'serial' })

/** Collects Content-Security-Policy violations reported by the browser. */
async function watchCsp(page: Page) {
  await page.addInitScript(() => {
    ;(window as any).__csp = []
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber} ${e.sample}`),
    )
  })
}
const cspViolations = (page: Page) => page.evaluate(() => (window as any).__csp as string[])

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Account').fill(E2E_USERNAME)
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/app\/timer/)
}

async function axe(page: Page) {
  // A dialog that is still fading in is semi-transparent, which skews colour
  // contrast. Wait for finite animations (the endless pulsing dot is ignored).
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
      .every((a) => a.playState === 'finished' || a.playState === 'idle'),
  )
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.target} ${v.nodes[0]?.any[0]?.message ?? ""}`)).toEqual([])
}

const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}`

test('TC-UI-01 the landing button leads to the test-mode login', async ({ page }) => {
  await watchCsp(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Know where')
  await axe(page)
  await page.getByRole('link', { name: 'Explore the demo' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Test mode. Use the demo account details you were given.')).toBeVisible()
  await axe(page)
  expect(await cspViolations(page)).toEqual([])
})

test('TC-UI-02 login errors are generic', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Account').fill('nobody')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password-1')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid account or password')
  await expect(page).toHaveURL(/\/login$/)
})

test('visitors without a session are sent to the login page', async ({ page }) => {
  await page.goto('/app/timer')
  await expect(page).toHaveURL(/\/login$/)
})

test('TC-UI-03 full flow: add, start, stop, restart, report', async ({ page }) => {
  await watchCsp(page)
  await signIn(page)
  const name = unique('Flow Tester')

  // Add an employee.
  await page.goto('/app/employees')
  await page.getByRole('button', { name: 'Add employee' }).first().click()
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Position (optional)').fill('Developer')
  await page.getByRole('button', { name: 'Add employee' }).last().click()
  await expect(page.getByText('Employee added')).toBeVisible()
  await expect(page.getByText(name)).toBeVisible()

  // Start a timer with a task.
  await page.goto('/app/timer')
  await axe(page)
  await page.getByRole('button', { name: `Start ${name}` }).click()
  await page.getByLabel('Task description').fill('Write the first report')
  await page.getByRole('button', { name: 'Start timer' }).click()
  await expect(page.getByText('Write the first report')).toBeVisible()
  await expect(page.getByRole('button', { name: `Stop ${name}` })).toBeVisible()
  await page.waitForTimeout(2200)
  await expect(page.getByText(/^00:00:0[2-9]$/)).toBeVisible() // the live clock is ticking

  // Stop, then restart: a new independent entry.
  await page.getByRole('button', { name: `Stop ${name}` }).click()
  await expect(page.getByRole('button', { name: `Start ${name}` })).toBeVisible()
  await page.getByRole('button', { name: `Start ${name}` }).click()
  await page.getByLabel('Task description').fill('Second task after restart')
  await page.getByRole('button', { name: 'Start timer' }).click()
  await expect(page.getByText('Second task after restart')).toBeVisible()
  await page.getByRole('button', { name: `Stop ${name}` }).click()
  await expect(page.getByRole('button', { name: `Start ${name}` })).toBeVisible()

  // The report shows both records.
  await page.goto('/app/reports')
  await page.getByRole('button', { name: 'Today' }).click()
  await axe(page)
  const row = page.getByRole('button', { name: new RegExp(name) })
  await expect(row).toContainText('2 records')
  await row.click()
  // The records exist twice in the DOM (cards for phones, a table for desktop); one is hidden by CSS.
  await expect(page.getByText('Write the first report').filter({ visible: true })).toBeVisible()
  await expect(page.getByText('Second task after restart').filter({ visible: true })).toBeVisible()
  expect(await cspViolations(page)).toEqual([])
})

test('TC-UI-13 pause freezes the clock, resume continues it, stop ends the task', async ({ page }) => {
  await watchCsp(page)
  await signIn(page)
  const name = unique('Pause Tester')
  await page.goto('/app/employees')
  await page.getByRole('button', { name: 'Add employee' }).first().click()
  await page.getByLabel('Full name').fill(name)
  await page.getByRole('button', { name: 'Add employee' }).last().click()
  await expect(page.getByText('Employee added')).toBeVisible()

  await page.goto('/app/timer')
  await page.getByRole('button', { name: `Start ${name}` }).click()
  await page.getByLabel('Task description').fill('Pausable task')
  await page.getByRole('button', { name: 'Start timer' }).click()
  const card = page.getByRole('listitem').filter({ hasText: name })
  await expect(card.getByRole('button', { name: `Pause ${name}` })).toBeVisible()
  await expect(card.getByRole('button', { name: `Stop ${name}` })).toBeVisible()
  await page.waitForTimeout(2200)

  // Pause: the state changes and the clock stops moving.
  await card.getByRole('button', { name: `Pause ${name}` }).click()
  await expect(card.getByText('Paused', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: `Resume ${name}` })).toBeVisible()
  await expect(card.getByText('Pausable task')).toBeVisible()
  await axe(page)
  const clock = card.getByText(/^\d\d:\d\d:\d\d$/)
  const frozen = await clock.textContent()
  await page.waitForTimeout(2500)
  expect(await clock.textContent()).toBe(frozen)

  // Resume: it continues from the frozen value, not from zero.
  await card.getByRole('button', { name: `Resume ${name}` }).click()
  await expect(card.getByText('Running', { exact: true })).toBeVisible()
  await page.waitForTimeout(2200)
  const [h, m, s] = (await clock.textContent())!.split(':').map(Number)
  const [fh, fm, fs] = frozen!.split(':').map(Number)
  expect(h! * 3600 + m! * 60 + s!).toBeGreaterThan(fh! * 3600 + fm! * 60 + fs!)

  // Pause again, then stop from the paused state.
  await card.getByRole('button', { name: `Pause ${name}` }).click()
  await expect(card.getByText('Paused', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: `Stop ${name}` }).click()
  await expect(card.getByRole('button', { name: `Start ${name}` })).toBeVisible()

  // The two work segments are in the report (the pause itself is not a record).
  await page.goto('/app/reports')
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('button', { name: new RegExp(name) })).toContainText('2 records')
  expect(await cspViolations(page)).toEqual([])
})

test('TC-UI-04 the empty report shows the empty state', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/reports')
  await page.getByRole('button', { name: 'Custom' }).click()
  await page.getByLabel('From').fill('2001-01-01')
  await page.getByLabel('To').fill('2001-01-31')
  await expect(page.getByRole('heading', { name: 'No records for this period' })).toBeVisible()
  await axe(page)
})

test('a data change survives a full page reload (persistence)', async ({ page }) => {
  await signIn(page)
  const name = unique('Persist Tester')
  await page.goto('/app/employees')
  await page.getByRole('button', { name: 'Add employee' }).first().click()
  await page.getByLabel('Full name').fill(name)
  await page.getByRole('button', { name: 'Add employee' }).last().click()
  await expect(page.getByText(name)).toBeVisible()
  await page.reload()
  await expect(page.getByText(name)).toBeVisible()
})

test('a duplicate employee name shows an inline error', async ({ page }) => {
  await signIn(page)
  const name = unique('Duplicate Tester')
  await page.goto('/app/employees')
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Add employee' }).first().click()
    await page.getByLabel('Full name').fill(name)
    await page.getByRole('button', { name: 'Add employee' }).last().click()
    if (i === 0) await expect(page.getByText('Employee added')).toBeVisible()
  }
  await expect(page.getByRole('alert')).toContainText('already exists')
})

test('TC-UI-05 navigation: bottom tab bar on phones, sidebar on desktop', async ({ page }, testInfo) => {
  await signIn(page)
  const phone = testInfo.project.name === 'phone'
  const nav = page.getByRole('navigation', { name: 'Main' })
  // Two nav elements exist; exactly one is visible at each size.
  await expect(nav.filter({ visible: true })).toHaveCount(1)
  const box = await nav.filter({ visible: true }).boundingBox()
  if (phone) expect(box!.y).toBeGreaterThan(600)
  else expect(box!.x).toBeLessThan(40)
  await nav.filter({ visible: true }).getByRole('link', { name: 'Reports' }).click()
  await expect(page).toHaveURL(/\/app\/reports/)
})

test('TC-UI-06 no horizontal scroll, even at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/')
  for (const path of ['/', '/login']) {
    await page.goto(path)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await signIn(page)
  for (const path of ['/app/timer', '/app/employees', '/app/reports']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('TC-UI-07 the add-employee dialog works with the keyboard only', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/employees')
  const trigger = page.getByRole('button', { name: 'Add employee' }).first()
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Full name')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(trigger).toBeFocused() // focus returns to the trigger
})

test('TC-UI-08 axe finds no serious issues on the employees screen', async ({ page }) => {
  await signIn(page)
  await page.goto('/app/employees')
  await page.waitForLoadState('networkidle')
  await axe(page)
})

test('TC-UI-10 the app shell loads offline and data screens show a retry state', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload() // now controlled by the service worker
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Know where')
  await context.setOffline(false)
})

test('TC-GDPR-02 the privacy notice is reachable, accessible and states the key facts', async ({ page }) => {
  await watchCsp(page)
  await page.goto('/')
  await page.getByRole('link', { name: 'Privacy' }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeVisible()
  await expect(page.getByText('All employees, tasks and time entries in the demo are fictional.')).toBeVisible()
  await expect(page.getByText('There are no analytics, advertising, third-party scripts or tracking cookies.')).toBeVisible()
  await axe(page)
  expect(await cspViolations(page)).toEqual([])
  // Also linked from the login page.
  await page.goto('/login')
  await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible()
})

test('TC-GDPR-03 demo workspaces warn against entering real personal data', async ({ page }) => {
  await signIn(page)
  await expect(page.getByText('Demo workspace: fictional data only. Please do not enter real personal data.')).toBeVisible()
  await page.goto('/app/employees')
  await page.getByRole('button', { name: 'Add employee' }).first().click()
  await expect(page.getByText('Use a fictional name. This is a demo; do not enter real people.')).toBeVisible()
  await axe(page)
})

test('logout ends the session', async ({ page }) => {
  await signIn(page)
  const logout = page.getByRole('button', { name: 'Log out' }).filter({ visible: true })
  await logout.click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/app/timer')
  await expect(page).toHaveURL(/\/login$/)
})

test('TC-UI-14 deleting an employee asks for confirmation and keeps the history', async ({ page }) => {
  await watchCsp(page)
  await signIn(page)
  const name = unique('Delete Tester')

  // Create the employee and one finished record, so there is history to keep.
  await page.goto('/app/employees')
  await page.getByRole('button', { name: 'Add employee' }).first().click()
  await page.getByLabel('Full name').fill(name)
  await page.getByRole('button', { name: 'Add employee' }).last().click()
  await expect(page.getByText('Employee added')).toBeVisible()
  await page.goto('/app/timer')
  await page.getByRole('button', { name: `Start ${name}` }).click()
  await page.getByLabel('Task description').fill('History to keep')
  await page.getByRole('button', { name: 'Start timer' }).click()
  await page.getByRole('button', { name: `Stop ${name}` }).click()
  await expect(page.getByRole('button', { name: `Start ${name}` })).toBeVisible()

  // Step 1: choose the employee. The button sits next to "Add employee".
  await page.goto('/app/employees')
  await expect(page.getByRole('button', { name: 'Delete employee' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete employee' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Delete…' })).toBeDisabled() // nothing chosen yet
  await dialog.getByLabel('Employee to delete').selectOption({ label: name })
  await dialog.getByRole('button', { name: 'Delete…' }).click()

  // Step 2: the confirmation question. "No, keep" leaves everything as it was.
  await expect(dialog.getByText(`Are you sure you want to delete ${name} from the list of employees?`)).toBeVisible()
  await axe(page)
  await dialog.getByRole('button', { name: 'No, keep' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText(name)).toBeVisible()

  // Confirm: the employee leaves the list and the timer screen.
  await page.getByRole('button', { name: 'Delete employee' }).click()
  await page.getByRole('dialog').getByLabel('Employee to delete').selectOption({ label: name })
  await page.getByRole('dialog').getByRole('button', { name: 'Delete…' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, delete' }).click()
  await expect(page.getByText(`${name} deleted. Their history is kept.`)).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: name })).toHaveCount(0)
  await page.goto('/app/timer')
  await expect(page.getByRole('button', { name: `Start ${name}` })).toHaveCount(0)

  // The history is still in the report, marked as deleted.
  await page.goto('/app/reports')
  await page.getByRole('button', { name: 'Today' }).click()
  const row = page.getByRole('button', { name: new RegExp(name) })
  await expect(row).toContainText('Deleted')
  await row.click()
  await expect(page.getByText('History to keep').filter({ visible: true })).toBeVisible()
  expect(await cspViolations(page)).toEqual([])
})
