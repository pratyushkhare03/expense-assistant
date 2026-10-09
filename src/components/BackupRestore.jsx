
import { useRef, useState } from "react";
import { exportBackup, importBackup } from "../utils/backupUtils";

function BackupRestore({ onRestore }) {
  const fileRef = useRef(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    if (exporting || importing) return;

    setExporting(true);
    setMessage("");
    setStatus("");

    try {
      await exportBackup();
      setMessage("Backup export completed. Check your downloads.");
      setStatus("success");
    } catch (error) {
      setMessage(`Export failed: ${error.message}`);
      setStatus("error");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event) => {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) return;

    if (importing || exporting) {
      input.value = "";
      return;
    }

    const confirmed = window.confirm(
      "Importing a backup will replace your current expenses, income, and settings. Make sure you have exported your current data first. Continue?"
    );

    if (!confirmed) {
      input.value = "";
      return;
    }

    setImporting(true);
    setMessage("");
    setStatus("");

    try {
      await importBackup(file);
      await onRestore();
      setMessage("Backup restored successfully. Your data has been refreshed.");
      setStatus("success");
    } catch (error) {
      setMessage(`Restore failed: ${error.message}`);
      setStatus("error");
    } finally {
      setImporting(false);
      input.value = "";
    }
  };

  return (
    <section className="backup-panel">
      <div className="backup-header">
        <div>
          <span className="backup-eyebrow">DATA MANAGEMENT</span>
          <h2>Backup & Restore</h2>
          <p>
            Keep your financial records safe and move your data when needed.
          </p>
        </div>

        <div className="backup-header-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 17v3h14v-3" />
          </svg>
        </div>
      </div>

      <div className="backup-options">
        <article className="backup-option-card backup-export-card">
          <div className="backup-option-top">
            <div className="backup-option-icon export-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 16V4" />
                <path d="m7 9 5-5 5 5" />
                <path d="M5 14v5h14v-5" />
              </svg>
            </div>
            <span className="backup-option-tag">RECOMMENDED</span>
          </div>

          <h3>Export Backup</h3>
          <p>
            Save a backup of your financial data as a file that you can store
            safely or import later.
          </p>

          <ul className="backup-feature-list">
            <li>
              <span>✓</span> Save your records
            </li>
            <li>
              <span>✓</span> Keep a separate copy
            </li>
          </ul>

          <button
            type="button"
            className="backup-action-button backup-export-button"
            onClick={handleExport}
            disabled={exporting || importing}
          >
            {exporting ? (
              <>
                <span className="backup-spinner" />
                Exporting...
              </>
            ) : (
              <>
                <span>↓</span>
                Export Backup
              </>
            )}
          </button>
        </article>

        <article className="backup-option-card backup-import-card">
          <div className="backup-option-top">
            <div className="backup-option-icon import-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 15V3" />
                <path d="m7 8 5-5 5 5" />
                <path d="M5 14v6h14v-6" />
              </svg>
            </div>
            <span className="backup-option-tag import-tag">RESTORE DATA</span>
          </div>

          <h3>Import Backup</h3>
          <p>
            Restore your financial records and settings from a previously
            exported JSON backup file.
          </p>

          <ul className="backup-feature-list">
            <li>
              <span>✓</span> Recover saved records
            </li>
            <li>
              <span>✓</span> Refresh your dashboard
            </li>
          </ul>

          <button
            type="button"
            className="backup-action-button backup-import-button"
            onClick={() => fileRef.current?.click()}
            disabled={importing || exporting}
          >
            {importing ? (
              <>
                <span className="backup-spinner" />
                Restoring...
              </>
            ) : (
              <>
                <span>↑</span>
                Choose Backup File
              </>
            )}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleImport}
          />
        </article>
      </div>

      <div className="backup-safety-note">
        <span className="backup-safety-icon">!</span>
        <div>
          <strong>Important: Protect your existing data</strong>
          <p>
            Importing replaces your current expenses, income, and settings.
            Export your current data before restoring an older backup.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`backup-status ${
            status === "success"
              ? "backup-status-success"
              : "backup-status-error"
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="backup-status-icon">
            {status === "success" ? "✓" : "!"}
          </span>
          <p>{message}</p>
          <button
            type="button"
            className="backup-dismiss"
            aria-label="Dismiss message"
            onClick={() => {
              setMessage("");
              setStatus("");
            }}
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}

export default BackupRestore;

