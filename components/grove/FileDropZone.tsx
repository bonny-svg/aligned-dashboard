"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { detectFileType, GroveFileType } from "@/lib/grove-parsers";

export interface UploadedFiles {
  rentRoll?: { name: string; buffer: ArrayBuffer };
  availability?: { name: string; buffer: ArrayBuffer };
  residentBalances?: { name: string; buffer: ArrayBuffer };
}

interface FileDropZoneProps {
  onFilesReady: (files: UploadedFiles) => void;
  uploaded: UploadedFiles;
}

const LABELS: Record<Exclude<GroveFileType, "unknown">, string> = {
  rentRoll: "Rent Roll Detail",
  availability: "Availability",
  residentBalances: "Resident Balances",
};

export default function FileDropZone({ onFilesReady, uploaded }: FileDropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setErrorMsg(null);
      const files = Array.from(fileList);
      const next: UploadedFiles = { ...uploaded };

      for (const f of files) {
        const kind = detectFileType(f.name);
        if (kind === "unknown") {
          setErrorMsg(`Could not identify file type for "${f.name}". Include "rent roll", "availability", or "balances" in filename.`);
          continue;
        }
        const buffer = await f.arrayBuffer();
        next[kind] = { name: f.name, buffer };
      }
      onFilesReady(next);
    },
    [uploaded, onFilesReady]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
  };

  const slots: Exclude<GroveFileType, "unknown">[] = ["rentRoll", "availability", "residentBalances"];

  return (
    <div
      className={`rounded-xl border-2 border-dashed transition-colors p-6 ${
        dragActive
          ? "border-[color:var(--grove-blue)] bg-[color:var(--grove-blue)]/5"
          : "border-[color:var(--grove-border)] bg-[color:var(--grove-card)]"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[color:var(--grove-blue)]/15 flex items-center justify-center">
            <Upload className="h-5 w-5 text-[color:var(--grove-blue)]" />
          </div>
          <div>
            <div className="font-semibold text-[color:var(--grove-text)]">Upload OneSite exports</div>
            <div className="text-xs text-[color:var(--grove-muted)]">
              Drop 3 .xls files here — we auto-detect by filename
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--grove-border)] hover:bg-[color:var(--grove-card-hover)] text-[color:var(--grove-text)]"
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xls,.xlsx"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {slots.map((slot) => {
          const file = uploaded[slot];
          const filled = !!file;
          return (
            <div
              key={slot}
              className={`rounded-lg border p-3 flex items-center gap-3 ${
                filled
                  ? "border-[color:var(--grove-green)]/30 bg-[color:var(--grove-green)]/5"
                  : "border-[color:var(--grove-border)]"
              }`}
            >
              <div
                className={`h-8 w-8 rounded-md flex items-center justify-center ${
                  filled ? "bg-[color:var(--grove-green)]/20 text-[color:var(--grove-green)]" : "bg-white/5 text-[color:var(--grove-muted)]"
                }`}
              >
                {filled ? <Check className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[color:var(--grove-text)]">{LABELS[slot]}</div>
                <div className="text-[11px] text-[color:var(--grove-muted)] truncate">
                  {filled ? file!.name : "Not uploaded"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {errorMsg && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[color:var(--grove-red)]">
          <AlertCircle className="h-4 w-4" />
          {errorMsg}
        </div>
      )}
    </div>
  );
}
