/**
 * Agent 9: Handover Assistant
 * Conversational procedural assistant strictly grounded in approved handover knowledge.
 * Cites exact step numbers, apps, and video timestamps.
 * Discloses knowledge gaps honestly if information was not demonstrated or approved.
 */

function answerCoveringColleagueQuery(workflow, userQuery) {
  const q = (userQuery || '').toLowerCase().trim();
  const steps = workflow.steps || [];
  const prereqs = workflow.prerequisites || [];
  const apps = workflow.applications || [];
  const troubleshooting = workflow.troubleshooting || [];
  const escalations = workflow.escalationContacts || [];

  if (!q) {
    return {
      answer: "I am your Handover Assistant. Ask me anything about how to execute this task, what settings to choose, what thresholds to verify, or what to do if an error occurs.",
      grounding: []
    };
  }

  // 1. Starting / Prerequisites / How to begin
  if (q.includes('start') || q.includes('begin') || q.includes('prereq') || q.includes('access') || q.includes('how do i start')) {
    const firstStep = steps[0];
    return {
      answer: `To begin this task, ensure you have the required prerequisites: ${prereqs.join('; ')}.\n\nThen follow Step 1: "${firstStep ? firstStep.title : 'Initial Setup'}" in ${firstStep ? firstStep.app : 'the portal'} at timestamp ${firstStep ? firstStep.timestamp : '00:00'}. Description: ${firstStep ? firstStep.description : 'Open the application'}.`,
      grounding: [
        { type: 'step', stepNumber: 1, timestamp: firstStep ? firstStep.timestamp : '00:00', app: firstStep ? firstStep.app : '' },
        { type: 'prerequisites', count: prereqs.length }
      ]
    };
  }

  // 2. Settings / Options / CSV format
  if (q.includes('setting') || q.includes('option') || q.includes('format') || q.includes('numeric') || q.includes('csv')) {
    const exportStep = steps.find(s => (s.description + ' ' + (s.decision || '')).toLowerCase().includes('csv') || (s.description + '').toLowerCase().includes('export'));
    if (exportStep) {
      return {
        answer: `For export configurations (Step ${exportStep.stepNumber} @ ${exportStep.timestamp} in ${exportStep.app}): ${exportStep.description}\n\nImportant Decision Rule: ${exportStep.decision || 'Ensure required export format is strictly selected.'}\n\nCaution: ${exportStep.caution || 'Do not modify required formatting.'}`,
        grounding: [
          { type: 'step', stepNumber: exportStep.stepNumber, timestamp: exportStep.timestamp, app: exportStep.app }
        ]
      };
    }
  }

  // 3. Response count / threshold / number
  if (q.includes('response') || q.includes('count') || q.includes('threshold') || q.includes('quota') || q.includes('50') || q.includes('number')) {
    const countStep = steps.find(s => (s.title + ' ' + s.description + ' ' + (s.decision || '')).toLowerCase().includes('count') || (s.title + ' ' + s.description).toLowerCase().includes('quota'));
    if (countStep) {
      return {
        answer: `In Step ${countStep.stepNumber} ("${countStep.title}" @ ${countStep.timestamp} in ${countStep.app}):\n\n${countStep.description}\n\nConfirmed Decision Rule: ${countStep.decision}\n\nVerification: ${countStep.validation}`,
        grounding: [
          { type: 'step', stepNumber: countStep.stepNumber, timestamp: countStep.timestamp, app: countStep.app }
        ]
      };
    }
  }

  // 4. Failures / Errors / Troubleshooting / Upload fail
  if (q.includes('fail') || q.includes('error') || q.includes('reject') || q.includes('stuck') || q.includes('timeout') || q.includes('troubleshoot')) {
    const match = troubleshooting.find(t => q.split(' ').some(w => w.length > 3 && t.issue.toLowerCase().includes(w)));
    if (match) {
      return {
        answer: `Troubleshooting guide for "${match.issue}":\n• Probable Cause: ${match.cause}\n• Recommended Resolution: ${match.resolution}`,
        grounding: [{ type: 'troubleshooting', issue: match.issue }]
      };
    } else if (troubleshooting.length > 0) {
      return {
        answer: `Here are the documented troubleshooting resolutions for this workflow:\n` +
          troubleshooting.map(t => `• If ${t.issue}: ${t.resolution}`).join('\n'),
        grounding: [{ type: 'troubleshooting', count: troubleshooting.length }]
      };
    }
  }

  // 5. Contact / Escalation / Who to ask
  if (q.includes('contact') || q.includes('who') || q.includes('escalate') || q.includes('help') || q.includes('slack')) {
    return {
      answer: `If you encounter an unresolvable blocker, contact the following confirmed escalation owners:\n` +
        escalations.map(e => `• ${e.name} (${e.role}): ${e.channel}`).join('\n'),
      grounding: [{ type: 'escalation', contacts: escalations.map(e => e.name) }]
    };
  }

  // 6. Generic step matching by keywords
  const matchedStep = steps.find(s => {
    const combined = (s.title + ' ' + s.description + ' ' + s.app).toLowerCase();
    const words = q.split(' ').filter(w => w.length > 3);
    return words.some(w => combined.includes(w));
  });

  if (matchedStep) {
    return {
      answer: `Relevant instruction found in Step ${matchedStep.stepNumber}: "${matchedStep.title}" (${matchedStep.app} @ ${matchedStep.timestamp}):\n\n${matchedStep.description}\n${matchedStep.decision ? '\nDecision Rule: ' + matchedStep.decision : ''}\n${matchedStep.validation ? '\nVerification Check: ' + matchedStep.validation : ''}`,
      grounding: [
        { type: 'step', stepNumber: matchedStep.stepNumber, timestamp: matchedStep.timestamp, app: matchedStep.app }
      ]
    };
  }

  // 7. Grounded Honesty fallback (Gaps disclosure)
  return {
    answer: `I searched the approved handover materials, but this specific question was not demonstrated or explicitly documented by the task owner (${workflow.owner}).\n\nTo prevent errors, I do not guess unverified workplace procedures. Please check with ${workflow.owner} or refer to the primary escalation contact: ${escalations[0]?.name || 'Operations Lead'}.`,
    grounding: [],
    isUnansweredGap: true
  };
}

module.exports = { answerCoveringColleagueQuery };
