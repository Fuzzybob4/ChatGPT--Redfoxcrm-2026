"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";

export interface InvoiceImportRow {
  customerName: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  squareInvoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  lineItemDescription?: string;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  amountPaid?: number;
  remainingBalance?: number;
  invoiceStatus?: string;
  paymentDate?: string;
  transactionId?: string;
  notes?: string;
}

export async function importInvoicesFromCSV(
  csvText: string,
  locationId: string
): Promise<{
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}> {
  try {
    const org = await getCurrentOrg();
    if (!org) return { success: false, imported: 0, failed: 0, errors: [{ row: 0, error: "Organization not found" }] };

    const supabase = await createClient();

    // Parse CSV text
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) {
      return { success: false, imported: 0, failed: 0, errors: [{ row: 0, error: "CSV must have header and at least one data row" }] };
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    
    // Support multiple column name variations
    const findHeader = (names: string[]) => headers.findIndex((h) => names.includes(h));
    
    const customerNameIdx = findHeader(["customer name", "customer", "name"]);
    const emailIdx = findHeader(["email"]);
    const phoneIdx = findHeader(["phone", "phone number"]);
    const billingAddressIdx = findHeader(["billing address", "address"]);
    const squareInvoiceNumberIdx = findHeader(["square invoice number", "invoice number", "square id"]);
    const invoiceDateIdx = findHeader(["invoice date", "date"]);
    const dueDateIdx = findHeader(["due date"]);
    const lineItemDescriptionIdx = findHeader(["line-item description", "description", "line item"]);
    const subtotalIdx = findHeader(["subtotal"]);
    const discountIdx = findHeader(["discount"]);
    const taxIdx = findHeader(["tax"]);
    const totalIdx = findHeader(["total", "amount"]);
    const amountPaidIdx = findHeader(["amount paid", "paid"]);
    const remainingBalanceIdx = findHeader(["remaining balance", "balance"]);
    const invoiceStatusIdx = findHeader(["invoice status", "status"]);
    const paymentDateIdx = findHeader(["payment date"]);
    const transactionIdIdx = findHeader(["square or other invoice transaction or invoice id", "transaction id", "transaction"]);
    const notesIdx = findHeader(["notes"]);

    if (customerNameIdx === -1) {
      return {
        success: false,
        imported: 0,
        failed: 0,
        errors: [{ row: 0, error: 'CSV must have a "Customer Name" column' }],
      };
    }

    const rows: InvoiceImportRow[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      
      const customerName = values[customerNameIdx]?.trim();
      if (!customerName) {
        errors.push({ row: i + 1, error: "Customer name is required" });
        continue;
      }

      // Parse numeric fields
      const parseNumber = (idx: number): number | undefined => {
        const val = values[idx];
        if (!val) return undefined;
        const num = parseFloat(val);
        return isNaN(num) ? undefined : num;
      };

      rows.push({
        customerName,
        email: values[emailIdx] || undefined,
        phone: values[phoneIdx] || undefined,
        billingAddress: values[billingAddressIdx] || undefined,
        squareInvoiceNumber: values[squareInvoiceNumberIdx] || undefined,
        invoiceDate: values[invoiceDateIdx] || undefined,
        dueDate: values[dueDateIdx] || undefined,
        lineItemDescription: values[lineItemDescriptionIdx] || undefined,
        subtotal: parseNumber(subtotalIdx),
        discount: parseNumber(discountIdx),
        tax: parseNumber(taxIdx),
        total: parseNumber(totalIdx),
        amountPaid: parseNumber(amountPaidIdx),
        remainingBalance: parseNumber(remainingBalanceIdx),
        invoiceStatus: values[invoiceStatusIdx] || undefined,
        paymentDate: values[paymentDateIdx] || undefined,
        transactionId: values[transactionIdIdx] || undefined,
        notes: values[notesIdx] || undefined,
      });
    }

    if (rows.length === 0) {
      return {
        success: false,
        imported: 0,
        failed: errors.length,
        errors,
      };
    }

    // Process invoices - for now, just store the parsed data
    // In a full implementation, you would create or update invoices in the database
    let successCount = 0;
    for (const row of rows) {
      try {
        // TODO: Create invoice in database with all fields
        // For MVP, we're just validating the data can be parsed
        successCount++;
      } catch (err) {
        errors.push({ row: rows.indexOf(row) + 2, error: (err instanceof Error ? err.message : "Unknown error") });
      }
    }

    revalidatePath("/invoices");

    return {
      success: errors.length === 0,
      imported: successCount,
      failed: errors.length,
      errors,
    };
  } catch (error) {
    console.error("CSV import error:", error);
    return {
      success: false,
      imported: 0,
      failed: 0,
      errors: [{ row: 0, error: error instanceof Error ? error.message : "Unknown error occurred" }],
    };
  }
}
