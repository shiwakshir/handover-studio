const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { db } = require('./db');
const { analyzeRecordingEvents } = require('./agents/observation');
const { reconstructWorkflow } = require('./agents/reconstruction');
const { detectKnowledgeGaps } = require('./agents/gapDetection');
const { generateClarificationPlan, applyClarificationAnswer } = require('./agents/clarification');
const { generateSopHtml, generateSopDocxBuffer } = require('./agents/documentation');
const { generateFlowchartModel, generateSvgMarkup, generateMermaidDefinition } = require('./agents/visualisation');
const { generateVideoPackage } = require('./agents/videoProduction');
const { runQualityAssuranceAudit } = require('./agents/qualityAssurance');
const { answerCoveringColleagueQuery } = require('./agents/assistant');
const { evaluatePracticeWalkthrough } = require('./agents/verification');
const { generatePresentationPptxBuffer } = require('./agents/presentation');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 50 * 1024 * 1024) { // 50MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

function logAudit(handoverId, action, actor, details) {
  try {
    const id = 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    db.prepare(`
      INSERT INTO audit_logs (id, handover_id, user_action, actor, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, handoverId || 'SYSTEM', action, actor || 'Current User', details || '', new Date().toISOString());
  } catch (err) {
    console.error('Audit log write error:', err.message);
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    // API Routes
    if (pathname === '/api/dashboard/overview' && method === 'GET') {
      const rows = db.prepare('SELECT id, title, task_description, owner_name, target_role, status, confidence_score, readiness_score, version, tags, created_at, updated_at, approved_at, approved_by, workflow FROM handovers ORDER BY updated_at DESC').all();

      const qRows = db.prepare('SELECT id, handover_id, step_id, question, importance, status FROM clarification_questions').all();
      const vRows = db.prepare('SELECT id, handover_id, tester_name, tester_role, status, started_at, completed_at, readiness_score, feedback_notes FROM verification_sessions ORDER BY started_at DESC').all();

      const qMap = {};
      const pendingQuestionsList = [];
      qRows.forEach(q => {
        if (!qMap[q.handover_id]) qMap[q.handover_id] = { total: 0, pending: 0, list: [] };
        qMap[q.handover_id].total++;
        if (q.status === 'pending') {
          qMap[q.handover_id].pending++;
          qMap[q.handover_id].list.push(q);
          pendingQuestionsList.push(q);
        }
      });

      const vMap = {};
      vRows.forEach(v => {
        if (!vMap[v.handover_id]) vMap[v.handover_id] = { total: 0, latest_score: null, sessions: [] };
        vMap[v.handover_id].total++;
        if (vMap[v.handover_id].latest_score === null && v.readiness_score !== null) {
          vMap[v.handover_id].latest_score = v.readiness_score;
        }
        vMap[v.handover_id].sessions.push(v);
      });

      const enrichedHandovers = rows.map(r => {
        let stepsCount = 0;
        let apps = [];
        try {
          const wf = JSON.parse(r.workflow || '{}');
          stepsCount = (wf.steps || []).length;
          apps = wf.applications || [];
        } catch (e) {}
        const qInfo = qMap[r.id] || { total: 0, pending: 0, list: [] };
        const vInfo = vMap[r.id] || { total: 0, latest_score: null, sessions: [] };
        return {
          id: r.id,
          title: r.title,
          task_description: r.task_description,
          owner_name: r.owner_name,
          target_role: r.target_role,
          status: r.status,
          confidence_score: r.confidence_score,
          readiness_score: r.readiness_score,
          version: r.version,
          tags: JSON.parse(r.tags || '[]'),
          created_at: r.created_at,
          updated_at: r.updated_at,
          approved_at: r.approved_at,
          approved_by: r.approved_by,
          stepsCount,
          applications: apps,
          pendingQuestions: qInfo.pending,
          totalQuestions: qInfo.total,
          verificationCount: vInfo.total,
          latestVerificationScore: vInfo.latest_score,
          isDemo: r.id === 'demo-market-research-01'
        };
      });

      // Construct Needs Your Attention items from real application state
      const attentionItems = [];

      // 1. Clarification gaps
      enrichedHandovers.forEach(h => {
        if (h.pendingQuestions > 0) {
          attentionItems.push({
            id: `att-clarify-${h.id}`,
            type: 'clarification',
            severity: 'warning',
            handoverId: h.id,
            handoverTitle: h.title,
            title: `${h.pendingQuestions} workflow step${h.pendingQuestions > 1 ? 's require' : ' requires'} clarification`,
            description: `Agent 4 identified missing decision rules or validation checks in "${h.title}".`,
            actionLabel: 'Answer Questions',
            targetView: 'review',
            time: h.updated_at
          });
        }
      });

      // 2. Unapproved handovers awaiting review
      enrichedHandovers.forEach(h => {
        if (h.status !== 'approved' && !h.approved_at) {
          attentionItems.push({
            id: `att-approval-${h.id}`,
            type: 'approval',
            severity: 'info',
            handoverId: h.id,
            handoverTitle: h.title,
            title: `Handover awaiting owner review & approval`,
            description: `Reconstructed workflow with ${h.stepsCount} steps is ready for inspection.`,
            actionLabel: 'Review & Approve',
            targetView: 'review',
            time: h.updated_at
          });
        }
      });

      // 3. Colleague feedback submitted
      vRows.forEach(v => {
        if (v.status === 'completed' || v.feedback_notes) {
          const matchingH = enrichedHandovers.find(h => h.id === v.handover_id);
          attentionItems.push({
            id: `att-verif-${v.id}`,
            type: 'verification',
            severity: 'success',
            handoverId: v.handover_id,
            handoverTitle: matchingH?.title || 'Handover Task',
            title: `Colleague practice walkthrough completed (${v.readiness_score || 93}%)`,
            description: `${v.tester_name || 'Covering Colleague'} tested the workflow and logged verification feedback.`,
            actionLabel: 'Inspect Feedback',
            targetView: 'verification',
            time: v.completed_at || v.started_at
          });
        }
      });

      // 4. Coverage Pack Blockers & Operations Alerts
      const activePacks = db.prepare("SELECT * FROM coverage_packs WHERE status = 'active'").all();
      const covTasks = db.prepare("SELECT ct.*, cp.title as pack_title, cp.covering_colleague, cp.owner_name FROM coverage_tasks ct JOIN coverage_packs cp ON ct.pack_id = cp.id").all();
      const blockedCovTasks = covTasks.filter(t => t.status === 'blocked');
      blockedCovTasks.forEach(bt => {
        attentionItems.push({
          id: `att-blocked-${bt.id}`,
          type: 'blocker',
          severity: 'danger',
          handoverId: bt.process_id || 'demo-market-research-01',
          handoverTitle: bt.pack_title,
          title: `Coverage Blocker: "${bt.task_title}"`,
          description: `${bt.covering_colleague} flagged blocker: "${bt.blocker_reason || 'Requires assistance'}"`,
          actionLabel: 'Resolve Blocker',
          targetView: 'covering-tasks',
          time: new Date().toISOString()
        });
      });

      if (activePacks.length > 0) {
        const pendingCovTasks = covTasks.filter(t => t.status === 'pending');
        attentionItems.push({
          id: `att-pack-active-${activePacks[0].id}`,
          type: 'coverage',
          severity: 'info',
          handoverId: activePacks[0].id,
          handoverTitle: activePacks[0].title,
          title: `Holiday Cover Active: ${activePacks[0].owner_name} → ${activePacks[0].covering_colleague}`,
          description: `${pendingCovTasks.length} assigned task${pendingCovTasks.length === 1 ? '' : 's'} scheduled across ${activePacks[0].start_date} to ${activePacks[0].end_date}.`,
          actionLabel: 'View Coverage Pack',
          targetView: 'coverage-packs',
          time: activePacks[0].updated_at
        });
      }

      // Sort attention items: blockers first, then recent items, limit to 6
      attentionItems.sort((a, b) => {
        if (a.type === 'blocker' && b.type !== 'blocker') return -1;
        if (b.type === 'blocker' && a.type !== 'blocker') return 1;
        return new Date(b.time || 0) - new Date(a.time || 0);
      });
      const topAttentionItems = attentionItems.slice(0, 6);

      const totalHandovers = enrichedHandovers.length;
      const awaitingReview = enrichedHandovers.filter(h => h.status !== 'approved').length;
      const approvedCount = enrichedHandovers.filter(h => h.status === 'approved').length;
      const totalPendingClarify = pendingQuestionsList.length;
      const verifiedHandoversCount = enrichedHandovers.filter(h => h.verificationCount > 0).length;

      const scoresWithVerif = enrichedHandovers.filter(h => h.latestVerificationScore !== null).map(h => h.latestVerificationScore);
      const avgReadiness = scoresWithVerif.length > 0 
        ? Math.round(scoresWithVerif.reduce((a, b) => a + b, 0) / scoresWithVerif.length) 
        : (enrichedHandovers[0]?.readiness_score || 93);

      return sendJson(res, 200, {
        stats: {
          totalHandovers,
          awaitingReview,
          approved: approvedCount,
          pendingClarifications: totalPendingClarify,
          verifiedHandovers: verifiedHandoversCount,
          avgReadiness,
          activeCoveragePacks: activePacks.length,
          pendingCoverageTasks: covTasks.filter(t => t.status === 'pending').length,
          completedCoverageTasks: covTasks.filter(t => t.status === 'completed').length,
          readinessExplanation: 'Evaluated by Agent 10 based on procedural step coverage, decision rules, and practice walkthrough verification.'
        },
        attentionItems: topAttentionItems,
        handovers: enrichedHandovers
      });
    }

    if (pathname === '/api/handovers' && method === 'GET') {
      const rows = db.prepare('SELECT id, title, task_description, owner_name, target_role, status, confidence_score, readiness_score, version, tags, created_at, updated_at, approved_at, approved_by, workflow FROM handovers ORDER BY updated_at DESC').all();

      const qRows = db.prepare("SELECT handover_id, COUNT(*) as total, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending FROM clarification_questions GROUP BY handover_id").all();
      const qMap = {};
      qRows.forEach(q => { qMap[q.handover_id] = q; });

      const vRows = db.prepare("SELECT handover_id, COUNT(*) as total, MAX(readiness_score) as latest_score FROM verification_sessions WHERE status = 'completed' GROUP BY handover_id").all();
      const vMap = {};
      vRows.forEach(v => { vMap[v.handover_id] = v; });

      return sendJson(res, 200, rows.map(r => {
        let stepsCount = 0;
        let apps = [];
        try {
          const wf = JSON.parse(r.workflow || '{}');
          stepsCount = (wf.steps || []).length;
          apps = wf.applications || [];
        } catch (e) {}
        const qInfo = qMap[r.id] || { total: 0, pending: 0 };
        const vInfo = vMap[r.id] || { total: 0, latest_score: null };
        return {
          id: r.id,
          title: r.title,
          task_description: r.task_description,
          owner_name: r.owner_name,
          target_role: r.target_role,
          status: r.status,
          confidence_score: r.confidence_score,
          readiness_score: r.readiness_score,
          version: r.version,
          tags: JSON.parse(r.tags || '[]'),
          created_at: r.created_at,
          updated_at: r.updated_at,
          approved_at: r.approved_at,
          approved_by: r.approved_by,
          stepsCount,
          applications: apps,
          pendingQuestions: qInfo.pending || 0,
          totalQuestions: qInfo.total || 0,
          verificationCount: vInfo.total || 0,
          latestVerificationScore: vInfo.latest_score,
          isDemo: r.id === 'demo-market-research-01'
        };
      }));
    }

    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)$/) && method === 'GET') {
      const id = pathname.split('/')[3];
      const row = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id);
      if (!row) return sendJson(res, 404, { error: 'Handover not found' });

      const questions = db.prepare('SELECT * FROM clarification_questions WHERE handover_id = ?').all(id);
      const verifications = db.prepare('SELECT * FROM verification_sessions WHERE handover_id = ? ORDER BY started_at DESC').all(id);
      const audit = db.prepare('SELECT * FROM audit_logs WHERE handover_id = ? ORDER BY created_at DESC LIMIT 30').all(id);

      const workflow = JSON.parse(row.workflow || '{}');
      const videoPkg = generateVideoPackage(workflow);
      const flowchart = generateFlowchartModel(workflow);
      const qa = runQualityAssuranceAudit(workflow);

      return sendJson(res, 200, {
        ...row,
        tags: JSON.parse(row.tags || '[]'),
        metadata: JSON.parse(row.metadata || '{}'),
        workflow,
        flowchart,
        videoPackage: videoPkg,
        qaAudit: qa,
        questions,
        verifications: verifications.map(v => ({
          ...v,
          completed_steps: JSON.parse(v.completed_steps || '[]'),
          confusing_steps: JSON.parse(v.confusing_steps || '[]'),
          improvement_recommendations: JSON.parse(v.improvement_recommendations || '[]')
        })),
        auditLogs: audit
      });
    }

    if (pathname === '/api/handovers' && method === 'POST') {
      const body = await parseJsonBody(req);
      const id = 'handover-' + Date.now();
      const now = new Date().toISOString();

      const initialWorkflow = {
        title: body.title || 'New Workplace Task',
        summary: body.summary || 'Recorded operational procedure awaiting AI reconstruction.',
        owner: body.owner || 'Task Owner',
        targetRole: body.targetRole || 'Covering Colleague',
        version: 'Verified',
        applications: body.applications || ['Browser'],
        prerequisites: body.prerequisites || ['Active user login credentials'],
        steps: body.steps || []
      };

      db.prepare(`
        INSERT INTO handovers (
          id, title, task_description, owner_name, target_role, status,
          confidence_score, readiness_score, version, tags, metadata, workflow,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        initialWorkflow.title,
        initialWorkflow.summary,
        initialWorkflow.owner,
        initialWorkflow.targetRole,
        'draft',
        85,
        70,
        'Verified',
        JSON.stringify(body.tags || ['Operations']),
        JSON.stringify({ apps: initialWorkflow.applications }),
        JSON.stringify(initialWorkflow),
        now,
        now
      );

      logAudit(id, 'HANDOVER_CREATED', initialWorkflow.owner, `Created draft task: "${initialWorkflow.title}"`);
      return sendJson(res, 201, { id, status: 'created', workflow: initialWorkflow });
    }

    // Reconstruct workflow from recording markers / observation
    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)\/reconstruct$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const row = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id);
      if (!row) return sendJson(res, 404, { error: 'Handover not found' });

      const body = await parseJsonBody(req);
      const recordingData = {
        handoverId: id,
        title: row.title,
        markers: body.markers || [],
        transcript: body.transcript || '',
        durationSec: body.durationSec || 180
      };

      // Agent 1: Observation
      const obsResult = analyzeRecordingEvents(recordingData);

      // Agent 2: Reconstruction
      const reconstructed = reconstructWorkflow(obsResult.observations, {
        title: row.title,
        summary: row.task_description,
        owner: row.owner_name,
        targetRole: row.target_role
      });

      // Agent 3: Gap Detection
      const gaps = detectKnowledgeGaps(reconstructed);

      // Agent 4: Generate Clarification Questions
      const questionsPlan = generateClarificationPlan(gaps, 3);

      // Save questions in db
      const qStmt = db.prepare(`
        INSERT INTO clarification_questions (id, handover_id, step_id, question, context, importance, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      questionsPlan.forEach((q, idx) => {
        try {
          const uniqueQId = `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${idx}`;
          qStmt.run(uniqueQId, id, q.stepId, q.question, q.context || '', q.importance || 'high', 'pending');
        } catch (e) {
          console.error('Error inserting question:', e.message);
        }
      });

      const now = new Date().toISOString();
      db.prepare(`
        UPDATE handovers
        SET workflow = ?, updated_at = ?, confidence_score = 90
        WHERE id = ?
      `).run(JSON.stringify(reconstructed), now, id);

      logAudit(id, 'WORKFLOW_RECONSTRUCTED', 'AI Pipeline (Agents 1-4)', `${reconstructed.steps.length} steps sequenced; ${questionsPlan.length} clarification questions generated.`);

      return sendJson(res, 200, {
        workflow: reconstructed,
        observationCount: obsResult.observationCount,
        clarificationQuestions: questionsPlan
      });
    }

    // Answer clarification question
    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)\/clarify$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const row = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id);
      if (!row) return sendJson(res, 404, { error: 'Handover not found' });

      const body = await parseJsonBody(req);
      const { questionId, answer, answeredBy } = body;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE clarification_questions
        SET status = 'answered', answer = ?, answered_at = ?, answered_by = ?
        WHERE id = ? AND handover_id = ?
      `).run(answer, now, answeredBy || 'Employee', questionId, id);

      const currentWorkflow = JSON.parse(row.workflow || '{}');
      const updatedWorkflow = applyClarificationAnswer(currentWorkflow, questionId, answer, answeredBy);

      db.prepare(`
        UPDATE handovers
        SET workflow = ?, updated_at = ?, readiness_score = MIN(100, readiness_score + 5)
        WHERE id = ?
      `).run(JSON.stringify(updatedWorkflow), now, id);

      logAudit(id, 'CLARIFICATION_ANSWERED', answeredBy || 'Employee', `Answered question "${questionId}". Step marked Confirmed.`);

      return sendJson(res, 200, { success: true, workflow: updatedWorkflow });
    }

    // Update workflow steps / metadata
    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)$/) && method === 'PUT') {
      const id = pathname.split('/')[3];
      const body = await parseJsonBody(req);
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE handovers
        SET title = COALESCE(?, title),
            task_description = COALESCE(?, task_description),
            status = COALESCE(?, status),
            workflow = COALESCE(?, workflow),
            updated_at = ?
        WHERE id = ?
      `).run(
        body.title || null,
        body.summary || null,
        body.status || null,
        body.workflow ? JSON.stringify(body.workflow) : null,
        now,
        id
      );

      logAudit(id, 'WORKFLOW_UPDATED', body.actor || 'Task Owner', 'Manual edits applied in Review Studio.');
      return sendJson(res, 200, { success: true });
    }

    // Explicit Approval Gate
    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)\/approve$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const body = await parseJsonBody(req);
      const now = new Date().toISOString();
      const approver = body.approver || 'Sarah Jenkins';

      db.prepare(`
        UPDATE handovers
        SET status = 'approved', approved_at = ?, approved_by = ?, updated_at = ?
        WHERE id = ?
      `).run(now, approver, now, id);

      logAudit(id, 'HANDOVER_APPROVED', approver, `Handover formally approved and published for covering team.`);
      return sendJson(res, 200, { success: true, status: 'approved', approvedAt: now, approvedBy: approver });
    }

    // Redaction across workflow
    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)\/redact$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const row = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id);
      if (!row) return sendJson(res, 404, { error: 'Handover not found' });

      const body = await parseJsonBody(req);
      const { textToRedact, replacement } = body;
      const mask = replacement || '████████ [REDACTED]';

      let wfStr = row.workflow;
      if (textToRedact && textToRedact.trim()) {
        const regex = new RegExp(textToRedact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        wfStr = wfStr.replace(regex, mask);
      }

      db.prepare(`
        UPDATE handovers
        SET workflow = ?, updated_at = ?
        WHERE id = ?
      `).run(wfStr, new Date().toISOString(), id);

      logAudit(id, 'SENSITIVE_DATA_REDACTED', body.actor || 'Privacy Auditor', `Applied redaction mask for sensitive text.`);
      return sendJson(res, 200, { success: true, workflow: JSON.parse(wfStr) });
    }

    // Submit Verification Practice Walkthrough
    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)\/verification$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const row = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id);
      if (!row) return sendJson(res, 404, { error: 'Handover not found' });

      const body = await parseJsonBody(req);
      const workflow = JSON.parse(row.workflow || '{}');

      // Agent 10: Verification Agent Evaluation
      const evalResult = evaluatePracticeWalkthrough(workflow, body);

      const verifId = 'verif-' + Date.now();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO verification_sessions (
          id, handover_id, tester_name, tester_role, status, started_at, completed_at,
          completed_steps, confusing_steps, readiness_score, feedback_notes, improvement_recommendations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        verifId,
        id,
        body.testerName || 'Alex Rivera (Covering Colleague)',
        body.testerRole || 'Operations Analyst',
        'completed',
        now,
        now,
        JSON.stringify(body.completedSteps || []),
        JSON.stringify(body.confusingSteps || []),
        evalResult.readinessScore,
        body.feedbackNotes || '',
        JSON.stringify(evalResult.recommendations)
      );

      // Update handover readiness score
      db.prepare(`
        UPDATE handovers
        SET readiness_score = ?, updated_at = ?
        WHERE id = ?
      `).run(evalResult.readinessScore, now, id);

      logAudit(id, 'VERIFICATION_PRACTICE_COMPLETED', body.testerName || 'Covering Colleague', `Practice walkthrough finished. Readiness Score: ${evalResult.readinessScore}% (${evalResult.readinessTier}).`);

      return sendJson(res, 201, { success: true, verification: evalResult });
    }

    // Handover Assistant query
    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)\/assistant$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const row = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id);
      if (!row) return sendJson(res, 404, { error: 'Handover not found' });

      const body = await parseJsonBody(req);
      const workflow = JSON.parse(row.workflow || '{}');

      // Agent 9: Grounded Assistant
      const answer = answerCoveringColleagueQuery(workflow, body.query);
      return sendJson(res, 200, answer);
    }

    // EXPORT 1: DOCX SOP
    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)\/export\/docx$/) && method === 'GET') {
      const id = pathname.split('/')[3];
      const row = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id);
      if (!row) return sendJson(res, 404, { error: 'Handover not found' });

      const workflow = JSON.parse(row.workflow || '{}');
      const docxBuf = generateSopDocxBuffer(workflow);

      logAudit(id, 'DOCX_EXPORTED', 'User', 'Downloaded standard operating procedure as editable Word .docx');
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${(workflow.title || 'Handover_SOP').replace(/[^a-zA-Z0-9_-]/g, '_')}.docx"`,
        'Content-Length': docxBuf.length
      });
      return res.end(docxBuf);
    }

    // EXPORT 2: PPTX Slides
    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)\/export\/pptx$/) && method === 'GET') {
      const id = pathname.split('/')[3];
      const row = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id);
      if (!row) return sendJson(res, 404, { error: 'Handover not found' });

      const workflow = JSON.parse(row.workflow || '{}');
      const pptxBuf = generatePresentationPptxBuffer(workflow);

      logAudit(id, 'PPTX_EXPORTED', 'User', 'Downloaded editable PowerPoint training presentation as .pptx');
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${(workflow.title || 'Handover_Training').replace(/[^a-zA-Z0-9_-]/g, '_')}.pptx"`,
        'Content-Length': pptxBuf.length
      });
      return res.end(pptxBuf);
    }

    // EXPORT 3: WebVTT Captions
    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)\/export\/vtt$/) && method === 'GET') {
      const id = pathname.split('/')[3];
      const row = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id);
      if (!row) return sendJson(res, 404, { error: 'Handover not found' });

      const workflow = JSON.parse(row.workflow || '{}');
      const videoPkg = generateVideoPackage(workflow);

      res.writeHead(200, {
        'Content-Type': 'text/vtt',
        'Content-Disposition': `attachment; filename="captions.vtt"`
      });
      return res.end(videoPkg.vtt);
    }

    // EXPORT 4: SVG Flowchart
    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)\/export\/svg$/) && method === 'GET') {
      const id = pathname.split('/')[3];
      const row = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id);
      if (!row) return sendJson(res, 404, { error: 'Handover not found' });

      const workflow = JSON.parse(row.workflow || '{}');
      const model = generateFlowchartModel(workflow);
      const svg = generateSvgMarkup(model);

      res.writeHead(200, {
        'Content-Type': 'image/svg+xml',
        'Content-Disposition': `attachment; filename="flowchart.svg"`
      });
      return res.end(svg);
    }

    // EXPORT 5: Structured JSON Model
    if (pathname.match(/^\/api\/handovers\/([a-zA-Z0-9_-]+)\/export\/json$/) && method === 'GET') {
      const id = pathname.split('/')[3];
      const row = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id);
      if (!row) return sendJson(res, 404, { error: 'Handover not found' });

      const workflow = JSON.parse(row.workflow || '{}');
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="handover_model.json"`
      });
      return res.end(JSON.stringify(workflow, null, 2));
    }

    // Global Audit Logs
    if (pathname === '/api/audit-logs' && method === 'GET') {
      const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50').all();
      return sendJson(res, 200, logs);
    }

    // Process Library (Reusable SOPs)
    if (pathname === '/api/process-library' && method === 'GET') {
      const rows = db.prepare(`
        SELECT id, title, task_description, owner_name, target_role, status, 
               confidence_score, readiness_score, version, tags, created_at, updated_at, 
               approved_at, approved_by, workflow 
        FROM handovers 
        ORDER BY updated_at DESC
      `).all();

      const usageRows = db.prepare('SELECT process_id, COUNT(*) as count FROM coverage_tasks WHERE process_id IS NOT NULL GROUP BY process_id').all();
      const usageMap = {};
      usageRows.forEach(u => { usageMap[u.process_id] = u.count; });

      const library = rows.map(r => {
        let stepsCount = 0;
        let apps = [];
        let decisionRulesCount = 0;
        let validationsCount = 0;
        let cautionsCount = 0;
        let steps = [];
        try {
          const wf = JSON.parse(r.workflow || '{}');
          steps = wf.steps || [];
          stepsCount = steps.length;
          apps = wf.applications || [];
          steps.forEach(s => {
            if (s.decisionRule) decisionRulesCount++;
            if (s.validation) validationsCount++;
            if (s.caution) cautionsCount++;
          });
        } catch (e) {}

        return {
          id: r.id,
          title: r.title,
          summary: r.task_description,
          owner: r.owner_name,
          targetRole: r.target_role,
          status: r.status,
          readinessScore: r.readiness_score || 92,
          confidenceScore: r.confidence_score || 94,
          version: r.version || 'Verified',
          tags: JSON.parse(r.tags || '[]'),
          applications: apps,
          stepsCount,
          decisionRulesCount,
          validationsCount,
          cautionsCount,
          steps,
          coveragePackUsage: usageMap[r.id] || 0,
          approvedAt: r.approved_at,
          approvedBy: r.approved_by,
          updatedAt: r.updated_at
        };
      });

      return sendJson(res, 200, library);
    }

    // Coverage Packs List
    if (pathname === '/api/coverage-packs' && method === 'GET') {
      const packs = db.prepare('SELECT * FROM coverage_packs ORDER BY created_at DESC').all();
      const tasks = db.prepare(`
        SELECT ct.*, h.title as process_title, h.version as process_version 
        FROM coverage_tasks ct 
        LEFT JOIN handovers h ON ct.process_id = h.id 
        ORDER BY ct.due_date ASC
      `).all();

      const taskMap = {};
      tasks.forEach(t => {
        if (!taskMap[t.pack_id]) taskMap[t.pack_id] = [];
        taskMap[t.pack_id].push(t);
      });

      const enrichedPacks = packs.map(p => {
        const pTasks = taskMap[p.id] || [];
        const totalTasks = pTasks.length;
        const completedTasks = pTasks.filter(t => t.status === 'completed').length;
        const blockedTasks = pTasks.filter(t => t.status === 'blocked').length;
        const pendingTasks = pTasks.filter(t => t.status === 'pending').length;
        const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        let escalationContacts = [];
        let systemsAccess = [];
        try { escalationContacts = JSON.parse(p.escalation_contacts || '[]'); } catch (e) {}
        try { systemsAccess = JSON.parse(p.systems_access || '[]'); } catch (e) {}

        return {
          ...p,
          escalationContacts,
          systemsAccess,
          tasks: pTasks,
          stats: {
            totalTasks,
            completedTasks,
            blockedTasks,
            pendingTasks,
            progressPercent
          }
        };
      });

      return sendJson(res, 200, enrichedPacks);
    }

    // Create Coverage Pack
    if (pathname === '/api/coverage-packs' && method === 'POST') {
      const data = await parseJsonBody(req);
      const {
        title, owner_name, owner_role, covering_colleague, covering_colleague_email,
        start_date, end_date, handover_type = 'annual_leave',
        project_status_notes = '', outstanding_decisions = '',
        escalation_contacts = [], systems_access = [],
        tasks = []
      } = data;

      if (!title || !owner_name || !covering_colleague || !start_date || !end_date) {
        return sendJson(res, 400, { error: 'Missing required coverage pack fields (title, owner, covering colleague, dates)' });
      }

      const packId = 'pack-' + Date.now();
      const now = new Date().toISOString();

      const packInsert = db.prepare(`
        INSERT INTO coverage_packs (
          id, title, owner_name, owner_role, covering_colleague, covering_colleague_email,
          start_date, end_date, status, handover_type, project_status_notes,
          outstanding_decisions, escalation_contacts, systems_access, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      packInsert.run(
        packId,
        title,
        owner_name,
        owner_role || 'Staff Member',
        covering_colleague,
        covering_colleague_email || '',
        start_date,
        end_date,
        'active',
        handover_type,
        project_status_notes,
        outstanding_decisions,
        typeof escalation_contacts === 'string' ? escalation_contacts : JSON.stringify(escalation_contacts),
        typeof systems_access === 'string' ? systems_access : JSON.stringify(systems_access),
        now,
        now
      );

      // Insert assigned tasks
      if (Array.isArray(tasks) && tasks.length > 0) {
        const taskInsert = db.prepare(`
          INSERT INTO coverage_tasks (
            id, pack_id, process_id, task_title, due_date, recurrence, priority, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        tasks.forEach((t, idx) => {
          const taskId = `cov-task-${Date.now()}-${idx + 1}`;
          taskInsert.run(
            taskId,
            packId,
            t.process_id || null,
            t.task_title || 'Assigned Responsibility',
            t.due_date || 'Daily',
            t.recurrence || 'weekly',
            t.priority || 'high',
            'pending',
            t.notes || ''
          );
        });
      }

      logAudit(packId, 'COVERAGE_PACK_CREATED', owner_name, `Created holiday coverage pack "${title}" for ${covering_colleague} (${start_date} to ${end_date})`);

      return sendJson(res, 201, { success: true, packId, message: 'Coverage pack published successfully' });
    }

    // Get Single Coverage Pack
    if (pathname.match(/^\/api\/coverage-packs\/([a-zA-Z0-9_-]+)$/) && method === 'GET') {
      const id = pathname.split('/')[3];
      const pack = db.prepare('SELECT * FROM coverage_packs WHERE id = ?').get(id);
      if (!pack) return sendJson(res, 404, { error: 'Coverage pack not found' });

      const tasks = db.prepare(`
        SELECT ct.*, h.title as process_title, h.version as process_version, h.workflow as process_workflow
        FROM coverage_tasks ct
        LEFT JOIN handovers h ON ct.process_id = h.id
        WHERE ct.pack_id = ?
        ORDER BY ct.due_date ASC
      `).all(id);

      let escalationContacts = [];
      let systemsAccess = [];
      try { escalationContacts = JSON.parse(pack.escalation_contacts || '[]'); } catch (e) {}
      try { systemsAccess = JSON.parse(pack.systems_access || '[]'); } catch (e) {}

      return sendJson(res, 200, {
        ...pack,
        escalationContacts,
        systemsAccess,
        tasks
      });
    }

    // Get Coverage Tasks (filterable by colleague, pack_id, status)
    if (pathname === '/api/coverage-tasks' && method === 'GET') {
      const colleague = parsedUrl.query.colleague;
      const packId = parsedUrl.query.pack_id;
      const status = parsedUrl.query.status;

      let query = `
        SELECT ct.*, cp.title as pack_title, cp.owner_name as pack_owner, cp.start_date, cp.end_date,
               cp.covering_colleague, cp.project_status_notes, cp.systems_access, cp.escalation_contacts,
               h.title as process_title, h.version as process_version, h.task_description as process_description
        FROM coverage_tasks ct
        JOIN coverage_packs cp ON ct.pack_id = cp.id
        LEFT JOIN handovers h ON ct.process_id = h.id
        WHERE 1=1
      `;
      const params = [];

      if (colleague) {
        query += ` AND (cp.covering_colleague LIKE ? OR ct.completed_by LIKE ?)`;
        params.push(`%${colleague}%`, `%${colleague}%`);
      }
      if (packId) {
        query += ` AND ct.pack_id = ?`;
        params.push(packId);
      }
      if (status) {
        query += ` AND ct.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY CASE ct.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, ct.due_date ASC`;

      const tasks = db.prepare(query).all(...params);
      return sendJson(res, 200, tasks);
    }

    // Update Coverage Task (complete, block, update notes)
    if (pathname.match(/^\/api\/coverage-tasks\/([a-zA-Z0-9_-]+)$/) && method === 'PUT') {
      const id = pathname.split('/')[3];
      const data = await parseJsonBody(req);
      const { status, blocker_reason, notes, completed_by } = data;

      const existing = db.prepare('SELECT * FROM coverage_tasks WHERE id = ?').get(id);
      if (!existing) return sendJson(res, 404, { error: 'Coverage task not found' });

      const newStatus = status || existing.status;
      const completedAt = newStatus === 'completed' ? (existing.completed_at || new Date().toISOString()) : (newStatus === 'pending' ? null : existing.completed_at);
      const completedBy = newStatus === 'completed' ? (completed_by || existing.completed_by || 'Covering Colleague') : (newStatus === 'pending' ? null : existing.completed_by);
      const blockerReason = newStatus === 'blocked' ? (blocker_reason !== undefined ? blocker_reason : existing.blocker_reason) : null;
      const updatedNotes = notes !== undefined ? notes : existing.notes;

      db.prepare(`
        UPDATE coverage_tasks
        SET status = ?, blocker_reason = ?, notes = ?, completed_at = ?, completed_by = ?
        WHERE id = ?
      `).run(newStatus, blockerReason, updatedNotes, completedAt, completedBy, id);

      logAudit(
        existing.pack_id,
        'COVERAGE_TASK_UPDATED',
        completedBy || 'Colleague',
        `Task "${existing.task_title}" status updated to ${newStatus}${blockerReason ? ` (Blocker: ${blockerReason})` : ''}`
      );

      const updated = db.prepare('SELECT * FROM coverage_tasks WHERE id = ?').get(id);
      return sendJson(res, 200, { success: true, task: updated });
    }

    // Static File Serving
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.ico': 'image/x-icon',
        '.vtt': 'text/vtt'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      return fs.createReadStream(filePath).pipe(res);
    }

    // Fallback to index.html for SPA routing
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(indexPath).pipe(res);
    }

    sendJson(res, 404, { error: 'Resource not found' });
  } catch (err) {
    console.error('Server request error:', err);
    sendJson(res, 500, { error: 'Internal server error', details: err.message });
  }
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  HANDOVER STUDIO SERVER RUNNING ON PORT ${PORT}`);
    console.log(`  Access URL: http://localhost:${PORT}`);
    console.log(`  Database: node:sqlite (handover_studio.db)`);
    console.log(`  All 10 Autonomous Agents Active`);
    console.log(`=======================================================`);
  });
}

module.exports = server;
