const { EventEmitter } = require('events');
const server = require('./server');

function makeDirectRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = options.method || 'GET';
    req.url = path;
    req.headers = options.headers || {};

    const res = new EventEmitter();
    res.statusCode = 200;
    res._headers = {};
    const chunks = [];

    res.setHeader = (k, v) => { res._headers[k.toLowerCase()] = v; };
    res.getHeader = (k) => res._headers[k.toLowerCase()];
    res.writeHead = (code, headers = {}) => {
      res.statusCode = code;
      for (const [k, v] of Object.entries(headers)) {
        res.setHeader(k, v);
      }
    };
    res.write = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const buffer = Buffer.concat(chunks);
      resolve({
        statusCode: res.statusCode,
        headers: res._headers,
        buffer,
        text: () => buffer.toString('utf8'),
        json: () => JSON.parse(buffer.toString('utf8'))
      });
    };

    server.emit('request', req, res);

    if (options.body) {
      const payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.emit('data', Buffer.from(payload));
    }
    req.emit('end');
  });
}

async function runTests() {
  console.log('--- STARTING HANDOVER STUDIO AUTOMATED INTEGRATION TESTS ---\n');
  let passed = 0;
  let failed = 0;

  async function assert(desc, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${desc} ->`, err.message);
      failed++;
    }
  }

  // Test 1: Frontend SPA index.html loads
  await assert('GET / serves index.html with Handover Studio title', async () => {
    const res = await makeDirectRequest('/');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.text().includes('Handover Studio')) throw new Error('Missing Handover Studio branding in HTML');
  });

  // Test 2: List Handovers
  await assert('GET /api/handovers returns array with seeded demo scenario', async () => {
    const res = await makeDirectRequest('/api/handovers');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    const list = res.json();
    if (!Array.isArray(list) || list.length === 0) throw new Error('Expected at least 1 handover in database');
    const demo = list.find(h => h.id === 'demo-market-research-01');
    if (!demo) throw new Error('Demo handover not found in response');
    if (demo.title !== 'Weekly Survey Data Export & Client Delivery Pipeline') throw new Error(`Unexpected title: ${demo.title}`);
  });

  // Test 3: Get Complete Handover Details & Models
  await assert('GET /api/handovers/demo-market-research-01 returns complete model, flowchart, and video package', async () => {
    const res = await makeDirectRequest('/api/handovers/demo-market-research-01');
    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
    const demoData = res.json();
    if (!demoData.workflow || !demoData.workflow.steps || demoData.workflow.steps.length !== 10) {
      throw new Error('Expected 10 steps in demo workflow');
    }
    if (!demoData.flowchart || !demoData.flowchart.nodes || demoData.flowchart.nodes.length === 0) {
      throw new Error('Expected flowchart nodes');
    }
    if (!demoData.videoPackage || !demoData.videoPackage.chapters || demoData.videoPackage.chapters.length !== 10) {
      throw new Error('Expected 10 video chapters');
    }
  });

  // Test 4: Create New Handover Project
  let newId = null;
  await assert('POST /api/handovers creates draft handover', async () => {
    const res = await makeDirectRequest('/api/handovers', {
      method: 'POST',
      body: {
        title: 'Integration Test Task',
        summary: 'Automated test procedure',
        owner: 'Test Agent',
        targetRole: 'Test Colleague'
      }
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    const data = res.json();
    newId = data.id;
    if (!newId) throw new Error('No ID returned');
  });

  // Test 5: Reconstruct Workflow with Agents 1-4
  await assert('POST /api/handovers/:id/reconstruct runs autonomous pipeline', async () => {
    const res = await makeDirectRequest(`/api/handovers/${newId}/reconstruct`, {
      method: 'POST',
      body: {
        markers: [
          { timestampSec: 10, label: 'Open Qualtrics survey portal' },
          { timestampSec: 35, label: 'Verify response count is >= 50 threshold' },
          { timestampSec: 70, label: 'Export numeric CSV dataset' }
        ],
        durationSec: 90
      }
    });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}: ${res.text()}`);
    const data = res.json();
    console.log('    Reconstruction result: steps =', data.workflow?.steps?.length, ', questions =', data.clarificationQuestions?.length);
    if (!data.workflow || data.workflow.steps.length !== 3) {
      throw new Error('Expected 3 reconstructed steps');
    }
  });

  // Test 6: Answer Clarification Question
  await assert('POST /api/handovers/:id/clarify records employee response and updates workflow', async () => {
    const hRes = await makeDirectRequest(`/api/handovers/${newId}`);
    const hData = hRes.json();
    console.log('    Handover get result: questions in db =', hData.questions?.length);
    const questions = hData.questions || [];
    if (questions.length === 0) throw new Error('No questions found to clarify');
    const qId = questions[0].id;

    const res = await makeDirectRequest(`/api/handovers/${newId}/clarify`, {
      method: 'POST',
      body: {
        questionId: qId,
        answer: 'Verified: Minimum 50 responses strictly required by client SLA.',
        answeredBy: 'Sarah Jenkins'
      }
    });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = res.json();
    if (!data.success) throw new Error('Clarification submission was not successful');
  });

  // Test 7: Redact Sensitive Information
  await assert('POST /api/handovers/:id/redact applies confidential masking', async () => {
    const res = await makeDirectRequest(`/api/handovers/${newId}/redact`, {
      method: 'POST',
      body: {
        textToRedact: 'Qualtrics',
        actor: 'Privacy Officer'
      }
    });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = res.json();
    if (!JSON.stringify(data.workflow).includes('[REDACTED]')) {
      throw new Error('Redaction token not found in updated workflow');
    }
  });

  // Test 8: Formally Approve Handover
  await assert('POST /api/handovers/:id/approve marks handover published', async () => {
    const res = await makeDirectRequest(`/api/handovers/${newId}/approve`, {
      method: 'POST',
      body: { approver: 'Sarah Jenkins' }
    });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = res.json();
    if (data.status !== 'approved') throw new Error('Expected status to be approved');
  });

  // Test 9: Grounded Assistant Q&A (Procedural & Fallback)
  await assert('POST /api/handovers/demo-market-research-01/assistant answers grounded queries and refuses hallucinations', async () => {
    const res1 = await makeDirectRequest('/api/handovers/demo-market-research-01/assistant', {
      method: 'POST',
      body: { query: 'What is the response count rule?' }
    });
    const ans1 = res1.json();
    if (!ans1.answer.includes('50') || !ans1.grounding || ans1.grounding.length === 0) {
      throw new Error('Expected citation of Step 3 with 50 threshold rule');
    }

    const res2 = await makeDirectRequest('/api/handovers/demo-market-research-01/assistant', {
      method: 'POST',
      body: { query: 'How do I modify employee 401k contribution tiers?' }
    });
    const ans2 = res2.json();
    if (!ans2.isUnansweredGap) {
      throw new Error('Expected unverified query to be honestly flagged as knowledge gap');
    }
  });

  // Test 10: Practice Walkthrough & Verification Agent (Agent 10)
  await assert('POST /api/handovers/demo-market-research-01/verification evaluates practice and returns readiness breakdown', async () => {
    const res = await makeDirectRequest('/api/handovers/demo-market-research-01/verification', {
      method: 'POST',
      body: {
        testerName: 'Alex Rivera',
        testerRole: 'Covering Analyst',
        completedSteps: ['step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'step-6', 'step-7', 'step-8', 'step-9', 'step-10'],
        confusingSteps: [{ stepId: 'step-6', stepTitle: 'Sanitize CSV', issue: 'Header names', suggestedFix: 'Keep row 1 intact' }]
      }
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    const data = res.json();
    if (!data.verification || typeof data.verification.readinessScore !== 'number') {
      throw new Error('Missing readiness score in verification result');
    }
    if (!data.verification.criteria || data.verification.criteria.length !== 5) {
      throw new Error('Expected 5 transparent readiness criteria');
    }
  });

  // Test 11: Export DOCX (OpenXML)
  await assert('GET /api/handovers/demo-market-research-01/export/docx generates downloadable Word document', async () => {
    const res = await makeDirectRequest('/api/handovers/demo-market-research-01/export/docx');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.headers['content-type'] !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      throw new Error(`Unexpected content type: ${res.headers['content-type']}`);
    }
    if (res.buffer.length < 2000) {
      throw new Error(`DOCX file suspiciously small: ${res.buffer.length} bytes`);
    }
    if (res.buffer[0] !== 0x50 || res.buffer[1] !== 0x4B) {
      throw new Error('DOCX is not a valid PKZip archive');
    }
  });

  // Test 12: Export PPTX (OpenXML)
  await assert('GET /api/handovers/demo-market-research-01/export/pptx generates downloadable PowerPoint slides', async () => {
    const res = await makeDirectRequest('/api/handovers/demo-market-research-01/export/pptx');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.headers['content-type'] !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      throw new Error(`Unexpected content type: ${res.headers['content-type']}`);
    }
    if (res.buffer.length < 5000) {
      throw new Error(`PPTX file suspiciously small: ${res.buffer.length} bytes`);
    }
    if (res.buffer[0] !== 0x50 || res.buffer[1] !== 0x4B) {
      throw new Error('PPTX is not a valid PKZip archive');
    }
  });

  // Test 13: Export WebVTT Captions
  await assert('GET /api/handovers/demo-market-research-01/export/vtt generates valid WebVTT captions', async () => {
    const res = await makeDirectRequest('/api/handovers/demo-market-research-01/export/vtt');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.text().startsWith('WEBVTT')) {
      throw new Error('Missing WEBVTT header');
    }
    if (!res.text().includes('-->')) {
      throw new Error('Missing timestamp cues in captions');
    }
  });

  // Test 14: Export SVG Flowchart
  await assert('GET /api/handovers/demo-market-research-01/export/svg generates valid SVG diagram', async () => {
    const res = await makeDirectRequest('/api/handovers/demo-market-research-01/export/svg');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.text().includes('<svg') || !res.text().includes('</svg>')) {
      throw new Error('Invalid SVG markup');
    }
  });

  // Test 15: Export Structured JSON Model
  await assert('GET /api/handovers/demo-market-research-01/export/json outputs valid workflow schema', async () => {
    const res = await makeDirectRequest('/api/handovers/demo-market-research-01/export/json');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const json = res.json();
    if (!json.steps || json.steps.length !== 10) {
      throw new Error('Invalid JSON workflow model');
    }
  });

  // Test 16: Security Audit Log
  await assert('GET /api/audit-logs contains full audit trail of test actions', async () => {
    const res = await makeDirectRequest('/api/audit-logs');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const logs = res.json();
    if (!Array.isArray(logs) || logs.length < 5) {
      throw new Error('Expected at least 5 audit log entries');
    }
  });

  // Test 17: Process Library (Reusable SOPs)
  await assert('GET /api/process-library returns reusable SOPs with steps, apps, and decision rules', async () => {
    const res = await makeDirectRequest('/api/process-library');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const library = res.json();
    if (!Array.isArray(library) || library.length === 0) {
      throw new Error('Expected at least 1 process library entry');
    }
    const demo = library.find(p => p.id === 'demo-market-research-01');
    if (!demo || demo.stepsCount !== 10) {
      throw new Error(`Expected demo process with 10 steps, got ${demo?.stepsCount}`);
    }
  });

  // Test 18: Coverage Packs List
  await assert('GET /api/coverage-packs returns active holiday packs with stats and tasks', async () => {
    const res = await makeDirectRequest('/api/coverage-packs');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const packs = res.json();
    if (!Array.isArray(packs) || packs.length === 0) {
      throw new Error('Expected seeded coverage pack');
    }
    const pack = packs[0];
    if (!pack.covering_colleague || !pack.stats) {
      throw new Error('Missing pack details or stats');
    }
  });

  // Test 19: Coverage Tasks Filter & Update
  await assert('GET /api/coverage-tasks and PUT status update works seamlessly', async () => {
    const res = await makeDirectRequest('/api/coverage-tasks?colleague=Alex');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const tasks = res.json();
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('Expected assigned tasks for Alex');
    }
    const task = tasks[0];
    
    // Test updating task status
    const updateRes = await makeDirectRequest(`/api/coverage-tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completed_by: 'Alex Rivera' })
    });
    if (updateRes.statusCode !== 200) throw new Error(`Expected 200 from PUT, got ${updateRes.statusCode}`);
    const updated = updateRes.json();
    if (updated.task.status !== 'completed' || updated.task.completed_by !== 'Alex Rivera') {
      throw new Error('Coverage task status did not update properly');
    }
  });

  console.log(`\n=======================================================`);
  console.log(`  INTEGRATION TEST SUMMARY:`);
  console.log(`  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`=======================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
