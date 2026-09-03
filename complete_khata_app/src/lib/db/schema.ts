import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  numeric,
  timestamp,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    hashedPassword: varchar("hashed_password", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("idx_users_email").on(table.email),
  })
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerPhoneUnique: unique("uq_customers_owner_id_phone").on(table.ownerId, table.phone),
    ownerIdx: index("idx_customers_owner_id").on(table.ownerId),
    phoneIdx: index("idx_customers_phone").on(table.phone),
  })
);

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    currentBalance: numeric("current_balance", { precision: 15, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerPhoneUnique: unique("uq_vendors_owner_id_phone").on(table.ownerId, table.phone),
    ownerIdx: index("idx_vendors_owner_id").on(table.ownerId),
    phoneIdx: index("idx_vendors_phone").on(table.phone),
  })
);

export const vendorItems = pgTable(
  "vendor_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    itemName: varchar("item_name", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    vendorItemUnique: unique("uq_vendor_items_vendor_id_item_name").on(table.vendorId, table.itemName),
    vendorIdx: index("idx_vendor_items_vendor_id").on(table.vendorId),
  })
);

export const salesInvoices = pgTable(
  "sales_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    saleType: varchar("sale_type", { length: 20 }).notNull(),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).notNull().default("0"),
    balanceDue: numeric("balance_due", { precision: 15, scale: 2 }).notNull(),
    notes: text("notes"),
    invoiceDate: timestamp("invoice_date", { withTimezone: false }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: false }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("idx_sales_invoices_owner_id").on(table.ownerId),
    invoiceNumberIdx: index("idx_sales_invoices_invoice_number").on(table.invoiceNumber),
  })
);

export const salesInvoiceItems = pgTable(
  "sales_invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salesInvoiceId: uuid("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    description: varchar("description", { length: 500 }).notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
    unitType: varchar("unit_type", { length: 20 }).notNull().default("kg"),
    weightPerUnit: numeric("weight_per_unit", { precision: 10, scale: 3 }),
    totalWeight: numeric("total_weight", { precision: 10, scale: 3 }),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
  }
);

export const salesInvoicePayments = pgTable(
  "sales_invoice_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salesInvoiceId: uuid("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    paymentDate: timestamp("payment_date", { withTimezone: false }).notNull(),
    notes: varchar("notes", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    invoiceIdx: index("idx_sales_invoice_payments_invoice_id").on(table.salesInvoiceId),
  })
);

export const purchaseInvoices = pgTable(
  "purchase_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id),
    purchaseType: varchar("purchase_type", { length: 20 }).notNull(),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).notNull().default("0"),
    balanceDue: numeric("balance_due", { precision: 15, scale: 2 }).notNull(),
    notes: text("notes"),
    invoiceDate: timestamp("invoice_date", { withTimezone: false }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: false }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("idx_purchase_invoices_owner_id").on(table.ownerId),
    invoiceNumberIdx: index("idx_purchase_invoices_invoice_number").on(table.invoiceNumber),
  })
);

export const purchaseInvoiceItems = pgTable(
  "purchase_invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseInvoiceId: uuid("purchase_invoice_id")
      .notNull()
      .references(() => purchaseInvoices.id, { onDelete: "cascade" }),
    description: varchar("description", { length: 500 }).notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
    unitType: varchar("unit_type", { length: 20 }).notNull().default("bag"),
    weightPerUnit: numeric("weight_per_unit", { precision: 10, scale: 3 }),
    totalWeight: numeric("total_weight", { precision: 10, scale: 3 }),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
  }
);

export const purchaseInvoicePayments = pgTable(
  "purchase_invoice_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseInvoiceId: uuid("purchase_invoice_id")
      .notNull()
      .references(() => purchaseInvoices.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    paymentDate: timestamp("payment_date", { withTimezone: false }).notNull(),
    notes: varchar("notes", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    invoiceIdx: index("idx_purchase_invoice_payments_invoice_id").on(table.purchaseInvoiceId),
  })
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    fromDate: timestamp("from_date", { withTimezone: false }).notNull(),
    toDate: timestamp("to_date", { withTimezone: false }).notNull(),
    heading: varchar("heading", { length: 100 }).notNull(),
    subHeading: varchar("sub_heading", { length: 100 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("idx_expenses_owner_id").on(table.ownerId),
    fromDateIdx: index("idx_expenses_from_date").on(table.fromDate),
    toDateIdx: index("idx_expenses_to_date").on(table.toDate),
  })
);

export const cashSales = pgTable(
  "cash_sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    fromDate: timestamp("from_date", { withTimezone: false }).notNull(),
    toDate: timestamp("to_date", { withTimezone: false }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("idx_cash_sales_owner_id").on(table.ownerId),
    fromDateIdx: index("idx_cash_sales_from_date").on(table.fromDate),
    toDateIdx: index("idx_cash_sales_to_date").on(table.toDate),
  })
);

export const investors = pgTable(
  "investors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    investmentAmount: numeric("investment_amount", { precision: 15, scale: 2 }).notNull(),
    investmentDate: timestamp("investment_date", { withTimezone: false }),
    investorName: varchar("investor_name", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("idx_investors_owner_id").on(table.ownerId),
  })
);

