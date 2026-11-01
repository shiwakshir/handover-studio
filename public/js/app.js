/**
 * Handover Studio - Frontend Application Engine V2
 * Includes flowchart auto-wrapping, presentation deck viewer,
 * inline step editing, interactive verification progress, and grounded assistant.
 */

class App {
  constructor() {
    this.currentHandoverId = 'demo-market-research-01';
    this.handoverData = null;
    this.currentStepIndex = 0;
    this.currentSlideIndex = 0;
    this.flowZoom = 1.0;
    this.activeView = 'dashboard';
    this.activeTab = 'tab-sop';
    this.recorder = new ScreenRecorder();
    this.editingStepId = null;
    this.practiceSession = {
      completedSteps: ['step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'step-6', 'step-7', 'step-8', 'step-9', 'step-10'],
      confusingSteps: [],
      flaggingStepId: null
    };

    // Dashboard State
    this.dashboardData = null;
    this.dashboardFilter = 'all';
    this.dashboardSearch = '';
    this.dashboardSort = 'updated';

    // Review Studio State
    this.expandedStepIds = new Set(['step-1']);
    this.guidedReviewActive = false;
    this.guidedReviewStage = 1;
    this.isPlaying = false;
    this.playInterval = null;
    this.playbackSpeed = 1.0;
    this.currentPlaybackSec = 8;
    this.allStepsExpanded = false;

    // Internal Operations & Coverage Packs State
    this.currentPersona = 'owner'; // 'owner' | 'covering'
    this.coveringColleagueName = 'Alex Rivera';
    this.allProcessLibrary = [];
    this.allCoveragePacks = [];
    this.allCoveringTasks = [];
    this.coveringFilter = 'all'; // 'all' | 'pending' | 'completed' | 'blocked'
    this.wizardStep = 1;
    this.draftPackTasks = [
      {
        task_title: 'Export & Validate Weekly CSAT Tracker Responses',
        process_id: 'demo-market-research-01',
        due_date: 'Friday 14:00 UTC',
        recurrence: 'weekly',
        priority: 'high',
        notes: 'Verify response count threshold >= 50 before initiating export format selection.'
      },
      {
        task_title: 'Sanitize CSV Schema & Upload to Enterprise Data Hub',
        process_id: 'demo-market-research-01',
        due_date: 'Friday 15:30 UTC',
        recurrence: 'weekly',
        priority: 'high',
        notes: 'Maintain exact column header names in row 1. Upload via /delivery/weekly-research-ingest.'
      }
    ];
    this.activeBlockerTaskId = null;

    this.init();
  }

  async init() {
    this.initTheme();
    this.initSidebar();
    this.initLightbox();
    this.initReviewStudioEvents();
    this.initPersonaSwitcher();
    this.initOperationsEvents();
    this.bindEvents();
    this.initRecorderCallbacks();
    await this.loadHandover(this.currentHandoverId);
    await this.loadDashboardHandovers();
    this.switchView('dashboard');
  }

  /* --------------------------------------------------------------------------
     Toast Notification System
     -------------------------------------------------------------------------- */
  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'error' || type === 'danger') {
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      <span class="toast-icon">${iconSvg}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" title="Dismiss">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 200);
    });

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.isConnected) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 200);
      }
    }, duration);
  }

  /* --------------------------------------------------------------------------
     Confirmation Modal Helper
     -------------------------------------------------------------------------- */
  showConfirmModal({ title = 'Confirm Action', message = 'Are you sure you want to proceed?', confirmText = 'Confirm', confirmClass = 'btn-primary' } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('modal-confirm');
      const titleEl = document.getElementById('confirm-modal-title');
      const msgEl = document.getElementById('confirm-modal-message');
      const okBtn = document.getElementById('btn-confirm-ok');
      const cancelBtn = document.getElementById('btn-confirm-cancel');

      if (!modal) {
        resolve(window.confirm(message));
        return;
      }

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (okBtn) {
        okBtn.textContent = confirmText;
        okBtn.className = `btn btn-sm ${confirmClass}`;
      }

      modal.style.display = 'flex';

      const cleanup = () => {
        modal.style.display = 'none';
        okBtn?.removeEventListener('click', onOk);
        cancelBtn?.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
      };

      const onOk = () => {
        cleanup();
        resolve(true);
      };
      const onCancel = () => {
        cleanup();
        resolve(false);
      };
      const onBackdrop = (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(false);
        }
      };

      okBtn?.addEventListener('click', onOk);
      cancelBtn?.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
    });
  }

  /* --------------------------------------------------------------------------
     Theme Management
     -------------------------------------------------------------------------- */
  initTheme() {
    const toggleBtn = document.getElementById('btn-theme-toggle');
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    this.updateThemeIcon(currentTheme);

    toggleBtn?.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const nextTheme = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('hs-theme', nextTheme);
      this.updateThemeIcon(nextTheme);

      // Re-render flowchart if visible so SVG colours synchronize
      if (this.activeTab === 'tab-flowchart' && this.handoverData && this.handoverData.flowchart) {
        const flowContainer = document.getElementById('flowchart-svg-container');
        if (flowContainer) {
          flowContainer.innerHTML = this.generateClientSvgMarkup(this.handoverData.flowchart);
        }
      }

      this.showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} theme`, 'info', 2000);
    });
  }

  updateThemeIcon(theme) {
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (!toggleBtn) return;
    if (theme === 'light') {
      toggleBtn.innerHTML = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
      toggleBtn.title = 'Switch to Dark Mode';
    } else {
      toggleBtn.innerHTML = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
      toggleBtn.title = 'Switch to Light Mode';
    }
  }

  /* --------------------------------------------------------------------------
     Sidebar Management
     -------------------------------------------------------------------------- */
  initSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    const mobileBtn = document.getElementById('btn-mobile-menu');

    if (localStorage.getItem('hs-sidebar-collapsed') === 'true' && window.innerWidth > 992) {
      sidebar?.classList.add('collapsed');
    }

    toggleBtn?.addEventListener('click', () => {
      sidebar?.classList.toggle('collapsed');
      const isCollapsed = sidebar?.classList.contains('collapsed');
      localStorage.setItem('hs-sidebar-collapsed', isCollapsed ? 'true' : 'false');
    });

    mobileBtn?.addEventListener('click', () => {
      sidebar?.classList.toggle('mobile-open');
    });

    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        if (window.innerWidth <= 992) {
          sidebar?.classList.remove('mobile-open');
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
     Screenshot Lightbox
     -------------------------------------------------------------------------- */
  initLightbox() {
    const viewer = document.getElementById('screenshot-viewer-box');
    const modal = document.getElementById('modal-lightbox');
    const img = document.getElementById('lightbox-img');

    viewer?.addEventListener('click', () => {
      const stepImg = document.getElementById('step-screenshot-img');
      if (stepImg && stepImg.src && modal && img) {
        img.src = stepImg.src;
        modal.style.display = 'flex';
      }
    });

    modal?.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        const view = el.dataset.view;
        this.switchView(view);
      });
    });

    // Dashboard Actions
    document.getElementById('btn-hero-record')?.addEventListener('click', () => this.switchView('record'));
    document.getElementById('btn-hero-guide')?.addEventListener('click', () => this.switchView('guide'));
    document.getElementById('btn-guide-start-rec')?.addEventListener('click', () => this.switchView('record'));
    document.getElementById('btn-guide-open-demo')?.addEventListener('click', () => {
      this.loadHandover('demo-market-research-01');
      this.switchView('review');
    });
    document.getElementById('btn-hero-demo')?.addEventListener('click', () => {
      this.loadHandover('demo-market-research-01');
      this.switchView('review');
    });
    document.getElementById('btn-hero-upload')?.addEventListener('click', () => {
      document.getElementById('hero-video-upload-input')?.click();
    });
    document.getElementById('hero-video-upload-input')?.addEventListener('change', (e) => {
      this.handleVideoUpload(e);
    });
    document.getElementById('btn-refresh-list')?.addEventListener('click', () => this.loadDashboardHandovers());

    // Guide Sub-tabs
    document.querySelectorAll('.guide-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabKey = btn.dataset.guideTab;
        if (tabKey) this.switchGuideTab(tabKey);
      });
    });

    // Search, Filter & Sort Controls
    document.getElementById('dashboard-search-input')?.addEventListener('input', (e) => {
      this.dashboardSearch = e.target.value.trim().toLowerCase();
      this.renderDashboardHandoverCards();
    });

    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.dashboardFilter = btn.dataset.filter || 'all';
        this.renderDashboardHandoverCards();
      });
    });

    document.getElementById('dashboard-sort-select')?.addEventListener('change', (e) => {
      this.dashboardSort = e.target.value;
      this.renderDashboardHandoverCards();
    });

    // Switch Handover Pill
    document.getElementById('btn-switch-handover')?.addEventListener('click', () => this.switchView('library'));

    // Output Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Recorder Controls
    document.getElementById('btn-start-record')?.addEventListener('click', () => this.handleStartRecord());
    document.getElementById('btn-pause-record')?.addEventListener('click', () => this.handlePauseRecord());
    document.getElementById('btn-stop-record')?.addEventListener('click', () => this.handleStopRecord());
    document.getElementById('btn-add-marker')?.addEventListener('click', () => this.handleAddMarker());
    document.getElementById('btn-discard-record')?.addEventListener('click', () => this.handleDiscardRecord());
    document.getElementById('btn-run-reconstruction')?.addEventListener('click', () => this.handleRunReconstruction());

    // Review Actions
    document.getElementById('btn-open-redact-modal')?.addEventListener('click', () => this.openRedactModal());
    document.getElementById('btn-cancel-redact')?.addEventListener('click', () => this.closeRedactModal());
    document.getElementById('btn-confirm-redact')?.addEventListener('click', () => this.handleApplyRedact());
    document.getElementById('btn-approve-handover')?.addEventListener('click', () => this.handleApproveHandover());

    // Step Edit Modal
    document.getElementById('btn-cancel-edit-step')?.addEventListener('click', () => this.closeEditStepModal());
    document.getElementById('btn-save-edit-step')?.addEventListener('click', () => this.handleSaveEditStep());

    // Flowchart Zoom Controls
    document.getElementById('btn-flow-zoom-in')?.addEventListener('click', () => this.adjustFlowZoom(0.15));
    document.getElementById('btn-flow-zoom-out')?.addEventListener('click', () => this.adjustFlowZoom(-0.15));
    document.getElementById('btn-flow-reset')?.addEventListener('click', () => {
      this.flowZoom = 1.0;
      this.updateFlowZoomTransform();
    });

    // Presentation Deck Controls
    document.getElementById('btn-prev-slide')?.addEventListener('click', () => this.changeSlide(-1));
    document.getElementById('btn-next-slide')?.addEventListener('click', () => this.changeSlide(1));

    // Copy SOP
    document.getElementById('btn-copy-sop')?.addEventListener('click', () => this.copySopMarkdown());

    // Assistant Chat
    document.getElementById('btn-send-chat')?.addEventListener('click', () => this.handleSendAssistantChat());
    document.getElementById('assistant-chat-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSendAssistantChat();
    });
    // Suggestion Chips
    document.querySelectorAll('.chip-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.dataset.query;
        if (query) {
          const input = document.getElementById('assistant-chat-input');
          if (input) input.value = query;
          this.handleSendAssistantChat();
        }
      });
    });

    // Verification Practice Actions
    document.getElementById('btn-reset-practice')?.addEventListener('click', () => this.resetPractice());
    document.getElementById('btn-submit-practice')?.addEventListener('click', () => this.handleSubmitPractice());
    document.getElementById('btn-cancel-flag')?.addEventListener('click', () => this.closeFlagModal());
    document.getElementById('btn-confirm-flag')?.addEventListener('click', () => this.handleConfirmFlag());

    // Library Search
    document.getElementById('library-search')?.addEventListener('input', (e) => this.filterLibrary(e.target.value));
  }

  initRecorderCallbacks() {
    this.recorder.onTick = (sec, timeStr) => {
      const timerEl = document.getElementById('recording-timer');
      if (timerEl) timerEl.textContent = timeStr;
    };

    this.recorder.onMarkerAdded = (marker) => {
      this.renderMarkersList();
    };

    this.recorder.onStop = (data) => {
      document.getElementById('recording-live-indicator').style.display = 'none';
      document.getElementById('btn-start-record').style.display = 'inline-flex';
      document.getElementById('btn-pause-record').style.display = 'none';
      document.getElementById('btn-stop-record').style.display = 'none';
      document.getElementById('post-record-actions').style.display = 'flex';

      const playback = document.getElementById('recorded-playback');
      playback.src = data.url;
      playback.style.display = 'block';
      document.getElementById('live-video-preview').style.display = 'none';
      document.getElementById('recording-empty-state').style.display = 'none';
    };
  }

  switchView(viewName) {
    this.activeView = viewName;

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === viewName);
    });

    // Hide all view containers
    const views = ['dashboard', 'record', 'review', 'outputs', 'verification', 'library', 'security', 'coverage-packs', 'covering-tasks', 'guide'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.style.display = v === viewName ? 'block' : 'none';
    });

    // Update header title
    const titles = {
      dashboard: 'Enterprise Dashboard',
      record: 'Watch Me Work — Live Screen Recording',
      review: 'Review Studio — Workflow Inspection & Evidence',
      outputs: 'Multi-Format Outputs Studio',
      verification: 'Handover Verification Studio (Agent 10)',
      library: 'Process Library (Reusable SOPs)',
      'coverage-packs': 'Holiday & Transfer Coverage Packs',
      'covering-tasks': 'My Assigned Tasks — Covering Colleague Workspace',
      security: 'Security, Privacy & Audit Trail',
      guide: 'About Handover Studio & System Guide'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.innerHTML = `<span>${titles[viewName] || 'Handover Studio'}</span>`;

    if (viewName === 'library') this.loadProcessLibrary();
    if (viewName === 'coverage-packs') this.loadCoveragePacks();
    if (viewName === 'covering-tasks') this.loadCoveringTasks();
    if (viewName === 'security') this.loadAuditLogs();
    if (viewName === 'verification') this.renderVerificationStudio();
    if (viewName === 'outputs') this.renderOutputs();
  }

  switchGuideTab(tabKey) {
    document.querySelectorAll('.guide-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.guideTab === tabKey);
    });
    document.querySelectorAll('.guide-content-panel').forEach(p => {
      p.classList.toggle('active', p.id === `guide-panel-${tabKey}`);
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
    ['tab-sop', 'tab-video', 'tab-pptx', 'tab-flowchart', 'tab-assistant'].forEach(t => {
      const el = document.getElementById(t);
      if (el) el.style.display = t === tabId ? 'block' : 'none';
    });

    if (tabId === 'tab-pptx') this.renderActiveSlide();
  }

  async loadHandover(id) {
    try {
      const res = await fetch(`/api/handovers/${id}`);
      if (!res.ok) throw new Error('Failed to load handover');
      const data = await res.json();
      this.currentHandoverId = id;
      this.handoverData = data;

      // Update Top Bar Pill
      const pill = document.getElementById('active-handover-pill');
      if (pill) {
        pill.textContent = `Active: ${data.title.substring(0, 34)}${data.title.length > 34 ? '...' : ''}`;
      }

      this.renderReviewStudio();
      this.renderOutputs();
      this.renderVerificationStudio();
    } catch (err) {
      console.error('Error loading handover:', err);
    }
  }

  handleVideoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const playback = document.getElementById('recorded-playback');
    if (playback) {
      playback.src = url;
      playback.style.display = 'block';
    }
    document.getElementById('live-video-preview').style.display = 'none';
    document.getElementById('recording-empty-state').style.display = 'none';
    document.getElementById('post-record-actions').style.display = 'flex';
    document.getElementById('recording-live-indicator').style.display = 'none';
    document.getElementById('btn-start-record').style.display = 'inline-flex';
    document.getElementById('btn-pause-record').style.display = 'none';
    document.getElementById('btn-stop-record').style.display = 'none';

    this.recorder.markers = [
      { timestamp: '00:05', timestampSec: 5, label: `Uploaded: ${file.name.substring(0, 32)}` }
    ];
    this.renderMarkersList();
    document.getElementById('recording-marker-panel').style.display = 'block';

    this.switchView('record');
    this.showToast(`Recording "${file.name}" loaded. Click "Run AI Agent Workflow Reconstruction" to generate your handover.`, 'success', 4000);
  }

  async loadDashboardHandovers() {
    try {
      const res = await fetch('/api/dashboard/overview');
      if (!res.ok) throw new Error('Failed to load dashboard overview');
      const data = await res.json();
      this.dashboardData = data;

      const { stats, attentionItems } = data;

      // 1. Populate Metrics
      const awaitingEl = document.getElementById('stat-awaiting-review');
      if (awaitingEl) awaitingEl.textContent = stats.awaitingReview;

      const approvedEl = document.getElementById('stat-approved');
      if (approvedEl) approvedEl.textContent = stats.approved;

      const clarifyEl = document.getElementById('stat-clarifications');
      if (clarifyEl) clarifyEl.textContent = stats.pendingClarifications;

      const verifEl = document.getElementById('stat-verified-count');
      if (verifEl) verifEl.textContent = stats.verifiedHandovers;

      const readinessEl = document.getElementById('stat-readiness');
      if (readinessEl) readinessEl.textContent = `${stats.avgReadiness}%`;

      // 2. Populate Needs Your Attention Section
      const attentionCountBadge = document.getElementById('attention-count-badge');
      const attentionContainer = document.getElementById('attention-items-container');

      if (attentionCountBadge) {
        attentionCountBadge.textContent = `${attentionItems.length} Item${attentionItems.length === 1 ? '' : 's'}`;
        attentionCountBadge.style.display = attentionItems.length > 0 ? 'inline-block' : 'none';
      }

      if (attentionContainer) {
        if (attentionItems.length === 0) {
          attentionContainer.innerHTML = `
            <div class="attention-empty-state">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:var(--success); flex-shrink:0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              <span><strong>All caught up!</strong> Every reconstructed handover is reviewed and published. No pending clarification gaps or verification friction points.</span>
            </div>
          `;
        } else {
          attentionContainer.innerHTML = attentionItems.map(item => {
            let iconSvg = '';
            if (item.type === 'clarification') {
              iconSvg = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
            } else if (item.type === 'approval') {
              iconSvg = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
            } else {
              iconSvg = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
            }

            return `
              <div class="attention-card ${item.severity || 'info'}">
                <div class="attention-left">
                  <div class="attention-icon-box ${item.severity || 'info'}">
                    ${iconSvg}
                  </div>
                  <div class="attention-info">
                    <div class="attention-item-title">${item.title}</div>
                    <div class="attention-item-desc">${item.description}</div>
                  </div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="app.handleAttentionAction('${item.handoverId}', '${item.targetView}')">
                  ${item.actionLabel} &rarr;
                </button>
              </div>
            `;
          }).join('');
        }
      }

      // 3. Render Handover Cards
      this.renderDashboardHandoverCards();
    } catch (err) {
      console.error('Error fetching dashboard list:', err);
    }
  }

  handleAttentionAction(handoverId, targetView) {
    if (targetView === 'coverage-packs' || targetView === 'covering-tasks') {
      this.switchView(targetView);
    } else {
      this.loadHandover(handoverId);
      this.switchView(targetView || 'review');
    }
  }

  renderDashboardHandoverCards() {
    const container = document.getElementById('dashboard-handover-cards');
    if (!container || !this.dashboardData) return;

    let list = [...(this.dashboardData.handovers || [])];

    // Filter
    if (this.dashboardFilter === 'review') {
      list = list.filter(h => h.status !== 'approved');
    } else if (this.dashboardFilter === 'approved') {
      list = list.filter(h => h.status === 'approved');
    } else if (this.dashboardFilter === 'demo') {
      list = list.filter(h => h.isDemo);
    }

    // Search
    if (this.dashboardSearch) {
      const q = this.dashboardSearch;
      list = list.filter(h => 
        (h.title || '').toLowerCase().includes(q) ||
        (h.owner_name || '').toLowerCase().includes(q) ||
        (h.task_description || '').toLowerCase().includes(q) ||
        (h.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (h.applications || []).some(a => a.toLowerCase().includes(q))
      );
    }

    // Sort
    if (this.dashboardSort === 'readiness') {
      list.sort((a, b) => (b.readiness_score || 0) - (a.readiness_score || 0));
    } else if (this.dashboardSort === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      list.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 36px 20px; text-align: center; background: var(--bg-base); border-radius: var(--radius-md); border: 1px dashed var(--border-medium);">
          <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No matching handovers found</div>
          <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">Try adjusting your search keywords or active filter tab.</div>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('dashboard-search-input').value=''; app.dashboardSearch=''; app.dashboardFilter='all'; document.querySelectorAll('.filter-pill').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all')); app.renderDashboardHandoverCards();">
            Clear Filters
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(h => {
      const isApproved = h.status === 'approved';
      const stepsCount = h.stepsCount || 0;
      const readiness = h.readiness_score || 75;
      const isDemo = h.isDemo;

      // Format updated date nicely
      let dateStr = 'Recently updated';
      if (h.updated_at) {
        try {
          const d = new Date(h.updated_at);
          dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {}
      }

      // App chips
      const appChips = (h.applications && h.applications.length > 0)
        ? h.applications.slice(0, 2).join(' • ')
        : 'Desktop / Browser';

      return `
        <div class="handover-card" onclick="app.selectHandover('${h.id}')">
          <div>
            <div class="handover-card-header">
              <span class="badge ${isDemo ? 'badge-observed' : 'badge-status'}" style="font-size:10.5px;">
                ${isDemo ? 'Demo Template' : 'Live Handover'}
              </span>
              <span class="badge ${isApproved ? 'badge-confirmed' : 'badge-suggested'}" style="font-size:10.5px;">
                ${isApproved ? 'Approved' : 'In Review'}
              </span>
            </div>

            <div class="handover-card-title">${h.title}</div>
            <div class="handover-card-desc">${h.task_description || 'Operational procedure reconstructed by Handover Studio autonomous agent pipeline.'}</div>

            <div class="handover-card-meta">
              <div class="handover-card-owner">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span>${h.owner_name ? h.owner_name.split(' ')[0] : 'Owner'}</span>
              </div>
              <div>${stepsCount} steps • ${appChips}</div>
              <div>${dateStr}</div>
            </div>

            <div class="handover-card-formats">
              <span class="format-chip active" title="Word Document SOP (.docx)">DOCX</span>
              <span class="format-chip active" title="PowerPoint Presentation (.pptx)">PPTX</span>
              <span class="format-chip active" title="Vector Process Flowchart (.svg)">SVG</span>
              <span class="format-chip active" title="Chaptered Video Walkthrough (.vtt)">VIDEO</span>
              <span class="format-chip active" title="Grounded AI Assistant">AI CHAT</span>
            </div>
          </div>

          <div class="handover-card-footer" onclick="event.stopPropagation()">
            <div style="font-size:12px; font-weight:700; color:${readiness >= 90 ? 'var(--success)' : 'var(--warning)'}; display:flex; align-items:center; gap:4px;">
              <span class="metric-dot ${readiness >= 90 ? 'success' : 'warning'}"></span>
              <span>${readiness}% Readiness</span>
            </div>

            <div style="display:flex; gap:6px;">
              ${isApproved ? `
                <button class="btn btn-secondary btn-sm" onclick="app.loadHandover('${h.id}'); app.switchView('outputs');" title="Open multi-format generated outputs">
                  View Materials
                </button>
              ` : `
                <button class="btn btn-primary btn-sm" onclick="app.loadHandover('${h.id}'); app.switchView('review');" title="Review reconstructed steps">
                  Review Workflow
                </button>
              `}
              <button class="btn btn-secondary btn-sm" onclick="app.loadHandover('${h.id}'); app.switchView('verification');" title="Practice walkthrough">
                Practice
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  selectHandover(id) {
    this.loadHandover(id);
    this.switchView('review');
  }

  /* --------------------------------------------------------------------------
     Review Studio Engine & Interaction Suite
     -------------------------------------------------------------------------- */
  initReviewStudioEvents() {
    // Back to Dashboard
    document.getElementById('btn-review-back-dashboard')?.addEventListener('click', () => {
      this.switchView('dashboard');
    });

    // Guided Mode Toggle
    document.getElementById('btn-toggle-guided-mode')?.addEventListener('click', () => {
      this.guidedReviewActive = !this.guidedReviewActive;
      const bar = document.getElementById('guided-review-bar');
      const text = document.getElementById('guided-mode-toggle-text');
      if (bar) bar.style.display = this.guidedReviewActive ? 'flex' : 'none';
      if (text) text.textContent = this.guidedReviewActive ? 'Exit Guided' : 'Guided Review';
      if (this.guidedReviewActive) this.setGuidedStage(1);
    });

    // Guided Stage Tabs
    document.querySelectorAll('.guided-stage-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const stage = parseInt(tab.dataset.stage, 10);
        if (stage) this.setGuidedStage(stage);
      });
    });

    document.getElementById('btn-guided-next')?.addEventListener('click', () => {
      if (this.guidedReviewStage < 4) {
        this.setGuidedStage(this.guidedReviewStage + 1);
      } else {
        this.handleApproveHandover();
      }
    });

    document.getElementById('btn-guided-prev')?.addEventListener('click', () => {
      if (this.guidedReviewStage > 1) {
        this.setGuidedStage(this.guidedReviewStage - 1);
      }
    });

    // Clarifications Drawer
    document.getElementById('btn-toggle-clarifications')?.addEventListener('click', () => {
      this.toggleClarificationsDrawer(true);
    });
    document.getElementById('btn-close-clarifications')?.addEventListener('click', () => {
      this.toggleClarificationsDrawer(false);
    });
    document.getElementById('clarifications-overlay')?.addEventListener('click', () => {
      this.toggleClarificationsDrawer(false);
    });

    // Jump Next Unresolved
    document.getElementById('btn-jump-next-unresolved')?.addEventListener('click', () => {
      this.jumpNextUnresolved();
    });

    // Expand All / Collapse All
    document.getElementById('btn-toggle-expand-all')?.addEventListener('click', () => {
      this.toggleExpandAll();
    });

    // Add Step Modal Button
    document.getElementById('btn-add-step-modal')?.addEventListener('click', () => {
      this.openAddStepModal();
    });

    // Video Playback Controls
    document.getElementById('btn-video-play')?.addEventListener('click', () => {
      this.togglePlayback();
    });
    document.getElementById('btn-step-prev')?.addEventListener('click', () => {
      if (this.currentStepIndex > 0) this.selectStep(this.currentStepIndex - 1);
    });
    document.getElementById('btn-step-next')?.addEventListener('click', () => {
      const steps = this.handoverData?.workflow?.steps || [];
      if (this.currentStepIndex < steps.length - 1) this.selectStep(this.currentStepIndex + 1);
    });
    document.getElementById('btn-playback-speed')?.addEventListener('click', (e) => {
      this.cyclePlaybackSpeed(e.target);
    });

    // Interactive Timeline Track Scrubber Click
    document.getElementById('timeline-track-wrapper')?.addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const totalSec = this.getVideoDurationSec();
      const targetSec = Math.round(ratio * totalSec);
      this.seekToSeconds(targetSec);
    });
  }

  setGuidedStage(stage) {
    this.guidedReviewStage = stage;
    document.querySelectorAll('.guided-stage-tab').forEach(t => {
      const s = parseInt(t.dataset.stage, 10);
      t.classList.toggle('active', s === stage);
      t.classList.toggle('completed', s < stage);
    });

    const prevBtn = document.getElementById('btn-guided-prev');
    const nextBtn = document.getElementById('btn-guided-next');
    if (prevBtn) prevBtn.style.display = stage > 1 ? 'inline-flex' : 'none';
    if (nextBtn) {
      if (stage === 1) nextBtn.textContent = 'Continue to Knowledge Gaps ➔';
      else if (stage === 2) nextBtn.textContent = 'Continue to Step Verification ➔';
      else if (stage === 3) nextBtn.textContent = 'Proceed to Approval ➔';
      else nextBtn.textContent = 'Approve & Publish Handover';
    }

    if (stage === 2) {
      this.toggleClarificationsDrawer(true);
    } else {
      this.toggleClarificationsDrawer(false);
    }

    if (stage === 1) {
      this.selectStep(0);
      this.showToast('Stage 1: Review observed recording, step events, and timestamps.', 'info', 2500);
    } else if (stage === 2) {
      this.showToast('Stage 2: Answer clarifying questions to capture missing decision rules.', 'info', 2500);
    } else if (stage === 3) {
      this.showToast('Stage 3: Inspect step instructions, verification checks, and warnings.', 'info', 2500);
    } else if (stage === 4) {
      this.showToast('Stage 4: Review readiness criteria and publish for your covering team.', 'info', 2500);
    }
  }

  toggleClarificationsDrawer(open) {
    const drawer = document.getElementById('clarifications-drawer');
    const overlay = document.getElementById('clarifications-overlay');
    if (drawer) drawer.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('open', open);
  }

  parseTimestampToSeconds(ts) {
    if (!ts) return 0;
    const parts = ts.toString().split(':').map(p => parseInt(p, 10));
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    return 0;
  }

  formatSecondsToTimestamp(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  getVideoDurationSec() {
    const steps = this.handoverData?.workflow?.steps || [];
    if (steps.length > 0) {
      const lastSec = this.parseTimestampToSeconds(steps[steps.length - 1].timestamp);
      return Math.max(134, lastSec + 15);
    }
    return 134;
  }

  seekToSeconds(sec) {
    const totalSec = this.getVideoDurationSec();
    this.currentPlaybackSec = Math.max(0, Math.min(totalSec, sec));

    const ratio = (this.currentPlaybackSec / totalSec) * 100;
    const fill = document.getElementById('timeline-progress-fill');
    if (fill) fill.style.width = `${ratio}%`;

    const timeReadout = document.getElementById('current-playback-time');
    if (timeReadout) timeReadout.textContent = this.formatSecondsToTimestamp(this.currentPlaybackSec);

    // Synchronize video player if actual stream exists
    const vidPlayer = document.getElementById('review-video-player');
    if (vidPlayer && vidPlayer.duration) {
      vidPlayer.currentTime = this.currentPlaybackSec;
    }

    // Find closest step matching this second
    const steps = this.handoverData?.workflow?.steps || [];
    let matchedIdx = 0;
    for (let i = 0; i < steps.length; i++) {
      const stepSec = this.parseTimestampToSeconds(steps[i].timestamp);
      if (stepSec <= this.currentPlaybackSec) {
        matchedIdx = i;
      } else {
        break;
      }
    }
    if (matchedIdx !== this.currentStepIndex) {
      this.selectStep(matchedIdx, false);
    }
  }

  togglePlayback() {
    this.isPlaying = !this.isPlaying;
    const icon = document.getElementById('icon-play-toggle');
    const vidPlayer = document.getElementById('review-video-player');

    if (this.isPlaying) {
      if (icon) icon.innerHTML = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;
      if (vidPlayer && vidPlayer.src) vidPlayer.play().catch(() => {});
      this.playInterval = setInterval(() => {
        const totalSec = this.getVideoDurationSec();
        if (this.currentPlaybackSec >= totalSec) {
          this.togglePlayback();
          return;
        }
        this.seekToSeconds(this.currentPlaybackSec + (1 * this.playbackSpeed));
      }, 1000);
    } else {
      if (icon) icon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
      if (vidPlayer) vidPlayer.pause();
      if (this.playInterval) clearInterval(this.playInterval);
      this.playInterval = null;
    }
  }

  cyclePlaybackSpeed(btn) {
    if (this.playbackSpeed === 1.0) this.playbackSpeed = 1.5;
    else if (this.playbackSpeed === 1.5) this.playbackSpeed = 2.0;
    else this.playbackSpeed = 1.0;
    if (btn) btn.textContent = `${this.playbackSpeed.toFixed(1)}x`;

    const vidPlayer = document.getElementById('review-video-player');
    if (vidPlayer) vidPlayer.playbackRate = this.playbackSpeed;
  }

  jumpNextUnresolved() {
    const questions = this.handoverData?.questions || [];
    const pendingQ = questions.find(q => q.status === 'pending');
    if (pendingQ) {
      const steps = this.handoverData?.workflow?.steps || [];
      const idx = steps.findIndex(s => s.id === pendingQ.step_id);
      if (idx !== -1) this.selectStep(idx);
      this.toggleClarificationsDrawer(true);
      this.showToast(`Jumped to pending question: "${pendingQ.question.substring(0, 36)}..."`, 'info', 2500);
      return;
    }

    const steps = this.handoverData?.workflow?.steps || [];
    const suggestedIdx = steps.findIndex(s => s.status === 'Suggested');
    if (suggestedIdx !== -1) {
      this.selectStep(suggestedIdx);
      this.showToast(`Selected suggested step requiring confirmation: Step ${steps[suggestedIdx].stepNumber}`, 'info', 2500);
      return;
    }

    this.showToast('All workflow steps and clarification questions are verified!', 'success', 2500);
  }

  toggleExpandAll() {
    this.allStepsExpanded = !this.allStepsExpanded;
    const btn = document.getElementById('btn-toggle-expand-all');
    if (btn) btn.textContent = this.allStepsExpanded ? 'Collapse All' : 'Expand All';

    const steps = this.handoverData?.workflow?.steps || [];
    if (this.allStepsExpanded) {
      steps.forEach(s => this.expandedStepIds.add(s.id));
    } else {
      this.expandedStepIds.clear();
      // Keep active step open
      if (steps[this.currentStepIndex]) {
        this.expandedStepIds.add(steps[this.currentStepIndex].id);
      }
    }
    this.renderReviewStudio();
  }

  toggleStepExpand(stepId) {
    if (this.expandedStepIds.has(stepId)) {
      this.expandedStepIds.delete(stepId);
    } else {
      this.expandedStepIds.add(stepId);
    }
    const body = document.getElementById(`step-body-${stepId}`);
    const chevron = document.getElementById(`step-chevron-${stepId}`);
    if (body) body.classList.toggle('open', this.expandedStepIds.has(stepId));
    if (chevron) chevron.classList.toggle('expanded', this.expandedStepIds.has(stepId));
  }

  renderReviewStudio() {
    if (!this.handoverData) return;
    const wf = this.handoverData.workflow || {};
    const steps = wf.steps || [];
    const questions = this.handoverData.questions || [];

    // 1. Header & Progress Strip
    const taskTitleEl = document.getElementById('review-task-title');
    if (taskTitleEl) taskTitleEl.textContent = wf.title || 'Workplace Handover';

    const taskMetaEl = document.getElementById('review-task-meta');
    if (taskMetaEl) taskMetaEl.textContent = `Owner: ${wf.owner || 'Sarah Jenkins'} • ${steps.length} Steps • Target: ${wf.targetRole || 'Covering Colleague'}`;

    const stepsReviewedEl = document.getElementById('progress-steps-reviewed');
    const confirmedCount = steps.filter(s => s.status === 'Confirmed').length;
    if (stepsReviewedEl) stepsReviewedEl.textContent = `${confirmedCount} / ${steps.length}`;

    const answeredCount = questions.filter(q => q.status === 'answered').length;
    const qAnsweredEl = document.getElementById('progress-questions-answered');
    if (qAnsweredEl) qAnsweredEl.textContent = `${answeredCount} / ${questions.length}`;

    const readinessEl = document.getElementById('progress-readiness-tier');
    if (readinessEl) readinessEl.textContent = `${this.handoverData.readiness_score || 93}% Readiness`;

    const pendingQCount = questions.filter(q => q.status === 'pending').length;
    const pendingQBadge = document.getElementById('pending-q-count');
    if (pendingQBadge) {
      pendingQBadge.textContent = pendingQCount;
      pendingQBadge.style.display = pendingQCount > 0 ? 'inline-block' : 'none';
    }

    const stepsCountTitle = document.getElementById('workflow-steps-count-title');
    if (stepsCountTitle) stepsCountTitle.textContent = `Reconstructed Workflow (${steps.length} Steps)`;

    // 2. Timeline Markers Ingestion
    const totalSec = this.getVideoDurationSec();
    const markersContainer = document.getElementById('timeline-markers-container');
    const totalTimeEl = document.getElementById('total-playback-time');
    if (totalTimeEl) totalTimeEl.textContent = this.formatSecondsToTimestamp(totalSec);

    if (markersContainer) {
      markersContainer.innerHTML = steps.map((s, idx) => {
        const stepSec = this.parseTimestampToSeconds(s.timestamp);
        const pct = Math.max(0, Math.min(100, (stepSec / totalSec) * 100));
        return `
          <div class="timeline-marker-pin ${idx === this.currentStepIndex ? 'active' : ''}"
               style="left:${pct}%;"
               title="Step ${s.stepNumber}: ${s.title} (@ ${s.timestamp})"
               onclick="event.stopPropagation(); app.selectStep(${idx});">
          </div>
        `;
      }).join('');
    }

    // 3. Right Panel: Workflow Cards with Progressive Disclosure
    const stepsContainer = document.getElementById('workflow-steps-list');
    if (stepsContainer) {
      stepsContainer.innerHTML = steps.map((s, idx) => {
        const isActive = idx === this.currentStepIndex;
        const isExpanded = this.expandedStepIds.has(s.id);
        const classification = s.status || 'Observed';
        const classLower = classification.toLowerCase();

        return `
          <div class="review-step-card ${classLower} ${isActive ? 'active' : ''}" id="step-card-${s.id}">
            <!-- Collapsed Header -->
            <div class="step-card-header" onclick="app.selectStep(${idx})">
              <div class="step-card-left">
                <span class="step-circle-badge">${s.stepNumber}</span>
                <div class="step-card-title-group">
                  <span class="step-card-title">${s.title}</span>
                  <div class="step-card-meta-pill">
                    <span>${s.app || 'Qualtrics'} @ ${s.timestamp || '00:00'}</span>
                    <span class="badge ${classification === 'Confirmed' ? 'badge-confirmed' : classification === 'Suggested' ? 'badge-suggested' : 'badge-observed'}" style="font-size:10px; padding:1px 6px;">
                      ${classification}
                    </span>
                  </div>
                </div>
              </div>

              <div class="step-card-actions" onclick="event.stopPropagation()">
                <button class="btn-card-action" onclick="app.openEditStepModal('${s.id}')" title="Edit step details">
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-card-action" onclick="app.handleMoveStep('${s.id}', -1)" title="Move step up" ${idx === 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                </button>
                <button class="btn-card-action" onclick="app.handleMoveStep('${s.id}', 1)" title="Move step down" ${idx === steps.length - 1 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                </button>
                <button class="btn-card-action" onclick="app.handleDeleteStep('${s.id}')" title="Delete step" style="color:var(--danger);">
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
                <button class="btn-card-action" onclick="app.toggleStepExpand('${s.id}')" title="Expand / collapse instructions">
                  <svg class="step-expand-chevron ${isExpanded ? 'expanded' : ''}" id="step-chevron-${s.id}" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
              </div>
            </div>

            <!-- Expanded Body (Progressive Disclosure) -->
            <div class="step-card-body ${isExpanded ? 'open' : ''}" id="step-body-${s.id}">
              <div class="step-card-desc">${s.description || 'No detailed instructions provided.'}</div>

              <div class="step-callouts-stack">
                ${s.decision ? `
                  <div class="callout-pill-box decision">
                    <strong>Decision Threshold:</strong> ${s.decision}
                  </div>
                ` : ''}
                ${s.validation ? `
                  <div class="callout-pill-box validation">
                    <strong>Verification Check:</strong> ${s.validation}
                  </div>
                ` : ''}
                ${s.caution ? `
                  <div class="callout-pill-box caution">
                    <strong>Caution:</strong> ${s.caution}
                  </div>
                ` : ''}
              </div>

              <div class="step-footer-actions">
                <div style="font-size:11px; color:var(--text-muted);">
                  Telemetry: Captured via ${s.app || 'Desktop App'} @ ${s.timestamp || '00:00'}
                </div>
                <div style="display:flex; gap:6px;">
                  ${classification !== 'Confirmed' ? `
                    <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:3px 8px;" onclick="app.handleMarkConfirmed('${s.id}')">
                      Mark Confirmed
                    </button>
                  ` : ''}
                  <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:3px 8px;" onclick="app.handleAddDecisionBranch('${s.id}')">
                    + Add Decision Branch
                  </button>
                  <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:3px 8px;" onclick="app.openEditStepModal('${s.id}')">
                    Edit Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 4. Clarifications Drawer
    const drawerList = document.getElementById('drawer-clarifications-list');
    if (drawerList) {
      if (questions.length === 0) {
        drawerList.innerHTML = `<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:30px 10px;">All knowledge gaps are resolved. No pending questions.</div>`;
      } else {
        drawerList.innerHTML = questions.map(q => {
          const isAnswered = q.status === 'answered';
          return `
            <div style="background:var(--bg-base); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); border-left:3px solid ${isAnswered ? 'var(--success)' : 'var(--warning)'};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span class="badge ${isAnswered ? 'badge-confirmed' : 'badge-suggested'}" style="font-size:10px;">
                  ${q.importance ? q.importance.toUpperCase() : 'HIGH'} GAP
                </span>
                <span style="font-size:11px; color:var(--text-muted);">${isAnswered ? 'Resolved' : 'Pending Answer'}</span>
              </div>
              <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:4px; line-height:1.4;">${q.question}</div>
              <div style="font-size:11.5px; color:var(--text-secondary); margin-bottom:10px; line-height:1.4;">${q.context}</div>

              ${isAnswered ? `
                <div style="font-size:12px; color:var(--success); background:rgba(16, 185, 129, 0.08); padding:8px 10px; border-radius:4px; border:1px solid var(--success-border);">
                  <strong>Confirmed Rule:</strong> ${q.answer}
                </div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                  <input type="text" id="drawer-answer-input-${q.id}" class="chat-input" placeholder="Explain the decision rule..." style="font-size:12px;">
                  <button class="btn btn-primary btn-sm" onclick="app.submitDrawerClarification('${q.id}')">Save &amp; Merge into Workflow</button>
                </div>
              `}
            </div>
          `;
        }).join('');
      }
    }

    this.selectStep(this.currentStepIndex, false);
  }

  selectStep(idx, seekTimeline = true) {
    if (!this.handoverData) return;
    const steps = this.handoverData.workflow?.steps || [];
    if (!steps[idx]) return;

    this.currentStepIndex = idx;
    const step = steps[idx];

    // Auto expand active card
    this.expandedStepIds.add(step.id);

    // Update active highlight on all cards
    document.querySelectorAll('.review-step-card').forEach((el, i) => {
      el.classList.toggle('active', i === idx);
    });

    // Expand body in DOM
    const body = document.getElementById(`step-body-${step.id}`);
    const chevron = document.getElementById(`step-chevron-${step.id}`);
    if (body) body.classList.add('open');
    if (chevron) chevron.classList.add('expanded');

    // Update Left Panel: Screenshot & Zoom Lightbox Source
    const screenshotEl = document.getElementById('review-screenshot-display');
    if (screenshotEl) {
      screenshotEl.src = step.screenshot || '/assets/step_placeholder.svg';
    }

    // Update Telemetry Context
    const timeBadge = document.getElementById('active-step-time-badge');
    if (timeBadge) timeBadge.textContent = `@ ${step.timestamp || '00:00'}`;

    const classBadge = document.getElementById('active-step-classification');
    if (classBadge) {
      classBadge.textContent = step.status || 'Observed';
      classBadge.className = `badge ${step.status === 'Confirmed' ? 'badge-confirmed' : step.status === 'Suggested' ? 'badge-suggested' : 'badge-observed'}`;
    }

    const appEl = document.getElementById('telemetry-app');
    if (appEl) appEl.textContent = step.app || 'Qualtrics XM Portal';

    const tsEl = document.getElementById('telemetry-timestamp');
    if (tsEl) tsEl.textContent = `${step.timestamp || '00:00'} (Direct Capture)`;

    const controlsEl = document.getElementById('telemetry-controls');
    if (controlsEl) {
      controlsEl.textContent = step.decision ? `Decision gate: ${step.decision}` : `Controls: Navigation elements, form buttons, table index`;
    }

    const actionEl = document.getElementById('telemetry-action-sequence');
    if (actionEl) actionEl.textContent = step.title;

    // Timeline position synchronization
    if (seekTimeline) {
      const sec = this.parseTimestampToSeconds(step.timestamp);
      const totalSec = this.getVideoDurationSec();
      this.currentPlaybackSec = sec;

      const fill = document.getElementById('timeline-progress-fill');
      if (fill) fill.style.width = `${(sec / totalSec) * 100}%`;

      const readout = document.getElementById('current-playback-time');
      if (readout) readout.textContent = this.formatSecondsToTimestamp(sec);

      // Highlight active timeline marker
      document.querySelectorAll('.timeline-marker-pin').forEach((pin, i) => {
        pin.classList.toggle('active', i === idx);
      });
    }

    // Video Tab preview synchronization
    const vidTabPreview = document.getElementById('video-tab-preview');
    if (vidTabPreview) vidTabPreview.src = step.screenshot || '/assets/step_placeholder.svg';
    const vidTabTitle = document.getElementById('video-active-chapter-title');
    if (vidTabTitle) vidTabTitle.textContent = `Chapter ${step.stepNumber}: ${step.title}`;
  }

  /* --------------------------------------------------------------------------
     Workflow Step CRUD & Editing Operations
     -------------------------------------------------------------------------- */
  openAddStepModal() {
    this.editingStepId = 'new';
    const heading = document.getElementById('edit-step-modal-heading');
    if (heading) heading.textContent = 'Add New Workflow Step';

    document.getElementById('edit-step-title').value = '';
    document.getElementById('edit-step-app').value = 'Qualtrics';
    document.getElementById('edit-step-time').value = '01:00';
    document.getElementById('edit-step-desc').value = '';
    document.getElementById('edit-step-decision').value = '';
    document.getElementById('edit-step-validation').value = '';
    document.getElementById('edit-step-caution').value = '';
    document.getElementById('edit-step-status').value = 'Confirmed';

    document.getElementById('modal-edit-step').style.display = 'flex';
  }

  openEditStepModal(stepId) {
    if (!this.handoverData) return;
    const steps = this.handoverData.workflow?.steps || [];
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    this.editingStepId = stepId;
    const heading = document.getElementById('edit-step-modal-heading');
    if (heading) heading.textContent = `Edit Step ${step.stepNumber}`;

    document.getElementById('edit-step-title').value = step.title || '';
    document.getElementById('edit-step-app').value = step.app || 'Qualtrics';
    document.getElementById('edit-step-time').value = step.timestamp || '00:00';
    document.getElementById('edit-step-desc').value = step.description || '';
    document.getElementById('edit-step-decision').value = step.decision || '';
    document.getElementById('edit-step-validation').value = step.validation || '';
    document.getElementById('edit-step-caution').value = step.caution || '';
    document.getElementById('edit-step-status').value = step.status || 'Confirmed';

    document.getElementById('modal-edit-step').style.display = 'flex';
  }

  closeEditStepModal() {
    document.getElementById('modal-edit-step').style.display = 'none';
    this.editingStepId = null;
  }

  async handleSaveEditStep() {
    if (!this.editingStepId || !this.handoverData) return;
    const wf = JSON.parse(JSON.stringify(this.handoverData.workflow || {}));
    if (!wf.steps) wf.steps = [];

    const title = document.getElementById('edit-step-title')?.value.trim();
    if (!title) {
      this.showToast('Please enter a step title', 'warning');
      return;
    }

    const appName = document.getElementById('edit-step-app')?.value.trim() || 'Qualtrics';
    const timestamp = document.getElementById('edit-step-time')?.value.trim() || '00:00';
    const description = document.getElementById('edit-step-desc')?.value.trim() || '';
    const decision = document.getElementById('edit-step-decision')?.value.trim() || null;
    const validation = document.getElementById('edit-step-validation')?.value.trim() || null;
    const caution = document.getElementById('edit-step-caution')?.value.trim() || null;
    const status = document.getElementById('edit-step-status')?.value || 'Confirmed';

    if (this.editingStepId === 'new') {
      const newStep = {
        id: `step-${Date.now()}`,
        stepNumber: wf.steps.length + 1,
        title,
        app: appName,
        timestamp,
        description,
        decision,
        validation,
        caution,
        status,
        screenshot: '/assets/demo_step1.svg'
      };
      wf.steps.push(newStep);
      this.expandedStepIds.add(newStep.id);
    } else {
      const step = wf.steps.find(s => s.id === this.editingStepId);
      if (step) {
        step.title = title;
        step.app = appName;
        step.timestamp = timestamp;
        step.description = description;
        step.decision = decision;
        step.validation = validation;
        step.caution = caution;
        step.status = status;
      }
    }

    // Re-index step numbers
    wf.steps.forEach((s, i) => { s.stepNumber = i + 1; });

    try {
      const res = await fetch(`/api/handovers/${this.currentHandoverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: wf, actor: 'Sarah Jenkins' })
      });
      if (!res.ok) throw new Error('Failed to save step');
      this.closeEditStepModal();
      this.showToast(this.editingStepId === 'new' ? 'Step added successfully' : 'Step updated successfully', 'success');
      await this.loadHandover(this.currentHandoverId);
    } catch (err) {
      this.showToast('Error saving step: ' + err.message, 'error');
    }
  }

  async handleDeleteStep(stepId) {
    const confirmed = await this.showConfirmModal({
      title: 'Delete Workflow Step',
      message: 'Are you sure you want to delete this step? It will be removed from all generated documents, slides, and flowcharts.',
      confirmText: 'Delete Step',
      confirmClass: 'btn-danger'
    });
    if (!confirmed || !this.handoverData) return;

    const wf = JSON.parse(JSON.stringify(this.handoverData.workflow || {}));
    wf.steps = (wf.steps || []).filter(s => s.id !== stepId);
    wf.steps.forEach((s, i) => { s.stepNumber = i + 1; });

    try {
      const res = await fetch(`/api/handovers/${this.currentHandoverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: wf, actor: 'Sarah Jenkins' })
      });
      if (!res.ok) throw new Error('Failed to delete step');
      this.expandedStepIds.delete(stepId);
      this.showToast('Step deleted successfully', 'info');
      await this.loadHandover(this.currentHandoverId);
    } catch (err) {
      this.showToast('Error deleting step: ' + err.message, 'error');
    }
  }

  async handleMoveStep(stepId, dir) {
    if (!this.handoverData) return;
    const wf = JSON.parse(JSON.stringify(this.handoverData.workflow || {}));
    const steps = wf.steps || [];
    const idx = steps.findIndex(s => s.id === stepId);
    if (idx === -1) return;

    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= steps.length) return;

    const temp = steps[idx];
    steps[idx] = steps[targetIdx];
    steps[targetIdx] = temp;
    steps.forEach((s, i) => { s.stepNumber = i + 1; });

    try {
      const res = await fetch(`/api/handovers/${this.currentHandoverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: wf, actor: 'Sarah Jenkins' })
      });
      if (!res.ok) throw new Error('Failed to reorder step');
      await this.loadHandover(this.currentHandoverId);
      this.selectStep(targetIdx, false);
      this.showToast('Step order updated', 'info', 1500);
    } catch (err) {
      this.showToast('Error reordering step: ' + err.message, 'error');
    }
  }

  async handleAddDecisionBranch(stepId) {
    if (!this.handoverData) return;
    const wf = JSON.parse(JSON.stringify(this.handoverData.workflow || {}));
    const steps = wf.steps || [];
    const idx = steps.findIndex(s => s.id === stepId);
    if (idx === -1) return;

    const parentStep = steps[idx];
    const branchStep = {
      id: `step-branch-${Date.now()}`,
      stepNumber: idx + 2,
      title: `[Exception Branch] If ${parentStep.decision || 'Condition Not Met'}`,
      app: parentStep.app,
      timestamp: parentStep.timestamp,
      description: `Notify the operations lead via Slack (#ops-alerts) and defer delivery until missing responses arrive.`,
      decision: `Requires >= 50 valid responses. If < 50, do not export data table.`,
      validation: `Send SLA delay notice to client team with reason code.`,
      caution: `Do not run automated data cleaning script on partial or incomplete survey responses.`,
      status: 'Confirmed',
      screenshot: parentStep.screenshot
    };

    steps.splice(idx + 1, 0, branchStep);
    steps.forEach((s, i) => { s.stepNumber = i + 1; });
    this.expandedStepIds.add(branchStep.id);

    try {
      const res = await fetch(`/api/handovers/${this.currentHandoverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: wf, actor: 'Sarah Jenkins' })
      });
      if (!res.ok) throw new Error('Failed to add decision branch');
      this.showToast('Decision exception branch added to workflow', 'success');
      await this.loadHandover(this.currentHandoverId);
      this.selectStep(idx + 1);
    } catch (err) {
      this.showToast('Error adding branch: ' + err.message, 'error');
    }
  }

  async handleMarkConfirmed(stepId) {
    if (!this.handoverData) return;
    const wf = JSON.parse(JSON.stringify(this.handoverData.workflow || {}));
    const step = (wf.steps || []).find(s => s.id === stepId);
    if (!step) return;

    step.status = 'Confirmed';

    try {
      const res = await fetch(`/api/handovers/${this.currentHandoverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: wf, actor: 'Sarah Jenkins' })
      });
      if (!res.ok) throw new Error('Failed to confirm step');
      this.showToast(`Step ${step.stepNumber} confirmed as verified SOP procedure`, 'success');
      await this.loadHandover(this.currentHandoverId);
    } catch (err) {
      this.showToast('Error confirming step: ' + err.message, 'error');
    }
  }

  async submitDrawerClarification(questionId) {
    const input = document.getElementById(`drawer-answer-input-${questionId}`);
    const answer = input?.value.trim();
    if (!answer) {
      this.showToast('Please enter an answer to clarify the rule', 'warning');
      return;
    }

    try {
      const res = await fetch(`/api/handovers/${this.currentHandoverId}/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          answer,
          answeredBy: 'Sarah Jenkins'
        })
      });

      if (!res.ok) throw new Error('Failed to submit clarification');
      this.showToast('Clarification answer recorded and merged into workflow', 'success');
      await this.loadHandover(this.currentHandoverId);
    } catch (err) {
      this.showToast('Error saving clarification: ' + err.message, 'error');
    }
  }

  async submitClarificationAnswer(questionId) {
    return this.submitDrawerClarification(questionId);
  }

  async handleApproveHandover() {
    const questions = this.handoverData?.questions || [];
    const pendingQuestions = questions.filter(q => q.status === 'pending');

    let promptMessage = 'Formally approve this workflow model and publish comprehensive handover materials for your covering team?';
    if (pendingQuestions.length > 0) {
      promptMessage = `Notice: There are still ${pendingQuestions.length} pending clarification question(s). Publishing will finalize the current instructions with default decision rules. Are you sure you want to approve & publish?`;
    }

    const confirmed = await this.showConfirmModal({
      title: 'Approve & Publish Handover',
      message: promptMessage,
      confirmText: 'Approve & Publish',
      confirmClass: 'btn-primary'
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/handovers/${this.currentHandoverId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver: 'Sarah Jenkins' })
      });
      if (!res.ok) throw new Error('Approval failed');
      this.showToast('Handover approved and published successfully! All 5 export materials are ready.', 'success', 4000);
      await this.loadHandover(this.currentHandoverId);
      this.switchView('outputs');
    } catch (err) {
      this.showToast('Approval error: ' + err.message, 'error');
    }
  }

  // Redaction
  openRedactModal() {
    document.getElementById('modal-redact').style.display = 'flex';
  }
  closeRedactModal() {
    document.getElementById('modal-redact').style.display = 'none';
  }
  async handleApplyRedact() {
    const text = document.getElementById('redact-input-text')?.value;
    if (!text || !text.trim()) return;

    try {
      const res = await fetch(`/api/handovers/${this.currentHandoverId}/redact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textToRedact: text.trim(), actor: 'Sarah Jenkins' })
      });
      if (!res.ok) throw new Error('Redaction failed');
      this.closeRedactModal();
      this.showToast('Redaction mask applied across workflow model!', 'success');
      await this.loadHandover(this.currentHandoverId);
    } catch (err) {
      this.showToast('Redaction error: ' + err.message, 'error');
    }
  }

  // Flowchart Zoom
  adjustFlowZoom(delta) {
    this.flowZoom = Math.max(0.5, Math.min(2.0, this.flowZoom + delta));
    this.updateFlowZoomTransform();
  }

  updateFlowZoomTransform() {
    const target = document.getElementById('flowchart-zoom-target');
    const levelEl = document.getElementById('flow-zoom-level');
    if (target) {
      target.style.transform = `scale(${this.flowZoom})`;
    }
    if (levelEl) {
      levelEl.textContent = `${Math.round(this.flowZoom * 100)}%`;
    }
  }

  // Presentation Slide Deck Viewer
  getSlideDeckData() {
    if (!this.handoverData) return [];
    const wf = this.handoverData.workflow || {};
    const steps = wf.steps || [];

    return [
      {
        tag: 'TITLE SLIDE',
        title: wf.title || 'Workplace Handover Walkthrough',
        subtitle: `Task Owner: ${wf.owner || 'Sarah Jenkins'}`,
        body: `<div style="font-size:16px; color:#94A3B8; max-width:680px; line-height:1.6;">${wf.summary || 'End-to-end standard operating procedure.'}</div>
               <div style="margin-top:24px; font-size:13px; color:#60A5FA;">Generated by Handover Studio • Verified Workflow Model</div>`
      },
      {
        tag: 'PREREQUISITES & ACCESS',
        title: 'Prerequisites & Environmental Checklist',
        subtitle: 'Verify all required system accesses before starting execution',
        body: `<ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:12px;">
                 ${(wf.prerequisites || []).map(p => `
                   <li style="display:flex; align-items:center; gap:10px; font-size:15px; color:#E2E8F0;">
                     <span style="color:#10B981; font-weight:bold;">✓</span>
                     <span>${p}</span>
                   </li>
                 `).join('')}
               </ul>`
      },
      ...steps.map(s => ({
        tag: `STEP ${s.stepNumber} • ${s.app.toUpperCase()}`,
        title: s.title,
        subtitle: `@ ${s.timestamp} in ${s.app} • Status: ${s.status}`,
        body: `
          <div style="font-size:16px; color:#E2E8F0; margin-bottom:16px; line-height:1.6;">${s.description}</div>
          ${s.decision ? `<div style="background:#FEF3C7; color:#78350F; padding:12px 16px; border-radius:8px; font-size:13px; font-weight:600; margin-bottom:10px;">⚠ Decision Rule: ${s.decision}</div>` : ''}
          ${s.validation ? `<div style="background:#DCFCE7; color:#14532D; padding:12px 16px; border-radius:8px; font-size:13px; font-weight:600;">✓ Verification: ${s.validation}</div>` : ''}
        `
      })),
      {
        tag: 'TROUBLESHOOTING',
        title: 'Common Issues & Exception Handling',
        subtitle: 'Pre-approved resolutions for operational anomalies',
        body: `
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${(wf.troubleshooting || []).slice(0, 3).map(t => `
              <div style="background:#1E293B; border-left:4px solid #F59E0B; padding:10px 14px; border-radius:6px;">
                <div style="font-weight:700; color:#FCD34D; font-size:13.5px;">${t.issue}</div>
                <div style="font-size:12.5px; color:#CBD5E1; margin-top:2px;">Fix: ${t.resolution}</div>
              </div>
            `).join('')}
          </div>
        `
      }
    ];
  }

  renderActiveSlide() {
    const slides = this.getSlideDeckData();
    if (slides.length === 0) return;

    this.currentSlideIndex = Math.max(0, Math.min(slides.length - 1, this.currentSlideIndex));
    const s = slides[this.currentSlideIndex];

    const frame = document.getElementById('active-slide-frame');
    if (frame) {
      frame.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; font-weight:800; color:#38BDF8; letter-spacing:1px;">${s.tag}</span>
          <span style="font-size:11px; color:#64748B;">Handover Studio Enterprise Deck</span>
        </div>
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; margin:16px 0;">
          <h2 style="font-size:26px; font-weight:800; color:#fff; margin-bottom:6px;">${s.title}</h2>
          <div style="font-size:13px; color:#94A3B8; margin-bottom:20px;">${s.subtitle}</div>
          <div>${s.body}</div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:10px; color:#475569; border-top:1px solid #1E293B; padding-top:10px;">
          <span>CONFIDENTIAL • FOR INTERNAL WORKPLACE USE ONLY</span>
          <span>Slide ${this.currentSlideIndex + 1} of ${slides.length}</span>
        </div>
      `;
    }

    document.getElementById('slide-counter-badge').textContent = `Slide ${this.currentSlideIndex + 1} of ${slides.length}`;

    // Render Thumbnails
    const strip = document.getElementById('slide-thumbnails-strip');
    if (strip) {
      strip.innerHTML = slides.map((item, i) => `
        <div class="slide-thumb ${i === this.currentSlideIndex ? 'active' : ''}" onclick="app.setSlide(${i})">
          <div style="font-weight:700; font-size:9px;">${i + 1}. ${item.tag.substring(0, 16)}</div>
          <div style="font-size:8.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.title}</div>
        </div>
      `).join('');
    }
  }

  changeSlide(delta) {
    this.currentSlideIndex += delta;
    this.renderActiveSlide();
  }

  setSlide(idx) {
    this.currentSlideIndex = idx;
    this.renderActiveSlide();
  }

  // Copy SOP Markdown
  copySopMarkdown() {
    if (!this.handoverData) return;
    const wf = this.handoverData.workflow || {};
    let md = `# ${wf.title}\n\n**Owner:** ${wf.owner} | **Target Role:** ${wf.targetRole}\n\n`;
    md += `## 1. Purpose & Scope\n${wf.summary}\n\n`;
    md += `## 2. Prerequisites\n${(wf.prerequisites || []).map(p => `- ${p}`).join('\n')}\n\n`;
    md += `## 3. Step-by-Step Instructions\n`;
    (wf.steps || []).forEach(s => {
      md += `### Step ${s.stepNumber}: ${s.title} (${s.app} @ ${s.timestamp})\n${s.description}\n`;
      if (s.decision) md += `> **Decision Rule:** ${s.decision}\n`;
      if (s.validation) md += `> **Verification Check:** ${s.validation}\n`;
      md += `\n`;
    });

    navigator.clipboard.writeText(md).then(() => {
      this.showToast('Standard Operating Procedure copied to clipboard in Markdown format!', 'success');
    }).catch(err => {
      this.showToast('Failed to copy to clipboard: ' + err.message, 'error');
    });
  }

  // Outputs Rendering
  renderOutputs() {
    if (!this.handoverData) return;
    const id = this.currentHandoverId;
    const wf = this.handoverData.workflow || {};

    // 1. Download Links
    document.getElementById('btn-dl-docx').href = `/api/handovers/${id}/export/docx`;
    document.getElementById('btn-dl-pptx').href = `/api/handovers/${id}/export/pptx`;
    document.getElementById('btn-dl-pptx-2').href = `/api/handovers/${id}/export/pptx`;
    document.getElementById('btn-dl-svg').href = `/api/handovers/${id}/export/svg`;
    document.getElementById('btn-dl-svg-2').href = `/api/handovers/${id}/export/svg`;
    document.getElementById('btn-dl-vtt').href = `/api/handovers/${id}/export/vtt`;

    // 2. Render Written SOP
    const sopEl = document.getElementById('sop-container');
    if (sopEl) {
      sopEl.innerHTML = this.generateClientSopHtml(wf);
    }

    // 3. Render Chapters List
    const chaptersEl = document.getElementById('chapters-list');
    const videoPkg = this.handoverData.videoPackage || {};
    if (chaptersEl && videoPkg.chapters) {
      chaptersEl.innerHTML = videoPkg.chapters.map((c, i) => `
        <div style="background:var(--bg-card-subtle); padding:10px 14px; border-radius:6px; cursor:pointer;" onclick="app.selectStep(${i})">
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px;">
            <span style="font-weight:700; color:#fff;">Chapter ${c.stepNumber}: ${c.title}</span>
            <span style="font-family:monospace; color:#60A5FA;">${c.startTime}</span>
          </div>
          <div style="font-size:11.5px; color:var(--text-muted);">${c.description}</div>
        </div>
      `).join('');
    }

    // 4. Render Active Slide Frame & Strip
    this.renderActiveSlide();

    // 5. Render Interactive Flowchart SVG
    const flowContainer = document.getElementById('flowchart-svg-container');
    if (flowContainer && this.handoverData.flowchart) {
      flowContainer.innerHTML = this.generateClientSvgMarkup(this.handoverData.flowchart);
      // Bind click on nodes
      flowContainer.querySelectorAll('.flow-node').forEach(node => {
        node.addEventListener('click', () => {
          const stepId = node.dataset.stepId;
          if (stepId) {
            const idx = (wf.steps || []).findIndex(s => s.id === stepId);
            if (idx !== -1) {
              this.selectStep(idx);
              this.switchView('review');
            }
          }
        });
      });
    }
  }

  generateClientSopHtml(wf) {
    const steps = wf.steps || [];
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="border-bottom:2px solid #2563EB; padding-bottom:18px; margin-bottom:24px;">
          <div style="font-size:12px; font-weight:800; color:#2563EB; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
            Standard Operating Procedure (SOP)
          </div>
          <h1 style="font-size:28px; font-weight:800; color:#0F172A; margin:6px 0 10px 0; line-height:1.3;">
            ${wf.title}
          </h1>
          <div style="display:flex; gap:16px; font-size:13px; color:#64748B; flex-wrap:wrap;">
            <span><strong>Task Owner:</strong> ${wf.owner}</span>
            <span><strong>Target Role:</strong> ${wf.targetRole}</span>
            <span><strong>Security:</strong> Internal Workplace Only</span>
          </div>
        </div>

        <h3 style="font-size:17px; font-weight:700; color:#0F172A; border-left:4px solid #2563EB; padding-left:12px; margin-bottom:10px;">
          1. Purpose &amp; Scope
        </h3>
        <p style="font-size:14px; color:#334155; margin-bottom:24px; line-height:1.65;">
          ${wf.summary}
        </p>

        <h3 style="font-size:17px; font-weight:700; color:#0F172A; border-left:4px solid #2563EB; padding-left:12px; margin-bottom:14px;">
          2. Step-by-Step Instructions
        </h3>
        <div style="display:flex; flex-direction:column; gap:18px; margin-bottom:28px;">
          ${steps.map(s => `
            <div style="border:1px solid #E2E8F0; border-radius:10px; padding:18px; background:#F8FAFC;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-weight:700; color:#1E3A8A; font-size:15px;">Step ${s.stepNumber}: ${s.title}</span>
                <span style="font-size:11.5px; background:#DBEAFE; color:#1E40AF; padding:3px 10px; border-radius:12px; font-weight:600;">
                  ${s.app} @ ${s.timestamp}
                </span>
              </div>
              <div style="font-size:13.5px; color:#334155; margin-bottom:10px; line-height:1.5;">${s.description}</div>
              ${s.decision ? `<div style="background:#FEF3C7; border:1px solid #F59E0B; padding:8px 12px; border-radius:6px; font-size:12.5px; color:#78350F; margin-top:6px;"><strong>Decision Rule:</strong> ${s.decision}</div>` : ''}
              ${s.validation ? `<div style="background:#DCFCE7; border:1px solid #16A34A; padding:8px 12px; border-radius:6px; font-size:12.5px; color:#14532D; margin-top:6px;"><strong>Verification Check:</strong> ${s.validation}</div>` : ''}
              ${s.caution ? `<div style="background:#FEE2E2; border:1px solid #EF4444; padding:8px 12px; border-radius:6px; font-size:12.5px; color:#991B1B; margin-top:6px;"><strong>Caution:</strong> ${s.caution}</div>` : ''}
            </div>
          `).join('')}
        </div>

        <h3 style="font-size:17px; font-weight:700; color:#0F172A; border-left:4px solid #2563EB; padding-left:12px; margin-bottom:12px;">
          3. Common Pitfalls &amp; Troubleshooting
        </h3>
        <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:28px;">
          <thead>
            <tr style="background:#F1F5F9; border-bottom:2px solid #CBD5E1; color:#0F172A; text-align:left;">
              <th style="padding:10px;">Issue</th>
              <th style="padding:10px;">Probable Cause</th>
              <th style="padding:10px;">Resolution</th>
            </tr>
          </thead>
          <tbody>
            ${(wf.troubleshooting || []).map(t => `
              <tr style="border-bottom:1px solid #E2E8F0;">
                <td style="padding:10px; font-weight:600; color:#0F172A;">${t.issue}</td>
                <td style="padding:10px; color:#475569;">${t.cause}</td>
                <td style="padding:10px; color:#1E40AF;">${t.resolution}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  generateClientSvgMarkup(model) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const width = 1000;
    const height = model.totalHeight || 1400;

    const colors = isDark ? {
      start: { bg: '#059669', text: '#FFFFFF', border: '#10B981' },
      end: { bg: '#047857', text: '#FFFFFF', border: '#059669' },
      action: { bg: '#171B26', text: '#F8FAFC', border: '#3B82F6' },
      decision: { bg: '#2A1F0D', text: '#FDE68A', border: '#F59E0B' },
      validation: { bg: '#20163B', text: '#DDD6FE', border: '#8B5CF6' },
      exception: { bg: '#331416', text: '#FECACA', border: '#EF4444' }
    } : {
      start: { bg: '#10B981', text: '#FFFFFF', border: '#059669' },
      end: { bg: '#059669', text: '#FFFFFF', border: '#047857' },
      action: { bg: '#FFFFFF', text: '#0F172A', border: '#3B82F6' },
      decision: { bg: '#FEF3C7', text: '#78350F', border: '#F59E0B' },
      validation: { bg: '#F3E8FF', text: '#581C87', border: '#8B5CF6' },
      exception: { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' }
    };
    const lineStroke = isDark ? '#475569' : '#94A3B8';
    const subtextColor = isDark ? '#94A3B8' : '#64748B';

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width:100%; height:auto;">
      <defs>
        <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="${lineStroke}"/>
        </marker>
        <filter id="flow-shadow" x="-5%" y="-5%" width="115%" height="115%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="${isDark ? '0.35' : '0.08'}"/>
        </filter>
      </defs>`;

    // Edges
    (model.edges || []).forEach(e => {
      const s = model.nodes.find(n => n.id === e.from);
      const t = model.nodes.find(n => n.id === e.to);
      if (!s || !t) return;
      if (s.x === t.x) {
        svg += `<line x1="${s.x}" y1="${s.y + 36}" x2="${t.x}" y2="${t.y - 36}" stroke="${lineStroke}" stroke-width="2.5" marker-end="url(#flow-arrow)"/>`;
        if (e.condition) {
          svg += `<text x="${s.x + 12}" y="${(s.y + t.y) / 2}" fill="#059669" font-size="11.5" font-weight="bold">${e.condition}</text>`;
        }
      } else {
        svg += `<path d="M ${s.x + 190} ${s.y} L ${t.x - 150} ${t.y}" stroke="#EF4444" stroke-width="2" stroke-dasharray="5" marker-end="url(#flow-arrow)"/>`;
        if (e.condition) {
          svg += `<text x="${(s.x + t.x) / 2}" y="${s.y - 8}" fill="#DC2626" font-size="11" font-weight="bold">${e.condition}</text>`;
        }
      }
    });

    // Nodes
    (model.nodes || []).forEach(n => {
      const c = colors[n.type] || colors.action;
      const lines = this.wrapText(n.label, 36);

      svg += `<g class="flow-node" data-step-id="${n.stepId || ''}" style="cursor:pointer;" transform="translate(${n.x}, ${n.y})">`;
      if (n.type === 'start' || n.type === 'end') {
        const nodeW = 420;
        svg += `<rect x="-${nodeW / 2}" y="-24" width="${nodeW}" height="48" rx="24" fill="${c.bg}" stroke="${c.border}" stroke-width="2" filter="url(#flow-shadow)"/>
                <text text-anchor="middle" y="5" fill="${c.text}" font-size="13" font-weight="bold">${n.label}</text>`;
      } else if (n.type === 'decision') {
        svg += `<polygon points="0,-42 200,0 0,42 -200,0" fill="${c.bg}" stroke="${c.border}" stroke-width="2" filter="url(#flow-shadow)"/>`;
        if (lines.length === 1) {
          svg += `<text text-anchor="middle" y="4" fill="${c.text}" font-size="12" font-weight="bold">${lines[0]}</text>`;
        } else {
          svg += `<text text-anchor="middle" y="-4" fill="${c.text}" font-size="12" font-weight="bold">${lines[0]}</text>
                  <text text-anchor="middle" y="14" fill="${c.text}" font-size="12" font-weight="bold">${lines[1]}</text>`;
        }
      } else {
        const nodeW = 380;
        const nodeH = 68;
        svg += `<rect x="-${nodeW / 2}" y="-${nodeH / 2}" width="${nodeW}" height="${nodeH}" rx="10" fill="${c.bg}" stroke="${c.border}" stroke-width="2" filter="url(#flow-shadow)"/>`;
        if (lines.length === 1) {
          svg += `<text text-anchor="middle" y="-6" fill="${c.text}" font-size="12.5" font-weight="bold">${lines[0]}</text>`;
        } else {
          svg += `<text text-anchor="middle" y="-12" fill="${c.text}" font-size="12" font-weight="bold">${lines[0]}</text>
                  <text text-anchor="middle" y="6" fill="${c.text}" font-size="12" font-weight="bold">${lines[1]}</text>`;
        }
        if (n.app) {
          svg += `<text text-anchor="middle" y="24" fill="${subtextColor}" font-size="10.5">${n.app} ${n.timestamp ? '@ ' + n.timestamp : ''}</text>`;
        }
      }
      svg += `</g>`;
    });

    svg += `</svg>`;
    return svg;
  }

  wrapText(text, maxChars = 36) {
    if (!text || text.length <= maxChars) return [text];
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length <= maxChars) {
        cur = (cur + ' ' + w).trim();
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 2);
  }

  // Assistant Chat
  async handleSendAssistantChat() {
    const input = document.getElementById('assistant-chat-input');
    const query = input?.value.trim();
    if (!query) return;

    input.value = '';
    const messagesEl = document.getElementById('assistant-chat-messages');

    // Add user bubble
    messagesEl.innerHTML += `<div class="chat-bubble user">${query}</div>`;
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const res = await fetch(`/api/handovers/${this.currentHandoverId}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();

      let groundingBadge = '';
      if (data.grounding && data.grounding.length > 0) {
        groundingBadge = `<div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
          ${data.grounding.map(g => `<button class="btn btn-secondary btn-sm" style="font-size:11px; padding:2px 8px;" onclick="app.selectStep(${(g.stepNumber || 1) - 1}); app.switchView('review');">Jump to Step ${g.stepNumber || ''} @ ${g.timestamp || ''}</button>`).join('')}
        </div>`;
      } else if (data.isUnansweredGap) {
        groundingBadge = `<div style="margin-top:10px;"><span class="badge badge-suggested">Grounded Honesty: Undemonstrated Knowledge Gap</span></div>`;
      }

      messagesEl.innerHTML += `
        <div class="chat-bubble assistant">
          ${data.answer.replace(/\n/g, '<br>')}
          ${groundingBadge}
        </div>
      `;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (err) {
      messagesEl.innerHTML += `<div class="chat-bubble assistant" style="color:#EF4444;">Error connecting to assistant: ${err.message}</div>`;
    }
  }

  // Verification Studio Rendering
  renderVerificationStudio() {
    if (!this.handoverData) return;
    const wf = this.handoverData.workflow || {};
    const steps = wf.steps || [];
    const total = steps.length;
    const completed = this.practiceSession.completedSteps.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Update progress meter
    document.getElementById('verif-progress-label').textContent = `Practice Walkthrough Progress: ${completed} of ${total} steps verified`;
    document.getElementById('verif-progress-pct').textContent = `${pct}% Complete`;
    document.getElementById('verif-progress-fill').style.width = `${pct}%`;

    const checklistEl = document.getElementById('practice-steps-checklist');
    if (!checklistEl) return;

    checklistEl.innerHTML = steps.map((s, idx) => {
      const isDone = this.practiceSession.completedSteps.includes(s.id);
      const isConfusing = this.practiceSession.confusingSteps.some(cs => cs.stepId === s.id);

      return `
        <div style="background:var(--bg-card-subtle); padding:14px; border-radius:8px; border-left:4px solid ${isConfusing ? '#EF4444' : isDone ? '#10B981' : '#4B5563'};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label style="display:flex; align-items:center; gap:12px; cursor:pointer;">
              <input type="checkbox" ${isDone ? 'checked' : ''} onchange="app.togglePracticeStep('${s.id}')" style="accent-color:var(--primary); width:18px; height:18px;">
              <span style="font-weight:700; color:#fff; font-size:14px;">Step ${s.stepNumber}: ${s.title}</span>
            </label>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary btn-sm" onclick="app.openFlagModal('${s.id}', '${s.title}')">
                ${isConfusing ? '⚠ Flagged' : 'Flag Confusing'}
              </button>
            </div>
          </div>
          <div style="font-size:12.5px; color:var(--text-secondary); margin:8px 0 0 30px;">${s.description}</div>
        </div>
      `;
    }).join('');

    // Update readiness score
    const score = this.handoverData.readiness_score || 93;
    document.getElementById('verif-readiness-score').textContent = `${score}%`;

    // Criteria breakdown
    const criteriaEl = document.getElementById('readiness-criteria-breakdown');
    if (criteriaEl) {
      const criteria = [
        { name: '1. Procedural Step Coverage', val: `${completed}/${total} steps marked complete` },
        { name: '2. Critical Decision Rules Verified', val: 'Verified (>= 50 quota threshold)' },
        { name: '3. Knowledge Gaps Resolved', val: '3/3 questions confirmed' },
        { name: '4. Colleague Practice Friction', val: `${this.practiceSession.confusingSteps.length} friction point(s) recorded` },
        { name: '5. Verification Signals Configured', val: 'Commit check & Slack receipt' }
      ];
      criteriaEl.innerHTML = criteria.map(c => `
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-color);">
          <span style="color:var(--text-secondary);">${c.name}</span>
          <span style="font-weight:600; color:#34D399;">${c.val}</span>
        </div>
      `).join('');
    }

    // Agent 10 Recommendations
    const recsEl = document.getElementById('improvement-recommendations-list');
    if (recsEl) {
      recsEl.innerHTML = `
        <div style="background:rgba(59, 130, 246, 0.1); border:1px solid var(--primary); padding:12px 16px; border-radius:8px; font-size:13px; color:#93C5FD; line-height:1.5;">
          <strong>Agent 10 Verification Insight:</strong> Practice walkthrough completed successfully by Alex Rivera with 93% readiness. Added explicit note to Step 6 to preserve column headers. Handover is operationally ready for leave period.
        </div>
      `;
    }
  }

  togglePracticeStep(stepId) {
    const list = this.practiceSession.completedSteps;
    const idx = list.indexOf(stepId);
    if (idx === -1) list.push(stepId);
    else list.splice(idx, 1);
    this.renderVerificationStudio();
  }

  openFlagModal(stepId, stepTitle) {
    this.practiceSession.flaggingStepId = stepId;
    document.getElementById('flag-modal-step-title').textContent = `Flagging: ${stepTitle}`;
    document.getElementById('modal-flag-step').style.display = 'flex';
  }
  closeFlagModal() {
    document.getElementById('modal-flag-step').style.display = 'none';
  }
  handleConfirmFlag() {
    const stepId = this.practiceSession.flaggingStepId;
    const issue = document.getElementById('flag-issue-text')?.value;
    const suggest = document.getElementById('flag-suggest-text')?.value;
    if (!issue || !issue.trim()) return;

    this.practiceSession.confusingSteps.push({
      stepId,
      issue: issue.trim(),
      suggestedFix: suggest?.trim() || ''
    });

    this.closeFlagModal();
    this.renderVerificationStudio();
  }

  resetPractice() {
    this.practiceSession.completedSteps = [];
    this.practiceSession.confusingSteps = [];
    this.renderVerificationStudio();
  }

  async handleSubmitPractice() {
    try {
      const res = await fetch(`/api/handovers/${this.currentHandoverId}/verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testerName: 'Alex Rivera (Covering Colleague)',
          testerRole: 'Associate Ops Analyst',
          completedSteps: this.practiceSession.completedSteps,
          confusingSteps: this.practiceSession.confusingSteps,
          feedbackNotes: 'Practice walkthrough completed successfully.'
        })
      });

      if (!res.ok) throw new Error('Failed to submit practice');
      const data = await res.json();
      this.showToast(`Practice session logged! Updated Handover Readiness: ${data.verification.readinessScore}% (${data.verification.readinessTier})`, 'success');
      await this.loadHandover(this.currentHandoverId);
    } catch (err) {
      this.showToast('Error submitting practice: ' + err.message, 'error');
    }
  }

  // Recorder Handlers
  async handleStartRecord() {
    const withAudio = document.getElementById('chk-audio')?.checked;
    try {
      const { stream } = await this.recorder.start({ withAudio });
      const livePreview = document.getElementById('live-video-preview');
      livePreview.srcObject = stream;
      livePreview.style.display = 'block';
      document.getElementById('recorded-playback').style.display = 'none';
      document.getElementById('recording-empty-state').style.display = 'none';

      document.getElementById('recording-live-indicator').style.display = 'flex';
      document.getElementById('btn-start-record').style.display = 'none';
      document.getElementById('btn-pause-record').style.display = 'inline-flex';
      document.getElementById('btn-stop-record').style.display = 'inline-flex';
      document.getElementById('recording-marker-panel').style.display = 'block';
      document.getElementById('post-record-actions').style.display = 'none';
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        this.showToast('Could not start screen capture: ' + err.message, 'error');
      }
    }
  }

  handlePauseRecord() {
    const btn = document.getElementById('btn-pause-record');
    if (this.recorder.isPaused) {
      this.recorder.resume();
      btn.textContent = 'Pause';
    } else {
      this.recorder.pause();
      btn.textContent = 'Resume';
    }
  }

  handleStopRecord() {
    this.recorder.stop();
  }

  handleAddMarker() {
    const input = document.getElementById('marker-input');
    const label = input?.value.trim();
    if (!label) return;
    this.recorder.addMarker(label);
    input.value = '';
    this.showToast(`Marker added: "${label}"`, 'info', 2000);
  }

  renderMarkersList() {
    const container = document.getElementById('markers-list');
    const countBadge = document.getElementById('markers-count-badge');
    if (!container) return;

    countBadge.textContent = `${this.recorder.markers.length} Markers Added`;
    container.innerHTML = this.recorder.markers.map(m => `
      <span class="badge badge-observed">
        ${m.timestamp} — ${m.label}
      </span>
    `).join('');
  }

  async handleDiscardRecord() {
    const confirmed = await this.showConfirmModal({
      title: 'Discard Recording',
      message: 'Discard this recorded demonstration and retake from scratch?',
      confirmText: 'Discard Recording',
      confirmClass: 'btn-danger'
    });
    if (!confirmed) return;

    document.getElementById('recorded-playback').style.display = 'none';
    document.getElementById('recording-empty-state').style.display = 'block';
    document.getElementById('post-record-actions').style.display = 'none';
    document.getElementById('recording-marker-panel').style.display = 'none';
    this.recorder.markers = [];
    this.showToast('Recording discarded', 'info', 2000);
  }

  async handleRunReconstruction() {
    const btn = document.getElementById('btn-run-reconstruction');
    btn.disabled = true;
    btn.textContent = 'Orchestrating Autonomous AI Agents 1-4...';

    try {
      // 1. Create a new handover project
      const title = 'Recorded Task: ' + new Date().toLocaleDateString();
      const createRes = await fetch('/api/handovers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary: 'Newly captured screen recording with timestamped markers.',
          owner: 'Current Demonstrator',
          targetRole: 'Covering Colleague'
        })
      });
      const createData = await createRes.json();
      const newId = createData.id;

      // 2. Trigger AI Reconstruction
      const reconRes = await fetch(`/api/handovers/${newId}/reconstruct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markers: this.recorder.markers,
          durationSec: this.recorder.elapsedSeconds || 120
        })
      });

      if (!reconRes.ok) throw new Error('Reconstruction failed');
      this.showToast('AI Agent workflow reconstruction complete! Transitioning to Review Studio...', 'success');

      await this.loadHandover(newId);
      this.switchView('review');
    } catch (err) {
      this.showToast('Reconstruction error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Run AI Agent Workflow Reconstruction';
    }
  }

  // Knowledge Library
  async loadLibraryTable() {
    try {
      const res = await fetch('/api/handovers');
      const list = await res.json();
      this.allLibraryHandovers = list;
      this.renderLibraryRows(list);
    } catch (err) {
      console.error('Error loading library:', err);
    }
  }

  renderLibraryRows(list) {
    const tbody = document.getElementById('library-table-body');
    if (!tbody) return;

    tbody.innerHTML = list.map(h => `
      <tr style="border-bottom:1px solid var(--border-color); cursor:pointer;" onclick="app.selectHandover('${h.id}')">
        <td style="padding:12px; font-weight:700; color:#fff;">${h.title}</td>
        <td style="padding:12px; color:var(--text-secondary);">${h.owner_name}</td>
        <td style="padding:12px; color:var(--text-secondary);">${h.target_role}</td>
        <td style="padding:12px;"><span class="badge ${h.status === 'approved' ? 'badge-confirmed' : 'badge-observed'}">${h.status}</span></td>
        <td style="padding:12px; color:#10B981; font-weight:700;">${h.readiness_score}%</td>
        <td style="padding:12px; font-family:monospace; color:#A78BFA;">Verified</td>
        <td style="padding:12px;">
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); app.selectHandover('${h.id}')">Open</button>
        </td>
      </tr>
    `).join('');
  }

  filterLibrary(term) {
    if (!this.allLibraryHandovers) return;
    const q = term.toLowerCase().trim();
    const filtered = this.allLibraryHandovers.filter(h =>
      h.title.toLowerCase().includes(q) ||
      h.owner_name.toLowerCase().includes(q) ||
      h.target_role.toLowerCase().includes(q)
    );
    this.renderLibraryRows(filtered);
  }

  // Security Audit
  async loadAuditLogs() {
    try {
      const res = await fetch('/api/audit-logs');
      const logs = await res.json();
      const tbody = document.getElementById('audit-table-body');
      if (!tbody) return;

      tbody.innerHTML = logs.map(l => `
        <tr style="border-bottom:1px solid var(--border-color);">
          <td style="padding:8px 10px; font-family:monospace; color:var(--text-muted); font-size:11px;">${new Date(l.created_at).toLocaleTimeString()}</td>
          <td style="padding:8px 10px; font-weight:700; color:#60A5FA;">${l.user_action}</td>
          <td style="padding:8px 10px; color:#fff;">${l.actor}</td>
          <td style="padding:8px 10px; color:var(--text-secondary);">${l.details}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Error loading audit logs:', err);
    }
  }

  /* --------------------------------------------------------------------------
     Internal Operations, Persona Switcher & Holiday Coverage Suite
     -------------------------------------------------------------------------- */
  initPersonaSwitcher() {
    const toggleBtn = document.getElementById('btn-persona-toggle');
    const menu = document.getElementById('persona-dropdown-menu');

    toggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = menu.style.display === 'none' || !menu.style.display;
      menu.style.display = isHidden ? 'block' : 'none';
    });

    menu?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('click', () => {
      if (menu) menu.style.display = 'none';
    });

    document.querySelectorAll('.persona-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const persona = opt.dataset.persona;
        const name = opt.dataset.name;
        const role = opt.dataset.role;
        const avatar = opt.dataset.avatar;
        this.setPersona(persona, name, role, avatar);
        if (menu) menu.style.display = 'none';
      });
    });
  }

  setPersona(persona, name, role, avatar) {
    this.currentPersona = persona;

    // Update active class in menu
    document.querySelectorAll('.persona-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.persona === persona);
    });

    // Update topbar trigger
    const nameEl = document.getElementById('topbar-persona-name');
    const avatarEl = document.getElementById('topbar-persona-avatar');
    if (nameEl) nameEl.textContent = `${name} (${persona === 'owner' ? 'Owner' : 'Covering'})`;
    if (avatarEl) {
      avatarEl.textContent = avatar;
      avatarEl.className = `persona-avatar-sm ${persona === 'covering' ? 'covering' : ''}`;
    }

    // Update sidebar profile widget
    const sbAvatar = document.getElementById('sidebar-user-avatar');
    const sbName = document.getElementById('sidebar-user-name');
    const sbRole = document.getElementById('sidebar-user-role');
    if (sbAvatar) sbAvatar.textContent = avatar;
    if (sbName) sbName.textContent = name;
    if (sbRole) sbRole.textContent = role;

    this.showToast(`Switched active view to ${name} (${persona === 'owner' ? 'Task Owner' : 'Covering Colleague'})`, 'info', 2500);

    // If switching to covering colleague, open My Assigned Tasks
    if (persona === 'covering') {
      this.switchView('covering-tasks');
    } else {
      this.switchView('dashboard');
      this.loadDashboardHandovers();
    }
  }

  initOperationsEvents() {
    // Process Library Record button
    document.getElementById('btn-library-record-new')?.addEventListener('click', () => this.switchView('record'));
    document.getElementById('btn-library-create-pack')?.addEventListener('click', () => this.openCreatePackModal());
    document.getElementById('btn-create-coverage-pack')?.addEventListener('click', () => this.openCreatePackModal());

    // Covering Colleague view buttons
    document.getElementById('btn-covering-view-all-sops')?.addEventListener('click', () => this.switchView('library'));
    document.getElementById('btn-covering-ask-assistant')?.addEventListener('click', () => {
      this.switchView('outputs');
      this.switchTab('tab-assistant');
    });

    // Task Filter Chips
    ['all', 'pending', 'completed', 'blocked'].forEach(f => {
      document.getElementById(`cov-filter-${f}`)?.addEventListener('click', (e) => {
        document.querySelectorAll('#view-covering-tasks .filter-chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        this.coveringFilter = f;
        this.renderCoveringTasks();
      });
    });

    // Wizard Navigation
    document.getElementById('btn-close-pack-modal')?.addEventListener('click', () => this.closeCreatePackModal());
    document.getElementById('btn-wiz-cancel')?.addEventListener('click', () => this.closeCreatePackModal());
    document.getElementById('btn-wiz-next')?.addEventListener('click', () => this.setWizardStep(this.wizardStep + 1));
    document.getElementById('btn-wiz-prev')?.addEventListener('click', () => this.setWizardStep(this.wizardStep - 1));
    document.getElementById('btn-wiz-publish')?.addEventListener('click', () => this.publishCoveragePack());

    // Add Task to draft pack
    document.getElementById('btn-add-task-to-pack')?.addEventListener('click', () => this.addTaskToDraftPack());

    // Blocker Modal
    document.getElementById('btn-cancel-blocker')?.addEventListener('click', () => this.closeBlockerModal());
    document.getElementById('btn-confirm-blocker')?.addEventListener('click', () => this.submitBlocker());

    // SOP Preview Modal
    document.getElementById('btn-close-sop-modal')?.addEventListener('click', () => this.closeSopPreviewModal());
    document.getElementById('btn-close-sop-modal-btn')?.addEventListener('click', () => this.closeSopPreviewModal());
    document.getElementById('btn-open-full-materials')?.addEventListener('click', () => {
      this.closeSopPreviewModal();
      this.switchView('outputs');
    });
  }

  // 1. Process Library Engine
  async loadProcessLibrary() {
    try {
      const res = await fetch('/api/process-library');
      if (!res.ok) throw new Error('Failed to load process library');
      const data = await res.json();
      this.allProcessLibrary = data;
      this.renderProcessLibraryCards(data);
      this.populateProcessSelectInWizard(data);
    } catch (err) {
      console.error('Error loading process library:', err);
    }
  }

  renderProcessLibraryCards(list) {
    const container = document.getElementById('process-library-grid');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = `<div class="card" style="grid-column: 1 / -1; text-align:center; padding:30px; color:var(--text-muted);">No processes found in library.</div>`;
      return;
    }

    container.innerHTML = list.map(p => `
      <div class="pack-card">
        <div class="pack-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <span class="badge ${p.status === 'approved' ? 'badge-confirmed' : 'badge-observed'}" style="font-size:11px;">
                Approved SOP
              </span>
              <span class="badge badge-suggested" style="font-size:11px;">
                ${p.readinessScore}% Verified
              </span>
            </div>
            <div class="pack-title">${p.title}</div>
          </div>
        </div>

        <p style="font-size:12.5px; color:var(--text-secondary); line-height:1.45; margin:0;">
          ${p.summary || 'Standard operating procedure.'}
        </p>

        <!-- Stats Chips -->
        <div style="display:flex; gap:8px; flex-wrap:wrap; font-size:11.5px; color:var(--text-muted);">
          <span style="background:var(--surface-hover); padding:3px 8px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            <strong>${p.stepsCount}</strong> Procedural Steps
          </span>
          <span style="background:var(--surface-hover); padding:3px 8px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            <strong>${p.decisionRulesCount}</strong> Decision Points
          </span>
          <span style="background:var(--surface-hover); padding:3px 8px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            <strong>${p.coveragePackUsage || 1}</strong> Active Pack${p.coveragePackUsage === 1 ? '' : 's'}
          </span>
        </div>

        <!-- Required Systems / Apps -->
        <div>
          <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Required Systems:</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${(p.applications || ['Qualtrics XM', 'Data Hub', 'Slack']).map(app => `
              <span style="font-size:11px; background:var(--surface-hover); color:var(--text-primary); border:1px solid var(--border-subtle); padding:2px 8px; border-radius:var(--radius-full);">
                ${app}
              </span>
            `).join('')}
          </div>
        </div>

        <!-- Actions -->
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:auto; padding-top:12px; border-top:1px solid var(--border-subtle);">
          <button class="btn btn-secondary btn-sm" onclick="app.openSopPreviewModal('${p.id}')" title="Preview instructions">
            Quick Preview
          </button>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick="app.loadHandover('${p.id}'); app.switchView('outputs');" title="Open multi-format generated outputs">
              SOP &amp; Docs
            </button>
            <button class="btn btn-primary btn-sm" onclick="app.openCreatePackModal('${p.id}')" title="Include in holiday handover pack">
              + Use in Pack
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  filterLibrary(term) {
    if (!this.allProcessLibrary) return;
    const q = term.toLowerCase().trim();
    const filtered = this.allProcessLibrary.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.summary || '').toLowerCase().includes(q) ||
      (p.owner || '').toLowerCase().includes(q) ||
      (p.applications || []).some(a => a.toLowerCase().includes(q))
    );
    this.renderProcessLibraryCards(filtered);
  }

  populateProcessSelectInWizard(list) {
    const select = document.getElementById('new-task-process-select');
    if (!select || !list) return;
    select.innerHTML = list.map(p => `
      <option value="${p.id}">${p.title}</option>
    `).join('');
  }

  // 2. Coverage Packs Engine
  async loadCoveragePacks() {
    try {
      const res = await fetch('/api/coverage-packs');
      if (!res.ok) throw new Error('Failed to load coverage packs');
      const data = await res.json();
      this.allCoveragePacks = data;

      // Update counters
      const activePacks = data.filter(p => p.status === 'active');
      const activeEl = document.getElementById('cov-stat-active-packs');
      if (activeEl) activeEl.textContent = activePacks.length;

      let totalTasks = 0;
      let totalBlockers = 0;
      data.forEach(p => {
        totalTasks += p.stats?.totalTasks || 0;
        totalBlockers += p.stats?.blockedTasks || 0;
      });

      const totalTasksEl = document.getElementById('cov-stat-total-tasks');
      if (totalTasksEl) totalTasksEl.textContent = totalTasks;

      const blockersEl = document.getElementById('cov-stat-blockers');
      if (blockersEl) {
        blockersEl.textContent = totalBlockers;
        blockersEl.style.color = totalBlockers > 0 ? 'var(--danger)' : 'var(--success)';
      }

      const badgePacks = document.getElementById('nav-badge-packs');
      if (badgePacks) badgePacks.textContent = `${activePacks.length} Active`;

      this.renderCoveragePackCards(data);
    } catch (err) {
      console.error('Error loading coverage packs:', err);
    }
  }

  renderCoveragePackCards(packs) {
    const container = document.getElementById('coverage-packs-list');
    if (!container) return;

    if (!packs || packs.length === 0) {
      container.innerHTML = `<div class="card" style="grid-column:1 / -1; text-align:center; padding:30px; color:var(--text-muted);">No coverage packs created yet. Click "+ Create Holiday Coverage Pack" above to get started.</div>`;
      return;
    }

    container.innerHTML = packs.map(pack => {
      const stats = pack.stats || { totalTasks: 0, completedTasks: 0, blockedTasks: 0, pendingTasks: 0, progressPercent: 0 };
      const isComplete = stats.progressPercent === 100 && stats.totalTasks > 0;

      return `
        <div class="pack-card">
          <div class="pack-header">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span class="badge ${pack.status === 'active' ? 'badge-confirmed' : 'badge-observed'}" style="font-size:11px;">
                  ${pack.handover_type === 'annual_leave' ? 'Annual Leave Cover' : 'Role Transfer'}
                </span>
                <span class="badge ${stats.blockedTasks > 0 ? 'badge-caution' : 'badge-suggested'}" style="font-size:11px;">
                  ${stats.blockedTasks > 0 ? `${stats.blockedTasks} Blocker Active` : 'Healthy Pipeline'}
                </span>
              </div>
              <div class="pack-title">${pack.title}</div>
              <div class="pack-coverage-dates">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                ${pack.start_date} &rarr; ${pack.end_date}
              </div>
            </div>
          </div>

          <!-- People Connection Bar -->
          <div class="pack-people-bar">
            <div class="pack-person">
              <span class="persona-avatar-sm">SJ</span>
              <div>
                <div style="font-weight:600; color:var(--text-primary);">${pack.owner_name}</div>
                <div style="font-size:11px; color:var(--text-muted);">${pack.owner_role || 'Absent Owner'}</div>
              </div>
            </div>
            <div class="pack-arrow">&rarr;</div>
            <div class="pack-person">
              <span class="persona-avatar-sm covering">AR</span>
              <div>
                <div style="font-weight:600; color:var(--text-primary);">${pack.covering_colleague}</div>
                <div style="font-size:11px; color:var(--text-muted);">Covering Specialist</div>
              </div>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="progress-bar-container">
            <div style="display:flex; justify-content:space-between; font-size:12px;">
              <span style="font-weight:600; color:var(--text-primary);">${stats.completedTasks} of ${stats.totalTasks} Tasks Completed</span>
              <span style="font-weight:700; color:${isComplete ? 'var(--success)' : 'var(--accent)'};">${stats.progressPercent}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${isComplete ? 'complete' : ''}" style="width: ${stats.progressPercent}%;"></div>
            </div>
          </div>

          <!-- Project Status Notes -->
          ${pack.project_status_notes ? `
            <div style="font-size:12px; color:var(--text-secondary); background:var(--surface-hover); padding:10px 12px; border-radius:var(--radius-sm); line-height:1.45;">
              <strong>Live Status:</strong> ${pack.project_status_notes}
            </div>
          ` : ''}

          <!-- Outstanding Decisions -->
          ${pack.outstanding_decisions ? `
            <div style="font-size:12px; color:var(--warning); background:var(--warning-subtle); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--warning-border); line-height:1.4;">
              <strong>Decision Rule:</strong> ${pack.outstanding_decisions}
            </div>
          ` : ''}

          <!-- Action Buttons -->
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:auto; padding-top:14px; border-top:1px solid var(--border-subtle);">
            <button class="btn btn-secondary btn-sm" onclick="app.setPersona('covering', '${pack.covering_colleague}', 'Covering Ops Specialist', 'AR');" title="Act as covering colleague">
              Open as ${pack.covering_colleague}
            </button>
            <button class="btn btn-primary btn-sm" onclick="app.switchView('covering-tasks');" title="View tasks checklist">
              View Tasks Checklist &rarr;
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 3. Covering Colleague Dashboard ("My Assigned Tasks")
  async loadCoveringTasks() {
    try {
      const res = await fetch(`/api/coverage-tasks?colleague=Alex`);
      if (!res.ok) throw new Error('Failed to load covering tasks');
      const data = await res.json();
      this.allCoveringTasks = data;

      const pendingCount = data.filter(t => t.status === 'pending').length;
      const assignedBadge = document.getElementById('nav-badge-assigned');
      if (assignedBadge) assignedBadge.textContent = `${pendingCount} Due`;

      this.renderCoveringTasks();
    } catch (err) {
      console.error('Error loading covering tasks:', err);
    }
  }

  renderCoveringTasks() {
    const container = document.getElementById('assigned-tasks-container');
    if (!container) return;

    let list = [...(this.allCoveringTasks || [])];

    if (this.coveringFilter === 'pending') {
      list = list.filter(t => t.status === 'pending');
    } else if (this.coveringFilter === 'completed') {
      list = list.filter(t => t.status === 'completed');
    } else if (this.coveringFilter === 'blocked') {
      list = list.filter(t => t.status === 'blocked');
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:32px 16px; color:var(--text-muted); font-size:13px;">
          No tasks found under filter "${this.coveringFilter}". All clear!
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(t => {
      const isCompleted = t.status === 'completed';
      const isBlocked = t.status === 'blocked';

      let priorityColor = 'var(--text-muted)';
      if (t.priority === 'high') priorityColor = 'var(--danger)';
      else if (t.priority === 'medium') priorityColor = 'var(--warning)';

      return `
        <div class="coverage-task-card ${isCompleted ? 'completed' : ''} ${isBlocked ? 'blocked' : ''}">
          <button class="task-check-btn ${isCompleted ? 'checked' : ''}" 
                  onclick="app.toggleTaskComplete('${t.id}', '${t.status}')" 
                  title="${isCompleted ? 'Mark as Pending' : 'Mark as Completed'}">
            ${isCompleted ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
          </button>

          <div class="task-content-block">
            <div class="task-top-row">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="task-title-text" style="${isCompleted ? 'text-decoration: line-through; opacity:0.8;' : ''}">${t.task_title}</span>
                <span style="font-size:11px; font-weight:700; color:${priorityColor}; text-transform:uppercase; letter-spacing:0.04em;">
                  ${t.priority} Priority
                </span>
              </div>
              <span class="badge ${isCompleted ? 'badge-confirmed' : (isBlocked ? 'badge-caution' : 'badge-observed')}" style="font-size:11px;">
                ${isCompleted ? `Completed by ${t.completed_by || 'Alex Rivera'}` : (isBlocked ? 'Blocked' : 'Due ' + (t.due_date || 'Weekly'))}
              </span>
            </div>

            <!-- Handover Notes -->
            ${t.notes ? `
              <div class="task-details-notes">${t.notes}</div>
            ` : ''}

            <!-- Blocker Banner if blocked -->
            ${isBlocked ? `
              <div style="margin-bottom:10px; padding:8px 12px; background:var(--danger-subtle); border:1px solid var(--danger-border); border-radius:var(--radius-sm); font-size:12px; color:var(--danger); display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong>Operational Blocker Flagged:</strong> ${t.blocker_reason || 'Requires assistance from task owner'}
                </div>
                <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:2px 8px; border-color:var(--danger-border);" onclick="app.resolveBlocker('${t.id}')">
                  Mark Resolved
                </button>
              </div>
            ` : ''}

            <!-- Task Actions & Reusable Process Link -->
            <div class="task-actions-row">
              ${t.process_id ? `
                <button class="btn btn-secondary btn-sm" onclick="app.openSopPreviewModal('${t.process_id}')" style="font-size:12px;">
                  📖 Open Step-by-Step SOP
                </button>
                <button class="btn btn-secondary btn-sm" onclick="app.loadHandover('${t.process_id}'); app.switchView('outputs');" style="font-size:12px;">
                  Flowchart &amp; Docs &rarr;
                </button>
              ` : ''}

              ${!isBlocked && !isCompleted ? `
                <button class="btn btn-secondary btn-sm" onclick="app.openBlockerModal('${t.id}', '${t.task_title.replace(/'/g, "\\'")}')" style="font-size:12px; color:var(--warning); margin-left:auto;">
                  ⚠️ Flag Blocker
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async toggleTaskComplete(taskId, currentStatus) {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      const res = await fetch(`/api/coverage-tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          completed_by: 'Alex Rivera'
        })
      });

      if (!res.ok) throw new Error('Failed to update task status');
      this.showToast(nextStatus === 'completed' ? 'Task marked completed!' : 'Task reopened as pending.', 'success');
      await this.loadCoveringTasks();
      await this.loadCoveragePacks();
    } catch (err) {
      this.showToast('Error updating task: ' + err.message, 'error');
    }
  }

  openBlockerModal(taskId, taskTitle) {
    this.activeBlockerTaskId = taskId;
    const titleEl = document.getElementById('blocker-modal-task-title');
    if (titleEl) titleEl.textContent = `Task: ${taskTitle}`;
    const modal = document.getElementById('modal-flag-blocker');
    if (modal) modal.style.display = 'flex';
  }

  closeBlockerModal() {
    const modal = document.getElementById('modal-flag-blocker');
    if (modal) modal.style.display = 'none';
    this.activeBlockerTaskId = null;
  }

  async submitBlocker() {
    if (!this.activeBlockerTaskId) return;
    const cat = document.getElementById('blocker-input-category')?.value || 'Operational Issue';
    const notes = document.getElementById('blocker-input-notes')?.value || '';
    const fullReason = `${cat}: ${notes}`.trim();

    try {
      const res = await fetch(`/api/coverage-tasks/${this.activeBlockerTaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'blocked',
          blocker_reason: fullReason
        })
      });

      if (!res.ok) throw new Error('Failed to record blocker');
      this.showToast('Operational blocker recorded and logged in audit log.', 'warning');
      this.closeBlockerModal();
      await this.loadCoveringTasks();
      await this.loadCoveragePacks();
      await this.loadDashboardHandovers();
    } catch (err) {
      this.showToast('Error submitting blocker: ' + err.message, 'error');
    }
  }

  async resolveBlocker(taskId) {
    try {
      const res = await fetch(`/api/coverage-tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'pending',
          blocker_reason: null
        })
      });

      if (!res.ok) throw new Error('Failed to resolve blocker');
      this.showToast('Blocker resolved! Task restored to active pending checklist.', 'success');
      await this.loadCoveringTasks();
      await this.loadCoveragePacks();
      await this.loadDashboardHandovers();
    } catch (err) {
      this.showToast('Error resolving blocker: ' + err.message, 'error');
    }
  }

  // 4. Reusable SOP Quick Preview Modal
  async openSopPreviewModal(processId) {
    try {
      const res = await fetch(`/api/handovers/${processId}`);
      if (!res.ok) throw new Error('Failed to fetch SOP details');
      const data = await res.json();
      const wf = data.workflow || {};

      document.getElementById('sop-preview-title').textContent = data.title || wf.title || 'Standard Operating Procedure';
      document.getElementById('sop-preview-summary').textContent = data.task_description || wf.summary || '';
      document.getElementById('sop-preview-version').textContent = 'Verified SOP';
      document.getElementById('sop-preview-readiness').textContent = `${data.readiness_score || 92}% Readiness`;

      const body = document.getElementById('sop-preview-body');
      const steps = wf.steps || [];

      body.innerHTML = `
        <div style="background:var(--surface-hover); padding:14px; border-radius:var(--radius-md); margin-bottom:18px;">
          <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Prerequisites &amp; Credentials:</div>
          <ul style="margin:0; padding-left:18px; font-size:12.5px; color:var(--text-secondary); line-height:1.5;">
            ${(wf.prerequisites || [
              'Qualtrics SSO credentials with "Export Survey Data" privileges',
              'Active Corporate VPN connection',
              'Internal Data Hub ingest privileges'
            ]).map(p => `<li>${p}</li>`).join('')}
          </ul>
        </div>

        <div style="font-size:13.5px; font-weight:700; color:var(--text-primary); margin-bottom:12px;">Step-by-Step Execution Sequence:</div>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${steps.map((s, idx) => `
            <div style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:14px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                <div style="font-weight:700; color:var(--text-primary); font-size:13.5px;">
                  ${idx + 1}. ${s.title}
                </div>
                <span style="font-size:11px; font-family:monospace; color:var(--text-muted); background:var(--surface-hover); padding:2px 6px; border-radius:var(--radius-xs);">
                  ${s.app || 'Qualtrics'} @ ${s.timestamp || ''}
                </span>
              </div>
              <div style="font-size:12.5px; color:var(--text-secondary); line-height:1.45; margin-bottom:8px;">
                ${s.description}
              </div>

              ${s.decisionRule ? `
                <div style="font-size:12px; color:var(--warning); background:var(--warning-subtle); padding:6px 10px; border-radius:var(--radius-sm); border:1px solid var(--warning-border); margin-bottom:6px;">
                  <strong>Decision Rule:</strong> ${s.decisionRule}
                </div>
              ` : ''}

              ${s.validation ? `
                <div style="font-size:12px; color:var(--success); background:var(--success-subtle); padding:6px 10px; border-radius:var(--radius-sm); border:1px solid var(--success-border); margin-bottom:6px;">
                  <strong>Verification Check:</strong> ${s.validation}
                </div>
              ` : ''}

              ${s.caution ? `
                <div style="font-size:12px; color:var(--danger); background:var(--danger-subtle); padding:6px 10px; border-radius:var(--radius-sm); border:1px solid var(--danger-border);">
                  <strong>Caution / Warning:</strong> ${s.caution}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;

      const modal = document.getElementById('modal-sop-preview');
      if (modal) modal.style.display = 'flex';
    } catch (err) {
      this.showToast('Error opening SOP preview: ' + err.message, 'error');
    }
  }

  closeSopPreviewModal() {
    const modal = document.getElementById('modal-sop-preview');
    if (modal) modal.style.display = 'none';
  }

  // 5. Guided Holiday Handover Creator Wizard
  openCreatePackModal(preselectedProcessId) {
    this.wizardStep = 1;
    this.setWizardStep(1);

    if (preselectedProcessId) {
      const p = this.allProcessLibrary.find(x => x.id === preselectedProcessId);
      if (p) {
        this.draftPackTasks = [
          {
            task_title: p.title,
            process_id: p.id,
            due_date: 'Friday 14:00 UTC',
            recurrence: 'weekly',
            priority: 'high',
            notes: p.summary || ''
          }
        ];
      }
    }

    this.renderDraftPackTasks();
    const modal = document.getElementById('modal-create-pack');
    if (modal) modal.style.display = 'flex';
  }

  closeCreatePackModal() {
    const modal = document.getElementById('modal-create-pack');
    if (modal) modal.style.display = 'none';
  }

  setWizardStep(stepNum) {
    if (stepNum < 1 || stepNum > 4) return;
    this.wizardStep = stepNum;

    // Show step contents
    for (let i = 1; i <= 4; i++) {
      const stepEl = document.getElementById(`wiz-step-${i}`);
      const nodeEl = document.getElementById(`wiz-node-${i}`);
      if (stepEl) stepEl.style.display = i === stepNum ? 'block' : 'none';
      if (nodeEl) {
        nodeEl.classList.toggle('active', i === stepNum);
        nodeEl.classList.toggle('completed', i < stepNum);
      }
    }

    // Prev / Next button states
    const btnPrev = document.getElementById('btn-wiz-prev');
    const btnNext = document.getElementById('btn-wiz-next');
    const btnPublish = document.getElementById('btn-wiz-publish');

    if (btnPrev) btnPrev.style.display = stepNum > 1 ? 'inline-flex' : 'none';
    if (btnNext) btnNext.style.display = stepNum < 4 ? 'inline-flex' : 'none';
    if (btnPublish) btnPublish.style.display = stepNum === 4 ? 'inline-flex' : 'none';

    // If step 4, update review summary
    if (stepNum === 4) {
      const title = document.getElementById('pack-input-title')?.value;
      const sDate = document.getElementById('pack-input-start-date')?.value;
      const eDate = document.getElementById('pack-input-end-date')?.value;
      const colleague = document.getElementById('pack-input-colleague-name')?.value;

      const revTitle = document.getElementById('review-pack-title');
      const revDates = document.getElementById('review-pack-dates');
      const revColleague = document.getElementById('review-pack-colleague');

      if (revTitle) revTitle.textContent = title || 'Annual Leave Handover';
      if (revDates) revDates.textContent = `${sDate} to ${eDate}`;
      if (revColleague) revColleague.textContent = colleague || 'Covering Colleague';
    }
  }

  renderDraftPackTasks() {
    const container = document.getElementById('pack-tasks-draft-list');
    const countLabel = document.getElementById('pack-task-count-label');
    if (!container) return;

    if (countLabel) countLabel.textContent = this.draftPackTasks.length;

    if (this.draftPackTasks.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px; text-align:center;">No tasks added yet. Fill form above and click "+ Add".</div>`;
      return;
    }

    container.innerHTML = this.draftPackTasks.map((t, idx) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface); border:1px solid var(--border-subtle); padding:10px 12px; border-radius:var(--radius-sm); font-size:12.5px;">
        <div>
          <div style="font-weight:600; color:var(--text-primary);">${idx + 1}. ${t.task_title}</div>
          <div style="font-size:11px; color:var(--text-muted);">
            Due: <strong>${t.due_date}</strong> &bull; Priority: <strong>${t.priority}</strong> &bull; Recurrence: <strong>${t.recurrence}</strong>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="app.removeDraftTask(${idx})" style="color:var(--danger); border-color:var(--danger-border); font-size:11px; padding:2px 8px;">
          Remove
        </button>
      </div>
    `).join('');
  }

  addTaskToDraftPack() {
    const titleInput = document.getElementById('new-task-title');
    const procSelect = document.getElementById('new-task-process-select');
    const dueInput = document.getElementById('new-task-due');
    const recSelect = document.getElementById('new-task-recurrence');
    const prioSelect = document.getElementById('new-task-priority');
    const notesInput = document.getElementById('new-task-notes');

    const title = titleInput?.value.trim();
    if (!title) {
      this.showToast('Please enter a task title', 'warning');
      return;
    }

    this.draftPackTasks.push({
      task_title: title,
      process_id: procSelect?.value || null,
      due_date: dueInput?.value.trim() || 'Weekly',
      recurrence: recSelect?.value || 'weekly',
      priority: prioSelect?.value || 'high',
      notes: notesInput?.value.trim() || ''
    });

    if (titleInput) titleInput.value = '';
    if (dueInput) dueInput.value = '';
    if (notesInput) notesInput.value = '';

    this.renderDraftPackTasks();
    this.showToast('Task added to coverage pack', 'success', 2000);
  }

  removeDraftTask(idx) {
    this.draftPackTasks.splice(idx, 1);
    this.renderDraftPackTasks();
  }

  async publishCoveragePack() {
    const title = document.getElementById('pack-input-title')?.value.trim();
    const handover_type = document.getElementById('pack-input-type')?.value;
    const owner_name = 'Sarah Jenkins';
    const owner_role = 'Lead Research Ops';
    const start_date = document.getElementById('pack-input-start-date')?.value;
    const end_date = document.getElementById('pack-input-end-date')?.value;
    const covering_colleague = document.getElementById('pack-input-colleague-name')?.value.trim();
    const covering_colleague_email = document.getElementById('pack-input-colleague-email')?.value.trim();
    const project_status_notes = document.getElementById('pack-input-status-notes')?.value.trim();
    const outstanding_decisions = document.getElementById('pack-input-decisions')?.value.trim();

    if (!title || !start_date || !end_date || !covering_colleague) {
      this.showToast('Please fill out all required coverage details (Title, Dates, Colleague)', 'warning');
      return;
    }

    const escalation_contacts = [
      { name: 'Sarah Jenkins (Task Owner)', role: 'Lead Research Ops', contact: 'WhatsApp: +1-555-0192', trigger: 'Critical data blocker or delivery halt' },
      { name: 'Marcus Vance', role: 'Research Operations Director', contact: 'Slack: @marcus.vance', trigger: 'Client SLA scope changes or survey delay' },
      { name: 'Priya Sharma', role: 'Data Platform Engineer', contact: 'Slack: #data-hub-support', trigger: 'Data Hub batch upload failure / VPN' }
    ];

    const systems_access = [
      { system: 'Qualtrics XM Survey Platform', roleRequired: 'Research Analyst', status: 'Verified Access', notes: 'SSO access with Export Data privileges' },
      { system: 'Enterprise Data Hub (/delivery/weekly-research-ingest)', roleRequired: 'Ingest Specialist', status: 'Verified Access', notes: 'Requires active Corporate VPN' },
      { system: 'Slack Delivery Channels (#research-ops-alerts)', roleRequired: 'Channel Member', status: 'Verified Access', notes: 'Post weekly checksum and receipt log' }
    ];

    try {
      const res = await fetch('/api/coverage-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          handover_type,
          owner_name,
          owner_role,
          covering_colleague,
          covering_colleague_email,
          start_date,
          end_date,
          project_status_notes,
          outstanding_decisions,
          escalation_contacts,
          systems_access,
          tasks: this.draftPackTasks
        })
      });

      if (!res.ok) throw new Error('Failed to create coverage pack');
      const data = await res.json();

      this.closeCreatePackModal();
      this.showToast(`Coverage Pack "${title}" successfully published! ${covering_colleague} can now execute assigned tasks.`, 'success', 4500);

      await this.loadCoveragePacks();
      await this.loadCoveringTasks();
      await this.loadDashboardHandovers();
      this.switchView('coverage-packs');
    } catch (err) {
      this.showToast('Error publishing coverage pack: ' + err.message, 'error');
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
