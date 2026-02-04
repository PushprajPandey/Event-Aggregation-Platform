import { Router, Request, Response, NextFunction } from "express";
import { passport } from "../config/passport";
import { ApiResponse } from "../types";
import { config } from "../config/environment";

const router = Router();

// Initiate Google OAuth flow
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
);

// Handle Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${config.cors.frontendUrl}/login?error=auth_failed`,
  }),
  (req: Request, res: Response) => {
    // Successful authentication, redirect to admin dashboard
    res.redirect(`${config.cors.frontendUrl}/admin`);
  },
);

// Get current authenticated user
router.get("/user", (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: req.user || null,
    message: req.user ? "User authenticated" : "No user authenticated",
  };
  res.json(response);
});

// Logout user
router.post(
  "/logout",
  (req: Request, res: Response, next: NextFunction): void => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        const response: ApiResponse = {
          success: false,
          error: "Failed to logout",
          message: "An error occurred during logout",
        };
        res.status(500).json(response);
        return;
      }

      // Destroy session
      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          console.error("Session destruction error:", sessionErr);
          const response: ApiResponse = {
            success: false,
            error: "Failed to destroy session",
            message: "Session could not be properly terminated",
          };
          res.status(500).json(response);
          return;
        }

        // Clear session cookie
        res.clearCookie("connect.sid");

        const response: ApiResponse = {
          success: true,
          message: "Successfully logged out",
        };
        res.json(response);
      });
    });
  },
);

// Check authentication status
router.get("/status", (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      isAuthenticated: req.isAuthenticated(),
      user: req.user || null,
    },
    message: req.isAuthenticated()
      ? "User is authenticated"
      : "User is not authenticated",
  };
  res.json(response);
});

export { router as authRouter };
