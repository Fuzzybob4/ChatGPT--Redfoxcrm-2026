"use client";

import { useState } from "react";
import { Upload, X, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { importCustomersFromCSV } from "@/app/(crm)/customers/import-actions";
import { useLocation } from "@/lib/location-context";

export function CSVImportDialog() {
  const { selectedLocationId } = useLocation();
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
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
      const res = await importCustomersFromCSV(csvText, selectedLocationId);
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
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="size-4" />
            Import CSV
          </Button>
        }
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Customers from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: name, email, phone, address, city, state, zip.
            Only "name" is required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-file"
              disabled={loading}
            />
            <label htmlFor="csv-file" className="cursor-pointer block">
              <div className="flex flex-col items-center gap-2">
                <Upload className="size-6 text-muted-foreground" />
                <div className="text-sm">
                  {csvText ? (
                    <span className="font-medium text-foreground">
                      CSV loaded ({csvText.split("\n").length - 1} rows)
                    </span>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">Click to upload</span>
                      <span className="text-muted-foreground"> or drag and drop</span>
                    </>
                  )}
                </div>
              </div>
            </label>
          </div>

          {/* CSV Preview */}
          {csvText && !result && (
            <div className="bg-muted p-4 rounded-lg max-h-48 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                {csvText.split("\n").slice(0, 5).join("\n")}
                {csvText.split("\n").length > 5 && "\n..."}
              </pre>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              {result.imported > 0 && (
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-start gap-2">
                  <div className="text-green-600 font-medium">✓ {result.imported} imported</div>
                </div>
              )}
              {result.failed > 0 && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
                    <span className="font-medium text-red-600">{result.failed} failed</span>
                  </div>
                  <div className="space-y-1 text-xs text-red-600">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <div key={i}>
                        Row {err.row}: {err.error}
                      </div>
                    ))}
                    {result.errors.length > 5 && (
                      <div>... and {result.errors.length - 5} more errors</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCsvText("");
                setResult(null);
              }}
              disabled={loading}
            >
              Clear
            </Button>
            <Button
              onClick={handleImport}
              disabled={!csvText || loading}
            >
              {loading ? "Importing..." : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
