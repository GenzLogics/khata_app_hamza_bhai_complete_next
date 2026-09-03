import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { customers, vendors, salesInvoices, purchaseInvoices, expenses, users, cashSales } from "@/lib/db/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { ok, unauthorized, serverError } from "@/lib/api-response";

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = request.cookies.get("access_token")?.value;
  const token = bearerToken || cookieToken;
  if (!token) throw new Error("No token");

  const { verifyAccessToken } = await import("@/lib/auth/jwt");
  const payload = await verifyAccessToken(token);
  if (!payload) throw new Error("Invalid token");

  const [user] = await getDb().select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user || !user.isActive) throw new Error("User not found");
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    const [
      totalCustomersResult,
      totalVendorsResult,
      totalSalesInvoicesResult,
      totalPurchaseInvoicesResult,
      purchaseBalanceDueResult,
      monthlyExpensesResult,
      monthlyCashSalesResult,
    ] = await Promise.all([
      getDb().select({ count: sql<number>`count(*)` }).from(customers).where(eq(customers.ownerId, user.id)),
      getDb().select({ count: sql<number>`count(*)` }).from(vendors).where(eq(vendors.ownerId, user.id)),
      getDb().select({ count: sql<number>`count(*)` }).from(salesInvoices).where(eq(salesInvoices.ownerId, user.id)),
      getDb().select({ count: sql<number>`count(*)` }).from(purchaseInvoices).where(eq(purchaseInvoices.ownerId, user.id)),
      getDb().select({ total: sql<number>`coalesce(sum(${purchaseInvoices.balanceDue}), 0)` }).from(purchaseInvoices).where(eq(purchaseInvoices.ownerId, user.id)),
      getDb().select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(and(eq(expenses.ownerId, user.id), gte(expenses.fromDate, new Date(new Date().getFullYear(), new Date().getMonth(), 1)))),
      getDb().select({ total: sql<number>`coalesce(sum(${cashSales.amount}), 0)` }).from(cashSales).where(and(eq(cashSales.ownerId, user.id), gte(cashSales.fromDate, new Date(new Date().getFullYear(), new Date().getMonth(), 1)))),
    ]);

    return ok({
      message: "Dashboard stats fetched",
      total_customers: Number(totalCustomersResult[0]?.count || 0),
      total_vendors: Number(totalVendorsResult[0]?.count || 0),
      total_sales_invoices: Number(totalSalesInvoicesResult[0]?.count || 0),
      total_purchase_invoices: Number(totalPurchaseInvoicesResult[0]?.count || 0),
      purchase_balance_due_total: Number(purchaseBalanceDueResult[0]?.total || 0),
      monthly_expenses_total: Number(monthlyExpensesResult[0]?.total || 0),
      monthly_cash_sales_total: Number(monthlyCashSalesResult[0]?.total || 0),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get dashboard error:", error);
    return serverError("Failed to fetch dashboard stats");
  }
}

