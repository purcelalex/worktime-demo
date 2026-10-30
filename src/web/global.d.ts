// Trusted Types is not in the TypeScript DOM library yet; only what we use.
interface TrustedScriptURLPolicy {
  createScriptURL(input: string): unknown
}

interface Window {
  trustedTypes?: {
    createPolicy(
      name: string,
      rules: { createScriptURL?: (url: string) => string },
    ): TrustedScriptURLPolicy
  }
}
