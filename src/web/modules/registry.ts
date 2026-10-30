// The only place the core application reaches optional modules. The Clean
// edition build (Phase 4) swaps this file, so demo code is not in its bundle.
import { lazy } from 'react'

export { Landing } from './demo/Landing'
export { LoginNotice } from './demo/LoginNotice'
// The privacy notice is rarely opened, so it is loaded on demand.
export const Privacy = lazy(() => import('./demo/Privacy').then((m) => ({ default: m.Privacy })))
