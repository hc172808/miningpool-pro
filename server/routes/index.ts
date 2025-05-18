import { Router } from 'express';
import { setupNodeRoutes } from './nodes';

// Main router to consolidate all API routes
export function setupApiRoutes(app: Router) {
  // Set up node configuration routes
  setupNodeRoutes(app);
  
  // Add more route setup functions here as needed
  
  return app;
}