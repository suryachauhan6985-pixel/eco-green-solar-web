// js/ui/skeleton.js
// -----------------------------------------------------------------------------
// ECO GREEN SOLAR ERP — ENTERPRISE SKELETON LOADING & STATE SYSTEM
// -----------------------------------------------------------------------------
// Centralized, high-performance, and responsive skeleton generator for tables,
// stat cards, lists, feeds, charts, and standardized empty/error states.
// -----------------------------------------------------------------------------

(function () {
  'use strict';

  const WIDTH_PATTERNS = [
    ['w-70', 'w-50', 'w-80', 'w-40', 'w-60', 'w-30', 'w-50', 'w-40'],
    ['w-50', 'w-75', 'w-40', 'w-60', 'w-80', 'w-50', 'w-30', 'w-60'],
    ['w-80', 'w-40', 'w-60', 'w-70', 'w-35', 'w-50', 'w-70', 'w-45'],
    ['w-60', 'w-80', 'w-50', 'w-35', 'w-75', 'w-40', 'w-60', 'w-50'],
    ['w-40', 'w-60', 'w-75', 'w-80', 'w-50', 'w-60', 'w-40', 'w-70'],
    ['w-75', 'w-50', 'w-35', 'w-60', 'w-40', 'w-80', 'w-50', 'w-40']
  ];

  const Skeleton = {
    /**
     * Generates responsive skeleton <tr> rows for HTML data tables
     * @param {number} cols - Number of columns
     * @param {number} rows - Number of rows (default: 5)
     * @param {object} opts - Options: { pillCols: [3], avatarCols: [0] }
     */
    tableRows(cols, rows = 5, opts = {}) {
      const colCount = Math.max(1, parseInt(cols, 10) || 1);
      const rowCount = Math.max(1, parseInt(rows, 10) || 5);
      const pillCols = Array.isArray(opts.pillCols) ? opts.pillCols : [];
      const avatarCols = Array.isArray(opts.avatarCols) ? opts.avatarCols : [];
      let html = "";
      for (let r = 0; r < rowCount; r++) {
        const pattern = WIDTH_PATTERNS[r % WIDTH_PATTERNS.length];
        html += '<tr class="skeleton-tr">';
        for (let c = 0; c < colCount; c++) {
          const isPill = pillCols.includes(c);
          const isAvatar = avatarCols.includes(c);
          const widthClass = pattern[c % pattern.length] || "w-60";
          html += '<td><div class="skeleton-td">';
          if (isAvatar) {
            html += '<div class="skeleton skeleton-avatar"></div>';
          } else if (isPill) {
            html += '<div class="skeleton skeleton-pill"></div>';
          } else {
            html += '<div class="skeleton skeleton-text ' + widthClass + '"></div>';
          }
          html += '</div></td>';
        }
        html += '</tr>';
      }
      return html;
    },

    /** Generates stat cards skeleton HTML */
    statCards(count = 4) {
      let html = "";
      for (let i = 0; i < count; i++) {
        html += '<div class="stat-card stat-card-skeleton">' +
          '<div class="skeleton skeleton-title w-50 h-24" style="margin-bottom:8px;"></div>' +
          '<div class="skeleton skeleton-text w-40 h-12"></div>' +
        '</div>';
      }
      return html;
    },

    /** Generates activity / timeline list item skeleton HTML */
    list(count = 4) {
      let html = "";
      for (let i = 0; i < count; i++) {
        const pattern = WIDTH_PATTERNS[i % WIDTH_PATTERNS.length];
        html += '<div class="skeleton-list-item" style="margin-bottom:8px;">' +
          '<div class="skeleton-list-item-left">' +
            '<div class="skeleton skeleton-avatar"></div>' +
            '<div class="skeleton-list-lines">' +
              '<div class="skeleton skeleton-title ' + pattern[0] + ' h-14"></div>' +
              '<div class="skeleton skeleton-text ' + pattern[1] + ' h-10"></div>' +
            '</div>' +
          '</div>' +
          '<div class="skeleton skeleton-pill w-20"></div>' +
        '</div>';
      }
      return html;
    },

    /** Generates chart bars placeholder HTML */
    chart(bars = 7) {
      const barHeights = [45, 80, 60, 95, 30, 70, 85, 50, 90, 65];
      let barHtml = "";
      for (let i = 0; i < bars; i++) {
        const h = barHeights[i % barHeights.length];
        barHtml += '<div class="skeleton-chart-bar" style="height:' + h + '%;"></div>';
      }
      return '<div class="skeleton-chart-box">' + barHtml + '</div>';
    },

    /** Standardized empty state HTML */
    empty(title = "No records found", opts = {}) {
      const icon = opts.icon || "fa-solid fa-inbox";
      const desc = opts.desc || "";
      const actionHtml = (opts.actionText && opts.actionId) ? (
        '<button type="button" class="btn btn-ghost btn-sm" id="' + opts.actionId + '" style="margin-top:12px;">' +
          (opts.actionIcon ? '<i class="' + opts.actionIcon + '"></i> ' : "") + opts.actionText +
        '</button>'
      ) : "";
      return '<div class="egs-empty-state">' +
        '<i class="' + icon + ' egs-empty-icon"></i>' +
        '<div class="egs-empty-title">' + title + '</div>' +
        (desc ? '<div class="egs-empty-desc">' + desc + '</div>' : "") +
        actionHtml +
      '</div>';
    },

    /** Table row wrapper for empty state */
    tableEmpty(colspan, title = "No records found", opts = {}) {
      return '<tr><td colspan="' + colspan + '">' + this.empty(title, opts) + '</td></tr>';
    },

    /** Standardized error state HTML with retry button */
    error(desc = "Unable to load records. Please verify network or server connection.", opts = {}) {
      const title = opts.title || "Data Fetch Failed";
      const icon = opts.icon || "fa-solid fa-triangle-exclamation";
      const retryId = opts.retryId || "";
      return '<div class="egs-error-state">' +
        '<i class="' + icon + ' egs-error-icon"></i>' +
        '<div class="egs-error-title">' + title + '</div>' +
        '<div class="egs-error-desc">' + desc + '</div>' +
        (retryId ? (
          '<button type="button" class="btn btn-ghost btn-sm egs-btn-retry" id="' + retryId + '" style="margin-top:10px;">' +
            '<i class="fa-solid fa-rotate-right"></i> Retry' +
          '</button>'
        ) : "") +
      '</div>';
    },

    /** Table row wrapper for error state */
    tableError(colspan, desc, opts = {}) {
      return '<tr><td colspan="' + colspan + '">' + this.error(desc, opts) + '</td></tr>';
    },

    /** Helper to wire retry callbacks */
    wireRetry(retryId, callback) {
      if (!retryId || typeof callback !== "function") return;
      setTimeout(() => {
        const btn = document.getElementById(retryId);
        if (btn) {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Retrying...';
            btn.disabled = true;
            callback();
          });
        }
      }, 0);
    },

    /**
     * Preview / Demo Helper: Simulates skeleton loading on the current page
     * @param {number} durationMs - Duration in milliseconds (default: 4000ms)
     */
    demo(durationMs = 4000) {
      const activeTbody = document.querySelector('.content table tbody');
      if (activeTbody) {
        const thCount = document.querySelectorAll('.content table thead th').length;
        const colCount = thCount || 6;
        const origHtml = activeTbody.innerHTML;
        activeTbody.innerHTML = this.tableRows(colCount, 7, { pillCols: [1, 3] });
        if (window.showToast) window.showToast(`✨ Skeleton Shimmer Preview Active (${durationMs / 1000}s)`);
        setTimeout(() => {
          activeTbody.innerHTML = origHtml;
        }, durationMs);
        return `Showing ${colCount}-column skeleton for ${durationMs / 1000} seconds.`;
      }
      return 'Navigate to any page with a table (Reports, Registers, Masters, etc.) and run Skeleton.demo() again.';
    }
  };

  window.Skeleton = Skeleton;
})();
