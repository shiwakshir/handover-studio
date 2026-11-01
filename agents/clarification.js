/**
 * Agent 4: Clarification Agent
 * Interacts with the employee to resolve detected knowledge gaps.
 * Updates workflow model with employee-confirmed rules and marks them "Confirmed".
 */

function generateClarificationPlan(gaps, maxQuestions = 5) {
  // Prioritize critical gaps first
  const order = { critical: 1, high: 2, medium: 3 };
  const sorted = [...gaps].sort((a, b) => (order[a.importance] || 9) - (order[b.importance] || 9));
  return sorted.slice(0, maxQuestions);
}

function applyClarificationAnswer(workflow, questionId, answer, answeredBy = 'Employee') {
  const updated = JSON.parse(JSON.stringify(workflow));

  // Find step associated with question
  const step = updated.steps.find(s => questionId.includes(s.id));
  if (step) {
    step.status = 'Confirmed';
    if (!step.decision) {
      step.decision = `Confirmed Rule: ${answer}`;
    } else {
      step.decision += ` | Confirmed: ${answer}`;
    }
  }

  // Update troubleshooting or notes if appropriate
  if (!updated.clarificationsLog) updated.clarificationsLog = [];
  updated.clarificationsLog.push({
    questionId,
    answer,
    answeredBy,
    timestamp: new Date().toISOString()
  });

  return updated;
}

module.exports = { generateClarificationPlan, applyClarificationAnswer };
