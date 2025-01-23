import { Router } from 'express';
import { healthCheck } from './healthcheck.controller.js';

const router = Router();

router.get('', healthCheck);

export default router;
