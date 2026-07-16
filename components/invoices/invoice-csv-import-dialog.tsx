"use client";

import { useState } from "react";
import { Upload, X, AlertCircle, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { importInvoicesFromCSV } from "@/app/(crm)/invoices/import-actions";

export function InvoiceCSVImportDialog() {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    headers: string[];
    rows: string[][];
  } | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      setResult(null);
      setShowPreview(false);
      
      // Parse CSV to show preview
      const lines = text.trim().split("\n");
      if (lines.length > 0) {
        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
        const rows = lines.slice(1, 6).map((line) =>
          line.split(",").map((cell) => cell.trim().replace(/"/g, ""))
        );
        setPreviewData({ headers, rows });
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvText.trim()) {
      alert("Please select a CSV file");
      return;
    }

    setLoading(true);
    try {
      const res = await importInvoicesFromCSV(csvText, "");
      setResult({
        imported: res.imported,
        failed: res.failed,
        errors: res.errors,
      });

      if (res.success && res.imported > 0) {
        setTimeout(() => {
          setCsvText("");
          setResult(null);
          setOpen(false);
        }, 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Import Invoices
          </Button>
        }
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader className="min-w-0">
          <DialogTitle>Import Invoices from CSV</DialogTitle>
          <DialogDescription className="text-pretty">
            Upload a CSV file with invoice data. Supported columns: Customer Name, Email, Phone, Billing Address, Square Invoice Number, Invoice Date, Due Date, Line-Item Description, Subtotal, Discount, Tax, Total, Amount Paid, Remaining Balance, Invoice Status, Payment Date, Transaction ID, and Notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Input */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-400" />
                <p className="text-sm font-medium">Click to select or drag and drop CSV file</p>
              </div>
            </label>
          </div>

          {/* CSV Preview Table */}
          {csvText && previewData && !result && (
            <div className="space-y-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showPreview ? "Hide" : "Show"} Preview ({csvText.split("\n").length - 1} rows)
              </button>
              {showPreview && (
                <div className="bg-muted p-3 rounded-lg max-h-48 overflow-x-auto">
                  <table className="text-xs border-collapse">
                    <thead>
                      <tr>
                        {previewData.headers.map((header, i) => (
                          <th key={i} className="border border-gray-300 px-2 py-1 text-left bg-gray-100 font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j} className="border border-gray-300 px-2 py-1 max-w-48 truncate">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              {result.imported > 0 && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-start gap-3">
                  <CheckCircle className="size-5 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-green-900">Success!</div>
                    <div className="text-sm text-green-800">{result.imported} invoice{result.imported !== 1 ? 's' : ''} imported successfully</div>
                  </div>
                </div>
              )}
              {result.failed > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <div className="flex items-start gap-3 mb-2">
                    <AlertCircle className="size-5 text-red-600 mt-0.5 shrink-0" />
                    <span className="font-semibold text-red-900">{result.failed} row{result.failed !== 1 ? 's' : ''} failed</span>
                  </div>
                  <div className="space-y-1 text-xs text-red-700 ml-8">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <div key={i}>
                        Row {err.row}: {err.error}
                      </div>
                    ))}
                    {result.errors.length > 5 && (
                      <div>... and {result.errors.length - 5} more error{result.errors.length - 5 !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            {csvText && !result && (
              <Button onClick={handleImport} disabled={loading}>
                {loading ? "Importing..." : "Import"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>
              {result ? "Close" : "Cancel"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