export const stockItems = pgTable(
  "stock_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemName: varchar("item_name", { length: 255 }).notNull(),
    quantityKg: numeric("quantity_kg", { precision: 15, scale: 3 }).notNull().default("0"),
    bagWeightKg: numeric("bag_weight_kg", { precision: 10, scale: 3 }).notNull().default("50"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerItemUnique: unique("uq_stock_items_owner_id_item_name").on(table.ownerId, table.itemName),
    ownerIdx: index("idx_stock_items_owner_id").on(table.ownerId),
    itemNameIdx: index("idx_stock_items_item_name").on(table.itemName),
  })
);

export const dbRelations = {
  users: relations(users, ({ many }) => ({
    customers: many(customers),
    vendors: many(vendors),
    salesInvoices: many(salesInvoices),
    purchaseInvoices: many(purchaseInvoices),
    expenses: many(expenses),
    cashSales: many(cashSales),
    investors: many(investors),
    stockItems: many(stockItems),
  })),
  customers: relations(customers, ({ one, many }) => ({
    owner: one(users, { fields: [customers.ownerId], references: [users.id] }),
    salesInvoices: many(salesInvoices),
  })),
  vendors: relations(vendors, ({ one, many }) => ({
    owner: one(users, { fields: [vendors.ownerId], references: [users.id] }),
    vendorItems: many(vendorItems),
    purchaseInvoices: many(purchaseInvoices),
  })),
  vendorItems: relations(vendorItems, ({ one }) => ({
    vendor: one(vendors, { fields: [vendorItems.vendorId], references: [vendors.id] }),
  })),
  salesInvoices: relations(salesInvoices, ({ one, many }) => ({
    owner: one(users, { fields: [salesInvoices.ownerId], references: [users.id] }),
    customer: one(customers, { fields: [salesInvoices.customerId], references: [customers.id] }),
    items: many(salesInvoiceItems),
    payments: many(salesInvoicePayments),
  })),
  salesInvoiceItems: relations(salesInvoiceItems, ({ one }) => ({
    salesInvoice: one(salesInvoices, { fields: [salesInvoiceItems.salesInvoiceId], references: [salesInvoices.id] }),
  })),
  salesInvoicePayments: relations(salesInvoicePayments, ({ one }) => ({
    salesInvoice: one(salesInvoices, { fields: [salesInvoicePayments.salesInvoiceId], references: [salesInvoices.id] }),
  })),
  purchaseInvoices: relations(purchaseInvoices, ({ one, many }) => ({
    owner: one(users, { fields: [purchaseInvoices.ownerId], references: [users.id] }),
    vendor: one(vendors, { fields: [purchaseInvoices.vendorId], references: [vendors.id] }),
    items: many(purchaseInvoiceItems),
    payments: many(purchaseInvoicePayments),
  })),
  purchaseInvoiceItems: relations(purchaseInvoiceItems, ({ one }) => ({
    purchaseInvoice: one(purchaseInvoices, { fields: [purchaseInvoiceItems.purchaseInvoiceId], references: [purchaseInvoices.id] }),
  })),
  purchaseInvoicePayments: relations(purchaseInvoicePayments, ({ one }) => ({
    purchaseInvoice: one(purchaseInvoices, { fields: [purchaseInvoicePayments.purchaseInvoiceId], references: [purchaseInvoices.id] }),
  })),
  expenses: relations(expenses, ({ one }) => ({
    owner: one(users, { fields: [expenses.ownerId], references: [users.id] }),
  })),
  cashSales: relations(cashSales, ({ one }) => ({
    owner: one(users, { fields: [cashSales.ownerId], references: [users.id] }),
  })),
  investors: relations(investors, ({ one }) => ({
    owner: one(users, { fields: [investors.ownerId], references: [users.id] }),
  })),
  stockItems: relations(stockItems, ({ one }) => ({
    owner: one(users, { fields: [stockItems.ownerId], references: [users.id] }),
  })),
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type VendorItem = typeof vendorItems.$inferSelect;
export type NewVendorItem = typeof vendorItems.$inferInsert;
export type SalesInvoice = typeof salesInvoices.$inferSelect;
export type NewSalesInvoice = typeof salesInvoices.$inferInsert;
export type SalesInvoiceItem = typeof salesInvoiceItems.$inferSelect;
export type NewSalesInvoiceItem = typeof salesInvoiceItems.$inferInsert;
export type SalesInvoicePayment = typeof salesInvoicePayments.$inferSelect;
export type NewSalesInvoicePayment = typeof salesInvoicePayments.$inferInsert;
export type PurchaseInvoice = typeof purchaseInvoices.$inferSelect;
export type NewPurchaseInvoice = typeof purchaseInvoices.$inferInsert;
export type PurchaseInvoiceItem = typeof purchaseInvoiceItems.$inferSelect;
export type NewPurchaseInvoiceItem = typeof purchaseInvoiceItems.$inferInsert;
export type PurchaseInvoicePayment = typeof purchaseInvoicePayments.$inferSelect;
export type NewPurchaseInvoicePayment = typeof purchaseInvoicePayments.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type CashSale = typeof cashSales.$inferSelect;
export type NewCashSale = typeof cashSales.$inferInsert;
export type Investor = typeof investors.$inferSelect;
export type NewInvestor = typeof investors.$inferInsert;
export type StockItem = typeof stockItems.$inferSelect;
export type NewStockItem = typeof stockItems.$inferInsert;
