import { Router, Request, Response, NextFunction } from "express";
import { EmailCapture } from "../models/EmailCapture";
import { Event } from "../models/Event";
import { ApiResponse, EmailCaptureRequest } from "../types";
import { Types } from "mongoose";

const router = Router();

/**
 * POST /api/email-capture
 * Public endpoint to capture user email and consent for event access
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5 - Email capture and consent system
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, consentGiven, eventId }: EmailCaptureRequest = req.body;

    // Validate required fields
    if (!email || consentGiven !== true || !eventId) {
      const response: ApiResponse = {
        success: false,
        error: "Email, explicit consent, and event ID are required",
      };
      return res.status(400).json(response);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const response: ApiResponse = {
        success: false,
        error: "Please provide a valid email address",
      };
      return res.status(400).json(response);
    }

    // Validate ObjectId format for eventId
    if (!Types.ObjectId.isValid(eventId)) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid event ID format",
      };
      return res.status(400).json(response);
    }

    // Verify event exists
    const event = await Event.findById(eventId).select(
      "originalEventUrl title",
    );
    if (!event) {
      const response: ApiResponse = {
        success: false,
        error: "Event not found",
      };
      return res.status(404).json(response);
    }

    // Extract IP address and user agent for tracking
    const ipAddress = req.ip || req.connection.remoteAddress || undefined;
    const userAgent = req.get("User-Agent") || undefined;

    // Create email capture record
    const emailCapture = new EmailCapture({
      email: email.toLowerCase().trim(),
      consentGiven,
      eventId: new Types.ObjectId(eventId),
      capturedAt: new Date(),
      ipAddress,
      userAgent,
    });

    try {
      await emailCapture.save();
    } catch (saveError: any) {
      // Handle duplicate email for same event
      if (saveError.code === 11000) {
        const response: ApiResponse = {
          success: false,
          error: "Email already captured for this event",
        };
        return res.status(409).json(response);
      }
      throw saveError;
    }

    // Return success response with redirect URL
    const response: ApiResponse = {
      success: true,
      data: {
        redirectUrl: event.originalEventUrl,
        eventTitle: event.title,
        capturedAt: emailCapture.capturedAt,
      },
      message: "Email captured successfully",
    };

    return res.status(201).json(response);
  } catch (error) {
    return next(error);
  }
});

export { router as emailCaptureRouter };
