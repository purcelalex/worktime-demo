import { Component, type ReactNode } from 'react'
import { Button } from './ui'
import { strings } from '../strings'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    // Name only: never log user data.
    console.error('UI error:', error.name)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">{strings.errors.boundaryTitle}</h1>
          <Button onClick={() => window.location.reload()} className="mt-5">
            {strings.errors.boundaryAction}
          </Button>
        </div>
      </main>
    )
  }
}
