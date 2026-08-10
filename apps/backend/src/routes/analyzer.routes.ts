import { Router } from 'express';
import { AnalyzerController } from '../controllers/analyzer.controller.js';
import { optionalAuth } from '../middleware/auth.middleware.js';

export const analyzerRouter: Router = Router();

analyzerRouter.post('/analyze', optionalAuth, AnalyzerController.analyze);
