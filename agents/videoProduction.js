/**
 * Agent 7: Video Production Agent
 * Detects chapters from demonstrated steps, produces synchronized captions
 * (WebVTT and SubRip SRT format), and builds an interactive searchable transcript.
 */

function generateVideoPackage(workflow) {
  const steps = workflow.steps || [];

  // Chapters
  const chapters = steps.map((s, idx) => {
    const nextStep = steps[idx + 1];
    const endSec = nextStep ? nextStep.timestampSec : (s.timestampSec + 30);
    return {
      id: `chap-${idx + 1}`,
      stepNumber: s.stepNumber,
      title: s.title,
      app: s.app,
      startSec: s.timestampSec,
      startTime: s.timestamp,
      endSec: endSec,
      endTime: formatTime(endSec),
      description: s.description
    };
  });

  // Captions (WebVTT)
  let vtt = 'WEBVTT - Handover Studio Instructional Video Captions\n\n';
  let srt = '';

  chapters.forEach((chap, idx) => {
    const startVtt = formatVttTimestamp(chap.startSec);
    const endVtt = formatVttTimestamp(chap.endSec);
    const startSrt = formatSrtTimestamp(chap.startSec);
    const endSrt = formatSrtTimestamp(chap.endSec);

    // VTT Cue
    vtt += `${idx + 1}\n${startVtt} --> ${endVtt}\n[Step ${chap.stepNumber}] ${chap.title}: ${chap.description}\n\n`;

    // SRT Cue
    srt += `${idx + 1}\n${startSrt} --> ${endSrt}\n[Step ${chap.stepNumber}] ${chap.title}\n${chap.description}\n\n`;
  });

  // Searchable Transcript
  const transcript = chapters.map(chap => ({
    timestamp: chap.startTime,
    timestampSec: chap.startSec,
    speaker: workflow.owner || 'Demonstrator',
    text: `Step ${chap.stepNumber} in ${chap.app}: ${chap.title}. ${chap.description}`
  }));

  return {
    chapters,
    vtt,
    srt,
    transcript,
    totalDurationSec: chapters.length > 0 ? chapters[chapters.length - 1].endSec : 180
  };
}

function formatVttTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = 0;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function formatSrtTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = 0;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

module.exports = { generateVideoPackage, formatVttTimestamp, formatSrtTimestamp };
