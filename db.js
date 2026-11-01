const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'handover_studio.db');
const db = new DatabaseSync(DB_PATH);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS handovers (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    task_description TEXT,
    owner_name TEXT,
    target_role TEXT,
    status TEXT DEFAULT 'draft',
    confidence_score INTEGER DEFAULT 92,
    readiness_score INTEGER DEFAULT 88,
    version TEXT DEFAULT 'Verified',
    tags TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    workflow TEXT DEFAULT '{}',
    created_at TEXT,
    updated_at TEXT,
    approved_at TEXT,
    approved_by TEXT
  );

  CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    handover_id TEXT,
    filename TEXT,
    duration_seconds INTEGER,
    file_size INTEGER,
    mime_type TEXT,
    created_at TEXT,
    timestamps_data TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS clarification_questions (
    id TEXT PRIMARY KEY,
    handover_id TEXT,
    step_id TEXT,
    question TEXT NOT NULL,
    context TEXT,
    importance TEXT DEFAULT 'high',
    status TEXT DEFAULT 'pending',
    answer TEXT,
    answered_at TEXT,
    answered_by TEXT
  );

  CREATE TABLE IF NOT EXISTS verification_sessions (
    id TEXT PRIMARY KEY,
    handover_id TEXT,
    tester_name TEXT,
    tester_role TEXT,
    status TEXT DEFAULT 'in_progress',
    started_at TEXT,
    completed_at TEXT,
    completed_steps TEXT DEFAULT '[]',
    confusing_steps TEXT DEFAULT '[]',
    readiness_score INTEGER DEFAULT 85,
    feedback_notes TEXT,
    improvement_recommendations TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    handover_id TEXT,
    user_action TEXT NOT NULL,
    actor TEXT NOT NULL,
    details TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS coverage_packs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    owner_role TEXT,
    covering_colleague TEXT NOT NULL,
    covering_colleague_email TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    handover_type TEXT DEFAULT 'annual_leave',
    project_status_notes TEXT,
    outstanding_decisions TEXT,
    escalation_contacts TEXT DEFAULT '[]',
    systems_access TEXT DEFAULT '[]',
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS coverage_tasks (
    id TEXT PRIMARY KEY,
    pack_id TEXT NOT NULL,
    process_id TEXT,
    task_title TEXT NOT NULL,
    due_date TEXT,
    recurrence TEXT DEFAULT 'weekly',
    priority TEXT DEFAULT 'high',
    status TEXT DEFAULT 'pending',
    notes TEXT,
    blocker_reason TEXT,
    completed_at TEXT,
    completed_by TEXT
  );
`);

function seedDemonstrationScenario() {
  const existing = db.prepare('SELECT id FROM handovers WHERE id = ?').get('demo-market-research-01');
  const now = new Date().toISOString();
  const demoHandoverId = 'demo-market-research-01';

  if (!existing) {
    const demoWorkflow = {
    title: 'Weekly Survey Data Export & Client Delivery Pipeline',
    summary: 'End-to-end standard operating procedure for extracting weekly CSAT & brand tracking responses from Qualtrics, validating response volume, cleaning CSV schema, uploading into the enterprise Data Hub, and confirming delivery.',
    owner: 'Sarah Jenkins (Lead Research Ops)',
    targetRole: 'Covering Operations Specialist / Analyst',
    prerequisites: [
      'Active Qualtrics SSO credentials with "Export Survey Data" privileges',
      'Corporate VPN connection active (required for Data Hub access)',
      'Access to Internal Data Hub pipeline: /delivery/weekly-research-ingest',
      'Slack membership in #research-ops-alerts channel'
    ],
    applications: ['Qualtrics XM', 'Excel / Data Viewer', 'Internal Data Hub', 'Slack'],
    inputs: ['Live survey responses in Qualtrics (Q3 Brand Health & CSAT)'],
    outputs: ['Cleaned CSV dataset: weekly_brand_health_YYYYMMDD.csv', 'Delivery receipt log in Data Hub'],
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        title: 'Open Qualtrics XM Portal',
        description: 'Navigate to the enterprise Qualtrics portal (qualtrics.internal.enterprise.com) and authenticate using single sign-on (SSO).',
        app: 'Qualtrics',
        timestamp: '00:08',
        timestampSec: 8,
        status: 'Observed',
        decision: null,
        validation: 'Confirm SSO displays the Research & Insights workspace.',
        caution: null,
        screenshot: '/assets/demo_step1.svg'
      },
      {
        id: 'step-2',
        stepNumber: 2,
        title: 'Locate "Q3 Brand Health & CSAT Tracker" Survey',
        description: 'In the Projects list, search for "Q3 Brand Health" or filter by the "Customer Experience" project folder. Open the survey.',
        app: 'Qualtrics',
        timestamp: '00:24',
        timestampSec: 24,
        status: 'Observed',
        decision: null,
        validation: 'Ensure the status badge displays green "Active".',
        caution: 'Do not modify survey questions or schema settings.',
        screenshot: '/assets/demo_step2.svg'
      },
      {
        id: 'step-3',
        stepNumber: 3,
        title: 'Verify Weekly Response Count Quota',
        description: 'Check the "Recorded Responses" count against the weekly benchmark. Inspect the last 7 days volume metric.',
        app: 'Qualtrics',
        timestamp: '00:42',
        timestampSec: 42,
        status: 'Confirmed',
        decision: 'Minimum response count rule: Must be >= 50 completed responses. If count is < 50, do NOT proceed with export; pause and notify Sarah Jenkins on Slack.',
        validation: 'Response count displayed is >= 50 (current week: 86 valid responses).',
        caution: 'Partial responses (in progress) must NOT be counted towards quota.',
        screenshot: '/assets/demo_step3.svg'
      },
      {
        id: 'step-4',
        stepNumber: 4,
        title: 'Inspect Response Quality & Distribution',
        description: 'Click the "Data & Analysis" tab. Review the first 10 responses to ensure timestamps are current and no test data flags exist.',
        app: 'Qualtrics',
        timestamp: '01:05',
        timestampSec: 65,
        status: 'Observed',
        decision: 'If spam filter score > 0.8 on any response, flag for exclusion.',
        validation: 'All reviewed records show DistributionChannel = "email" or "anonymous".',
        caution: null,
        screenshot: '/assets/demo_step4.svg'
      },
      {
        id: 'step-5',
        stepNumber: 5,
        title: 'Export Survey Data in CSV Format',
        description: 'Click "Export & Import" > "Export Data". In the modal, select "CSV", check "Download all fields", and ensure "Use numeric values" is checked.',
        app: 'Qualtrics',
        timestamp: '01:28',
        timestampSec: 88,
        status: 'Confirmed',
        decision: 'Always export "Use numeric values" rather than choice text; the downstream data warehouse relies on numeric code mapping (1-5 scale).',
        validation: 'Download dialog finishes and generates weekly_csat_raw.csv.',
        caution: 'Do not select "Compress data as .zip" as automated parser expects direct .csv.',
        screenshot: '/assets/demo_step5.svg'
      },
      {
        id: 'step-6',
        stepNumber: 6,
        title: 'Inspect & Cleanse Exported CSV File',
        description: 'Open the exported CSV in Excel or VS Code. Check header row row 1. Remove rows where Finished == 0 or ResponseId contains "TEST_".',
        app: 'Excel / Data Viewer',
        timestamp: '01:54',
        timestampSec: 114,
        status: 'Observed',
        decision: 'Save the sanitized file as weekly_brand_health_YYYYMMDD.csv using ISO date suffix.',
        validation: 'Verify total row count matches recorded count (minus test records).',
        caution: 'Ensure UTF-8 encoding is preserved when saving from Excel to avoid character corruption.',
        screenshot: '/assets/demo_step6.svg'
      },
      {
        id: 'step-7',
        stepNumber: 7,
        title: 'Open Internal Data Hub Delivery Platform',
        description: 'Navigate to https://datahub.internal.enterprise.com/ingest/weekly-research and verify connectivity.',
        app: 'Internal Data Hub',
        timestamp: '02:22',
        timestampSec: 142,
        status: 'Observed',
        decision: null,
        validation: 'Service health status shows "Pipeline Online: Ready for Ingestion".',
        caution: 'If VPN disconnects, the portal will time out.',
        screenshot: '/assets/demo_step7.svg'
      },
      {
        id: 'step-8',
        stepNumber: 8,
        title: 'Upload Sanitized CSV to Ingestion Pipeline',
        description: 'Drag and drop weekly_brand_health_YYYYMMDD.csv into the upload target. Select Batch Type = "Weekly Scheduled Delivery".',
        app: 'Internal Data Hub',
        timestamp: '02:45',
        timestampSec: 165,
        status: 'Observed',
        decision: null,
        validation: 'Green upload progress bar reaches 100% and displays "Checksum verified".',
        caution: 'Never abort the browser tab while the ingest worker is parsing.',
        screenshot: '/assets/demo_step8.svg'
      },
      {
        id: 'step-9',
        stepNumber: 9,
        title: 'Verify Batch Verification Log & Record Count',
        description: 'Click "View Ingestion Summary". Confirm the parsed row count matches your CSV row count exactly. Record the Batch Ingestion ID.',
        app: 'Internal Data Hub',
        timestamp: '03:10',
        timestampSec: 190,
        status: 'Observed',
        decision: 'If row count discrepancy > 0, inspect rejected records log immediately.',
        validation: 'Status displays "BATCH_COMMITTED_SUCCESSFULLY".',
        caution: null,
        screenshot: '/assets/demo_step9.svg'
      },
      {
        id: 'step-10',
        stepNumber: 10,
        title: 'Send Completion Confirmation to #research-ops',
        description: 'Post a notification in Slack #research-ops channel: "Weekly survey data for [Date] uploaded to Data Hub. Batch ID: [ID]. Total records: [N]. Status: Verified."',
        app: 'Slack',
        timestamp: '03:30',
        timestampSec: 210,
        status: 'Observed',
        decision: null,
        validation: 'Stakeholders receive automated thumbs-up acknowledgment.',
        caution: 'Ensure Batch ID is included in Slack message for traceability.',
        screenshot: '/assets/demo_step10.svg'
      }
    ],
    flowchart: {
      nodes: [
        { id: 'start', type: 'start', label: 'Start: Weekly Research Delivery', stepId: null },
        { id: 'node-1', type: 'action', label: '1. Open Qualtrics Portal', stepId: 'step-1' },
        { id: 'node-2', type: 'action', label: '2. Locate CSAT Survey', stepId: 'step-2' },
        { id: 'node-3', type: 'decision', label: '3. Response count >= 50?', stepId: 'step-3' },
        { id: 'node-3-alt', type: 'exception', label: 'Alert Sarah Jenkins (Count < 50)', stepId: 'step-3' },
        { id: 'node-4', type: 'action', label: '4. Inspect Response Quality', stepId: 'step-4' },
        { id: 'node-5', type: 'action', label: '5. Export Numeric CSV', stepId: 'step-5' },
        { id: 'node-6', type: 'action', label: '6. Clean & Sanitize File', stepId: 'step-6' },
        { id: 'node-7', type: 'action', label: '7. Open Internal Data Hub', stepId: 'step-7' },
        { id: 'node-8', type: 'action', label: '8. Upload Cleaned CSV', stepId: 'step-8' },
        { id: 'node-9', type: 'validation', label: '9. Validate Ingestion Batch', stepId: 'step-9' },
        { id: 'node-10', type: 'action', label: '10. Post Confirmation in Slack', stepId: 'step-10' },
        { id: 'end', type: 'end', label: 'End: Delivery Complete', stepId: null }
      ],
      edges: [
        { from: 'start', to: 'node-1' },
        { from: 'node-1', to: 'node-2' },
        { from: 'node-2', to: 'node-3' },
        { from: 'node-3', to: 'node-4', condition: 'Yes (>= 50)' },
        { from: 'node-3', to: 'node-3-alt', condition: 'No (< 50)' },
        { from: 'node-4', to: 'node-5' },
        { from: 'node-5', to: 'node-6' },
        { from: 'node-6', to: 'node-7' },
        { from: 'node-7', to: 'node-8' },
        { from: 'node-8', to: 'node-9' },
        { from: 'node-9', to: 'node-10' },
        { from: 'node-10', to: 'end' }
      ]
    },
    troubleshooting: [
      {
        issue: 'Qualtrics export times out or hangs',
        cause: 'High server load during peak hours or large attachment payload',
        resolution: 'Select "Download fields in separate batches" or retry after 5 minutes.'
      },
      {
        issue: 'Data Hub rejects CSV upload with schema mismatch error',
        cause: 'Column names altered during Excel edit or UTF-8 BOM missing',
        resolution: 'Re-export raw CSV and save specifically as "CSV UTF-8 (Comma delimited) (*.csv)".'
      },
      {
        issue: 'Weekly response quota is under 50 records',
        cause: 'Survey invitation sent late or reminder email pending',
        resolution: 'Do NOT ingest partial data. Contact survey owner Sarah Jenkins via Slack #research-ops.'
      }
    ],
    escalationContacts: [
      { role: 'Primary Process Owner', name: 'Sarah Jenkins', channel: 'Slack @sarah.j / #research-ops' },
      { role: 'Data Hub Systems Engineer', name: 'Devin Marcus', channel: 'Slack @devin.m / #data-engineering' },
      { role: 'Research Director (Escalations)', name: 'Elena Rostova', channel: 'Email: e.rostova@enterprise.internal' }
    ],
    qualityAssuranceNotes: 'Automated QA Agent checked process consistency: 10/10 steps have verified timestamps; decision rule in Step 3 confirmed by task owner; all output schemas conform to Data Hub ingest spec v2.4.'
  };

  db.prepare(`
    INSERT INTO handovers (
      id, title, task_description, owner_name, target_role, status,
      confidence_score, readiness_score, version, tags, metadata, workflow,
      created_at, updated_at, approved_at, approved_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    demoHandoverId,
    demoWorkflow.title,
    demoWorkflow.summary,
    demoWorkflow.owner,
    demoWorkflow.targetRole,
    'approved',
    96,
    92,
    'Verified',
    JSON.stringify(['Market Research', 'Qualtrics', 'Data Delivery', 'Weekly', 'Operations']),
    JSON.stringify({ apps: demoWorkflow.applications, prereqs: demoWorkflow.prerequisites }),
    JSON.stringify(demoWorkflow),
    now,
    now,
    now,
    'Sarah Jenkins'
  );

  // Seed clarification questions
  const qInsert = db.prepare(`
    INSERT INTO clarification_questions (id, handover_id, step_id, question, context, importance, status, answer, answered_at, answered_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  qInsert.run(
    'q-1',
    demoHandoverId,
    'step-3',
    'Before exporting, you checked the number of survey responses. Is there a minimum response count required to proceed?',
    'Observation showed the cursor hovered over the total recorded count (86 responses) before navigating to Export.',
    'critical',
    'answered',
    'Yes! Minimum response threshold is 50. If under 50, do not export; notify Sarah Jenkins on Slack.',
    now,
    'Sarah Jenkins'
  );

  qInsert.run(
    'q-2',
    demoHandoverId,
    'step-5',
    'Why did you select "Use numeric values" instead of "Use choice text" in the Qualtrics export options?',
    'The export modal has two radio options for data representation.',
    'high',
    'answered',
    'The downstream Data Hub ingestion pipeline maps numeric ratings (1 to 5) directly into analytical SQL tables. Text labels will break the parser.',
    now,
    'Sarah Jenkins'
  );

  qInsert.run(
    'q-3',
    demoHandoverId,
    'step-6',
    'How should the covering colleague handle test records if they appear in the CSV?',
    'Observed filtering out rows containing TEST_',
    'medium',
    'answered',
    'Filter column ResponseId for prefix TEST_ and delete those rows completely prior to saving the delivery file.',
    now,
    'Sarah Jenkins'
  );

  // Seed verification session
  db.prepare(`
    INSERT INTO verification_sessions (
      id, handover_id, tester_name, tester_role, status, started_at, completed_at,
      completed_steps, confusing_steps, readiness_score, feedback_notes, improvement_recommendations
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'verif-01',
    demoHandoverId,
    'Alex Rivera',
    'Associate Ops Analyst (Covering Colleague)',
    'completed',
    now,
    now,
    JSON.stringify(['step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'step-6', 'step-7', 'step-8', 'step-9', 'step-10']),
    JSON.stringify([
      {
        stepId: 'step-6',
        stepTitle: 'Inspect & Cleanse Exported CSV File',
        issue: 'Was initially unsure whether to keep column headers intact or rename them.',
        suggestedFix: 'Clarify that header names must remain untouched to avoid schema error on upload.'
      }
    ]),
    92,
    'Followed the handover from start to finish. The decision threshold on Step 3 was clear. Export and Data Hub ingest worked without issues.',
    JSON.stringify([
      'Added explicit note to Step 6: "Do not modify column headers in row 1"',
      'Included Data Hub batch verification screenshot in Step 9'
    ])
  );

  // Seed audit logs
  const auditInsert = db.prepare(`
    INSERT INTO audit_logs (id, handover_id, user_action, actor, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  auditInsert.run('log-1', demoHandoverId, 'RECORDING_COMPLETED', 'Sarah Jenkins', 'Screen recording captured (duration: 03:42, source: Display 1)', now);
  auditInsert.run('log-2', demoHandoverId, 'WORKFLOW_RECONSTRUCTED', 'AI Pipeline (Agents 1-4)', '10 steps identified, 3 clarification questions generated', now);
  auditInsert.run('log-3', demoHandoverId, 'QUESTIONS_ANSWERED', 'Sarah Jenkins', '3 knowledge gaps resolved and integrated into workflow model', now);
  auditInsert.run('log-4', demoHandoverId, 'HANDOVER_APPROVED', 'Sarah Jenkins', 'Owner signed off on workflow and published for covering team', now);
  auditInsert.run('log-5', demoHandoverId, 'VERIFICATION_PRACTICE_COMPLETED', 'Alex Rivera', 'Practice walkthrough completed with 92% readiness score', now);
  }

  // Seed Demonstration Coverage Pack
  const existingPack = db.prepare('SELECT id FROM coverage_packs WHERE id = ?').get('pack-annual-leave-sarah');
  if (!existingPack) {
    const packInsert = db.prepare(`
      INSERT INTO coverage_packs (
        id, title, owner_name, owner_role, covering_colleague, covering_colleague_email,
        start_date, end_date, status, handover_type, project_status_notes,
        outstanding_decisions, escalation_contacts, systems_access, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const escalationContacts = [
      {
        name: 'Sarah Jenkins (Task Owner)',
        role: 'Lead Research Ops',
        contact: 'Emergency WhatsApp: +1-555-0192',
        trigger: 'Critical data blocker or unexpected client delivery halt'
      },
      {
        name: 'Marcus Vance',
        role: 'Research Operations Director',
        contact: 'Slack: #research-leadership / @marcus.vance',
        trigger: 'Client SLA scope changes or survey delay notifications'
      },
      {
        name: 'Priya Sharma',
        role: 'Data Platform Engineer',
        contact: 'Slack: #data-hub-support / @priya.sharma',
        trigger: 'Data Hub batch upload failure or VPN access drop'
      }
    ];

    const systemsAccess = [
      {
        system: 'Qualtrics XM Survey Platform',
        roleRequired: 'Research Analyst',
        status: 'Verified Access',
        notes: 'SSO access with Export Data privileges'
      },
      {
        system: 'Enterprise Data Hub (/delivery/weekly-research-ingest)',
        roleRequired: 'Ingest Specialist',
        status: 'Verified Access',
        notes: 'Requires active Corporate VPN connection'
      },
      {
        system: 'Slack Delivery Channels (#research-ops-alerts)',
        roleRequired: 'Channel Member',
        status: 'Verified Access',
        notes: 'Post weekly checksum and receipt log'
      }
    ];

    packInsert.run(
      'pack-annual-leave-sarah',
      'Annual Leave Cover: Market Research Operations (Nov 3 – Nov 17)',
      'Sarah Jenkins',
      'Lead Research Ops',
      'Alex Rivera',
      'alex.rivera@internal-ops.corp',
      '2026-11-03',
      '2026-11-17',
      'active',
      'annual_leave',
      'Q3 Brand Health & CSAT tracking survey is currently active with ~740 responses collected. Client SLA requires clean numeric CSV exports delivered to Data Hub every Friday before 16:00 UTC. Minimum valid weekly threshold is 50 responses.',
      'If weekly valid responses fall below 50, do NOT trigger automated cleaning. Notify client team via #research-ops-alerts and defer delivery to Monday morning batch.',
      JSON.stringify(escalationContacts),
      JSON.stringify(systemsAccess),
      now,
      now
    );

    // Seed Coverage Tasks linked to demo process
    const taskInsert = db.prepare(`
      INSERT INTO coverage_tasks (
        id, pack_id, process_id, task_title, due_date, recurrence,
        priority, status, notes, blocker_reason, completed_at, completed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    taskInsert.run(
      'cov-task-1',
      'pack-annual-leave-sarah',
      demoHandoverId,
      'Export & Validate Weekly CSAT Tracker Responses',
      'Friday 14:00 UTC',
      'weekly',
      'high',
      'pending',
      'Verify response count threshold >= 50 before initiating export format selection.',
      null,
      null,
      null
    );

    taskInsert.run(
      'cov-task-2',
      'pack-annual-leave-sarah',
      demoHandoverId,
      'Sanitize CSV Schema & Upload to Enterprise Data Hub',
      'Friday 15:30 UTC',
      'weekly',
      'high',
      'pending',
      'Maintain exact column header names in row 1. Upload via /delivery/weekly-research-ingest.',
      null,
      null,
      null
    );

    taskInsert.run(
      'cov-task-3',
      'pack-annual-leave-sarah',
      demoHandoverId,
      'Vendor Panel Response Quota Mid-Week Health Check',
      'Wednesday 11:00 UTC',
      'weekly',
      'medium',
      'pending',
      'Check Qualtrics panel incoming quota to verify tracking remains on pace for Friday export.',
      null,
      null,
      null
    );

    taskInsert.run(
      'cov-task-4',
      'pack-annual-leave-sarah',
      demoHandoverId,
      'Post Ingest Checksum & Batch Receipt to Slack #research-ops-alerts',
      'Friday 16:00 UTC',
      'weekly',
      'medium',
      'completed',
      'Receipt confirmed by Alex Rivera during practice verification run.',
      null,
      now,
      'Alex Rivera'
    );
  }
}

seedDemonstrationScenario();

module.exports = { db, seedDemonstrationScenario };
