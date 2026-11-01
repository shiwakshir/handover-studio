/**
 * Agent 3: Knowledge Gap Detection Agent
 * Identifies missing decisions, unhandled edge cases, unexplained settings,
 * and tacit employee rules that a covering colleague will need to know.
 */

function detectKnowledgeGaps(workflow) {
  const gaps = [];

  workflow.steps.forEach(step => {
    const text = (step.title + ' ' + step.description).toLowerCase();

    // Check for decision criteria gaps
    if (text.includes('check') || text.includes('count') || text.includes('review') || text.includes('status')) {
      gaps.push({
        id: `gap-${step.id}-1`,
        stepId: step.id,
        importance: 'critical',
        question: `In Step ${step.stepNumber} ("${step.title}"), what is the exact minimum or required threshold to proceed, and what should the covering colleague do if the condition is not met?`,
        context: `Observed a review or count verification in ${step.app}. The underlying rule must be made explicit.`,
        suggestedRule: 'Define exact numeric threshold or status requirement.'
      });
    }

    // Check for export / configuration choices
    if (text.includes('export') || text.includes('select') || text.includes('setting') || text.includes('option')) {
      gaps.push({
        id: `gap-${step.id}-2`,
        stepId: step.id,
        importance: 'high',
        question: `In Step ${step.stepNumber}, are there specific export options or file format settings that must be chosen, and why?`,
        context: `Observed setting selections in ${step.app}. Downstream systems may depend on exact format specifications.`,
        suggestedRule: 'Confirm expected file format, encoding, or field selections.'
      });
    }

    // Check for file cleaning / data manipulation
    if (text.includes('clean') || text.includes('filter') || text.includes('remove') || text.includes('edit')) {
      gaps.push({
        id: `gap-${step.id}-3`,
        stepId: step.id,
        importance: 'high',
        question: `In Step ${step.stepNumber}, what specific records or characters need to be filtered or sanitized, and how is file integrity confirmed?`,
        context: `Data cleaning was performed in ${step.app}. A covering colleague needs precise inclusion/exclusion criteria.`,
        suggestedRule: 'List exact column names and filter criteria.'
      });
    }

    // Check for upload or delivery failure fallback
    if (text.includes('upload') || text.includes('deliver') || text.includes('send')) {
      gaps.push({
        id: `gap-${step.id}-4`,
        stepId: step.id,
        importance: 'medium',
        question: `In Step ${step.stepNumber}, what is the recovery procedure if the upload fails or returns a validation error?`,
        context: `Delivery step in ${step.app}. Error handling and escalation contacts prevent operational stoppage.`,
        suggestedRule: 'Identify primary technical contact and retry policy.'
      });
    }
  });

  return gaps;
}

module.exports = { detectKnowledgeGaps };
