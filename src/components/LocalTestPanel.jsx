
import { useState } from "react";
import { parseWithBackend } from "../services/aiService";
import { parserTestCases } from "../utils/parserTestCases";

function LocalTestPanel() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const handleTest = async () => {
    if (!input.trim() || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await parseWithBackend(input);
      setResult(response);
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const runAllTests = async () => {
    if (loading) return;

    setLoading(true);
    setTestResults([]);
    setResult(null);

    const results = [];

    try {
      for (const test of parserTestCases) {
        try {
          const response = await parseWithBackend(test.input);
          const data = response.data;

          const passed =
            response.success &&
            data?.type === "expense" &&
            data?.amount === test.expectedAmount &&
            data?.category === test.expectedCategory;

          results.push({
            ...test,
            actualAmount: data?.amount,
            actualCategory: data?.category,
            passed,
            error: response.success
              ? undefined
              : response.error || "Parser returned an unsuccessful response",
          });
        } catch (error) {
          results.push({
            ...test,
            passed: false,
            error: error.message,
          });
        }

        // Show results progressively as tests finish.
        setTestResults([...results]);
      }
    } finally {
      setLoading(false);
    }
  };

  const passedCount = testResults.filter(
    (test) => test.passed
  ).length;

  const failedCount = testResults.length - passedCount;

  return (
    <section className="parser-panel">
      <div className="parser-header">
        <div>
          <span className="parser-eyebrow">DEVELOPER WORKSPACE</span>
          <h2>Parser Lab</h2>
          <p className="parser-description">
            Test Hindi and English commands and inspect the parser output.
          </p>
        </div>

        <div className="parser-icon" aria-hidden="true">
          {"</>"}
        </div>
      </div>

      <div className="parser-input-card">
        <label htmlFor="parser-input">Test your command</label>

        <textarea
          id="parser-input"
          className="parser-textarea"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.ctrlKey || event.metaKey)
            ) {
              event.preventDefault();
              handleTest();
            }
          }}
          placeholder="जैसे: मैंने चाय पर पचास रुपये खर्च किए"
          rows={3}
        />

        <div className="parser-input-footer">
          <span>Hindi / English supported</span>
          <span>Ctrl + Enter to test</span>
        </div>

        <div className="parser-actions">
          <button
            type="button"
            className="parser-primary-button"
            onClick={handleTest}
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <>
                <span className="parser-spinner" />
                Processing...
              </>
            ) : (
              <>
                <span aria-hidden="true">▶</span>
                Test Parse
              </>
            )}
          </button>

          <button
            type="button"
            className="parser-secondary-button"
            onClick={runAllTests}
            disabled={loading}
          >
            <span aria-hidden="true">⚡</span>
            {loading ? "Running Tests..." : "Run All Tests"}
          </button>
        </div>
      </div>

      {result && (
        <div className="parser-output-card">
          <div className="parser-result-heading">
            <div>
              <span className="parser-eyebrow">SINGLE TEST</span>
              <h3>Parser Response</h3>
            </div>

            <span
              className={`parser-badge ${
                result.success ? "parser-badge-success" : "parser-badge-error"
              }`}
            >
              {result.success ? "Success" : "Failed"}
            </span>
          </div>

          <button
            type="button"
            className="parser-json-toggle"
            onClick={() => setShowJson((previous) => !previous)}
          >
            {showJson ? "Hide JSON" : "View JSON"}
            <span aria-hidden="true">{showJson ? "−" : "+"}</span>
          </button>

          {showJson && (
            <pre className="parser-json">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}

          {result.data && (
            <div className="parser-data-grid">
              <div className="parser-data-item">
                <span>Detected type</span>
                <strong>{result.data.type || "N/A"}</strong>
              </div>

              <div className="parser-data-item">
                <span>Amount</span>
                <strong>
                  {typeof result.data.amount === "number"
                    ? `₹${result.data.amount.toLocaleString("en-IN")}`
                    : "N/A"}
                </strong>
              </div>

              <div className="parser-data-item">
                <span>Category / Source</span>
                <strong>
                  {result.data.category || result.data.source || "N/A"}
                </strong>
              </div>

              <div className="parser-data-item">
                <span>Intent</span>
                <strong>{result.data.intent || "N/A"}</strong>
              </div>
            </div>
          )}

          {result.error && (
            <p className="parser-error-text">{result.error}</p>
          )}
        </div>
      )}

      {testResults.length > 0 && (
        <div className="parser-output-card">
          <div className="parser-result-heading">
            <div>
              <span className="parser-eyebrow">AUTOMATED CHECKS</span>
              <h3>Test Results</h3>
            </div>

            <span className="parser-total-badge">
              {testResults.length} tests
            </span>
          </div>

          <div className="parser-stats">
            <div className="parser-stat">
              <span>Passed</span>
              <strong className="parser-pass-text">
                {passedCount}
              </strong>
            </div>

            <div className="parser-stat">
              <span>Failed</span>
              <strong className="parser-fail-text">
                {failedCount}
              </strong>
            </div>

            <div className="parser-stat">
              <span>Pass rate</span>
              <strong>
                {testResults.length
                  ? Math.round(
                      (passedCount / testResults.length) * 100
                    )
                  : 0}
                %
              </strong>
            </div>
          </div>

          <div className="parser-progress-track">
            <div
              className="parser-progress-fill"
              style={{
                width: `${
                  testResults.length
                    ? (passedCount / testResults.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="parser-test-list">
            {testResults.map((test, index) => (
              <article
                className={`parser-test-item ${
                  test.passed ? "test-passed" : "test-failed"
                }`}
                key={`${test.input}-${index}`}
              >
                <div className="parser-test-top">
                  <span className="parser-test-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <p className="parser-test-command">{test.input}</p>

                  <span
                    className={`parser-test-status ${
                      test.passed ? "status-pass" : "status-fail"
                    }`}
                  >
                    {test.passed ? "PASS" : "FAIL"}
                  </span>
                </div>

                <div className="parser-comparison">
                  <div>
                    <span>Expected</span>
                    <strong>
                      ₹{test.expectedAmount} · {test.expectedCategory}
                    </strong>
                  </div>

                  <div>
                    <span>Actual</span>
                    <strong>
                      ₹{test.actualAmount ?? "N/A"} ·{" "}
                      {test.actualCategory ?? "N/A"}
                    </strong>
                  </div>
                </div>

                {test.error && (
                  <p className="parser-error-text">{test.error}</p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {!result && testResults.length === 0 && (
        <div className="parser-empty-state">
          <span aria-hidden="true">✳</span>
          <p>Ready to test your parser</p>
          <span>Enter a command or run your complete test suite.</span>
        </div>
      )}
    </section>
  );
}

export default LocalTestPanel;