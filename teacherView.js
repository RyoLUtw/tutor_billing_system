// views/teacherView.js

// Plain‐script version—no imports/exports. Assumes html2canvas is loaded globally
const teacherView = {
  render: function (rootElement, {
    students = [],
    archivedStudents = [],
    monthlySchedules = {}
  }) {
    // 1) Build container + UI
    const container = document.createElement('div');
    container.innerHTML = `
      <h1>Teacher's Salary Review</h1>

      <div>
        <label>
          <input type="checkbox" id="multiMonthsCheckbox" />
          Check multiple months
        </label>
      </div>

      <div id="singleMonthUI">
        <label>Month (1-12):</label>
        <input type="number" id="monthInput" min="1" max="12" />
        <label>Year:</label>
        <input type="number" id="yearInput" />
      </div>

      <div id="multiMonthUI" style="display:none;">
        <label>Start Month (1-12):</label>
        <input type="number" id="startMonthInput" min="1" max="12" />
        <label>Start Year:</label>
        <input type="number" id="startYearInput" />
        <br/>
        <label>End Month (1-12):</label>
        <input type="number" id="endMonthInput" min="1" max="12" />
        <label>End Year:</label>
        <input type="number" id="endYearInput" />
      </div>

      <button id="generateBtn">Generate Review</button>

      <div id="reviewContainer" style="margin-top:20px;">
        <table id="reviewTable" border="1">
          <thead><tr></tr></thead>
          <tbody></tbody>
        </table>
        <h3 id="summaryLine"></h3>
      </div>

      <button id="saveSalaryReviewBtn">Save Salary Review (PNG)</button>
    `;
    rootElement.appendChild(container);

    // 2) Grab references
    const multiMonthsCheckbox = container.querySelector('#multiMonthsCheckbox');
    const singleMonthUI       = container.querySelector('#singleMonthUI');
    const monthInput          = container.querySelector('#monthInput');
    const yearInput           = container.querySelector('#yearInput');
    const multiMonthUI        = container.querySelector('#multiMonthUI');
    const startMonthInput     = container.querySelector('#startMonthInput');
    const startYearInput      = container.querySelector('#startYearInput');
    const endMonthInput       = container.querySelector('#endMonthInput');
    const endYearInput        = container.querySelector('#endYearInput');
    const generateBtn         = container.querySelector('#generateBtn');
    const reviewContainer     = container.querySelector('#reviewContainer');
    const reviewTableHead     = container.querySelector('#reviewTable thead');
    const reviewTableBody     = container.querySelector('#reviewTable tbody');
    const summaryLine         = container.querySelector('#summaryLine');
    const saveBtn             = container.querySelector('#saveSalaryReviewBtn');

    // 3) Default inputs to today
    const now = new Date();
    monthInput.value      = now.getMonth() + 1;
    yearInput.value       = now.getFullYear();
    startMonthInput.value = now.getMonth() + 1;
    startYearInput.value  = now.getFullYear();
    endMonthInput.value   = now.getMonth() + 1;
    endYearInput.value    = now.getFullYear();

    // 4) Toggle single/multi UIs
    function updateUIVisibility() {
      if (multiMonthsCheckbox.checked) {
        singleMonthUI.style.display = 'none';
        multiMonthUI.style.display  = 'block';
      } else {
        singleMonthUI.style.display = 'block';
        multiMonthUI.style.display  = 'none';
      }
    }
    multiMonthsCheckbox.addEventListener('change', updateUIVisibility);
    updateUIVisibility();

    // 5) Prepare combined lookup list
    const allStudents = students.concat(archivedStudents);

    // 6) Single-month review
    function computeSingleMonthReview(m, y) {
      const mm = String(m).padStart(2, '0');
      const key = `${y}-${mm}`;
      const monthlyMap = monthlySchedules[key] || {};

      // build set of IDs: scheduled + active
      const scheduledIds = Object.keys(monthlyMap);
      const activeIds    = students.map(s => s.id);
      const allIdsSet    = new Set(scheduledIds.concat(activeIds));

      // header
      reviewTableHead.innerHTML = `
        <tr>
          <th>Student Name</th>
          <th>Expected Charge</th>
          <th>Actual Charge</th>
          <th>Ratio (%)</th>
        </tr>
      `;
      reviewTableBody.innerHTML = '';
      summaryLine.textContent   = '';

      let totalExp = 0, totalAct = 0;

      allIdsSet.forEach(id => {
        const schedule = monthlyMap[id] || [];
        const student  = allStudents.find(s => s.id === id);
        const name     = student ? student.name : `(Unknown: ${id})`;

        const cntAll    = schedule.length;
        const cntCancel = schedule.filter(i => i.canceled).length;
        const cntVio    = schedule.filter(i => i.violation).length;
        const cntMakeup = schedule.filter(i => i.makeup !== null).length;

        let exp = 0, act = 0, ratio = 0;
        if (student) {
          exp   = student.hourlyRate * student.sessionLength * cntAll
                  + student.additionalChargeModifier;
          act   = student.hourlyRate * student.sessionLength * (cntAll - cntCancel + cntMakeup)
                  + (500 * cntVio)
                  + student.additionalChargeModifier;
          ratio = exp ? (act / exp) * 100 : 0;
        }

        totalExp += exp;
        totalAct += act;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${name}</td>
          <td>${exp.toFixed(2)}</td>
          <td>${act.toFixed(2)}</td>
          <td>${ratio.toFixed(2)}</td>
        `;
        reviewTableBody.appendChild(row);
      });

      const overallRatio = totalExp ? (totalAct / totalExp) * 100 : 0;
      summaryLine.textContent = 
        `Total Expected: ${totalExp.toFixed(2)} | `
        + `Total Actual: ${totalAct.toFixed(2)} | `
        + `Overall Ratio: ${overallRatio.toFixed(2)}%`;
    }

    // 7) Multi-month review
    function computeMultiMonthReview(sM, sY, eM, eY) {
      reviewTableHead.innerHTML = `
        <tr>
          <th>Month</th>
          <th>Expected Charge</th>
          <th>Actual Charge</th>
          <th>Ratio (%)</th>
        </tr>
      `;
      reviewTableBody.innerHTML = '';
      summaryLine.textContent   = '';

      let cy = sY, cm = sM;
      let grandExp = 0, grandAct = 0;

      while (cy < eY || (cy === eY && cm <= eM)) {
        const mm = String(cm).padStart(2, '0');
        const key = `${cy}-${mm}`;
        const monthlyMap = monthlySchedules[key] || {};

        let sumExp = 0, sumAct = 0;
        Object.entries(monthlyMap).forEach(([id, schedule]) => {
          const student = allStudents.find(s => s.id === id);
          if (!student) return;

          const ts = schedule.length;
          const tc = schedule.filter(i => i.canceled).length;
          const tv = schedule.filter(i => i.violation).length;
          const tm = schedule.filter(i => i.makeup !== null).length;

          const exp = student.hourlyRate * student.sessionLength * ts
                    + student.additionalChargeModifier;
          const act = student.hourlyRate * student.sessionLength * (ts - tc + tm)
                    + (500 * tv)
                    + student.additionalChargeModifier;

          sumExp += exp;
          sumAct += act;
        });

        const ratio = sumExp ? (sumAct / sumExp) * 100 : 0;
        grandExp += sumExp;
        grandAct += sumAct;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${key}</td>
          <td>${sumExp.toFixed(2)}</td>
          <td>${sumAct.toFixed(2)}</td>
          <td>${ratio.toFixed(2)}</td>
        `;
        reviewTableBody.appendChild(row);

        cm++;
        if (cm > 12) { cm = 1; cy++; }
      }

      const grandRatio = grandExp ? (grandAct / grandExp) * 100 : 0;
      summaryLine.textContent = 
        `Total Expected: ${grandExp.toFixed(2)} | `
        + `Total Actual: ${grandAct.toFixed(2)} | `
        + `Overall Ratio: ${grandRatio.toFixed(2)}%`;
    }

    // 8) Decide mode + compute
    function generateReview() {
      if (!multiMonthsCheckbox.checked) {
        const m = parseInt(monthInput.value, 10);
        const y = parseInt(yearInput.value,  10);
        if (m && y) computeSingleMonthReview(m, y);
      } else {
        const sM_ = parseInt(startMonthInput.value, 10);
        const sY_ = parseInt(startYearInput.value,  10);
        const eM_ = parseInt(endMonthInput.value,   10);
        const eY_ = parseInt(endYearInput.value,    10);
        if (sM_ && sY_ && eM_ && eY_) computeMultiMonthReview(sM_, sY_, eM_, eY_);
      }
    }

    generateBtn.addEventListener('click', generateReview);
    [ monthInput, yearInput,
      startMonthInput, startYearInput,
      endMonthInput,   endYearInput
    ].forEach(el => el.addEventListener('change', generateReview));

    // initial draw
    generateReview();

    // 9) Save as PNG
    saveBtn.addEventListener('click', () => {
      const origPad = reviewContainer.style.padding;
      reviewContainer.style.padding = '20px';

      html2canvas(reviewContainer).then(canvas => {
        reviewContainer.style.padding = origPad || '';
        let filename = 'teacher_salary_review.png';
        if (!multiMonthsCheckbox.checked) {
          filename = `teacher_salary_review_${
            yearInput.value}_${String(monthInput.value).padStart(2,'0')}.png`;
        } else {
          filename = `teacher_salary_review_${
            startYearInput.value}_${String(startMonthInput.value).padStart(2,'0')
          }_to_${
            endYearInput.value}_${String(endMonthInput.value).padStart(2,'0')
          }.png`;
        }
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL();
        link.click();
      });
    });
  }
};

// expose globally
window.teacherView = teacherView;
