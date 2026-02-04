import { Request, Response, NextFunction } from "express";
import {
  requireAuth,
  requireAdminAuth,
  optionalAuth,
  redirectIfAuthenticated,
} from "./auth";
import { ApiResponse } from "../types";

// Mock Express objects
const mockRequest = (isAuthenticated = false, path = "/api/test") =>
  ({
    isAuthenticated: () => isAuthenticated,
    path,
  }) as Request;

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as NextFunction;

describe("Authentication Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requireAuth", () => {
    it("should call next() for authenticated users", () => {
      const req = mockRequest(true);
      const res = mockResponse();

      requireAuth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it("should return 401 JSON for unauthenticated API requests", () => {
      const req = mockRequest(false, "/api/admin/events");
      const res = mockResponse();

      requireAuth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Authentication required",
        message: "You must be logged in to access this resource",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should redirect to Google OAuth for unauthenticated non-API requests", () => {
      const req = mockRequest(false, "/admin");
      const res = mockResponse();

      requireAuth(req, res, mockNext);

      expect(res.redirect).toHaveBeenCalledWith("/auth/google");
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireAdminAuth", () => {
    it("should call next() for authenticated users", () => {
      const req = mockRequest(true);
      const res = mockResponse();

      requireAdminAuth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 401 for unauthenticated users", () => {
      const req = mockRequest(false);
      const res = mockResponse();

      requireAdminAuth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Admin authentication required",
        message: "You must be logged in as an admin to access this resource",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("optionalAuth", () => {
    it("should always call next() regardless of authentication status", () => {
      const req1 = mockRequest(true);
      const req2 = mockRequest(false);
      const res = mockResponse();

      optionalAuth(req1, res, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      optionalAuth(req2, res, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });

  describe("redirectIfAuthenticated", () => {
    it("should redirect authenticated users to /admin", () => {
      const req = mockRequest(true);
      const res = mockResponse();

      redirectIfAuthenticated(req, res, mockNext);

      expect(res.redirect).toHaveBeenCalledWith("/admin");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should call next() for unauthenticated users", () => {
      const req = mockRequest(false);
      const res = mockResponse();

      redirectIfAuthenticated(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });
});
