/**
 * Agent 6: Visualisation Agent
 * Generates structured flowchart graph representations, Mermaid syntax,
 * and high-resolution SVG markup for process map visualization and export.
 * Features auto-wrapping, generous margins, and no text clipping.
 */

function generateFlowchartModel(workflow) {
  const steps = workflow.steps || [];
  const nodes = [];
  const edges = [];

  const centerX = 480;
  let currentY = 50;

  // Start Node
  nodes.push({
    id: 'start',
    type: 'start',
    label: `Start: ${workflow.title || 'Task Workflow'}`,
    stepId: null,
    x: centerX,
    y: currentY
  });

  currentY += 130;
  let prevNodeId = 'start';

  steps.forEach((step, idx) => {
    const nodeId = `node-${step.stepNumber}`;

    if (step.decision) {
      // Decision diamond node
      nodes.push({
        id: nodeId,
        type: 'decision',
        label: `${step.stepNumber}. Check: ${step.title}?`,
        stepId: step.id,
        app: step.app,
        timestamp: step.timestamp,
        decisionRule: step.decision,
        x: centerX,
        y: currentY
      });

      edges.push({ from: prevNodeId, to: nodeId });

      // Alternate branch for exception
      const altNodeId = `node-${step.stepNumber}-alt`;
      nodes.push({
        id: altNodeId,
        type: 'exception',
        label: `Escalate / Pause (Condition Not Met)`,
        stepId: step.id,
        app: step.app,
        x: centerX + 340,
        y: currentY
      });

      edges.push({ from: nodeId, to: altNodeId, condition: 'Failed / Below Quota' });

      // Continue main path
      currentY += 130;
      prevNodeId = nodeId;
    } else {
      // Standard action / validation node
      const isValidation = (step.title + ' ' + step.description).toLowerCase().includes('verify');
      nodes.push({
        id: nodeId,
        type: isValidation ? 'validation' : 'action',
        label: `${step.stepNumber}. ${step.title}`,
        stepId: step.id,
        app: step.app,
        timestamp: step.timestamp,
        x: centerX,
        y: currentY
      });

      edges.push({
        from: prevNodeId,
        to: nodeId,
        condition: prevNodeId.includes('node') && steps[idx - 1]?.decision ? 'Criteria Satisfied' : null
      });

      currentY += 120;
      prevNodeId = nodeId;
    }
  });

  // End Node
  nodes.push({
    id: 'end',
    type: 'end',
    label: 'End: Handover Verified & Delivered',
    stepId: null,
    x: centerX,
    y: currentY
  });
  edges.push({ from: prevNodeId, to: 'end' });

  return { nodes, edges, totalHeight: currentY + 100 };
}

function wrapTextLines(text, maxChars = 34) {
  if (!text || text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const w of words) {
    if ((currentLine + ' ' + w).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + w).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = w;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 2);
}

