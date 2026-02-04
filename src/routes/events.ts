import { Router, Request, Response, NextFunction } from "express";
import { Event } from "../models/Event";
import { ApiResponse, EventFilter } from "../types";
import { Types } from "mongoose";
import { ResilienceService } from "../services/ResilienceService";
import {
  createEnhancedError,
  GlobalErrorCategory,
} from "../middleware/globalErrorHandler";

const router = Router();

/**
 * GET /api/events
 * Public endpoint to retrieve filtered event listings with resilience
 * Requirements: 3.1 - Public event listing interface, 8.4 - Public site resilience
 */
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        city = "Sydney",
        keyword,
        dateFrom,
        dateTo,
        limit = "50",
        offset = "0",
      } = req.query;

      // Build filter object
      const filter: any = {
        city: new RegExp(city as string, "i"),
        dateTime: { $gte: new Date() }, // Only show upcoming events
      };

      // Add keyword search if provided
      if (keyword) {
        filter.$text = { $search: keyword as string };
      }

      // Add date range filters
      if (dateFrom) {
        filter.dateTime.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        filter.dateTime.$lte = new Date(dateTo as string);
      }

      // Parse pagination parameters
      const limitNum = Math.min(parseInt(limit as string) || 50, 100); // Max 100 events
      const offsetNum = parseInt(offset as string) || 0;

      // Use resilience service to get events with fallback
      const resilienceService = ResilienceService.getInstance();
      const { events, fromCache, degradationInfo } =
        await resilienceService.getEventsWithFallback(filter);

      // Apply pagination to results (since fallback might return cached data)
      const paginatedEvents = events.slice(offsetNum, offsetNum + limitNum);
      const totalCount = events.length;

      const response: ApiResponse = {
        success: true,
        data: {
          events: paginatedEvents,
          pagination: {
            total: totalCount,
            limit: limitNum,
            offset: offsetNum,
            hasMore: offsetNum + limitNum < totalCount,
          },
          ...(fromCache && {
            cacheInfo: {
              fromCache: true,
              message: "Data served from cache due to service issues",
            },
          }),
          ...(degradationInfo && { degradationInfo }),
        },
        message: fromCache
          ? `Found ${paginatedEvents.length} events (from cache)`
          : `Found ${paginatedEvents.length} events`,
      };

      // Add cache headers for client-side caching
      if (fromCache) {
        res.setHeader("X-Data-Source", "cache");
        res.setHeader("Cache-Control", "public, max-age=300"); // 5 minutes
      } else {
        res.setHeader("X-Data-Source", "live");
        res.setHeader("Cache-Control", "public, max-age=60"); // 1 minute
      }

      res.json(response);
    } catch (error) {
      // Enhanced error handling for public endpoint
      if (
        error instanceof Error &&
        error.message.includes("temporarily unavailable")
      ) {
        // Return a graceful degradation response
        const response: ApiResponse = {
          success: false,
          error: "Event data is temporarily unavailable",
          data: {
            events: [],
            pagination: { total: 0, limit: 0, offset: 0, hasMore: false },
            serviceStatus: "degraded",
            retryAfter: 300, // 5 minutes
          },
        };
        res.status(503).json(response);
        return;
      }

      next(error);
    }
  },
);

/**
 * GET /api/events/:id
 * Public endpoint to get specific event details with resilience
 * Requirements: 3.1 - Public event listing interface, 8.4 - Public site resilience
 */
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      // Validate ObjectId format
      if (!Types.ObjectId.isValid(id)) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid event ID format",
        };
        res.status(400).json(response);
        return;
      }

      try {
        // Try to find event by ID with resilience
        const event = await Event.findById(id)
          .select(
            "title dateTime venueName venueAddress city description categoryTags imageUrl sourceWebsite originalEventUrl",
          )
          .lean();

        if (!event) {
          const response: ApiResponse = {
            success: false,
            error: "Event not found",
          };
          res.status(404).json(response);
          return;
        }

        const response: ApiResponse = {
          success: true,
          data: { event },
          message: "Event retrieved successfully",
        };

        res.json(response);
        return;
      } catch (dbError) {
        // Fallback: try to find event in cached data
        const resilienceService = ResilienceService.getInstance();
        const { events, fromCache } =
          await resilienceService.getEventsWithFallback({});

        const cachedEvent = events.find((event) => event._id.toString() === id);

        if (cachedEvent && fromCache) {
          const response: ApiResponse = {
            success: true,
            data: {
              event: cachedEvent,
              cacheInfo: {
                fromCache: true,
                message: "Event data served from cache due to service issues",
              },
            },
            message: "Event retrieved from cache",
          };

          res.setHeader("X-Data-Source", "cache");
          res.json(response);
          return;
        }

        // If not found in cache either, throw the original error
        throw dbError;
      }
    } catch (error) {
      // Enhanced error handling
      if (
        error instanceof Error &&
        error.message.includes("temporarily unavailable")
      ) {
        const response: ApiResponse = {
          success: false,
          error: "Event details temporarily unavailable",
          data: {
            serviceStatus: "degraded",
            retryAfter: 300,
          },
        };
        res.status(503).json(response);
        return;
      }

      next(error);
    }
  },
);

/**
 * GET /api/events/health/status
 * Public endpoint to check event service health
 * Requirements: 8.4 - Public site resilience
 */
router.get(
  "/health/status",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resilienceService = ResilienceService.getInstance();
      const resilienceStatus = resilienceService.getResilienceStatus();

      const response: ApiResponse = {
        success: resilienceStatus.systemHealth.isHealthy,
        data: {
          status: resilienceStatus.systemHealth.isHealthy
            ? "healthy"
            : "degraded",
          degradationLevel: resilienceStatus.systemHealth.degradationLevel,
          services: {
            scraper: resilienceStatus.scraperHealth.isHealthy
              ? "healthy"
              : "degraded",
            cache: resilienceStatus.cacheStatus.isValid ? "available" : "stale",
          },
          lastUpdate: resilienceStatus.lastSuccessfulScrape,
          recommendations: resilienceStatus.recommendations,
        },
        message: resilienceStatus.systemHealth.isHealthy
          ? "All event services are operating normally"
          : "Some event services are experiencing issues",
      };

      const statusCode = resilienceStatus.systemHealth.isHealthy ? 200 : 503;
      res.status(statusCode).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export { router as eventsRouter };
