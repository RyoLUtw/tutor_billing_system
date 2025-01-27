// views/teacherView.js
const teacherView = {
  render: function (rootElement, { students, monthlySchedules }) {
    /**
     * 1) Create container with:
     *    - Single-month UI: monthInput / yearInput
     *    - Multi-month UI: startMonthInput / startYearInput / endMonthInput / endYearInput
     *    - A checkbox to switch between them
     *    - A "Generate" button
     *    - The results table
     *    - The "Save Salary Review" button
     */
    const container = document.createElement('div');
    container.innerHTML = `
      <h1>Teacher's Salary Review</h1>

      <div>
        <label>
          <input type="checkbox" id="multiMonthsCheckbox" />
          Check multiple months
        </label>
      </div>

      <!-- Single-month UI -->
      <div id="singleMonthUI">
        <label>Month (1-12):</label>
        <input type="number" id="monthInput" min="1" max="12" />
        <label>Year:</label>
        <input type="number" id="yearInput" />
      </div>

      <!-- Multi-month UI (hidden by default) -->
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

      <div id="reviewContainer" style="margin-top: 20px;">
        <table id="reviewTable" border="1">
          <thead>
            <tr>
              <!-- These headers will vary depending on single or multi mode -->
            </tr>
          </thead>
          <tbody></tbody>
        </table>

        <!-- Display total or ratio if needed -->
        <h3 id="summaryLine"></h3>
      </div>

      <button id="saveSalaryReviewBtn">Save Salary Review (PNG)</button>
    `;
    rootElement.appendChild(container);

    // 2) Grab references
    const multiMonthsCheckbox = container.querySelector('#multiMonthsCheckbox');

    const singleMonthUI = container.querySelector('#singleMonthUI');
    const monthInput = container.querySelector('#monthInput');
    const yearInput = container.querySelector('#yearInput');

    const multiMonthUI = container.querySelector('#multiMonthUI');
    const startMonthInput = container.querySelector('#startMonthInput');
    const startYearInput = container.querySelector('#startYearInput');
    const endMonthInput = container.querySelector('#endMonthInput');
    const endYearInput = container.querySelector('#endYearInput');

    const generateBtn = container.querySelector('#generateBtn');

    const reviewContainer = container.querySelector('#reviewContainer');
    const reviewTable = container.querySelector('#reviewTable');
    const reviewTableHead = reviewTable.querySelector('thead');
    const reviewTableBody = reviewTable.querySelector('tbody');

    const summaryLine = container.querySelector('#summaryLine');
    const saveSalaryReviewBtn = container.querySelector('#saveSalaryReviewBtn');

    // 3) Default single month/year to today's date
    const now = new Date();
    monthInput.value = now.getMonth() + 1;
    yearInput.value = now.getFullYear();

    // Also default multi-month start/end
    startMonthInput.value = now.getMonth() + 1;
    startYearInput.value = now.getFullYear();
    endMonthInput.value = now.getMonth() + 1;
    endYearInput.value = now.getFullYear();

    // 4) Toggle UI for single or multi
    function updateUIVisibility() {
      if (multiMonthsCheckbox.checked) {
        singleMonthUI.style.display = 'none';
        multiMonthUI.style.display = 'block';
      } else {
        singleMonthUI.style.display = 'block';
        multiMonthUI.style.display = 'none';
      }
    }
    multiMonthsCheckbox.addEventListener('change', updateUIVisibility);
    updateUIVisibility(); // run on load

    // 5) Helper: compute single-month table (one row per student)
    function computeSingleMonthReview(chosenMonth, chosenYear) {
      const mm = String(chosenMonth).padStart(2, '0');
      const yearMonth = `${chosenYear}-${mm}`;
      const monthlyMap = monthlySchedules[yearMonth] || {};

      // Table head (single-month mode)
      reviewTableHead.innerHTML = `
        <tr>
          <th>Student Name</th>
          <th>Expected Charge</th>
          <th>Actual Charge</th>
          <th>Ratio (%)</th>
        </tr>
      `;
      reviewTableBody.innerHTML = '';
      summaryLine.textContent = '';

      let totalExpectedAll = 0;
      let totalActualAll = 0;

      students.forEach(student => {
        const schedule = monthlyMap[student.id];
        if (!schedule) {
          // No schedule => 0
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${student.name}</td>
            <td>0.00</td>
            <td>0.00</td>
            <td>0.00</td>
          `;
          reviewTableBody.appendChild(row);
          return;
        }

        // compute
        const totalScheduled = schedule.length;
        const totalCanceled = schedule.filter(i => i.canceled).length;
        const totalViolation = schedule.filter(i => i.violation).length;
        const totalMakeup = schedule.filter(i => i.makeup !== null).length;

        const expected = (student.hourlyRate * student.sessionLength * totalScheduled)
                         + student.additionalChargeModifier;

        const actual = (student.hourlyRate * student.sessionLength * (totalScheduled - totalCanceled + totalMakeup))
                       + (500 * totalViolation)
                       + student.additionalChargeModifier;

        const ratio = (expected !== 0) ? (actual / expected) * 100 : 0;

        totalExpectedAll += expected;
        totalActualAll += actual;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${student.name}</td>
          <td>${expected.toFixed(2)}</td>
          <td>${actual.toFixed(2)}</td>
          <td>${ratio.toFixed(2)}</td>
        `;
        reviewTableBody.appendChild(row);
      });

      const overallRatio = (totalExpectedAll !== 0)
        ? (totalActualAll / totalExpectedAll) * 100
        : 0;

      summaryLine.textContent =
        `Total Expected: ${totalExpectedAll.toFixed(2)} | `
        + `Total Actual: ${totalActualAll.toFixed(2)} | `
        + `Overall Ratio: ${overallRatio.toFixed(2)}%`;
    }

    // 6) Helper: compute multi-month table (one row per month).
    //    Each row sums all students for that month
    function computeMultiMonthReview(startMonth, startYear, endMonth, endYear) {
      // Table head (multi-month mode)
      reviewTableHead.innerHTML = `
        <tr>
          <th>Month</th>
          <th>Expected Charge</th>
          <th>Actual Charge</th>
          <th>Ratio (%)</th>
        </tr>
      `;
      reviewTableBody.innerHTML = '';
      summaryLine.textContent = '';

      // We'll loop from (startYear, startMonth) up to (endYear, endMonth)
      let currentY = startYear;
      let currentM = startMonth;

      let totalExpectedAll = 0;
      let totalActualAll = 0;
      // We'll store each month row, so we do something like:
      while ((currentY < endYear) || (currentY === endYear && currentM <= endMonth)) {
        const mm = String(currentM).padStart(2, '0');
        const yearMonth = `${currentY}-${mm}`;

        // Sum across all students
        let sumExpected = 0;
        let sumActual = 0;
        // gather schedules for that yearMonth
        const monthlyMap = monthlySchedules[yearMonth] || {};

        students.forEach(student => {
          const schedule = monthlyMap[student.id];
          if (!schedule) return; // no classes for that student in that month

          const totalScheduled = schedule.length;
          const totalCanceled = schedule.filter(i => i.canceled).length;
          const totalViolation = schedule.filter(i => i.violation).length;
          const totalMakeup = schedule.filter(i => i.makeup !== null).length;

          const expected = (student.hourlyRate * student.sessionLength * totalScheduled)
                           + student.additionalChargeModifier;

          const actual = (student.hourlyRate * student.sessionLength * (totalScheduled - totalCanceled + totalMakeup))
                         + (500 * totalViolation)
                         + student.additionalChargeModifier;

          sumExpected += expected;
          sumActual += actual;
        });

        const ratio = (sumExpected !== 0) ? (sumActual / sumExpected) * 100 : 0;
        totalExpectedAll += sumExpected;
        totalActualAll += sumActual;

        // Build a row for that month
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${yearMonth}</td>
          <td>${sumExpected.toFixed(2)}</td>
          <td>${sumActual.toFixed(2)}</td>
          <td>${ratio.toFixed(2)}</td>
        `;
        reviewTableBody.appendChild(row);

        // increment month
        currentM++;
        if (currentM > 12) {
          currentM = 1;
          currentY++;
        }
      }

      // After looping through all months, show a summary line
      const grandRatio = (totalExpectedAll !== 0)
        ? (totalActualAll / totalExpectedAll) * 100
        : 0;

      summaryLine.textContent =
        `Total Expected: ${totalExpectedAll.toFixed(2)} | `
        + `Total Actual: ${totalActualAll.toFixed(2)} | `
        + `Overall Ratio: ${grandRatio.toFixed(2)}%`;
    }

    // 7) Decide which mode (single or multi) and compute
    function generateReview() {
      if (!multiMonthsCheckbox.checked) {
        // single-month
        const chosenMonth = parseInt(monthInput.value, 10);
        const chosenYear = parseInt(yearInput.value, 10);
        if (!chosenMonth || !chosenYear) return; // skip if invalid
        computeSingleMonthReview(chosenMonth, chosenYear);
      } else {
        // multi-month
        const sMonth = parseInt(startMonthInput.value, 10);
        const sYear = parseInt(startYearInput.value, 10);
        const eMonth = parseInt(endMonthInput.value, 10);
        const eYear = parseInt(endYearInput.value, 10);
        if (!sMonth || !sYear || !eMonth || !eYear) return;
        // Could add logic to ensure (start <= end)
        computeMultiMonthReview(sMonth, sYear, eMonth, eYear);
      }
    }

    // 8) The Generate button calls generateReview
    generateBtn.addEventListener('click', generateReview);

    // 9) Auto update on any change for single-month or multi-month fields
    monthInput.addEventListener('change', generateReview);
    yearInput.addEventListener('change', generateReview);
    startMonthInput.addEventListener('change', generateReview);
    startYearInput.addEventListener('change', generateReview);
    endMonthInput.addEventListener('change', generateReview);
    endYearInput.addEventListener('change', generateReview);

    // 10) do initial compute
    generateReview();

    // 11) Save as PNG (html2canvas)
    saveSalaryReviewBtn.addEventListener('click', () => {
      // We'll add padding to create a margin
      const originalPadding = reviewContainer.style.padding;
      reviewContainer.style.padding = '20px';

      html2canvas(reviewContainer).then(canvas => {
        reviewContainer.style.padding = originalPadding || '';

        // Build a file name
        let fileName = 'teacher_salary_review.png';
        // Optionally if single or multi
        if (!multiMonthsCheckbox.checked) {
          const m = String(monthInput.value).padStart(2,'0');
          const y = yearInput.value;
          fileName = `teacher_salary_review_${y}_${m}.png`;
        } else {
          const sm = String(startMonthInput.value).padStart(2,'0');
          const sy = startYearInput.value;
          const em = String(endMonthInput.value).padStart(2,'0');
          const ey = endYearInput.value;
          fileName = `teacher_salary_review_${sy}_${sm}_to_${ey}_${em}.png`;
        }

        // Download the image
        const link = document.createElement('a');
        link.download = fileName;
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    });
  }
};
