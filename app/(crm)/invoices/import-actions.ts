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

    // Process invoices - create or update in database
    let successCount = 0;
    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      try {
        // Find or create customer by name
        const { data: existingCustomers, error: customerFetchError } = await supabase
          .from('customers')
          .select('id')
          .eq('name', row.customerName)
          .eq('org_id', org.id)
          .single();

        let customerId: string;
        if (existingCustomers) {
          customerId = existingCustomers.id;
        } else {
          // Create new customer
          const { data: newCustomer, error: customerCreateError } = await supabase
            .from('customers')
            .insert({
              org_id: org.id,
              name: row.customerName,
              email: row.email || '',
              phone: row.phone || '',
              billing_address: row.billingAddress || '',
            })
            .select('id')
            .single();

          if (customerCreateError || !newCustomer) {
            errors.push({ row: idx + 2, error: `Failed to create customer: ${customerCreateError?.message || 'Unknown error'}` });
            continue;
          }
          customerId = newCustomer.id;
        }

        // Map status string to valid status
        const statusMap: Record<string, string> = {
          'draft': 'Draft',
          'sent': 'Sent',
          'paid': 'Paid',
          'overdue': 'Overdue',
        };
        const status = statusMap[row.invoiceStatus?.toLowerCase() || ''] || 'Draft';

        // Create invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            org_id: org.id,
            customer_id: customerId,
            invoice_number: row.squareInvoiceNumber || `INV-${Date.now()}`,
            issued_date: row.invoiceDate ? new Date(row.invoiceDate).toISOString() : new Date().toISOString(),
            due_date: row.dueDate ? new Date(row.dueDate).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: status,
            subtotal_cents: Math.round((row.subtotal || 0) * 100),
            discount_cents: Math.round((row.discount || 0) * 100),
            tax_cents: Math.round((row.tax || 0) * 100),
            notes: row.notes || '',
            payment_date: row.paymentDate ? new Date(row.paymentDate).toISOString() : null,
            transaction_id: row.transactionId || '',
          })
          .select('id')
          .single();

        if (invoiceError || !invoice) {
          errors.push({ row: idx + 2, error: `Failed to create invoice: ${invoiceError?.message || 'Unknown error'}` });
          continue;
        }

        // Create line item if description exists
        if (row.lineItemDescription) {
          const { error: lineItemError } = await supabase
            .from('invoice_line_items')
            .insert({
              org_id: org.id,
              invoice_id: invoice.id,
              description: row.lineItemDescription,
              quantity: 1,
              unit_price_cents: Math.round((row.total || 0) * 100),
              order: 0,
            });

          if (lineItemError) {
            console.error('Warning: Failed to create line item:', lineItemError);
            // Don't count this as a failure - invoice was created successfully
          }
        }

        successCount++;
      } catch (err) {
        errors.push({ row: idx + 2, error: (err instanceof Error ? err.message : "Unknown error") });
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
