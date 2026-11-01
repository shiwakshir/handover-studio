/**
 * Handover Studio - Screen Recorder Controller
 * Uses real Web APIs: getDisplayMedia, MediaRecorder, getUserMedia.
 * Supports moment marking, pause/resume, audio mixing, and review before AI processing.
 */

class ScreenRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.stream = null;
    this.timerInterval = null;
    this.elapsedSeconds = 0;
    this.markers = [];
    this.isRecording = false;
    this.isPaused = false;
    this.recordedBlob = null;
    this.recordedUrl = null;

    // Callbacks
    this.onTick = null;
    this.onStop = null;
    this.onMarkerAdded = null;
  }

  async start(options = {}) {
    const withAudio = !!options.withAudio;
    this.markers = [];
    this.elapsedSeconds = 0;
    this.recordedChunks = [];

    try {
      // 1. Request Display Stream
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', displaySurface: 'monitor' },
        audio: withAudio
      });

      let finalStream = displayStream;

      // 2. Mix optional microphone if requested
      if (withAudio) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const dest = audioCtx.createMediaStreamDestination();

          if (displayStream.getAudioTracks().length > 0) {
            const displaySource = audioCtx.createMediaStreamSource(displayStream);
            displaySource.connect(dest);
          }
          const micSource = audioCtx.createMediaStreamSource(micStream);
          micSource.connect(dest);

          finalStream = new MediaStream([
            ...displayStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
          ]);
        } catch (micErr) {
          console.warn('Microphone permission denied or unavailable, continuing with display only:', micErr);
        }
      }

      this.stream = finalStream;

      // 3. Setup MediaRecorder
      const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      let selectedMime = 'video/webm';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      this.mediaRecorder = new MediaRecorder(finalStream, { mimeType: selectedMime });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.stopTimer();
        this.recordedBlob = new Blob(this.recordedChunks, { type: selectedMime });
        if (this.recordedUrl) URL.revokeObjectURL(this.recordedUrl);
        this.recordedUrl = URL.createObjectURL(this.recordedBlob);

        // Stop all track tracks
        if (this.stream) {
          this.stream.getTracks().forEach(t => t.stop());
        }

        this.isRecording = false;
        this.isPaused = false;

        if (this.onStop) {
          this.onStop({
            blob: this.recordedBlob,
            url: this.recordedUrl,
            durationSec: this.elapsedSeconds,
            markers: this.markers
          });
        }
      };

      // Handle user stopping screen share from browser banner
      displayStream.getVideoTracks()[0].onended = () => {
        if (this.isRecording) {
          this.stop();
        }
      };

      this.mediaRecorder.start(1000); // chunk every 1 second
      this.isRecording = true;
      this.isPaused = false;
      this.startTimer();

      return { stream: this.stream, mimeType: selectedMime };
    } catch (err) {
      console.error('Failed to start screen recording:', err);
      throw err;
    }
  }

  pause() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused = true;
      clearInterval(this.timerInterval);
    }
  }

  resume() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused = false;
      this.startTimer();
    }
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  addMarker(label, notes = '') {
    const marker = {
      id: 'mark-' + Date.now(),
      timestampSec: this.elapsedSeconds,
      timestamp: this.formatTime(this.elapsedSeconds),
      label: label || `Moment @ ${this.formatTime(this.elapsedSeconds)}`,
      notes
    };
    this.markers.push(marker);
    if (this.onMarkerAdded) this.onMarkerAdded(marker);
    return marker;
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      if (this.onTick) this.onTick(this.elapsedSeconds, this.formatTime(this.elapsedSeconds));
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
  }

  formatTime(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

window.ScreenRecorder = ScreenRecorder;
