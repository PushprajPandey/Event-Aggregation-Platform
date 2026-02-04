import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../types";

/**
 * Middleware to ensure user is authenticated
 * Redirects unauthenticated users to Google OAuth login
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.isAuthenticated()) {
    return next();
  }

  // For API requests, return JSON error
  if (req.path.startsWith("/api/")) {
    const response: ApiResponse = {
      success: false,
      error: "Authentication required",
      message: "You must be logged in to access this resource",
    };
    res.status(401).json(response);
    return;
  }

  // For non-API requests, redirect to Google OAuth
  res.redirect("/auth/google");
}

/**
 * Middleware to ensure user is authenticated for admin routes
 * Returns 401 for unauthenticated requests
 */
export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.isAuthenticated()) {
    return next();
  }

  const response: ApiResponse = {
    success: false,
    error: "Admin authentication required",
    message: "You must be logged in as an admin to access this resource",
  };
  res.status(401).json(response);
}

/**
 * Optional authentication middleware
 * Continues regardless of authentication status but populates req.user if authenticated
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // req.user is automatically populated by Passport if authenticated
  next();
}

/**
 * Middleware to check if user is already authenticated
 * Redirects authenticated users away from login pages
 */
export function redirectIfAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.isAuthenticated()) {
    return res.redirect("/admin");
  }
  next();
}
