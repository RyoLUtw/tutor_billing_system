// printingBillView.js
const printingBillView = {
    render: function (rootElement, { parents, students, monthlySchedulesByMonth }) {
        const container = document.createElement('div');
        container.innerHTML = `
        <h1>Printing Bill</h1>
        <div>
          <label>Select Parent:</label>
          <select id="parentSelect"></select>
        </div>
        <div>
          <label>Month (1-12):</label>
          <input type="number" id="monthInput" min="1" max="12" />
          <label>Year:</label>
          <input type="number" id="yearInput" />
        </div>
        <div>
          <button id="generateBillBtn">Generate Bill</button>
          <button id="printBtn">Print to PNG</button>
        </div>
        <div id="billContainer"></div>
      `;
        rootElement.appendChild(container);

        const parentSelect = container.querySelector('#parentSelect');
        const monthInput = container.querySelector('#monthInput');
        const yearInput = container.querySelector('#yearInput');
        const generateBillBtn = container.querySelector('#generateBillBtn');
        const printBtn = container.querySelector('#printBtn');
        const billContainer = container.querySelector('#billContainer');

        // Populate parent dropdown
        parents.forEach((p, i) => {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = p.name;
            parentSelect.appendChild(option);
        });
        // generate bill on change of selected parent
        parentSelect.addEventListener('change', () => {
            generateBillBtn.click()
          });

        // Default the month/year to today's date
        const now = new Date();
        monthInput.value = now.getMonth() + 1;
        yearInput.value = now.getFullYear();

        generateBillBtn.addEventListener('click', () => {
            billContainer.innerHTML = '';
            const parentIndex = parentSelect.value;
            if (parentIndex === '') {
                alert('Please select a parent.');
                return;
            }
            const chosenMonth = parseInt(monthInput.value, 10);
            const chosenYear = parseInt(yearInput.value, 10);
            if (!chosenMonth || !chosenYear) {
                alert('Please enter valid month and year.');
                return;
            }

            const parentObj = parents[parentIndex];
            const yearMonth = `${chosenYear}-${String(chosenMonth).padStart(2, '0')}`;

            // Debug logs (optional)
            console.log('>>> Print Bill DEBUG <<<');
            console.log('parents array:', parents);
            console.log('students array:', students);
            console.log('monthlySchedulesByMonth object:', monthlySchedulesByMonth);
            console.log('Selected parent:', parentObj);
            console.log('Chosen yearMonth:', yearMonth);

            let totalAllChildren = 0;
            let foundAnyData = false;

            // Go through each child
            parentObj.children.forEach(childId => {
                console.log('Now checking childId:', childId);
                const student = students.find(s => s.id === childId);
                if (!student) {
                    console.log(`No matching student found for childId=${childId}. Skipping.`);
                    return;
                }
                console.log('Found student:', student);

                // Retrieve the schedules for the chosen month-year
                const schedulesForYearMonth = monthlySchedulesByMonth[yearMonth];
                if (!schedulesForYearMonth) {
                    console.log(`No entry found in monthlySchedulesByMonth for key=${yearMonth}.`);
                    return;
                }
                const schedule = schedulesForYearMonth[student.id];
                if (!schedule) {
                    console.log(`No schedule found for studentId=${student.id} under yearMonth=${yearMonth}.`);
                    return;
                }

                // If we get here, we have data for this child
                foundAnyData = true;
                console.log('Found schedule:', schedule);

                // Build a child's section
                const childDiv = document.createElement('div');
                childDiv.style.border = '1px solid #000';
                childDiv.style.marginBottom = '20px';
                childDiv.innerHTML = `<h2>學生姓名: ${student.name}</h2>`;

                // Table for classes
                const table = document.createElement('table');
                table.border = '1';
                table.style.width = '100%';
                const thead = document.createElement('thead');
                thead.innerHTML = `
            <tr>
              <th>日期</th>
              <th>狀態</th>
              <th>補課</th>
            </tr>
          `;
                table.appendChild(thead);

                const tbody = document.createElement('tbody');

                let canceledCount = 0;
                let makeupCount = 0;

                schedule.forEach(item => {
                    const row = document.createElement('tr');

                    // Date
                    const dateTd = document.createElement('td');
                    dateTd.textContent = item.date;
                    row.appendChild(dateTd);

                    // Status: canceled -> "請假", otherwise -> "正常上課"
                    const statusTd = document.createElement('td');
                    if (item.canceled) {
                        // If violation => "請假(酌收補償金500元)"
                        if (item.violation) {
                            statusTd.textContent = '請假(酌收補償金500元)';
                        } else {
                            statusTd.textContent = '請假';
                        }
                    } else {
                        statusTd.textContent = '正常上課';
                    }

                    row.appendChild(statusTd);

                    // Make-up: if item.makeup -> show date/time, otherwise "無補課"
                    const makeupTd = document.createElement('td');
                    if (item.makeup) {
                        makeupTd.textContent = `${item.makeup.date} ${item.makeup.time}`;
                        makeupCount++;
                    } else {
                        makeupTd.textContent = '無補課';
                    }
                    row.appendChild(makeupTd);

                    tbody.appendChild(row);

                    if (item.canceled) canceledCount++;
                });
                table.appendChild(tbody);

                childDiv.appendChild(table);

                // Compute child’s total (including student’s additionalChargeModifier)
                const scheduledCount = schedule.length;
                const violationCount = schedule.filter(i => i.violation).length;
                const totalCharge =
                    (student.hourlyRate * student.sessionLength * (scheduledCount - canceledCount + makeupCount))
                    + (500 * violationCount)
                    + student.additionalChargeModifier;

                totalAllChildren += totalCharge;

                // Child's summary table
                const summaryTable = document.createElement('table');
                summaryTable.border = '1';
                summaryTable.style.width = '100%';
                summaryTable.innerHTML = `
            <thead>
              <tr><th></th><th>數量/金額</th></tr>
            </thead>
            <tbody>
              <tr><td>正常上課次數</td><td>${scheduledCount}</td></tr>
              <tr><td>請假次數</td><td>${canceledCount}</td></tr>
              <tr><td>補課次數</td><td>${makeupCount}</td></tr>
              <!-- REMOVED the row for "學生加減額" -->
              <tr><td>費用小計</td><td>${totalCharge}</td></tr>
            </tbody>
          `;
                childDiv.appendChild(summaryTable);

                billContainer.appendChild(childDiv);
            }); // end forEach child

            if (!foundAnyData) {
                alert(`No data found for parent "${parentObj.name}" in ${yearMonth}.`);
                return;
            }

            // 1) Add parent's billModifierValue to totalAllChildren
            totalAllChildren += parentObj.billModifierValue || 0;

            // 2) Show "其他費用調整項目" if there's a parent modifier name
            const parentModDiv = document.createElement('div');
            parentModDiv.style.marginBottom = '10px'; // some spacing
            parentModDiv.innerHTML = `
          <strong>其他費用調整項目:</strong><br/>
          ${parentObj.billModifierName || ''} ${parentObj.billModifierValue || 0}
        `;
            billContainer.appendChild(parentModDiv);

            // 3) Final total for all children (including parent’s modifier)
            const h1 = document.createElement('h1');
            h1.textContent = `總費用: ${totalAllChildren}`;
            billContainer.appendChild(h1);
        });



        // 4-4) Print to PNG with margin
        printBtn.addEventListener('click', () => {
            // 4-1) Gather chosen month/year
            const chosenMonth = parseInt(monthInput.value, 10);
            const chosenYear = parseInt(yearInput.value, 10);
            // zero-pad month: e.g. "06" for June
            const mm = String(chosenMonth).padStart(2, '0');
            const yearMonth = `${chosenYear}_${mm}`;

            // 4-2) Grab the parent's name from the dropdown
            const parentIndex = parentSelect.value;
            const parentObj = parents[parentIndex];
            // Spaces or special chars can break filenames,
            // so you might replace them or just keep them
            const safeParentName = parentObj.name.replace(/\s+/g, '');

            // 4-3) Construct the file name
            const fileName = `${yearMonth}_bill_${safeParentName}.png`;
            const originalPadding = billContainer.style.padding;
            billContainer.style.padding = '20px';

            html2canvas(billContainer).then(canvas => {
                billContainer.style.padding = originalPadding || '';
                const link = document.createElement('a');
                link.download = fileName;
                link.href = canvas.toDataURL('image/png');
                link.click();
            });
        });

        // Auto-select first parent if none chosen
        if (parentSelect.value === '' && parents.length > 0) {
            parentSelect.value = '0';
        }
    }
};
