import { Router, Request, Response } from "express";
import { Event } from "../models/Event";
import { User } from "../models/User";
import { requireAdminAuth } from "../middleware/auth";
import {
  ApiResponse,
  EventFilter,
  EventImportRequest,
  DashboardStats,
  EventStatus,
} from "../types";
import { Types } from "mongoose";

const router = Router();

// Apply authentication middleware to all admin routes
router.use(requireAdminAuth);

// Get events with admin filters
router.get("/events", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      city = "Sydney",
      keyword,
      dateFrom,
      dateTo,
      status,
      limit = 50,
      offset = 0,
    } = req.query;

    const filter: any = {};

    // City filter
    if (city) {
      filter.city = { $regex: new RegExp(city as string, "i") };
    }

    // Keyword search across title, description, and venue
    if (keyword) {
      filter.$or = [
        { title: { $regex: new RegExp(keyword as string, "i") } },
        { description: { $regex: new RegExp(keyword as string, "i") } },
        { venueName: { $regex: new RegExp(keyword as string, "i") } },
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.dateTime = {};
      if (dateFrom) {
        filter.dateTime.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        filter.dateTime.$lte = new Date(dateTo as string);
      }
    }

    // Status filter
    if (status && Object.values(EventStatus).includes(status as EventStatus)) {
      filter.status = status;
    }

    const events = await Event.find(filter)
      .sort({ lastScrapedAt: -1, dateTime: 1 })
      .limit(Number(limit))
      .skip(Number(offset))
      .populate("importedBy", "name email")
      .lean();

    const totalCount = await Event.countDocuments(filter);

    const response: ApiResponse = {
      success: true,
      data: {
        events,
        pagination: {
          total: totalCount,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < totalCount,
        },
      },
      message: `Retrieved ${events.length} events`,
    };

    res.json(response);
  } catch (error) {
    console.error("Admin events fetch error:", error);
    const response: ApiResponse = {
      success: false,
      error: "Failed to fetch events",
      message: "An error occurred while retrieving events",
    };
    res.status(500).json(response);
  }
});

// Get specific event details for admin
router.get(
  "/events/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid event ID",
          message: "The provided event ID is not valid",
        };
        res.status(400).json(response);
        return;
      }

      const event = await Event.findById(id)
        .populate("importedBy", "name email profilePicture")
        .lean();

      if (!event) {
        const response: ApiResponse = {
          success: false,
          error: "Event not found",
          message: "The requested event could not be found",
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: event,
        message: "Event retrieved successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Admin event fetch error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to fetch event",
        message: "An error occurred while retrieving the event",
      };
      res.status(500).json(response);
    }
  },
);

// Import event to platform
router.put(
  "/events/:id/import",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { importNotes }: EventImportRequest = req.body;

      if (!Types.ObjectId.isValid(id)) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid event ID",
          message: "The provided event ID is not valid",
        };
        res.status(400).json(response);
        return;
      }

      const event = await Event.findById(id);

      if (!event) {
        const response: ApiResponse = {
          success: false,
          error: "Event not found",
          message: "The requested event could not be found",
        };
        res.status(404).json(response);
        return;
      }

      // Check if event is already imported
      if (event.status === EventStatus.IMPORTED) {
        const response: ApiResponse = {
          success: false,
          error: "Event already imported",
          message: "This event has already been imported to the platform",
        };
        res.status(400).json(response);
        return;
      }

      // Update event with import information
      event.status = EventStatus.IMPORTED;
      event.importedAt = new Date();
      event.importedBy = req.user!._id;
      if (importNotes) {
        event.importNotes = importNotes;
      }

      await event.save();

      // Populate the importedBy field for response
      await event.populate("importedBy", "name email");

      const response: ApiResponse = {
        success: true,
        data: event,
        message: "Event successfully imported to platform",
      };

      res.json(response);
    } catch (error) {
      console.error("Event import error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to import event",
        message: "An error occurred while importing the event",
      };
      res.status(500).json(response);
    }
  },
);

// Get dashboard statistics
router.get(
  "/dashboard-stats",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const [
        totalEvents,
        newEvents,
        updatedEvents,
        inactiveEvents,
        importedEvents,
        lastScrapingEvent,
      ] = await Promise.all([
        Event.countDocuments(),
        Event.countDocuments({ status: EventStatus.NEW }),
        Event.countDocuments({ status: EventStatus.UPDATED }),
        Event.countDocuments({ status: EventStatus.INACTIVE }),
        Event.countDocuments({ status: EventStatus.IMPORTED }),
        Event.findOne()
          .sort({ lastScrapedAt: -1 })
          .select("lastScrapedAt")
          .lean(),
      ]);

      const stats: DashboardStats = {
        totalEvents,
        newEvents,
        updatedEvents,
        inactiveEvents,
        importedEvents,
        lastScrapingTime: lastScrapingEvent?.lastScrapedAt,
      };

      const response: ApiResponse = {
        success: true,
        data: stats,
        message: "Dashboard statistics retrieved successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      const response: ApiResponse = {
        success: false,
        error: "Failed to fetch dashboard statistics",
        message: "An error occurred while retrieving dashboard statistics",
      };
      res.status(500).json(response);
    }
  },
);

export { router as adminRouter };
