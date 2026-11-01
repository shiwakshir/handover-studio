const { PptxBuilder } = require('../exporters/pptxBuilder');

/**
 * Generates an editable enterprise PowerPoint presentation (.pptx)
 * adapting to the workflow length and complexity.
 */
function generatePresentationPptxBuffer(workflow) {
  const ppt = new PptxBuilder({
    title: workflow.title || 'Workplace Handover Walkthrough',
    author: workflow.owner || 'Handover Studio AI',
    subtitle: `Step-by-step Training & Procedural Deck for ${workflow.targetRole || 'Covering Colleague'}`
  });

  // Slide 1: Title Slide
  ppt.addSlide({
    title: workflow.title || 'Handover Walkthrough',
    subtitle: `Task Owner: ${workflow.owner || 'Sarah Jenkins'} | Version: ${workflow.version || 'v1.0'}`
  });

  // Slide 2: Workflow Overview & Objectives
  ppt.addSlide({
    title: '1. Workflow Objectives & Context',
    subtitle: 'Operational purpose and handover scope',
    cards: [
      {
        tag: 'Objective',
        title: 'Primary Goal',
        desc: workflow.summary || 'Ensure seamless execution of recurring workplace task during holiday cover.'
      },
      {
        tag: 'Roles',
        title: 'Ownership & Cover',
        desc: `Task Owner: ${workflow.owner || 'Sarah Jenkins'}\nCovering Role: ${workflow.targetRole || 'Covering Colleague'}`
      },
      {
        tag: 'Systems',
        title: 'Applications Involved',
        desc: (workflow.applications || []).join(', ') || 'Enterprise Portals & Tools'
      }
    ]
  });

  // Slide 3: Prerequisites & Access Requirements
  ppt.addSlide({
    title: '2. Prerequisites & Access Checklist',
    subtitle: 'Verify all requirements before beginning execution',
    bullets: (workflow.prerequisites || [
      'Active enterprise credentials',
      'Corporate VPN connection',
      'Access to target destination folders'
    ]).map(p => `Requirement: ${p}`)
  });

  // Slides 4+: Procedural Steps (chunked in cards)
  const steps = workflow.steps || [];
  for (let i = 0; i < steps.length; i += 3) {
    const chunk = steps.slice(i, i + 3);
    const slideNumber = Math.floor(i / 3) + 3;

    ppt.addSlide({
      title: `Procedural Steps (${i + 1} - ${Math.min(i + 3, steps.length)})`,
      subtitle: 'Demonstrated execution sequence',
      cards: chunk.map(s => ({
        tag: `${s.app} • @${s.timestamp}`,
        title: `Step ${s.stepNumber}: ${s.title}`,
        desc: s.description,
        extra: s.decision ? `Rule: ${s.decision}` : s.validation ? `Check: ${s.validation}` : null
      }))
    });
  }

  // Slide: Decision Points & Thresholds
  const decisionSteps = steps.filter(s => s.decision);
  if (decisionSteps.length > 0) {
    ppt.addSlide({
      title: 'Critical Decision Rules & Thresholds',
      subtitle: 'Explicit business logic and conditional branches',
      bullets: decisionSteps.map(s => `Step ${s.stepNumber} (${s.title}): ${s.decision}`)
    });
  }

  // Slide: Common Pitfalls & Troubleshooting
  const troubleshooting = workflow.troubleshooting || [];
  if (troubleshooting.length > 0) {
    ppt.addSlide({
      title: 'Troubleshooting & Exception Handling',
      subtitle: 'Known resolutions for potential errors',
      cards: troubleshooting.slice(0, 3).map(t => ({
        tag: 'Issue Resolution',
        title: t.issue,
        desc: `Probable Cause: ${t.cause}`,
        extra: `Fix: ${t.resolution}`
      }))
    });
  }

  // Final Slide: Escalation & Completion Sign-off
  const escalations = workflow.escalationContacts || [];
  ppt.addSlide({
    title: 'Escalation Contacts & Completion Checklist',
    subtitle: 'Who to contact if blocked and final sign-off criteria',
    bullets: [
      ...escalations.map(e => `Escalation: ${e.name} (${e.role}) — ${e.channel}`),
      'Sign-off: Confirm all batch IDs and receipt logs recorded.',
      'Notification: Alert stakeholders in confirmed Slack/Email channels.'
    ]
  });

  return ppt.toBuffer();
}

module.exports = { generatePresentationPptxBuffer };
