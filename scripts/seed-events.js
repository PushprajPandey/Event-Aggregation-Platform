const mongoose = require("mongoose");
require("dotenv").config();

// Event schema (simplified version for seeding)
const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  dateTime: { type: Date, required: true },
  venueName: { type: String, required: true },
  venueAddress: String,
  city: { type: String, default: "Sydney" },
  description: { type: String, required: true },
  categoryTags: [String],
  imageUrl: String,
  sourceWebsite: { type: String, required: true },
  originalEventUrl: { type: String, required: true },
  status: {
    type: String,
    enum: ["new", "updated", "inactive", "imported"],
    default: "imported",
  },
  lastScrapedAt: { type: Date, default: Date.now },
  importedAt: Date,
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  importNotes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Event = mongoose.model("Event", eventSchema);

const sampleEvents = [
  {
    title: "Sydney Opera House Concert",
    dateTime: new Date("2026-02-15T19:30:00Z"),
    venueName: "Sydney Opera House",
    venueAddress: "Bennelong Point, Sydney NSW 2000",
    city: "Sydney",
    description:
      "A spectacular classical music concert featuring the Sydney Symphony Orchestra.",
    categoryTags: ["music", "classical", "concert"],
    imageUrl: "https://example.com/opera-house.jpg",
    sourceWebsite: "Sydney Opera House",
    originalEventUrl: "https://sydneyoperahouse.com/events/concert",
    status: "imported",
    importedAt: new Date(),
    lastScrapedAt: new Date(),
  },
  {
    title: "Harbour Bridge Climb Experience",
    dateTime: new Date("2026-02-20T10:00:00Z"),
    venueName: "Sydney Harbour Bridge",
    venueAddress: "Sydney Harbour Bridge, Sydney NSW",
    city: "Sydney",
    description:
      "Climb the iconic Sydney Harbour Bridge and enjoy breathtaking views of the city.",
    categoryTags: ["adventure", "tourism", "outdoor"],
    imageUrl: "https://example.com/bridge-climb.jpg",
    sourceWebsite: "BridgeClimb Sydney",
    originalEventUrl: "https://bridgeclimb.com/experiences",
    status: "imported",
    importedAt: new Date(),
    lastScrapedAt: new Date(),
  },
  {
    title: "Bondi Beach Festival",
    dateTime: new Date("2026-02-25T12:00:00Z"),
    venueName: "Bondi Beach",
    venueAddress: "Bondi Beach, Sydney NSW 2026",
    city: "Sydney",
    description:
      "Annual beach festival with live music, food stalls, and beach activities.",
    categoryTags: ["festival", "beach", "music", "food"],
    imageUrl: "https://example.com/bondi-festival.jpg",
    sourceWebsite: "Bondi Events",
    originalEventUrl: "https://bondi.com/festival",
    status: "imported",
    importedAt: new Date(),
    lastScrapedAt: new Date(),
  },
  {
    title: "Royal Botanic Gardens Tour",
    dateTime: new Date("2026-03-01T09:00:00Z"),
    venueName: "Royal Botanic Gardens Sydney",
    venueAddress: "Mrs Macquaries Rd, Sydney NSW 2000",
    city: "Sydney",
    description:
      "Guided tour through the beautiful Royal Botanic Gardens with expert botanists.",
    categoryTags: ["nature", "education", "tour"],
    imageUrl: "https://example.com/botanic-gardens.jpg",
    sourceWebsite: "Royal Botanic Gardens",
    originalEventUrl: "https://botanicgardens.org.au/tours",
    status: "imported",
    importedAt: new Date(),
    lastScrapedAt: new Date(),
  },
  {
    title: "Darling Harbour Food Market",
    dateTime: new Date("2026-03-05T11:00:00Z"),
    venueName: "Darling Harbour",
    venueAddress: "Darling Harbour, Sydney NSW 2000",
    city: "Sydney",
    description:
      "Weekend food market featuring local and international cuisine.",
    categoryTags: ["food", "market", "weekend"],
    imageUrl: "https://example.com/food-market.jpg",
    sourceWebsite: "Darling Harbour Events",
    originalEventUrl: "https://darlingharbour.com/food-market",
    status: "imported",
    importedAt: new Date(),
    lastScrapedAt: new Date(),
  },
];

async function seedEvents() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing events
    await Event.deleteMany({});
    console.log("Cleared existing events");

    // Insert sample events
    const insertedEvents = await Event.insertMany(sampleEvents);
    console.log(`Inserted ${insertedEvents.length} sample events`);

    // Display the events
    insertedEvents.forEach((event, index) => {
      console.log(
        `${index + 1}. ${event.title} - ${event.dateTime.toDateString()}`,
      );
    });

    console.log("Sample events seeded successfully!");
  } catch (error) {
    console.error("Error seeding events:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

seedEvents();
