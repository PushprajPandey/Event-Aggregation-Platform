import * as fc from "fast-check";
import {
  EventData,
  EventStatus,
  ScrapingResult,
  ScrapingError,
} from "../types";

// Generator for valid event data
export const eventDataGenerator = (): fc.Arbitrary<EventData> => {
  return fc.record({
    title: fc.string({ minLength: 1, maxLength: 200 }),
    dateTime: fc.date({
      min: new Date(),
      max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    }),
    venueName: fc.string({ minLength: 1, maxLength: 100 }),
    venueAddress: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
    city: fc.constant("Sydney"),
    description: fc.string({ minLength: 1, maxLength: 1000 }),
    categoryTags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
      minLength: 0,
      maxLength: 10,
    }),
    imageUrl: fc.option(fc.webUrl()),
    sourceWebsite: fc.webUrl(),
    originalEventUrl: fc.webUrl(),
    lastScrapedAt: fc.date({
      min: new Date(Date.now() - 24 * 60 * 60 * 1000),
      max: new Date(),
    }),
  });
};

// Generator for event status
export const eventStatusGenerator = (): fc.Arbitrary<EventStatus> => {
  return fc.constantFrom(
    EventStatus.NEW,
    EventStatus.UPDATED,
    EventStatus.INACTIVE,
    EventStatus.IMPORTED,
  );
};

// Generator for scraping errors
export const scrapingErrorGenerator = (): fc.Arbitrary<ScrapingError> => {
  return fc.record({
    message: fc.string({ minLength: 1, maxLength: 500 }),
    url: fc.option(fc.webUrl()),
    stack: fc.option(fc.string({ minLength: 1, maxLength: 1000 })),
    timestamp: fc.date({
      min: new Date(Date.now() - 24 * 60 * 60 * 1000),
      max: new Date(),
    }),
  });
};

// Generator for scraping results
export const scrapingResultGenerator = (): fc.Arbitrary<ScrapingResult> => {
  return fc.record({
    events: fc.array(eventDataGenerator(), { minLength: 0, maxLength: 50 }),
    scrapingErrors: fc.array(scrapingErrorGenerator(), {
      minLength: 0,
      maxLength: 10,
    }),
    sourceUrl: fc.webUrl(),
    scrapedAt: fc.date({
      min: new Date(Date.now() - 60 * 60 * 1000),
      max: new Date(),
    }),
  });
};

// Generator for HTML content (simplified)
export const htmlContentGenerator = (): fc.Arbitrary<string> => {
  return fc
    .string({ minLength: 10, maxLength: 10000 })
    .map(
      (content) =>
        `<html><body><div class="event">${content}</div></body></html>`,
    );
};

// Generator for email addresses
export const emailGenerator = (): fc.Arbitrary<string> => {
  return fc.emailAddress();
};

// Generator for MongoDB ObjectId-like strings
export const objectIdGenerator = (): fc.Arbitrary<string> => {
  return fc.hexaString({ minLength: 24, maxLength: 24 });
};
