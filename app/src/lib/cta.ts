// Decision for the landing's primary CTA, given the stored auth token.
// Pure (no imports) so it is unit-testable in the node test env.
export type CtaAction = { kind: 'open' } | { kind: 'signin' };

export const ctaAction = (token: string | null): CtaAction =>
    token ? { kind: 'open' } : { kind: 'signin' };
