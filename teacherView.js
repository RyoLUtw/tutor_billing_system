// views/teacherView.js
const teacherView = {
  render: function (rootElement, { students, monthlySchedules, salaryReviews }) {
    // 1) Create the container
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

    // 2) Grab references
    const reviewTableBody = container.querySelector('#reviewTable tbody');
    const totalExpectedDisplay = container.querySelector('#totalExpectedDisplay');
    const totalActualDisplay = container.querySelector('#totalActualDisplay');
    const overallRatioDisplay = container.querySelector('#overallRatioDisplay');
    const saveSalaryReviewBtn = container.querySelector('#saveSalaryReviewBtn');

    // 3) We'll accumulate data for each student (scheduled, canceled, violation, etc.)
    // Then compute expected vs. actual
    let totalExpectedAll = 0;
    let totalActualAll = 0;

    // For each student, gather schedule data across all months in monthlySchedules
    students.forEach(student => {
      // We'll accumulate across all months
      let totalScheduled = 0;   // total # of classes (length of schedule array)
      let totalCanceled = 0;    // how many are canceled
      let totalViolation = 0;   // how many have violation == true
      let totalMakeup = 0;      // how many have a non-null "makeup"

      // 4) Loop through every "YYYY-MM" in monthlySchedules
      for (const yearMonth in monthlySchedules) {
        const studentMap = monthlySchedules[yearMonth];
        // If this student has a schedule for that month:
        if (studentMap[student.id]) {
          const schedule = studentMap[student.id];
          totalScheduled += schedule.length;
          // canceled
          totalCanceled += schedule.filter(i => i.canceled).length;
          // violation
          totalViolation += schedule.filter(i => i.violation).length;
          // makeup
          totalMakeup += schedule.filter(i => i.makeup !== null).length;
        }
      }

      // 5) Now compute expected vs. actual
      // Expected = (hourlyRate * sessionLength * totalScheduled) + additionalChargeModifier
      const expected = (student.hourlyRate * student.sessionLength * totalScheduled)
                       + student.additionalChargeModifier;

      // Actual = (hourlyRate * sessionLength * (totalScheduled - totalCanceled + totalMakeup))
      //        + (500 * totalViolation)
      //        + additionalChargeModifier
      const actual = (student.hourlyRate * student.sessionLength * (totalScheduled - totalCanceled + totalMakeup))
                     + (500 * totalViolation)
                     + student.additionalChargeModifier;

      // Ratio
      const ratio = (expected !== 0) ? (actual / expected) * 100 : 0;

      // 6) Accumulate totals
      totalExpectedAll += expected;
      totalActualAll += actual;

      // 7) Build a row
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${student.name}</td>
        <td>${expected.toFixed(2)}</td>
        <td>${actual.toFixed(2)}</td>
        <td>${ratio.toFixed(2)}</td>
      `;
      reviewTableBody.appendChild(row);
    });

    // 8) Fill in total/overall
    totalExpectedDisplay.textContent = totalExpectedAll.toFixed(2);
    totalActualDisplay.textContent = totalActualAll.toFixed(2);
    const overallRatio = (totalExpectedAll !== 0)
      ? (totalActualAll / totalExpectedAll) * 100
      : 0;
    overallRatioDisplay.textContent = overallRatio.toFixed(2);

    // 9) Save Salary Review as JSON
    saveSalaryReviewBtn.addEventListener('click', () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      
      // You could store each student's detail too, but let's keep it simple
      const reviewData = {
        date: `${year}-${month}-01`,
        totalExpected: totalExpectedAll.toFixed(2),
        totalActual: totalActualAll.toFixed(2),
        overallRatio: overallRatio.toFixed(2)
        // you can also push each student's breakdown if you want
      };

      // If you want to store in salaryReviews array:
      // salaryReviews.push(reviewData);

      // Then let the user download
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
