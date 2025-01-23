import * as Sentry from '@sentry/node';
import env from '../../config/env.js';

Sentry.init({
    dsn: env.SENTRY_DSN,
    integrations: [],
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
});
