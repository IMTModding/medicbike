import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          single: vi.fn(),
        })),
      })),
      insert: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    })),
    rpc: vi.fn(),
  },
}));

describe("Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Email validation", () => {
    it("should validate correct email format", () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test("test@example.com")).toBe(true);
      expect(emailRegex.test("user.name@domain.fr")).toBe(true);
      expect(emailRegex.test("admin@medicbike.fr")).toBe(true);
    });

    it("should reject invalid email format", () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test("invalid")).toBe(false);
      expect(emailRegex.test("@domain.com")).toBe(false);
      expect(emailRegex.test("user@")).toBe(false);
      expect(emailRegex.test("")).toBe(false);
    });
  });

  describe("Password validation", () => {
    it("should require minimum 6 characters", () => {
      const isValidPassword = (password: string) => password.length >= 6;
      expect(isValidPassword("123456")).toBe(true);
      expect(isValidPassword("password123")).toBe(true);
      expect(isValidPassword("12345")).toBe(false);
      expect(isValidPassword("")).toBe(false);
    });
  });

  describe("Invite code validation", () => {
    it("should validate 6-character alphanumeric codes", () => {
      const isValidInviteCode = (code: string) => /^[A-Z0-9]{6}$/i.test(code);
      expect(isValidInviteCode("ABC123")).toBe(true);
      expect(isValidInviteCode("MEDIC1")).toBe(true);
      expect(isValidInviteCode("abc123")).toBe(true);
      expect(isValidInviteCode("12345")).toBe(false);
      expect(isValidInviteCode("ABCDEFG")).toBe(false);
      expect(isValidInviteCode("ABC-12")).toBe(false);
    });
  });

  describe("Phone number validation", () => {
    it("should validate French phone numbers", () => {
      const isValidPhone = (phone: string) => {
        const cleaned = phone.replace(/\s/g, "");
        return /^(\+33|0)[1-9](\d{8})$/.test(cleaned);
      };
      expect(isValidPhone("0612345678")).toBe(true);
      expect(isValidPhone("06 12 34 56 78")).toBe(true);
      expect(isValidPhone("+33612345678")).toBe(true);
      expect(isValidPhone("123")).toBe(false);
      expect(isValidPhone("")).toBe(false);
    });
  });
});

describe("Role-based access control", () => {
  it("should identify admin role correctly", () => {
    const isAdmin = (role: string | null) => role === "admin";
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("employee")).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("should identify employee role correctly", () => {
    const isEmployee = (role: string | null) => role === "employee";
    expect(isEmployee("employee")).toBe(true);
    expect(isEmployee("admin")).toBe(false);
    expect(isEmployee(null)).toBe(false);
  });
});
