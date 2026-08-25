// js/utils/password-policy.js
// -----------------------------------------------------------------------------
// Client-Side Real-Time Enterprise Password Policy & UI Widget
// -----------------------------------------------------------------------------

(function() {
  const MIN_LENGTH = 12;
  const MAX_LENGTH = 128;

  const COMMON_WEAK_PASSWORDS = new Set([
    'password', 'password123', 'password1234', 'password@123', 'password123!',
    '123456789012', '1234567890123', '12345678901234', '123456789012345',
    'admin12345678', 'admin@123456', 'administrator', 'administrator1',
    'welcome123456', 'welcome@12345', 'qwerty123456', 'qwertyuiopas',
    'letmein123456', 'changeme12345', 'ecogreensolar', 'ecogreen12345',
    'sunshine12345', 'solarpower123', 'solarpanel123'
  ]);

  function evaluatePassword(password, options = {}) {
    const p = String(password || '');
    const checks = {
      minLength: p.length >= MIN_LENGTH && p.length <= MAX_LENGTH,
      hasUpper: /[A-Z]/.test(p),
      hasLower: /[a-z]/.test(p),
      hasNumber: /[0-9]/.test(p),
      hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p),
      noSurroundingWhitespace: p.length > 0 && p.trim() === p,
      notCommon: !COMMON_WEAK_PASSWORDS.has(p.toLowerCase()) && !/^(.)\1{7,}$/.test(p),
      passwordsMatch: options.confirmPassword !== undefined ? (p.length > 0 && p === options.confirmPassword) : true,
    };

    let score = 0;
    if (checks.minLength) score += 25;
    if (p.length >= 16) score += 15;
    if (p.length >= 20) score += 10;
    if (checks.hasUpper) score += 10;
    if (checks.hasLower) score += 10;
    if (checks.hasNumber) score += 10;
    if (checks.hasSpecial) score += 15;
    if (checks.notCommon) score += 5;
    if (!checks.noSurroundingWhitespace) score = Math.max(0, score - 20);

    let strength = 'Weak';
    let strengthClass = 'weak';
    if (score >= 90) { strength = 'Very Strong'; strengthClass = 'very-strong'; }
    else if (score >= 75) { strength = 'Strong'; strengthClass = 'strong'; }
    else if (score >= 55) { strength = 'Good'; strengthClass = 'good'; }
    else if (score >= 35) { strength = 'Fair'; strengthClass = 'fair'; }

    const valid = checks.minLength && checks.hasUpper && checks.hasLower && checks.hasNumber && checks.hasSpecial && checks.noSurroundingWhitespace && checks.notCommon && checks.passwordsMatch;

    return {
      valid,
      checks,
      score: Math.min(100, score),
      strength,
      strengthClass
    };
  }

  function attachPolicyWidget({ passwordInput, confirmPasswordInput, container, showMatch = true }) {
    if (!passwordInput || !container) return null;

    container.className = 'pwd-strength-container';
    container.innerHTML = `
      <div class="pwd-strength-header">
        <span class="pwd-strength-title"><i class="fa-solid fa-shield-halved"></i> Password Strength</span>
        <span class="pwd-strength-label weak">Weak</span>
      </div>
      <div class="pwd-strength-track">
        <div class="pwd-strength-fill weak" style="width: 0%;"></div>
      </div>
      <div class="pwd-requirements-list">
        <div class="pwd-req-item" data-req="minLength"><i class="fa-solid fa-circle-xmark"></i> <span>At least 12 characters</span></div>
        <div class="pwd-req-item" data-req="hasUpper"><i class="fa-solid fa-circle-xmark"></i> <span>One uppercase letter (A-Z)</span></div>
        <div class="pwd-req-item" data-req="hasLower"><i class="fa-solid fa-circle-xmark"></i> <span>One lowercase letter (a-z)</span></div>
        <div class="pwd-req-item" data-req="hasNumber"><i class="fa-solid fa-circle-xmark"></i> <span>One number (0-9)</span></div>
        <div class="pwd-req-item" data-req="hasSpecial"><i class="fa-solid fa-circle-xmark"></i> <span>One special character (!@#$%...)</span></div>
        ${showMatch ? '<div class="pwd-req-item" data-req="passwordsMatch"><i class="fa-solid fa-circle-xmark"></i> <span>Passwords match</span></div>' : ''}
      </div>
    `;

    const label = container.querySelector('.pwd-strength-label');
    const fill = container.querySelector('.pwd-strength-fill');
    const reqItems = container.querySelectorAll('.pwd-req-item');

    function update() {
      const val = passwordInput.value || '';
      const confirmVal = confirmPasswordInput ? (confirmPasswordInput.value || '') : undefined;

      if (!val) {
        container.style.display = 'none';
        return;
      }
      container.style.display = 'block';

      const res = evaluatePassword(val, { confirmPassword: confirmVal });

      label.textContent = res.strength;
      label.className = `pwd-strength-label ${res.strengthClass}`;

      fill.style.width = `${res.score}%`;
      fill.className = `pwd-strength-fill ${res.strengthClass}`;

      reqItems.forEach(item => {
        const reqName = item.dataset.req;
        const isPassed = !!res.checks[reqName];
        const icon = item.querySelector('i');
        if (isPassed) {
          item.classList.add('passed');
          if (icon) {
            icon.className = 'fa-solid fa-circle-check';
          }
        } else {
          item.classList.remove('passed');
          if (icon) {
            icon.className = 'fa-solid fa-circle-xmark';
          }
        }
      });
    }

    passwordInput.addEventListener('input', update);
    passwordInput.addEventListener('focus', () => { if (passwordInput.value) container.style.display = 'block'; });
    if (confirmPasswordInput) {
      confirmPasswordInput.addEventListener('input', update);
      confirmPasswordInput.addEventListener('focus', () => { if (passwordInput.value) container.style.display = 'block'; });
    }

    return {
      validate: () => evaluatePassword(passwordInput.value || '', { confirmPassword: confirmPasswordInput ? confirmPasswordInput.value : undefined }),
      update,
      reset: () => {
        container.style.display = 'none';
        update();
      }
    };
  }

  window.PasswordPolicy = {
    MIN_LENGTH,
    MAX_LENGTH,
    evaluate: evaluatePassword,
    attach: attachPolicyWidget,
  };
})();
