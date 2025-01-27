// views/teacherView.js
const teacherView = {
  render: function (rootElement, { students, monthlySchedules, salaryReviews }) {
    // 1) Create container with Month/Year, a "Generate" button, and the results table
    const container = document.createElement('div');
    container.innerHTML = `
      <h1>Teacher's Salary Review</h1>

      <div>
        <label>Month (1-12):</label>
        <input type="number" id="monthInput" min="1" max="12" />
        <label>Year:</label>
        <input type="number" id="yearInput" />
        <button id="generateBtn">Generate Review</button>
      </div>

      <table id="reviewTable" border="1" style="margin-top: 20px;">
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Expected Charge</th>
            <th>Actual Charge</th>
            <th>Ratio (%)</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      
      <h3>Total Expected: <span id="totalExpectedDisplay">0</span></h3>
      <h3>Total Actual: <span id="totalActualDisplay">0</span></h3>
      <h3>Overall Ratio: <span id="overallRatioDisplay">0</span>%</h3>
      
      <button id="saveSalaryReviewBtn">Save Salary Review</button>
    `;
    rootElement.appendChild(container);

    // 2) Grab references
    const monthInput = container.querySelector('#monthInput');
    const yearInput = container.querySelector('#yearInput');
    const generateBtn = container.querySelector('#generateBtn');

    const reviewTableBody = container.querySelector('#reviewTable tbody');
    const totalExpectedDisplay = container.querySelector('#totalExpectedDisplay');
    const totalActualDisplay = container.querySelector('#totalActualDisplay');
    const overallRatioDisplay = container.querySelector('#overallRatioDisplay');
    const saveSalaryReviewBtn = container.querySelector('#saveSalaryReviewBtn');

    // 3) Default the month/year to today's date
    const now = new Date();
    monthInput.value = now.getMonth() + 1;
    yearInput.value = now.getFullYear();

    // 4) We'll define a function to compute the review for the chosen month/year
    function computeSalaryReview() {
      // Clear old results
      reviewTableBody.innerHTML = '';
      totalExpectedDisplay.textContent = '0';
      totalActualDisplay.textContent = '0';
      overallRatioDisplay.textContent = '0';

      // Parse the chosen month/year
      const chosenMonth = parseInt(monthInput.value, 10);
      const chosenYear = parseInt(yearInput.value, 10);
      if (!chosenMonth || !chosenYear) {
        // If invalid inputs
        return;
      }

      // Build the "YYYY-MM" key
      const mm = String(chosenMonth).padStart(2, '0');
      const yearMonth = `${chosenYear}-${mm}`;

      // If that key doesn't exist in monthlySchedules, we can just show empty results
      const monthlyMap = monthlySchedules[yearMonth] || {};

      let totalExpectedAll = 0;
      let totalActualAll = 0;

      // 5) For each student, gather schedule data from monthlyMap[student.id]
      students.forEach(student => {
        const schedule = monthlyMap[student.id];
        if (!schedule) {
          // This student has no classes in that month; so expected/actual = just the "additionalChargeModifier" if you prefer
          // or 0. We'll do 0 plus the modifier in expected to be consistent with the usual formula.
          // But let's do a typical approach: if there's no schedule, everything is zero
          const expected = 0; 
          const actual = 0;
          const ratio = 0;

          // build row
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${student.name}</td>
            <td>${expected.toFixed(2)}</td>
            <td>${actual.toFixed(2)}</td>
            <td>${ratio.toFixed(2)}</td>
          `;
          reviewTableBody.appendChild(row);
          return;
        }

        // If there's a schedule, let's compute:
        // totalScheduled, totalCanceled, totalViolation, totalMakeup
        const totalScheduled = schedule.length;
        const totalCanceled = schedule.filter(i => i.canceled).length;
        const totalViolation = schedule.filter(i => i.violation).length;
        const totalMakeup = schedule.filter(i => i.makeup !== null).length;

        // Expected
        // Usually: (hourlyRate * sessionLength * totalScheduled) + additionalChargeModifier
        const expected = (student.hourlyRate * student.sessionLength * totalScheduled)
                        + student.additionalChargeModifier;

        // Actual
        // (hourlyRate * sessionLength * (totalScheduled - totalCanceled + totalMakeup))
        // + (500 * totalViolation)
        // + student.additionalChargeModifier
        const actual = 
          (student.hourlyRate * student.sessionLength * (totalScheduled - totalCanceled + totalMakeup))
          + (500 * totalViolation)
          + student.additionalChargeModifier;

        const ratio = expected !== 0 ? (actual / expected) * 100 : 0;

        // Accumulate
        totalExpectedAll += expected;
        totalActualAll += actual;

        // Build a row
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${student.name}</td>
          <td>${expected.toFixed(2)}</td>
          <td>${actual.toFixed(2)}</td>
          <td>${ratio.toFixed(2)}</td>
        `;
        reviewTableBody.appendChild(row);
      }); // end forEach student

      // 6) Fill the totals
      totalExpectedDisplay.textContent = totalExpectedAll.toFixed(2);
      totalActualDisplay.textContent = totalActualAll.toFixed(2);
      const overallRatio = (totalExpectedAll !== 0)
        ? (totalActualAll / totalExpectedAll) * 100
        : 0;
      overallRatioDisplay.textContent = overallRatio.toFixed(2);
    }

    // 7) The "Generate" button calls computeSalaryReview
    generateBtn.addEventListener('click', computeSalaryReview);

    // 8) Auto-update on change of month/year
    monthInput.addEventListener('change', computeSalaryReview);
    yearInput.addEventListener('change', computeSalaryReview);

    // 9) After we build everything, let's do an initial compute
    computeSalaryReview();

    // 10) Save Salary Review as JSON
    saveSalaryReviewBtn.addEventListener('click', () => {
      // We'll use the final numbers from the displays
      const expected = parseFloat(totalExpectedDisplay.textContent) || 0;
      const actual = parseFloat(totalActualDisplay.textContent) || 0;
      const ratio = parseFloat(overallRatioDisplay.textContent) || 0;

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      
      const reviewData = {
        date: `${year}-${month}-01`,
        totalExpected: expected.toFixed(2),
        totalActual: actual.toFixed(2),
        overallRatio: ratio.toFixed(2)
      };

      // e.g., salaryReviews.push(reviewData);

      const dataStr = JSON.stringify(reviewData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `salary_review_${year}_${month}.json`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }
};
