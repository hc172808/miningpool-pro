import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import { registerRoutes } from "./routes-fixed";
import { log } from "./vite";
import passport from "passport";
import path from "path";
import fs from "fs";

// Check environment
const isDevelopment = process.env.NODE_ENV === "development";
log(`Running in ${isDevelopment ? "development" : "production"} mode`);

// Express setup
const app: Express = express();
app.use(cors());
app.use(express.json());

// Set up session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: !isDevelopment,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Register all API routes
async function startServer() {
  try {
    const server = await registerRoutes(app);
    
    // Start the server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      log(`Server listening on port ${PORT}`);
    });
    
    return server;
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Start the server
startServer();