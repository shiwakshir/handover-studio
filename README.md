# Handover Studio
> *"Do your work once. Let AI turn it into a handover anyone can follow."*

Handover Studio is an autonomous, multimodal AI workplace handover platform designed to capture how an employee performs complex operational workflows and transform that demonstration into verified, production-grade handover materials that colleagues can execute accurately without manual supervision.

---

## 1. Product Vision & Architecture

Employees frequently carry deep operational knowledge in their heads. When taking annual leave, transitioning roles, or departing, creating manual documentation is time-consuming, prone to omissions, and quickly outdated.

Handover Studio solves this with an end-to-end continuous transfer cycle:
$$\text{Demonstration} \longrightarrow \text{Observation} \longrightarrow \text{Reconstruction} \longrightarrow \text{Clarification} \longrightarrow \text{Approval} \longrightarrow \text{Multi-Format Generation} \longrightarrow \text{Practice Verification} \longrightarrow \text{Continuous Improvement}$$

### The 10 Autonomous Cooperating Agents

Rather than a simple prompt or video summarizer, Handover Studio employs an orchestrated multi-agent pipeline bound to a shared, validated workflow model:

1. **Agent 1: Observation Agent** (`agents/observation.js`): Analyzes video recordings, frame changes, timestamp markers, and audio transcripts. Identifies applications used, screens visited, UI controls, and file operations.
2. **Agent 2: Workflow Reconstruction Agent** (`agents/reconstruction.js`): Converts discrete observations into an ordered procedural workflow. Distinguishes observed facts from inferred steps; identifies prerequisites, inputs, outputs, decisions, and completion criteria.
3. **Agent 3: Knowledge Gap Detection Agent** (`agents/gapDetection.js`): Analyzes each step for unspoken assumptions, ambiguous criteria (e.g. *"Why was a threshold checked?"*), unhandled error branches, and tacit institutional knowledge.
4. **Agent 4: Clarification Agent** (`agents/clarification.js`): Formulates targeted, high-impact follow-up questions for the task owner. Prompts for typed responses and updates the workflow model from "Observed" to "Confirmed".
5. **Agent 5: Documentation Agent** (`agents/documentation.js`): Synthesizes an 18-part Standard Operating Procedure (SOP) with structured tables, decision rules, quality checks, and escalation contacts. Compiles directly into standard OpenXML Word `.docx` and printable PDF format.
6. **Agent 6: Visualisation Agent** (`agents/visualisation.js`): Generates interactive flowchart models, Mermaid syntax, and vector SVG process maps with color-coded node states (Start, Action, Decision, Validation, Exception, End).
7. **Agent 7: Video Production Agent** (`agents/videoProduction.js`): Generates structured chapter detection, timestamp navigation, synchronized WebVTT (`.vtt`) and SubRip (`.srt`) captions, and an interactive searchable transcript.
8. **Agent 8: Quality Assurance Agent** (`agents/qualityAssurance.js`): Cross-checks generated instructions against source evidence to catch out-of-order steps, unsupported claims, missing exception handling, or exposed credentials.
9. **Agent 9: Grounded Handover Assistant** (`agents/assistant.js`): Procedural conversational assistant strictly grounded in the approved handover. Cites exact step numbers, apps, and timestamps. **Honesty by design:** if an unverified query is asked, it explicitly discloses the knowledge gap rather than inventing instructions.
10. **Agent 10: Handover Verification Agent** (`agents/verification.js`): Facilitates a safe practice walkthrough mode for covering colleagues, tracks step completion, flags confusing instructions, computes an objective Handover Readiness Score (e.g. 93%), and formulates actionable improvement recommendations for the task owner.

---

## 2. Five Comprehensive Handover Formats

All outputs derive from the single, approved, versioned workflow model:

- **Format 1: Detailed Written SOP**: Full 18-section operating procedure with purpose, prerequisites, step breakdown, decision rules, quality checks, troubleshooting matrix, escalation contacts, and sign-off checklist. Downloadable as a real, editable Microsoft Word `.docx` file and printable to PDF.
- **Format 2: Instructional Video & Chapters**: Interactive player with chapter jump navigation, synchronized closed captions, adjustable playback speed, and downloadable `.vtt` subtitles.
- **Format 3: Enterprise PowerPoint Deck**: Professional 16:9 widescreen presentation slides generated via pure Node.js OpenXML packaging with editable title, objectives, prerequisites, procedural cards, decision rules, and troubleshooting slides (`.pptx`).
- **Format 4: Interactive Flowchart**: High-resolution SVG process map with clickable nodes linking directly to step instructions, timestamps, and screenshots; exportable to SVG and Mermaid.
- **Format 5: Interactive Grounded Handover Assistant**: Conversational agent providing instant procedural guidance, step citations, and error-prevention rules without hallucinations.

---

## 3. Handover Review & Verification Studios

### Review Studio
- **Split-Screen Interface**: Left pane displays demonstration video and timestamp-synced screenshot evidence; right pane displays the editable workflow sequence.
- **Evidence Provenance Badges**: Clear visual distinction between:
  - `Observed`: Directly demonstrated in recording.
  - `Confirmed`: Explicitly verified or answered by employee.
  - `Suggested`: AI-proposed quality check or optimization awaiting review.
