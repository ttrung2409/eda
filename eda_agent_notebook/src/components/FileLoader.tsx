import { useRef, useState } from "react";

const SERVER = "http://localhost:3001";

const STYLES = {
  container: {
    background: "#ffffff",
    borderBottom: "1px solid #e0e0e0",
    padding: "12px 24px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap" as const,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  title: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#1a1a1a",
    marginRight: "4px",
    whiteSpace: "nowrap" as const,
    letterSpacing: "-0.2px",
  },
  fileButton: {
    background: "#f0f0f0",
    border: "1px solid #d0d0d0",
    borderRadius: "6px",
    color: "#333",
    padding: "6px 14px",
    fontSize: "13px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  fileName: {
    flex: "1 1 200px",
    fontSize: "13px",
    color: "#999",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  fileNameReady: {
    color: "#1a73e8",
  },
  button: {
    background: "#1a73e8",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    padding: "6px 18px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  buttonDisabled: {
    background: "#e0e0e0",
    border: "none",
    borderRadius: "6px",
    color: "#aaa",
    padding: "6px 18px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "not-allowed",
    whiteSpace: "nowrap" as const,
  },
  uploadError: {
    fontSize: "12px",
    color: "#d93025",
    whiteSpace: "nowrap" as const,
  },
};

type Props = {
  onLoad: (filePath: string) => void;
  disabled: boolean;
};

export function FileLoader({ onLoad, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadError(null);
  }

  async function handleLoad() {
    if (!selectedFile || uploading || disabled) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(`${SERVER}/upload`, {
        method: "POST",
        body: selectedFile,
        headers: { "Content-Type": "text/csv" },
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { filePath } = (await res.json()) as { filePath: string };
      onLoad(filePath);
    } catch (e) {
      setUploadError(String(e));
    } finally {
      setUploading(false);
    }
  }

  const canLoad = !disabled && !uploading && selectedFile !== null;
  const label = uploading
    ? "Uploading..."
    : selectedFile
    ? selectedFile.name
    : "No file chosen";

  return (
    <div style={STYLES.container}>
      <span style={STYLES.title}>EDA Notebook</span>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      {/* Visible file picker button */}
      <button
        style={STYLES.fileButton}
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
      >
        Choose CSV
      </button>
      <span style={{ ...STYLES.fileName, ...(selectedFile ? STYLES.fileNameReady : {}) }}>
        {label}
      </span>

      <button
        style={canLoad ? STYLES.button : STYLES.buttonDisabled}
        onClick={handleLoad}
        disabled={!canLoad}
      >
        Load
      </button>

      {uploadError && <span style={STYLES.uploadError}>{uploadError}</span>}
    </div>
  );
}
