import env from '../../config/env.js';
import { makeStamper } from './activity.js';

export const stampActivity = makeStamper({ file: env.ACTIVITY_FILE });