function generateMermaidDefinition(flowchartModel) {
  let m = 'graph TD\n';
  m += '  classDef startEnd fill:#10B981,stroke:#059669,stroke-width:2px,color:#FFFFFF;\n';
  m += '  classDef actionNode fill:#3B82F6,stroke:#1D4ED8,stroke-width:2px,color:#FFFFFF;\n';
  m += '  classDef decisionNode fill:#F59E0B,stroke:#D97706,stroke-width:2px,color:#FFFFFF;\n';
  m += '  classDef validationNode fill:#8B5CF6,stroke:#6D28D9,stroke-width:2px,color:#FFFFFF;\n';
  m += '  classDef exceptionNode fill:#EF4444,stroke:#B91C1C,stroke-width:2px,color:#FFFFFF;\n\n';

  flowchartModel.nodes.forEach(n => {
    const cleanLabel = n.label.replace(/"/g, "'");
    if (n.type === 'start' || n.type === 'end') {
      m += `  ${n.id}(["${cleanLabel}"]) :::startEnd\n`;
    } else if (n.type === 'decision') {
      m += `  ${n.id}{"${cleanLabel}"} :::decisionNode\n`;
    } else if (n.type === 'validation') {
      m += `  ${n.id}[/"${cleanLabel}"/] :::validationNode\n`;
    } else if (n.type === 'exception') {
      m += `  ${n.id}>"${cleanLabel}"] :::exceptionNode\n`;
    } else {
      m += `  ${n.id}["${cleanLabel}"] :::actionNode\n`;
    }
  });

  m += '\n';
  flowchartModel.edges.forEach(e => {
    if (e.condition) {
      m += `  ${e.from} -->|"${e.condition}"| ${e.to}\n`;
    } else {
      m += `  ${e.from} --> ${e.to}\n`;
    }
  });

  return m;
}

function generateSvgMarkup(flowchartModel) {
  const width = 1000;
  const height = flowchartModel.totalHeight || 1400;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="w-full h-auto font-sans">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748B"/>
    </marker>
    <filter id="shadow" x="-5%" y="-5%" width="115%" height="115%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#F8FAFC" rx="12"/>`;

  // Draw Edges
  flowchartModel.edges.forEach(e => {
    const sourceNode = flowchartModel.nodes.find(n => n.id === e.from);
    const targetNode = flowchartModel.nodes.find(n => n.id === e.to);
    if (!sourceNode || !targetNode) return;

    const sx = sourceNode.x;
    const sy = sourceNode.y + 36;
    const tx = targetNode.x;
    const ty = targetNode.y - 36;

    if (sourceNode.x === targetNode.x) {
      svg += `\n  <line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="#94A3B8" stroke-width="2.5" marker-end="url(#arrow)"/>`;
      if (e.condition) {
        svg += `\n  <text x="${sx + 12}" y="${(sy + ty) / 2}" fill="#059669" font-size="11.5" font-weight="bold">${escapeXml(e.condition)}</text>`;
      }
    } else {
      svg += `\n  <path d="M ${sx + 190} ${sourceNode.y} L ${tx - 150} ${ty + 36}" stroke="#EF4444" stroke-width="2" stroke-dasharray="5" marker-end="url(#arrow)"/>`;
      if (e.condition) {
        svg += `\n  <text x="${(sx + tx) / 2}" y="${sourceNode.y - 10}" fill="#DC2626" font-size="11" font-weight="bold">${escapeXml(e.condition)}</text>`;
      }
    }
  });

  // Draw Nodes
  flowchartModel.nodes.forEach(n => {
    const colors = {
      start: { bg: '#10B981', border: '#059669', text: '#FFFFFF' },
      end: { bg: '#059669', border: '#047857', text: '#FFFFFF' },
      action: { bg: '#FFFFFF', border: '#3B82F6', text: '#1E293B', badge: '#3B82F6' },
      decision: { bg: '#FEF3C7', border: '#F59E0B', text: '#78350F', badge: '#D97706' },
      validation: { bg: '#F3E8FF', border: '#8B5CF6', text: '#581C87', badge: '#7C3AED' },
      exception: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B', badge: '#DC2626' }
    };
    const c = colors[n.type] || colors.action;
    const lines = wrapTextLines(n.label, 36);

    svg += `\n  <g class="flow-node cursor-pointer" data-step-id="${n.stepId || ''}" data-node-id="${n.id}" transform="translate(${n.x}, ${n.y})">`;

    if (n.type === 'start' || n.type === 'end') {
      const nodeW = 420;
      svg += `\n    <rect x="-${nodeW / 2}" y="-24" width="${nodeW}" height="48" rx="24" fill="${c.bg}" stroke="${c.border}" stroke-width="2" filter="url(#shadow)"/>
    <text text-anchor="middle" y="5" fill="${c.text}" font-size="13" font-weight="bold">${escapeXml(n.label)}</text>`;
    } else if (n.type === 'decision') {
      svg += `\n    <polygon points="0,-42 200,0 0,42 -200,0" fill="${c.bg}" stroke="${c.border}" stroke-width="2" filter="url(#shadow)"/>`;
      if (lines.length === 1) {
        svg += `\n    <text text-anchor="middle" y="4" fill="${c.text}" font-size="12" font-weight="bold">${escapeXml(lines[0])}</text>`;
      } else {
        svg += `\n    <text text-anchor="middle" y="-4" fill="${c.text}" font-size="12" font-weight="bold">${escapeXml(lines[0])}</text>
    <text text-anchor="middle" y="14" fill="${c.text}" font-size="12" font-weight="bold">${escapeXml(lines[1])}</text>`;
      }
    } else {
      const nodeW = 380;
      const nodeH = 68;
      svg += `\n    <rect x="-${nodeW / 2}" y="-${nodeH / 2}" width="${nodeW}" height="${nodeH}" rx="10" fill="${c.bg}" stroke="${c.border}" stroke-width="2" filter="url(#shadow)"/>`;
      if (lines.length === 1) {
        svg += `\n    <text text-anchor="middle" y="-6" fill="${c.text}" font-size="12.5" font-weight="bold">${escapeXml(lines[0])}</text>`;
      } else {
        svg += `\n    <text text-anchor="middle" y="-12" fill="${c.text}" font-size="12" font-weight="bold">${escapeXml(lines[0])}</text>
    <text text-anchor="middle" y="6" fill="${c.text}" font-size="12" font-weight="bold">${escapeXml(lines[1])}</text>`;
      }
      if (n.app) {
        svg += `\n    <text text-anchor="middle" y="24" fill="#64748B" font-size="10.5">${escapeXml(n.app)} ${n.timestamp ? '@ ' + n.timestamp : ''}</text>`;
      }
    }

    svg += `\n  </g>`;
  });

  svg += '\n</svg>';
  return svg;
}

function escapeXml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { generateFlowchartModel, wrapTextLines, generateMermaidDefinition, generateSvgMarkup };
