import { describe, it, expect, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Dashboard Stats", () => {
  it("should return dashboard statistics", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.dashboard.stats();

    expect(stats).toBeDefined();
    expect(stats).toHaveProperty("totalOrders");
    expect(stats).toHaveProperty("totalRevenue");
    expect(stats).toHaveProperty("pendingOrders");
    expect(stats).toHaveProperty("activeReservations");
    expect(stats).toHaveProperty("totalCustomers");
    expect(stats).toHaveProperty("averageRating");
    expect(typeof stats.totalOrders).toBe("number");
    expect(typeof stats.totalRevenue).toBe("number");
  });
});

describe("Restaurant Settings", () => {
  it("should get restaurant settings", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const settings = await caller.restaurant.getSettings();
    // Settings might be undefined initially
    expect(settings === undefined || typeof settings === "object").toBe(true);
  });

  it("should update restaurant settings", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.restaurant.updateSettings({
      name: "Restaurante Teste",
      phone: "+5511999999999",
      address: "Rua Teste, 123",
      openingHours: "Segunda a Sexta: 11h às 23h",
      acceptsDelivery: true,
      acceptsReservation: true,
      deliveryFee: 500, // R$ 5.00
      minimumOrder: 2000, // R$ 20.00
      paymentMethods: "Dinheiro, Cartão, Pix",
    });

    expect(result).toEqual({ success: true });
  });
});

describe("Menu Categories", () => {
  // Limpar dados de teste criados no banco após cada teste
  afterEach(async () => {
    const { getDb } = await import("./db");
    const { menuCategories, menuItems } = await import("../drizzle/schema");
    const { like } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      // Deletar itens de categorias de teste primeiro (FK constraint)
      const testCats = await db.select({ id: menuCategories.id }).from(menuCategories).where(like(menuCategories.name, "Test_%"));
      for (const cat of testCats) {
        const { eq } = await import("drizzle-orm");
        await db.delete(menuItems).where(eq(menuItems.categoryId, cat.id));
      }
      await db.delete(menuCategories).where(like(menuCategories.name, "Test_%"));
    }
  });

  it("should list menu categories", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const categories = await caller.menuCategories.list();

    expect(Array.isArray(categories)).toBe(true);
  });

  it("should create a menu category", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const uniqueName = `Test_Category_${Date.now()}`;
    const category = await caller.menuCategories.create({
      name: uniqueName,
      description: "Categoria de teste",
      displayOrder: 99,
    });

    expect(category).toBeDefined();
    expect(category.name).toBe(uniqueName);
    expect(category.description).toBe("Categoria de teste");
  });
});

describe("Menu Items", () => {
  // Limpar dados de teste criados no banco após cada teste
  afterEach(async () => {
    const { getDb } = await import("./db");
    const { menuCategories, menuItems } = await import("../drizzle/schema");
    const { like } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      const testCats = await db.select({ id: menuCategories.id }).from(menuCategories).where(like(menuCategories.name, "Test_%"));
      for (const cat of testCats) {
        const { eq } = await import("drizzle-orm");
        await db.delete(menuItems).where(eq(menuItems.categoryId, cat.id));
      }
      await db.delete(menuCategories).where(like(menuCategories.name, "Test_%"));
    }
  });

  it("should list menu items", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const items = await caller.menuItems.list();

    expect(Array.isArray(items)).toBe(true);
  });

  it("should create a menu item", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First create a category with unique name to avoid duplicate conflict
    const uniqueCatName = `Test_Bebidas_${Date.now()}`;
    const category = await caller.menuCategories.create({
      name: uniqueCatName,
      displayOrder: 99,
    });

    // Then create an item
    const item = await caller.menuItems.create({
      categoryId: category.id,
      name: "Coca-Cola",
      description: "Lata 350ml",
      price: 500, // R$ 5.00
      preparationTime: 5,
    });

    expect(item).toBeDefined();
    expect(item.name).toBe("Coca-Cola");
    expect(item.price).toBe(500);
    expect(item.categoryId).toBe(category.id);
  });
});

describe("Orders", () => {
  it("should list orders", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const orders = await caller.orders.list();

    expect(Array.isArray(orders)).toBe(true);
  });
});

describe("Reservations", () => {
  it("should list reservations", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const reservations = await caller.reservations.list();

    expect(Array.isArray(reservations)).toBe(true);
  });
});

describe("Customers", () => {
  it("should list customers", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const customers = await caller.customers.list();

    expect(Array.isArray(customers)).toBe(true);
  });
});

describe("Feedback", () => {
  it("should list feedback", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const feedbackList = await caller.feedback.list();

    expect(Array.isArray(feedbackList)).toBe(true);
  });
});
