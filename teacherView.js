// views/teacherView.js
const teacherView = {
  render: function (rootElement, { students, monthlySchedules, salaryReviews }) {
    const container = document.createElement('div');
    container.innerHTML = `
      <h1>Teacher's Salary Review</h1>
      <table id="reviewTable" border="1">
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

    const reviewTableBody = container.querySelector('#reviewTable tbody');
    const totalExpectedDisplay = container.querySelector('#totalExpectedDisplay');
    const totalActualDisplay = container.querySelector('#totalActualDisplay');
    const overallRatioDisplay = container.querySelector('#overallRatioDisplay');
    const saveSalaryReviewBtn = container.querySelector('#saveSalaryReviewBtn');

    // For demonstration, let’s compute “expected” vs. “actual” on the fly.
    // Actual logic depends on how you store monthlySchedules or final charges.
    let totalExpected = 0;
    let totalActual = 0;

    students.forEach(student => {
      // Hypothetical approach:
      //  - Expected = hourlyRate * sessionLength * totalPossibleClasses + additionalChargeModifier
      //  - Actual = you must incorporate cancellations and violation fees from monthlySchedules
      // For a quick demo, let’s just do a random example:
      const randomScheduledCount = 8;  // e.g., 8 possible classes
      const randomCanceledCount = 2;   // e.g., 2 canceled
      const randomViolations = 1;      // e.g., 1 violation
      
      const expectedCharge = (student.hourlyRate * student.sessionLength * randomScheduledCount) 
                             + student.additionalChargeModifier;
      const actualCharge = (student.hourlyRate * student.sessionLength * (randomScheduledCount - randomCanceledCount)) 
                           + 500 * randomViolations 
                           + student.additionalChargeModifier;

      const ratio = expectedCharge ? (actualCharge / expectedCharge) * 100 : 0;
      
      totalExpected += expectedCharge;
      totalActual += actualCharge;

      // Build table row
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${student.name}</td>
        <td>${expectedCharge.toFixed(2)}</td>
        <td>${actualCharge.toFixed(2)}</td>
        <td>${ratio.toFixed(2)}</td>
      `;
      reviewTableBody.appendChild(row);
    });

    totalExpectedDisplay.textContent = totalExpected.toFixed(2);
    totalActualDisplay.textContent = totalActual.toFixed(2);
    overallRatioDisplay.textContent = totalExpected
      ? ((totalActual / totalExpected) * 100).toFixed(2)
      : '0';

    // Save Salary Review as JSON
    saveSalaryReviewBtn.addEventListener('click', () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const reviewData = {
        date: `${year}-${month}-01`,
        totalExpected,
        totalActual,
        overallRatio: overallRatioDisplay.textContent
        // you can also store each student's charges if you want
      };

      // For a real app, you might store in `salaryReviews` array
      // salaryReviews.push(reviewData);

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
