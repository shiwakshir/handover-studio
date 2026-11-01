const { DocxBuilder } = require('../exporters/docxBuilder');

/**
 * Agent 5: Documentation Agent
 * Produces comprehensive 18-part Standard Operating Procedure (SOP)
 * in both structured HTML and downloadable DOCX format.
 */

function generateSopHtml(workflow) {
  const steps = workflow.steps || [];
  const prereqs = workflow.prerequisites || [];
  const apps = workflow.applications || [];
  const troubleshooting = workflow.troubleshooting || [
    { issue: 'Application timeout or SSO failure', cause: 'Expired session or VPN disconnection', resolution: 'Reconnect VPN, clear cache, and re-authenticate via SSO.' }
  ];
  const escalations = workflow.escalationContacts || [
    { role: 'Task Owner', name: workflow.owner || 'Lead Operations', channel: 'Corporate Slack / Email' }
  ];

  return `
    <div class="sop-document max-w-4xl mx-auto p-8 bg-white text-slate-800 font-sans shadow-lg rounded-xl border border-slate-200">
      <!-- 1. Header & Title -->
      <header class="border-b-2 border-indigo-600 pb-6 mb-8">
        <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2">
          <span>Standard Operating Procedure (SOP)</span>
          <span>Security Classification: Internal Workplace</span>
        </div>
        <h1 class="text-3xl font-extrabold text-slate-900 leading-tight">${workflow.title || 'Workplace Task SOP'}</h1>
        <div class="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
          <div><strong class="text-slate-800">Task Owner:</strong> ${workflow.owner || 'Sarah Jenkins'}</div>
          <div><strong class="text-slate-800">Target Role:</strong> ${workflow.targetRole || 'Covering Colleague'}</div>
          <div><strong class="text-slate-800">Last Reviewed:</strong> ${new Date().toLocaleDateString()}</div>
        </div>
      </header>

      <!-- 2. Purpose & Expected Outcome -->
      <section class="mb-8">
        <h2 class="text-xl font-bold text-slate-900 border-l-4 border-indigo-500 pl-3 mb-3">1. Purpose &amp; Expected Outcome</h2>
        <p class="text-slate-700 leading-relaxed mb-3">${workflow.summary || 'Enables covering colleague to execute recurring task reliably without requiring manual supervision.'}</p>
        <div class="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-sm text-emerald-900">
          <strong>Expected Outcome:</strong> Task completed accurately, outputs verified, and stakeholder notifications delivered with complete audit trail.
        </div>
      </section>

      <!-- 3. Applications & Permissions -->
      <section class="mb-8">
        <h2 class="text-xl font-bold text-slate-900 border-l-4 border-indigo-500 pl-3 mb-3">2. Required Applications &amp; Permissions</h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="p-3 bg-slate-50 border border-slate-200 rounded">
            <h4 class="font-bold text-sm text-slate-800 mb-2">Software &amp; Tools:</h4>
            <ul class="list-disc list-inside text-sm text-slate-600 space-y-1">
              ${apps.map(a => `<li>${a}</li>`).join('')}
            </ul>
          </div>
          <div class="p-3 bg-slate-50 border border-slate-200 rounded">
            <h4 class="font-bold text-sm text-slate-800 mb-2">Prerequisites &amp; Access:</h4>
            <ul class="list-disc list-inside text-sm text-slate-600 space-y-1">
              ${prereqs.map(p => `<li>${p}</li>`).join('')}
            </ul>
          </div>
        </div>
      </section>

      <!-- 4. Detailed Step-by-Step Instructions -->
      <section class="mb-8">
        <h2 class="text-xl font-bold text-slate-900 border-l-4 border-indigo-500 pl-3 mb-4">3. Step-by-Step Procedural Guide</h2>
        <div class="space-y-6">
          ${steps.map(step => `
            <div class="step-card border border-slate-200 rounded-lg p-5 bg-white hover:border-indigo-300 transition-colors">
              <div class="flex items-center justify-between mb-2">
                <span class="inline-flex items-center gap-2">
                  <span class="w-7 h-7 flex items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs">${step.stepNumber}</span>
                  <h3 class="text-lg font-bold text-slate-900">${step.title}</h3>
                </span>
                <span class="text-xs px-2.5 py-1 rounded-full font-medium ${step.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
                  ${step.status || 'Observed'} • ${step.app} @ ${step.timestamp}
                </span>
              </div>
              <p class="text-slate-700 text-sm mb-3 pl-9">${step.description}</p>
              
              <div class="pl-9 space-y-2 text-xs">
                ${step.decision ? `
                  <div class="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900">
                    <strong>Decision Rule:</strong> ${step.decision}
                  </div>` : ''}
                ${step.validation ? `
                  <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-900">
                    <strong>Verification Check:</strong> ${step.validation}
                  </div>` : ''}
                ${step.caution ? `
                  <div class="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-900">
                    <strong>Caution / Error Prevention:</strong> ${step.caution}
                  </div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- 5. Troubleshooting & Exceptions -->
      <section class="mb-8">
        <h2 class="text-xl font-bold text-slate-900 border-l-4 border-indigo-500 pl-3 mb-3">4. Common Issues &amp; Troubleshooting</h2>
        <table class="w-full text-left text-sm border-collapse border border-slate-200">
          <thead class="bg-slate-100 text-slate-800">
            <tr>
              <th class="p-2.5 border border-slate-200 font-bold">Observed Issue</th>
              <th class="p-2.5 border border-slate-200 font-bold">Probable Cause</th>
              <th class="p-2.5 border border-slate-200 font-bold">Recommended Resolution</th>
            </tr>
          </thead>
          <tbody>
            ${troubleshooting.map(t => `
              <tr class="hover:bg-slate-50">
                <td class="p-2.5 border border-slate-200 font-medium text-slate-900">${t.issue}</td>
                <td class="p-2.5 border border-slate-200 text-slate-600">${t.cause}</td>
                <td class="p-2.5 border border-slate-200 text-slate-700">${t.resolution}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>

      <!-- 6. Escalation Contacts -->
      <section class="mb-8">
        <h2 class="text-xl font-bold text-slate-900 border-l-4 border-indigo-500 pl-3 mb-3">5. Escalation Contacts &amp; Support</h2>
        <div class="grid grid-cols-3 gap-4">
          ${escalations.map(e => `
            <div class="p-3 bg-slate-50 border border-slate-200 rounded text-sm">
              <div class="font-bold text-slate-900">${e.name}</div>
              <div class="text-xs text-slate-500">${e.role}</div>
              <div class="text-xs text-indigo-600 mt-1 font-mono">${e.channel}</div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- 7. Completion Checklist -->
      <section class="mb-8">
        <h2 class="text-xl font-bold text-slate-900 border-l-4 border-indigo-500 pl-3 mb-3">6. Operational Sign-off Checklist</h2>
        <div class="space-y-2 text-sm text-slate-700">
          ${steps.map(s => `
            <div class="flex items-center gap-2 p-2 rounded hover:bg-slate-50">
              <input type="checkbox" disabled class="rounded text-indigo-600 pointer-events-none" />
              <span>Step ${s.stepNumber}: ${s.title}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Footer -->
      <footer class="pt-6 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
        <div>Handover Studio Document Engine • Grounded Knowledge Transfer</div>
        <div>CONFIDENTIAL • FOR INTERNAL WORKPLACE USE ONLY</div>
      </footer>
    </div>
  `;
}

function generateSopDocxBuffer(workflow) {
  const doc = new DocxBuilder({
    title: workflow.title || 'Standard Operating Procedure',
    author: workflow.owner || 'Handover Studio AI'
  });

  doc.addTitle(workflow.title || 'Standard Operating Procedure');
  doc.addHeading2(`Task Owner: ${workflow.owner || 'Sarah Jenkins'} | Role: ${workflow.targetRole || 'Covering Colleague'}`);
  doc.addParagraph(`Generated automatically by Handover Studio from verified demonstration and employee-confirmed rules.`);

  // 1. Purpose
  doc.addHeading1('1. Purpose & Scope');
  doc.addParagraph(workflow.summary || 'Provides step-by-step guidance for covering colleague.');
  doc.addCallout('Target Role', workflow.targetRole || 'Covering Colleague', 'info');

  // 2. Prerequisites
  doc.addHeading1('2. Prerequisites & Access Requirements');
  (workflow.prerequisites || []).forEach(p => doc.addBullet(p, 'Requirement:'));

  // 3. Applications
  doc.addHeading1('3. Applications & Systems Used');
  (workflow.applications || []).forEach(a => doc.addBullet(a, 'System:'));

  // 4. Numbered Steps
  doc.addHeading1('4. Step-by-Step Instructions');
  (workflow.steps || []).forEach(s => {
    doc.addStep(s.stepNumber, s.title, s.description, {
      app: s.app,
      timestamp: s.timestamp,
      decision: s.decision,
      validation: s.validation,
      caution: s.caution,
      status: s.status
    });
  });

  // 5. Troubleshooting Table
  doc.addHeading1('5. Troubleshooting Guide');
  const headers = ['Issue', 'Probable Cause', 'Resolution'];
  const rows = (workflow.troubleshooting || []).map(t => [t.issue, t.cause, t.resolution]);
  if (rows.length > 0) {
    doc.addTable(headers, rows);
  }

  // 6. Escalation Contacts
  doc.addHeading1('6. Escalation Contacts');
  (workflow.escalationContacts || []).forEach(e => {
    doc.addBullet(`${e.name} (${e.role}) — ${e.channel}`, 'Contact:');
  });

  // 7. Completion Checklist
  doc.addHeading1('7. Completion Sign-off Checklist');
  (workflow.steps || []).forEach(s => {
    doc.addBullet(`[  ] Step ${s.stepNumber}: ${s.title} verified and recorded.`);
  });

  return doc.toBuffer();
}

module.exports = { generateSopHtml, generateSopDocxBuffer };
