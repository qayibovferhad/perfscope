import { Router } from 'express';
import { AnalyzerController } from '../controllers/analyzer.controller.js';

export const analyzerRouter = Router();

analyzerRouter.post('/analyze', AnalyzerController.analyze);
