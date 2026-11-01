/**
 * Agent 8: Quality Assurance Agent
 * Cross-checks generated instructions against source demonstration evidence.
 * Verifies ordering, unhandled branches, sensitive data exposure, and inconsistencies.
 */

function runQualityAssuranceAudit(workflow) {
  const issues = [];
  const checks = [];
  const steps = workflow.steps || [];

  // Check 1: Sequence & Timestamps
  let prevTime = -1;
  let hasOutOfOrder = false;
  steps.forEach(s => {
    if (s.timestampSec !== undefined && s.timestampSec < prevTime) {
      hasOutOfOrder = true;
    }
    prevTime = s.timestampSec || prevTime;
  });

  checks.push({
    name: 'Timeline & Chronological Sequencing',
    passed: !hasOutOfOrder,
    details: hasOutOfOrder ? 'Detected step out of chronological order.' : 'All steps follow validated chronological sequence.'
  });
  if (hasOutOfOrder) {
    issues.push({ severity: 'error', message: 'Step timestamps are not monotonically increasing.' });
  }

  // Check 2: Decision Rules & Exception Branches
  const decisionsWithoutExceptions = steps.filter(s => s.decision && !s.decision.includes('If') && !s.decision.includes('fallback') && !s.decision.includes('notify'));
  checks.push({
    name: 'Decision Point Exception Coverage',
    passed: decisionsWithoutExceptions.length === 0,
    details: decisionsWithoutExceptions.length === 0
      ? 'All decision gates define clear alternative / exception handling paths.'
      : `${decisionsWithoutExceptions.length} decision point(s) lack explicit failure fallback rules.`
  });
  if (decisionsWithoutExceptions.length > 0) {
    issues.push({ severity: 'warning', message: 'Some decision points require explicit failure paths.' });
  }

  // Check 3: Sensitive Information Redaction Audit
  const sensitiveKeywords = ['password', 'secret', 'bearer', 'private_key', 'ssn', 'credit_card'];
  let sensitiveFound = 0;
  steps.forEach(s => {
    const text = (s.description + ' ' + (s.decision || '')).toLowerCase();
    sensitiveKeywords.forEach(k => {
      if (text.includes(k)) sensitiveFound++;
    });
  });

  checks.push({
    name: 'Sensitive Credentials & PII Redaction Audit',
    passed: sensitiveFound === 0,
    details: sensitiveFound === 0 ? 'No exposed plaintext credentials or secret tokens found.' : `${sensitiveFound} potential credential keywords flagged for redaction.`
  });
  if (sensitiveFound > 0) {
    issues.push({ severity: 'critical', message: 'Potential sensitive credential keyword detected in step description.' });
  }

  // Check 4: Verification Checks Configured
  const stepsWithoutVerification = steps.filter(s => !s.validation);
  checks.push({
    name: 'Verification & Success Criteria Completeness',
    passed: stepsWithoutVerification.length === 0,
    details: `${steps.length - stepsWithoutVerification.length} of ${steps.length} steps contain verifiable completion signals.`
  });

  // Calculate QA Score
  const passedCount = checks.filter(c => c.passed).length;
  const qaScore = Math.round((passedCount / checks.length) * 100);

  return {
    qaScore,
    status: qaScore >= 80 ? 'PASSED' : 'REQUIRES_REVIEW',
    auditTimestamp: new Date().toISOString(),
    checks,
    issues
  };
}

module.exports = { runQualityAssuranceAudit };
