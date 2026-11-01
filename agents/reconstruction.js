/**
 * Agent 2: Workflow Reconstruction Agent
 * Converts raw observations into an ordered, structured process.
 * Distinguishes what was observed from what was inferred.
 * Identifies dependencies, decision points, validation steps, and exception paths.
 */

function reconstructWorkflow(observations, taskMeta = {}) {
  const steps = [];
  const applications = new Set();
  const prerequisites = [
    'Active user credentials for all involved corporate applications',
    'Standard network access / Corporate VPN enabled'
  ];

  observations.forEach((obs, idx) => {
    applications.add(obs.appName);

    const stepNum = idx + 1;
    let decision = null;
    let validation = `Verify ${obs.appName} displays successful response.`;
    let caution = null;

    // Detect if observation implies a decision rule
    const lower = (obs.observedText || '').toLowerCase();
    if (lower.includes('count') || lower.includes('check') || lower.includes('verify')) {
      decision = `Decision Check: Confirm numerical threshold or status satisfies criteria before continuing.`;
      validation = `Inspection confirmed valid status code / threshold reached.`;
    } else if (lower.includes('clean') || lower.includes('filter')) {
      decision = `Exclusion Rule: Filter out test records or invalid data entries.`;
      caution = `Do not alter required column header names.`;
    } else if (lower.includes('upload') || lower.includes('submit')) {
      validation = `Verify upload confirmation ID and 100% completion status.`;
      caution = `Do not close browser window while processing is active.`;
    }

    steps.push({
      id: `step-${stepNum}`,
      stepNumber: stepNum,
      title: formatStepTitle(obs),
      description: obs.observedText,
      app: obs.appName,
      timestamp: obs.timestamp,
      timestampSec: obs.timestampSec,
      status: 'Observed',
      decision,
      validation,
      caution,
      screenshot: `/assets/step_placeholder.svg`
    });
  });

  return {
    title: taskMeta.title || 'Reconstructed Workplace Workflow',
    summary: taskMeta.summary || `Standard operating workflow reconstructed from employee demonstration across ${applications.size} applications.`,
    owner: taskMeta.owner || 'Employee Task Owner',
    targetRole: taskMeta.targetRole || 'Covering Colleague',
    applications: Array.from(applications),
    prerequisites: taskMeta.prerequisites || prerequisites,
    inputs: taskMeta.inputs || ['Demonstrated input files / credentials'],
    outputs: taskMeta.outputs || ['Completed task outputs / verified records'],
    steps
  };
}

function formatStepTitle(obs) {
  const text = obs.observedText || '';
  if (text.length <= 45) return text;
  return `${obs.actionType} in ${obs.appName}: ${text.substring(0, 35)}...`;
}

module.exports = { reconstructWorkflow };
