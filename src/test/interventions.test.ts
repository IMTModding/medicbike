import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(),
      })),
    })),
  },
}));

describe("Intervention data validation", () => {
  describe("Urgency levels", () => {
    it("should validate urgency enum values", () => {
      const validUrgencies = ["low", "medium", "high"];
      const isValidUrgency = (urgency: string) => validUrgencies.includes(urgency);
      
      expect(isValidUrgency("high")).toBe(true);
      expect(isValidUrgency("medium")).toBe(true);
      expect(isValidUrgency("low")).toBe(true);
      expect(isValidUrgency("critical")).toBe(false);
      expect(isValidUrgency("")).toBe(false);
    });
  });

  describe("Intervention status", () => {
    it("should validate status enum values", () => {
      const validStatuses = ["active", "completed"];
      const isValidStatus = (status: string) => validStatuses.includes(status);
      
      expect(isValidStatus("active")).toBe(true);
      expect(isValidStatus("completed")).toBe(true);
      expect(isValidStatus("pending")).toBe(false);
      expect(isValidStatus("")).toBe(false);
    });
  });

  describe("Response status", () => {
    it("should validate response enum values", () => {
      const validResponses = ["available", "unavailable"];
      const isValidResponse = (response: string) => validResponses.includes(response);
      
      expect(isValidResponse("available")).toBe(true);
      expect(isValidResponse("unavailable")).toBe(true);
      expect(isValidResponse("maybe")).toBe(false);
    });
  });
});

describe("Location validation", () => {
  it("should validate latitude range", () => {
    const isValidLatitude = (lat: number) => lat >= -90 && lat <= 90;
    
    expect(isValidLatitude(48.8566)).toBe(true); // Paris
    expect(isValidLatitude(0)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLatitude(-91)).toBe(false);
  });

  it("should validate longitude range", () => {
    const isValidLongitude = (lng: number) => lng >= -180 && lng <= 180;
    
    expect(isValidLongitude(2.3522)).toBe(true); // Paris
    expect(isValidLongitude(0)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(181)).toBe(false);
    expect(isValidLongitude(-181)).toBe(false);
  });
});

describe("Title and description validation", () => {
  it("should require non-empty title", () => {
    const isValidTitle = (title: string) => title.trim().length > 0;
    
    expect(isValidTitle("Intervention urgente")).toBe(true);
    expect(isValidTitle("A")).toBe(true);
    expect(isValidTitle("")).toBe(false);
    expect(isValidTitle("   ")).toBe(false);
  });

  it("should allow empty description", () => {
    const isValidDescription = (desc: string | undefined | null) => true;
    
    expect(isValidDescription("Description détaillée")).toBe(true);
    expect(isValidDescription("")).toBe(true);
    expect(isValidDescription(undefined)).toBe(true);
    expect(isValidDescription(null)).toBe(true);
  });

  it("should limit title length", () => {
    const isValidTitleLength = (title: string) => title.length <= 200;
    
    expect(isValidTitleLength("Titre court")).toBe(true);
    expect(isValidTitleLength("A".repeat(200))).toBe(true);
    expect(isValidTitleLength("A".repeat(201))).toBe(false);
  });
});

describe("Date filtering", () => {
  it("should validate date range", () => {
    const isValidDateRange = (start: Date, end: Date) => start <= end;
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    expect(isValidDateRange(yesterday, today)).toBe(true);
    expect(isValidDateRange(today, tomorrow)).toBe(true);
    expect(isValidDateRange(today, today)).toBe(true);
    expect(isValidDateRange(tomorrow, yesterday)).toBe(false);
  });
});
