import { EventData } from "../types";

/**
 * Utility class for normalizing and cleaning scraped event data
 */
export class DataNormalizer {
  /**
   * Normalize event data by cleaning and standardizing fields
   */
  static normalizeEventData(eventData: EventData): EventData {
    return {
      ...eventData,
      title: this.normalizeTitle(eventData.title),
      venueName: this.normalizeVenueName(eventData.venueName),
      venueAddress: eventData.venueAddress
        ? this.normalizeAddress(eventData.venueAddress)
        : undefined,
      city: this.normalizeCity(eventData.city),
      description: this.normalizeDescription(eventData.description),
      categoryTags: this.normalizeCategoryTags(eventData.categoryTags),
      originalEventUrl: this.normalizeUrl(eventData.originalEventUrl),
      imageUrl: eventData.imageUrl
        ? this.normalizeUrl(eventData.imageUrl)
        : undefined,
    };
  }

  /**
   * Normalize event title
   */
  private static normalizeTitle(title: string): string {
    return title
      .trim()
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .replace(/[^\w\s\-.,!?()&]/g, "") // Remove special characters except common punctuation
      .substring(0, 200); // Limit length
  }

  /**
   * Normalize venue name
   */
  private static normalizeVenueName(venueName: string): string {
    return venueName
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s\-.,&]/g, "")
      .substring(0, 100);
  }

  /**
   * Normalize venue address
   */
  private static normalizeAddress(address: string): string {
    return address
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s\-.,#/]/g, "")
      .substring(0, 200);
  }

  /**
   * Normalize city name
   */
  private static normalizeCity(city: string): string {
    const normalized = city
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s\-]/g, "");

    // Default to Sydney if empty or invalid
    return normalized || "Sydney";
  }

  /**
   * Normalize description
   */
  private static normalizeDescription(description: string): string {
    return description.trim().replace(/\s+/g, " ").substring(0, 1000); // Limit description length
  }

  /**
   * Normalize category tags
   */
  private static normalizeCategoryTags(tags: string[]): string[] {
    if (!Array.isArray(tags)) {
      return [];
    }

    return tags
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0 && tag.length <= 50)
      .filter((tag, index, array) => array.indexOf(tag) === index) // Remove duplicates
      .slice(0, 10); // Limit number of tags
  }

  /**
   * Normalize URL
   */
  private static normalizeUrl(url: string): string {
    try {
      const normalizedUrl = url.trim();
      // Validate URL format
      new URL(normalizedUrl);
      return normalizedUrl;
    } catch {
      return url.trim();
    }
  }

  /**
   * Clean HTML content from text
   */
  static cleanHtmlContent(content: string): string {
    return content
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/&nbsp;/g, " ") // Replace HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Extract and normalize date from various formats
   */
  static normalizeDateString(dateStr: string): string {
    return dateStr
      .trim()
      .replace(/\s+/g, " ")
      .replace(/(\d{1,2})(st|nd|rd|th)/gi, "$1") // Remove ordinal suffixes
      .replace(
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/gi,
        (match) => {
          const months: { [key: string]: string } = {
            jan: "January",
            feb: "February",
            mar: "March",
            apr: "April",
            may: "May",
            jun: "June",
            jul: "July",
            aug: "August",
            sep: "September",
            oct: "October",
            nov: "November",
            dec: "December",
          };
          return months[match.toLowerCase()] || match;
        },
      );
  }

  /**
   * Validate normalized event data
   */
  static validateNormalizedData(eventData: EventData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required field validation
    if (!eventData.title || eventData.title.length === 0) {
      errors.push("Title is required");
    }

    if (!eventData.dateTime || isNaN(eventData.dateTime.getTime())) {
      errors.push("Valid dateTime is required");
    }

    if (!eventData.venueName || eventData.venueName.length === 0) {
      errors.push("Venue name is required");
    }

    if (!eventData.description || eventData.description.length === 0) {
      errors.push("Description is required");
    }

    if (!eventData.sourceWebsite || eventData.sourceWebsite.length === 0) {
      errors.push("Source website is required");
    }

    if (
      !eventData.originalEventUrl ||
      eventData.originalEventUrl.length === 0
    ) {
      errors.push("Original event URL is required");
    }

    if (!eventData.city || eventData.city.length === 0) {
      errors.push("City is required");
    }

    // URL validation
    if (eventData.originalEventUrl) {
      try {
        new URL(eventData.originalEventUrl);
      } catch {
        errors.push("Original event URL must be a valid URL");
      }
    }

    if (eventData.imageUrl) {
      try {
        new URL(eventData.imageUrl);
      } catch {
        errors.push("Image URL must be a valid URL");
      }
    }

    // Date validation
    if (eventData.dateTime) {
      const now = new Date();
      const oneYearFromNow = new Date(
        now.getFullYear() + 1,
        now.getMonth(),
        now.getDate(),
      );

      if (eventData.dateTime > oneYearFromNow) {
        errors.push("Event date cannot be more than one year in the future");
      }
    }

    // Array validation
    if (!Array.isArray(eventData.categoryTags)) {
      errors.push("Category tags must be an array");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
