const settingsView = {
  render: function (rootElement, { appSettings, activeProfile = 'pc', onSettingsUpdate }) {
    let editingProfile = activeProfile === 'mobile' ? 'mobile' : 'pc';
    const settingsByProfile = {
      pc: normalizeProfileSettings(appSettings?.pc || appSettings),
      mobile: normalizeProfileSettings(appSettings?.mobile || appSettings?.pc || appSettings)
    };

    const controls = {
      contentFontSizeRem: {
        title: 'Content Font Size',
        description: 'Adjust content text, form labels, select fields, table body cells, and table buttons.',
        unit: 'rem',
        min: 0.9,
        max: 1.8,
        step: 0.05,
        decimals: 2
      },
      buttonPaddingY: {
        title: 'Button Vertical Padding',
        description: 'Adjust top and bottom padding inside buttons.',
        unit: 'px',
        min: 4,
        max: 24,
        step: 1,
        decimals: 0
      },
      buttonPaddingX: {
        title: 'Button Horizontal Padding',
        description: 'Adjust left and right padding inside buttons.',
        unit: 'px',
        min: 8,
        max: 36,
        step: 1,
        decimals: 0
      },
      tableCellPaddingY: {
        title: 'Table Vertical Spacing',
        description: 'Adjust top and bottom spacing inside table cells.',
        unit: 'px',
        min: 6,
        max: 32,
        step: 1,
        decimals: 0
      },
      tableCellPaddingX: {
        title: 'Table Horizontal Spacing',
        description: 'Adjust left and right spacing inside table cells.',
        unit: 'px',
        min: 8,
        max: 40,
        step: 1,
        decimals: 0
      }
    };

    const container = document.createElement('div');
    container.className = 'settings-panel';
    container.innerHTML = `
      <h1>Settings</h1>

      <section class="settings-control" aria-label="Device profile">
        <h2>Device Profile</h2>
        <label>PC and mobile use separate backed up display settings.</label>
        <div class="settings-profile-switch">
          <button id="pcProfileBtn" type="button">PC</button>
          <button id="mobileProfileBtn" type="button">Mobile</button>
        </div>
      </section>

      ${Object.entries(controls).map(([key, config]) => `
        <section class="settings-control" aria-label="${config.title}">
          <h2>${config.title}</h2>
          <label>${config.description}</label>
          <div class="settings-stepper" data-setting="${key}">
            <button data-action="decrease" type="button" aria-label="Decrease ${config.title}">-</button>
            <span class="settings-value" data-value="${key}"></span>
            <button data-action="increase" type="button" aria-label="Increase ${config.title}">+</button>
          </div>
        </section>
      `).join('')}

      <section class="settings-preview" aria-label="Font size preview">
        <h2>Preview</h2>
        <p id="profilePreviewText"></p>
        <label>
          Preview Select
          <select>
            <option>Current month schedule</option>
            <option>Parent billing view</option>
          </select>
        </label>
        <div class="settings-preview-actions">
          <button type="button">Primary Action</button>
          <button type="button">Secondary Action</button>
        </div>
        <table class="settings-preview-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>2026/06/13</td>
              <td>Scheduled</td>
              <td><button type="button">Modify Time</button></td>
            </tr>
            <tr>
              <td>2026/06/20</td>
              <td>Canceled</td>
              <td><button type="button">Unmark Canceled</button></td>
            </tr>
          </tbody>
        </table>
      </section>
    `;
    rootElement.appendChild(container);

    const pcProfileBtn = container.querySelector('#pcProfileBtn');
    const mobileProfileBtn = container.querySelector('#mobileProfileBtn');
    const profilePreviewText = container.querySelector('#profilePreviewText');
    const previewSection = container.querySelector('.settings-preview');

    function clampValue(key, value) {
      const config = controls[key];
      const settings = settingsByProfile[editingProfile];
      return Math.min(config.max, Math.max(config.min, Number(value) || settings[key]));
    }

    function formatValue(key, value) {
      const config = controls[key];
      return clampValue(key, value).toFixed(config.decimals);
    }

    function renderControl(key) {
      const config = controls[key];
      const settings = settingsByProfile[editingProfile];
      const value = Number(formatValue(key, settings[key]));
      const wrap = container.querySelector(`[data-setting="${key}"]`);
      const display = container.querySelector(`[data-value="${key}"]`);
      display.textContent = `${formatValue(key, value)}${config.unit}`;
      wrap.querySelector('[data-action="decrease"]').disabled = value <= config.min;
      wrap.querySelector('[data-action="increase"]').disabled = value >= config.max;
    }

    function updateValue(key, nextValue) {
      settingsByProfile[editingProfile][key] = Number(formatValue(key, nextValue));
      renderControl(key);
      applyPreviewSettings();
      onSettingsUpdate(editingProfile, { [key]: settingsByProfile[editingProfile][key] });
    }

    function applyPreviewSettings() {
      const settings = settingsByProfile[editingProfile];
      previewSection.style.setProperty("--content-font-size", `${settings.contentFontSizeRem}rem`);
      previewSection.style.setProperty("--button-padding-y", `${settings.buttonPaddingY}px`);
      previewSection.style.setProperty("--button-padding-x", `${settings.buttonPaddingX}px`);
      previewSection.style.setProperty("--table-cell-padding-y", `${settings.tableCellPaddingY}px`);
      previewSection.style.setProperty("--table-cell-padding-x", `${settings.tableCellPaddingX}px`);
    }

    function renderAllControls() {
      pcProfileBtn.style.background = editingProfile === 'pc' ? 'var(--primary)' : '';
      pcProfileBtn.style.borderColor = editingProfile === 'pc' ? 'var(--primary)' : '';
      pcProfileBtn.style.color = editingProfile === 'pc' ? '#fff' : '';
      mobileProfileBtn.style.background = editingProfile === 'mobile' ? 'var(--primary)' : '';
      mobileProfileBtn.style.borderColor = editingProfile === 'mobile' ? 'var(--primary)' : '';
      mobileProfileBtn.style.color = editingProfile === 'mobile' ? '#fff' : '';
      profilePreviewText.textContent = `Previewing ${editingProfile === 'pc' ? 'PC' : 'Mobile'} content text, buttons, and table spacing.`;
      Object.keys(controls).forEach(renderControl);
      applyPreviewSettings();
    }

    pcProfileBtn.addEventListener('click', () => {
      editingProfile = 'pc';
      renderAllControls();
    });
    mobileProfileBtn.addEventListener('click', () => {
      editingProfile = 'mobile';
      renderAllControls();
    });

    Object.keys(controls).forEach((key) => {
      const wrap = container.querySelector(`[data-setting="${key}"]`);
      wrap.querySelector('[data-action="decrease"]').addEventListener('click', () => {
        updateValue(key, settingsByProfile[editingProfile][key] - controls[key].step);
      });
      wrap.querySelector('[data-action="increase"]').addEventListener('click', () => {
        updateValue(key, settingsByProfile[editingProfile][key] + controls[key].step);
      });
    });

    renderAllControls();

    function normalizeProfileSettings(settings) {
      return {
        contentFontSizeRem: Number(settings?.contentFontSizeRem) || 1.25,
        buttonPaddingY: Number(settings?.buttonPaddingY) || 10,
        buttonPaddingX: Number(settings?.buttonPaddingX) || 15,
        tableCellPaddingY: Number(settings?.tableCellPaddingY) || 16,
        tableCellPaddingX: Number(settings?.tableCellPaddingX) || 18
      };
    }
  }
};
