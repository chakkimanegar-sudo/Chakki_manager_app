import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shopsTable = pgTable("shops", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull().default("Meri Chakki"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shopDataTable = pgTable("shop_data", {
  id: uuid("id").primaryKey().defaultRandom(),
  shopId: uuid("shop_id")
    .notNull()
    .unique()
    .references(() => shopsTable.id, { onDelete: "cascade" }),
  records: jsonb("records").$type<unknown[]>().default([]),
  customers: jsonb("customers").$type<unknown[]>().default([]),
  transactions: jsonb("transactions").$type<unknown[]>().default([]),
  settings: jsonb("settings").$type<Record<string, number>>().default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertShopSchema = createInsertSchema(shopsTable).omit({ id: true, createdAt: true });
export type InsertShop = z.infer<typeof insertShopSchema>;
export type Shop = typeof shopsTable.$inferSelect;
export type ShopData = typeof shopDataTable.$inferSelect;