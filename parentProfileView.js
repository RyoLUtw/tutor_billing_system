// parentProfileView.js
const parentProfileView = {
  render: function (rootElement, { parents, students, archivedStudents = [], onParentDataUpdate }) {
    let selectedIndex = null;

    const container = document.createElement('div');
    container.innerHTML = `
      <h1>Parent Profile</h1>

      <!-- Form to Add/Update Parent -->
      <div>
        <label>Parent Name:</label>
        <input type="text" id="parentNameInput" />
      </div>
      <div>
        <label>Check the children (students):</label>
        <div id="studentCheckboxes"></div>
      </div>
      <div>
        <label>Bill Modifier Name:</label>
        <input type="text" id="billModifierNameInput" />
      </div>
      <div>
        <label>Bill Modifier Value (+/-):</label>
        <input type="number" id="billModifierValueInput" />
      </div>
      <button id="saveParentBtn">Save New Parent</button>
      <button id="updateParentBtn">Update Parent</button>

      <h2>Current Parents</h2>
      <table id="parentsTable" border="1">
        <thead>
          <tr>
            <th>Parent Name</th>
            <th>Modifier Name</th>
            <th>Modifier Value</th>
            <th>Children</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>

      <hr/>

      <!-- NEW: Backup / Restore Buttons for Parents -->
      <div>
        <button id="downloadJsonBtn">Download Parents as JSON</button>
        <input type="file" id="uploadJsonInput" accept=".json" style="display:none" />
        <button id="uploadJsonBtn">Upload JSON</button>
      </div>
    `;
    rootElement.appendChild(container);

    // Form elements
    const parentNameInput = container.querySelector('#parentNameInput');
    const studentCheckboxesContainer = container.querySelector('#studentCheckboxes');
    const billModifierNameInput = container.querySelector('#billModifierNameInput');
    const billModifierValueInput = container.querySelector('#billModifierValueInput');
    const saveParentBtn = container.querySelector('#saveParentBtn');
    const updateParentBtn = container.querySelector('#updateParentBtn');

    // Parent table
    const parentsTableBody = container.querySelector('#parentsTable tbody');

    // NEW: Backup / Restore
    const downloadJsonBtn = container.querySelector('#downloadJsonBtn');
    const uploadJsonBtn = container.querySelector('#uploadJsonBtn');
    const uploadJsonInput = container.querySelector('#uploadJsonInput');

    // In-memory list of checkboxes for students
    const studentCheckboxes = [];

// 0) Build a combined list once
const allStudents = students.concat(archivedStudents);

    // 1) Render student checkboxes
function renderStudentCheckboxes() {
  studentCheckboxesContainer.innerHTML = '';
  studentCheckboxes.length = 0;
  allStudents.forEach(student => {
    const wrapper = document.createElement('div');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = student.id;
    const label = document.createElement('label');
    // Append " (inactive)" if this student came from the archive
    const isInactive = archivedStudents.some(a => a.id === student.id);
    label.textContent = student.name + (isInactive ? ' (inactive)' : '');
    wrapper.append(cb, label);
    studentCheckboxesContainer.appendChild(wrapper);
    studentCheckboxes.push(cb);
  });
}
renderStudentCheckboxes();

    // 2) Functions to refresh the parents table
    function refreshParentsTable() {
      parentsTableBody.innerHTML = '';
      parents.forEach((p, index) => {
        const row = document.createElement('tr');

        // Parent Name
        const nameCell = document.createElement('td');
        nameCell.textContent = p.name;
        row.appendChild(nameCell);

        // Modifier Name
        const modNameCell = document.createElement('td');
        modNameCell.textContent = p.billModifierName || '';
        row.appendChild(modNameCell);

        // Modifier Value
        const modValueCell = document.createElement('td');
        modValueCell.textContent = p.billModifierValue || 0;
        row.appendChild(modValueCell);

        // Children
        const childrenCell = document.createElement('td');
    const childNames = p.children.map(childId => {
      const s = allStudents.find(stu => stu.id === childId);
      if (!s) return `Unknown(${childId})`;
      const inactive = archivedStudents.some(a => a.id === s.id);
      return s.name + (inactive ? ' (inactive)' : '');
    });
    childrenCell.textContent = childNames.join(', ');
    row.appendChild(childrenCell);

        // Actions
        const actionCell = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editParent(index));

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteParent(index));

        actionCell.appendChild(editBtn);
        actionCell.appendChild(document.createTextNode(' '));
        actionCell.appendChild(deleteBtn);
        row.appendChild(actionCell);

        parentsTableBody.appendChild(row);
      });
    }

    function editParent(index) {
      selectedIndex = index;
      const p = parents[index];
      parentNameInput.value = p.name;
      billModifierNameInput.value = p.billModifierName || '';
      billModifierValueInput.value = p.billModifierValue || 0;

      // Uncheck all first
      studentCheckboxes.forEach(cb => (cb.checked = false));
      // Check relevant children
      p.children.forEach(childId => {
        const matchingCb = studentCheckboxes.find(cb => cb.value === childId);
        if (matchingCb) matchingCb.checked = true;
      });
    }

    function deleteParent(index) {
      const p = parents[index];
      if (!confirm(`Delete parent "${p.name}"?`)) return;
      parents.splice(index, 1);
      refreshParentsTable();
      onParentDataUpdate(parents);
    }

    function getSelectedChildren() {
      return studentCheckboxes
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    }

    function clearForm() {
      selectedIndex = null;
      parentNameInput.value = '';
      studentCheckboxes.forEach(cb => (cb.checked = false));
      billModifierNameInput.value = '';
      billModifierValueInput.value = '';
    }

    // 3) Event Listeners for Save/Update
    saveParentBtn.addEventListener('click', () => {
      const newParent = {
        id: `parent_${Date.now()}`,
        name: parentNameInput.value,
        children: getSelectedChildren(),
        billModifierName: billModifierNameInput.value,
        billModifierValue: parseFloat(billModifierValueInput.value) || 0
      };
      parents.push(newParent);
      refreshParentsTable();
      onParentDataUpdate(parents);
      clearForm();
    });

    updateParentBtn.addEventListener('click', () => {
      if (selectedIndex === null) {
        alert('No parent selected. Click "Edit" to select a parent.');
        return;
      }
      const p = parents[selectedIndex];
      p.name = parentNameInput.value;
      p.children = getSelectedChildren();
      p.billModifierName = billModifierNameInput.value;
      p.billModifierValue = parseFloat(billModifierValueInput.value) || 0;

      refreshParentsTable();
      onParentDataUpdate(parents);
      clearForm();
    });

    // 4) NEW: Backup / Restore
    downloadJsonBtn.addEventListener('click', () => {
      // Convert parents array to JSON string
      const dataStr = JSON.stringify(parents, null, 2);
      // Create a blob
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create a temp link to trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = 'parents_backup.json';
      link.click();
      URL.revokeObjectURL(url);
    });

    uploadJsonBtn.addEventListener('click', () => {
      uploadJsonInput.click();
    });

    uploadJsonInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (Array.isArray(imported)) {
            // Overwrite the global parents array or merge
            // For simplicity, let's overwrite:
            parents.splice(0, parents.length, ...imported);

            refreshParentsTable();
            onParentDataUpdate(parents);
            alert('Parents imported successfully.');
          } else {
            alert('Invalid JSON format: expected an array of parent objects.');
          }
        } catch (err) {
          alert(`Error parsing JSON: ${err}`);
        }
      };
      reader.readAsText(file);
    });

    // 5) Initialize
    refreshParentsTable();
  }
};
