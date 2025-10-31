/* Induct Finish – front-end storage + UI controller (localStorage + Notifications)
   --------------------------------------------------------------------------------
   What’s included:
   - Request form (Employee ID + Shift)
   - Admin login and panel (approve/deny + DELETE STATUS)
   - Floating status box:
       • APPROVED (green)
       • DENIED (red; click to view reason)
       • HIDDEN when there is NO request on record (NEW per your ask)
   - Desktop notifications (OS sound) when a request is submitted
     * Works while the site is OPEN somewhere (tab can be backgrounded/minimized)
     * Requires sw.js registered and Notification permission granted
*/

(function () {
  const LS_KEY = 'induct_requests_v1';
  const SESSION_EMP_KEY = 'induct_current_employee_id';
  const STATUS = { PENDING: 'pending', APPROVED: 'approved', DENIED: 'denied' };

  // =========================
  // Service Worker + Notify
  // =========================
  let swReady = null;

  function registerServiceWorkerAndAskPermission() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

    // Register SW (idempotent)
    swReady = navigator.serviceWorker.register('sw.js')
      .then((reg) => {
        if (!navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(() => { /* controller after first activation */ });
        }
        return reg;
      })
      .catch((err) => {
        console.warn('SW register failed:', err);
        return null;
      });

    // Ask/ensure permission
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }

  async function triggerLocalNotification(payload) {
    try {
      if (!('Notification' in window)) return;

      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission !== 'granted') return;

      const reg = await (swReady || navigator.serviceWorker.getRegistration());
      if (reg && reg.showNotification) {
        await reg.showNotification(
          payload.title || 'New Induct Finish Request',
          {
            body:
              payload.body ||
              `Employee ${payload.employeeId || 'Unknown'} (${payload.shift || 'N/A'}) submitted a request.`,
            icon:
              payload.icon ||
              'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f47b.png',
            badge:
              payload.badge ||
              'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f47b.png',
            tag: payload.tag || 'induct-request',
            renotify: true,
            requireInteraction: true,
            data: { url: payload.url || '/', meta: payload.meta || {} },
          }
        );
        return;
      }

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'LOCAL_NOTIFY',
          payload,
        });
        return;
      }

      // Last fallback (best-effort)
      // eslint-disable-next-line no-new
      new Notification(payload.title || 'New Induct Finish Request', {
        body:
          payload.body ||
          `Employee ${payload.employeeId || 'Unknown'} (${payload.shift || 'N/A'}) submitted a request.`,
        icon:
          payload.icon ||
          'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f47b.png',
      });
    } catch (e) {
      console.warn('triggerLocalNotification error:', e);
    }
  }

  // Register SW on load
  registerServiceWorkerAndAskPermission();

  // -------------------------
  // storage helpers
  // -------------------------
  function loadRequests() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { return []; }
  }
  function saveRequests(list) { localStorage.setItem(LS_KEY, JSON.stringify(list)); }
  function upsertRequest(req) {
    const list = loadRequests();
    const idx = list.findIndex(r => r.id === req.id);
    if (idx >= 0) list[idx] = req; else list.unshift(req); // newest first
    saveRequests(list);
    return list;
  }
  function updateRequest(id, patch) {
    const list = loadRequests();
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
      saveRequests(list);
      return list[idx];
    }
    return null;
  }
  function deleteRequest(id) {
    const list = loadRequests();
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) {
      const [removed] = list.splice(idx, 1);
      saveRequests(list);
      return removed || null;
    }
    return null;
  }
  function latestRequestForEmployee(employeeId) {
    const list = loadRequests();
    return list.find(r => r.employeeId === employeeId) || null; // list is newest-first
  }

  // -------------------------
  // dom/helpers
  // -------------------------
  const $ = (sel) => document.querySelector(sel);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // Elements (exist on both pages)
  const openRequestBtn = $('#open-request-btn');
  const openAdminBtn   = $('#open-admin-btn');
  const statusBox      = $('#induct-status-box');
  const overlay        = $('#modal-overlay');

  const requestModal   = $('#request-modal');
  const adminLoginModal= $('#admin-login-modal');
  const adminPanelModal= $('#admin-panel-modal');

  // Request modal fields
  const empInput   = $('#req-employee-id');
  const shiftInput = $('#req-shift');
  const submitReq  = $('#submit-request');

  // Admin login fields
  const adminEmail = $('#admin-email');
  const adminPass  = $('#admin-pass');
  const adminLogin = $('#admin-login-btn');

  // Admin table
  const tableBody  = $('#requests-table tbody');
  const emptyMsg   = $('#requests-empty');

  // -------------------------
  // modal controls
  // -------------------------
  function openModal(modal) {
    if (!modal) return;
    overlay.style.display = 'block';
    modal.style.display = 'block';
  }
  function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    const anyOpen = [requestModal, adminLoginModal, adminPanelModal].some(m => m && m.style.display === 'block');
    if (!anyOpen) overlay.style.display = 'none';
  }
  function closeByAttr(e) {
    const id = e.currentTarget.getAttribute('data-close');
    const modal = document.getElementById(id);
    closeModal(modal);
  }
  document.querySelectorAll('.close-btn[data-close]').forEach(btn => on(btn, 'click', closeByAttr));
  on(overlay, 'click', () => {
    [requestModal, adminLoginModal, adminPanelModal].forEach(closeModal);
  });

  // -------------------------
  // status box
  // -------------------------
  function setStatusBox(state, text) {
    if (!statusBox) return;
    if (!state) {
      // Hide entirely (no waiting/anything) – requested behavior
      statusBox.style.display = 'none';
      statusBox.classList.remove('status-waiting','status-approved','status-denied');
      statusBox.textContent = '';
      statusBox.dataset.reqId = '';
      return;
    }

    statusBox.style.display = 'block';
    statusBox.classList.remove('status-waiting','status-approved','status-denied');
    if (state === STATUS.APPROVED) {
      statusBox.classList.add('status-approved');
      statusBox.textContent = text || 'Induct finish: APPROVED';
    } else if (state === STATUS.DENIED) {
      statusBox.classList.add('status-denied');
      statusBox.textContent = text || 'Induct finish: DENIED (tap for reason)';
    } else {
      statusBox.classList.add('status-waiting');
      statusBox.textContent = text || 'Waiting for status update…';
    }
  }

  function refreshStatusBoxForCurrentEmployee() {
    const emp = sessionStorage.getItem(SESSION_EMP_KEY);
    if (!emp) { setStatusBox(null); return; }
    const latest = latestRequestForEmployee(emp);
    if (!latest) { setStatusBox(null); return; } // HIDE when there is no request
    if (latest.status === STATUS.APPROVED) setStatusBox(STATUS.APPROVED);
    else if (latest.status === STATUS.DENIED) setStatusBox(STATUS.DENIED, 'Induct finish: DENIED (tap for reason)');
    else setStatusBox(STATUS.PENDING);
    statusBox.dataset.reqId = latest.id;
  }

  on(statusBox, 'click', () => {
    const id = statusBox?.dataset?.reqId;
    if (!id) return;
    const req = loadRequests().find(r => r.id === id);
    if (!req) return;
    if (req.status === STATUS.DENIED) {
      alert(`Denied reason:\n\n${req.reason || 'No reason provided.'}`);
    } else if (req.status === STATUS.APPROVED) {
      if (req.reason) alert(`Approved.\n\nNote: ${req.reason}`);
    }
  });

  // -------------------------
  // Request flow
  // -------------------------
  on(openRequestBtn, 'click', () => {
    if (empInput) empInput.value = sessionStorage.getItem(SESSION_EMP_KEY) || '';
    if (shiftInput) shiftInput.value = '';
    openModal(requestModal);
  });

  on(submitReq, 'click', async () => {
    const employeeId = (empInput?.value || '').trim();
    const shift = (shiftInput?.value || '').trim();
    if (!employeeId || !shift) {
      alert('Please fill Employee ID and Shift.');
      return;
    }
    const req = {
      id: 'REQ_' + Date.now(),
      employeeId,
      shift,
      status: STATUS.PENDING,
      reason: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    upsertRequest(req);
    sessionStorage.setItem(SESSION_EMP_KEY, employeeId);
    setStatusBox(STATUS.PENDING);
    if (statusBox) statusBox.dataset.reqId = req.id;
    closeModal(requestModal);

    // --- Trigger desktop notification (with OS sound) ---
    await triggerLocalNotification({
      title: '🧾 New Induct Finish Request',
      body: `Employee ${employeeId} (${shift}) submitted a request.`,
      url: (typeof location !== 'undefined') ? location.origin : '/',
      tag: 'induct-request',
    });

    alert('Request submitted. Your status will update once an admin reviews it.');
  });

  // -------------------------
  // Admin login + panel
  // -------------------------
  let adminLoggedIn = false;

  on(openAdminBtn, 'click', () => {
    if (adminLoggedIn) { openModal(adminPanelModal); renderAdminTable(); }
    else { openModal(adminLoginModal); }
  });

  on(adminLogin, 'click', () => {
    const email = (adminEmail?.value || '').trim();
    const pass = adminPass?.value || '';
    if (email === 'admin@amazon.com' && pass === 'amzlDAP8') {
      adminLoggedIn = true;
      closeModal(adminLoginModal);
      openModal(adminPanelModal);
      renderAdminTable();
    } else {
      alert('Invalid credentials.');
    }
  });

  function renderAdminTable() {
    const list = loadRequests();
    if (!tableBody || !emptyMsg) return;

    tableBody.innerHTML = '';
    if (!list.length) {
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    list.forEach(req => {
      const tr = document.createElement('tr');

      const tdTime = document.createElement('td');
      const dt = new Date(req.createdAt);
      tdTime.textContent = dt.toLocaleString();
      tr.appendChild(tdTime);

      const tdEmp = document.createElement('td');
      tdEmp.textContent = req.employeeId;
      tr.appendChild(tdEmp);

      const tdShift = document.createElement('td');
      tdShift.textContent = req.shift;
      tr.appendChild(tdShift);

      const tdStatus = document.createElement('td');
      tdStatus.textContent = req.status.toUpperCase();
      tr.appendChild(tdStatus);

      const tdAction = document.createElement('td');

      // Approve
      const approveBtn = document.createElement('button');
      approveBtn.className = 'btn btn-primary';
      approveBtn.textContent = 'Approve';

      // Deny
      const denyBtn = document.createElement('button');
      denyBtn.className = 'btn btn-danger';
      denyBtn.style.marginLeft = '.4rem';
      denyBtn.textContent = 'Deny';

      // DELETE STATUS (NEW) – removes this request entirely
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-ghost';
      deleteBtn.style.marginLeft = '.4rem';
      deleteBtn.textContent = 'Delete Status';

      approveBtn.addEventListener('click', () => {
        const reason = prompt('Optional note for approval (visible to requester):', '');
        const updated = updateRequest(req.id, { status: STATUS.APPROVED, reason: reason || '' });
        tdStatus.textContent = 'APPROVED';
        maybeUpdateStatusBox(updated);
      });

      denyBtn.addEventListener('click', () => {
        const reason = prompt('Reason for denial (shown to requester):', '');
        if (!reason) { alert('Please provide a reason to deny.'); return; }
        const updated = updateRequest(req.id, { status: STATUS.DENIED, reason });
        tdStatus.textContent = 'DENIED';
        maybeUpdateStatusBox(updated);
      });

      deleteBtn.addEventListener('click', () => {
        const sure = confirm('Delete this status entirely? The requester will see no status until they submit a new request.');
        if (!sure) return;

        const removed = deleteRequest(req.id);
        // Remove row from UI
        tr.remove();

        // If table became empty, show empty msg
        if (!loadRequests().length) {
          emptyMsg.style.display = 'block';
        }

        // If this requester is the one currently viewing, recompute their latest request
        const currentEmp = sessionStorage.getItem(SESSION_EMP_KEY);
        if (currentEmp && removed && removed.employeeId === currentEmp) {
          const latest = latestRequestForEmployee(currentEmp);
          if (!latest) {
            // Hide the status box entirely (your requested behavior)
            setStatusBox(null);
          } else {
            // Show whatever the next-latest status is
            if (latest.status === STATUS.APPROVED) setStatusBox(STATUS.APPROVED);
            else if (latest.status === STATUS.DENIED) setStatusBox(STATUS.DENIED, 'Induct finish: DENIED (tap for reason)');
            else setStatusBox(STATUS.PENDING);
            if (statusBox) statusBox.dataset.reqId = latest.id;
          }
        }
      });

      tdAction.appendChild(approveBtn);
      tdAction.appendChild(denyBtn);
      tdAction.appendChild(deleteBtn);
      tr.appendChild(tdAction);

      tableBody.appendChild(tr);
    });
  }

  function maybeUpdateStatusBox(updatedReq) {
    const currentEmp = sessionStorage.getItem(SESSION_EMP_KEY);
    if (!currentEmp || !updatedReq) return;
    if (updatedReq.employeeId !== currentEmp) return;

    if (updatedReq.status === STATUS.APPROVED) {
      setStatusBox(STATUS.APPROVED);
    } else if (updatedReq.status === STATUS.DENIED) {
      setStatusBox(STATUS.DENIED, 'Induct finish: DENIED (tap for reason)');
    } else {
      setStatusBox(STATUS.PENDING);
    }
    if (statusBox) statusBox.dataset.reqId = updatedReq.id;
  }

  // -------------------------
  // init
  // -------------------------
  refreshStatusBoxForCurrentEmployee();
})();