- **Knowledge Gap Resolution**: Real-time clarification answering panel.
- **Redaction Tool**: Multi-modal sensitive data masking across text, documents, and slides.
- **Explicit Approval Gate**: Requires employee sign-off before publishing to colleagues.

### Verification Studio (Practice Walkthrough)
- **Covering Colleague Mode**: Covering specialist (e.g. Alex Rivera) completes a simulated practice walkthrough.
- **Step Checklists & Friction Flagging**: Mark steps as completed or flag confusing instructions with specific feedback.
- **Handover Readiness Assessment**: Transparent 5-part evaluation:
  1. *Procedural Step Coverage* (100%)
  2. *Decision Rules Verified* (Threshold criteria confirmed)
  3. *Knowledge Gaps Resolved* (All clarification questions answered)
  4. *Colleague Practice Friction* (Friction points logged and weighted)
  5. *Verification Checks Configured* (Completion signals in place)
- **Automated Improvement Proposals**: Synthesizes colleague feedback into concrete recommendations for the task owner.

---

## 4. Preloaded Demonstration Scenario

**Task:** Weekly Survey Data Export & Client Delivery Pipeline
- **Owner:** Sarah Jenkins (Lead Research Ops)
- **Covering Colleague:** Alex Rivera (Associate Operations Analyst)
- **Applications:** Qualtrics XM, Excel / Data Viewer, Internal Data Hub, Enterprise Slack
- **Step Highlights:**
  1. Authenticate via SSO to Qualtrics portal (`00:08`)
  2. Locate "Q3 Brand Health & CSAT Tracker" survey (`00:24`)
  3. Verify Weekly Response Count Quota: **Critical Decision Rule:** Quota must be $\ge 50$ valid responses; if $<50$, pause and notify Sarah Jenkins on Slack (`00:42`)
  4. Inspect response quality in Data & Analysis tab (`01:05`)
  5. Export survey data in CSV format with **"Use numeric values"** checked (`01:28`)
  6. Sanitize CSV in Excel: delete test rows with prefix `TEST_`; preserve column headers in row 1 (`01:54`)
  7. Open Internal Data Hub delivery portal (`02:22`)
  8. Upload sanitized CSV to ingestion pipeline with SHA-256 validation (`02:45`)
  9. Verify batch receipt status: `BATCH_COMMITTED_SUCCESSFULLY` (`03:10`)
  10. Notify stakeholders in Slack `#research-ops` with Batch ID (`03:30`)

---

## 5. Security, Confidentiality & Governance

- **Explicit Recording Consent**: Prominent recording indicators; microphone access is disabled by default and requires explicit toggle; no covert employee surveillance.
- **Multi-Modal Redaction**: Automated scanning and manual masking for passwords, authentication tokens, and customer PII across video metadata, OCR text, and generated documents.
- **Relational Integrity**: Built-in SQLite relational storage (`node:sqlite`) for handovers, clarification questions, practice sessions, and audit events.
- **Tamper-Evident Audit Trail**: Immutable logging of every recording creation, reconstruction, question answer, document export, and verification session.

---

## 6. Quick Start & Local Setup

### Prerequisites
- Node.js v20+ (Node v24 included with Antigravity via `agy-node`)
- Modern web browser (Chrome, Edge) supporting `getDisplayMedia` and `MediaRecorder`

### Running Handover Studio

1. Navigate to the project directory:
   ```powershell
   cd C:\Users\HP\.gemini\antigravity\scratch\handover-studio
   ```

2. Start the application server:
   ```powershell
   agy-node server.js
   ```
   *(Or if standard node is in PATH: `node server.js`)*

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

4. Run the automated integration test suite:
   ```powershell
   agy-node test.js
   ```

---

## 7. Verification Test Results

Handover Studio features an automated end-to-end integration test suite (`test.js`) verifying all system capabilities:

```
=======================================================
  HANDOVER STUDIO AUTOMATED INTEGRATION TESTS:
=======================================================
  [PASS] GET / serves index.html with Handover Studio title
  [PASS] GET /api/handovers returns array with seeded demo scenario
  [PASS] GET /api/handovers/demo-market-research-01 returns complete model, flowchart, and video package
  [PASS] POST /api/handovers creates draft handover
  [PASS] POST /api/handovers/:id/reconstruct runs autonomous pipeline
  [PASS] POST /api/handovers/:id/clarify records employee response and updates workflow
  [PASS] POST /api/handovers/:id/redact applies confidential masking
  [PASS] POST /api/handovers/:id/approve marks handover published
  [PASS] POST /api/handovers/demo-market-research-01/assistant answers grounded queries and refuses hallucinations
  [PASS] POST /api/handovers/demo-market-research-01/verification evaluates practice and returns readiness breakdown
  [PASS] GET /api/handovers/demo-market-research-01/export/docx generates downloadable Word document
  [PASS] GET /api/handovers/demo-market-research-01/export/pptx generates downloadable PowerPoint slides
  [PASS] GET /api/handovers/demo-market-research-01/export/vtt generates valid WebVTT captions
  [PASS] GET /api/handovers/demo-market-research-01/export/svg generates valid SVG diagram
  [PASS] GET /api/handovers/demo-market-research-01/export/json outputs valid workflow schema
  [PASS] GET /api/audit-logs contains full audit trail of test actions
=======================================================
  Total: 16 | Passed: 16 | Failed: 0 (100% Pass Rate)
=======================================================
```
