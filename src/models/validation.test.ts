import { Event, User, EmailCapture, ScrapingLog, EventStatus } from "./index";

describe("Model Exports and Types", () => {
  it("should export all models correctly", () => {
    expect(Event).toBeDefined();
    expect(User).toBeDefined();
    expect(EmailCapture).toBeDefined();
    expect(ScrapingLog).toBeDefined();
    expect(EventStatus).toBeDefined();
  });

  it("should have correct EventStatus enum values", () => {
    expect(EventStatus.NEW).toBe("new");
    expect(EventStatus.UPDATED).toBe("updated");
    expect(EventStatus.INACTIVE).toBe("inactive");
    expect(EventStatus.IMPORTED).toBe("imported");
  });

  it("should create model instances without errors", () => {
    expect(() => new Event()).not.toThrow();
    expect(() => new User()).not.toThrow();
    expect(() => new EmailCapture()).not.toThrow();
    expect(() => new ScrapingLog()).not.toThrow();
  });
});
