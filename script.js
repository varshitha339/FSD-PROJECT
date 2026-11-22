"use strict";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
const STORAGE_KEY = "classclockwork-schedule-v1";
const SEARCH_LIMIT = 90000;

function createSampleData() {
  const faculty = [
    { id: "fac-1", name: "Dr. Maya Rao", maxHours: 9, availableDays: [0, 1, 2, 3, 4] },
    { id: "fac-2", name: "Prof. Arjun Mehta", maxHours: 9, availableDays: [0, 1, 2, 3] },
    { id: "fac-3", name: "Dr. Nina Shah", maxHours: 9, availableDays: [1, 2, 3, 4] },
    { id: "fac-4", name: "Prof. Dev Patel", maxHours: 9, availableDays: [0, 2, 4] },
    { id: "fac-5", name: "Dr. Leena Iyer", maxHours: 9, availableDays: [0, 1, 3, 4] },
    { id: "fac-6", name: "Prof. Kiran Bose", maxHours: 9, availableDays: [0, 1, 2, 4] },
    { id: "fac-7", name: "Dr. Omar Khan", maxHours: 9, availableDays: [0, 1, 2, 3, 4] },
    { id: "fac-8", name: "Prof. Sara Das", maxHours: 9, availableDays: [0, 2, 3, 4] },
    { id: "fac-9", name: "Dr. Ethan Roy", maxHours: 10, availableDays: [0, 1, 2, 3, 4] },
    { id: "fac-10", name: "Prof. Asha Menon", maxHours: 10, availableDays: [0, 1, 2, 3, 4] }
  ];
  const rooms = [
    { id: "room-1", name: "Room 101", capacity: 72, equipment: ["projector"] },
    { id: "room-2", name: "Room 102", capacity: 64, equipment: ["projector", "whiteboard"] },
    { id: "room-3", name: "Room 103", capacity: 54, equipment: ["whiteboard"] },
    { id: "room-4", name: "Lecture Hall", capacity: 110, equipment: ["projector", "microphone"] },
    { id: "room-5", name: "Computer Lab", capacity: 70, equipment: ["computers", "projector"] },
    { id: "room-6", name: "Network Lab", capacity: 60, equipment: ["computers", "networking kit"] }
  ];
  const subjects = [
    { id: "sub-1", name: "Operating Systems Lab", batch: "CSE-B", students: 48, facultyId: "fac-1", hours: 3, kind: "lab", equipment: ["computers"] },
    { id: "sub-2", name: "Programming Foundations", batch: "CSE-A", students: 60, facultyId: "fac-2", hours: 3, kind: "lecture", equipment: [] },
    { id: "sub-3", name: "Data Structures", batch: "CSE-A", students: 60, facultyId: "fac-3", hours: 3, kind: "lecture", equipment: [] },
    { id: "sub-4", name: "Discrete Mathematics", batch: "CSE-A", students: 60, facultyId: "fac-4", hours: 3, kind: "lecture", equipment: [] },
    { id: "sub-5", name: "Computer Networks", batch: "CSE-B", students: 48, facultyId: "fac-5", hours: 3, kind: "lecture", equipment: [] },
    { id: "sub-6", name: "Database Systems", batch: "CSE-C", students: 42, facultyId: "fac-6", hours: 3, kind: "lecture", equipment: [] },
    { id: "sub-7", name: "AI Fundamentals", batch: "CSE-C", students: 42, facultyId: "fac-7", hours: 3, kind: "lecture", equipment: [] },
    { id: "sub-8", name: "Software Engineering", batch: "CSE-C", students: 42, facultyId: "fac-8", hours: 3, kind: "lecture", equipment: [] }
  ];
  return { faculty, rooms, subjects, allocations: [], generated: false, viewType: "batch", selectedFilter: "CSE-A" };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createSampleData();
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.faculty) || !Array.isArray(parsed.rooms) ||
        !Array.isArray(parsed.subjects) || !Array.isArray(parsed.allocations)) {
      throw new Error("Saved timetable data is incomplete.");
    }
    return { ...createSampleData(), ...parsed };
  } catch (error) {
    console.warn("Could not load saved timetable data; using the sample schedule.", error);
    return createSampleData();
  }
}

let state = loadState();
let nextId = Date.now();
let toastTimer;
let draggedAllocationId = null;

const elements = {
  timeHeader: document.getElementById("time-header"),
  grid: document.getElementById("timetable-grid"),
  filter: document.getElementById("view-filter"),
  audit: document.getElementById("audit-strip"),
  subjectForm: document.getElementById("subject-form"),
  facultyForm: document.getElementById("faculty-form"),
  roomForm: document.getElementById("room-form"),
  toast: document.getElementById("toast")
};

function idFor(prefix) {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.querySelector(".saved-state").innerHTML = "<i></i> Saved locally";
  } catch (error) {
    console.error("Could not save timetable data.", error);
    document.querySelector(".saved-state").textContent = "Could not save";
    showToast("Your browser could not save these changes. Check local storage settings.", true);
  }
}

function showToast(message, isError) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", Boolean(isError));
  elements.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 3200);
}

function getFaculty(id) {
  return state.faculty.find((person) => person.id === id);
}

function getRoom(id) {
  return state.rooms.find((room) => room.id === id);
}

function getSubject(id) {
  return state.subjects.find((subject) => subject.id === id);
}

function requiredEquipment(subject) {
  return subject.kind === "lab" && subject.equipment.length === 0
    ? ["computers"]
    : subject.equipment;
}

function makeTasks(subjects) {
  const tasks = [];
  subjects.forEach((subject) => {
    const sessionLength = subject.kind === "lab" ? 3 : 1;
    let remainingHours = Number(subject.hours);
    let session = 1;
    while (remainingHours > 0) {
      const duration = Math.min(sessionLength, remainingHours);
      tasks.push({ id: `${subject.id}-session-${session}`, subjectId: subject.id, duration });
      remainingHours -= duration;
      session += 1;
    }
  });
  return tasks;
}

function overlaps(first, second) {
  return first.day === second.day &&
    first.period < second.period + second.duration &&
    second.period < first.period + first.duration;
}

function hasRoomForSubject(subject, room) {
  const equipment = requiredEquipment(subject);
  const roomEquipment = room.equipment.map((item) => item.toLowerCase());
  return room.capacity >= Number(subject.students) &&
    equipment.every((item) => roomEquipment.includes(item.toLowerCase()));
}

function candidateIsFree(task, candidate, placed) {
  const subject = getSubject(task.subjectId);
  const faculty = getFaculty(subject.facultyId);
  if (!faculty || !faculty.availableDays.includes(candidate.day)) return false;
  if (candidate.period + task.duration > PERIODS.length) return false;
  if (!hasRoomForSubject(subject, candidate.room)) return false;

  const facultyHours = placed.reduce((hours, allocation) => {
    const otherSubject = getSubject(allocation.subjectId);
    return hours + (otherSubject && otherSubject.facultyId === faculty.id ? allocation.duration : 0);
  }, 0);
  if (facultyHours + task.duration > Number(faculty.maxHours)) return false;

  return !placed.some((allocation) => {
    if (!overlaps({ day: candidate.day, period: candidate.period, duration: task.duration }, allocation)) return false;
    const otherSubject = getSubject(allocation.subjectId);
    if (!otherSubject) return false;
    return otherSubject.facultyId === faculty.id ||
      otherSubject.batch === subject.batch ||
      allocation.roomId === candidate.room.id;
  });
}

function getCandidates(task, placed) {
  const subject = getSubject(task.subjectId);
  const faculty = subject && getFaculty(subject.facultyId);
  if (!subject || !faculty) return [];
  const rooms = state.rooms.filter((room) => hasRoomForSubject(subject, room));
  const candidates = [];

  DAYS.forEach((_, day) => {
    for (let period = 0; period <= PERIODS.length - task.duration; period += 1) {
      rooms.forEach((room) => {
        const candidate = { day, period, room };
        if (!candidateIsFree(task, candidate, placed)) return;
        const sameBatchThatDay = placed.filter((allocation) => {
          const otherSubject = getSubject(allocation.subjectId);
          return allocation.day === day && otherSubject && otherSubject.batch === subject.batch;
        }).length;
        const sameFacultyThatDay = placed.filter((allocation) => {
          const otherSubject = getSubject(allocation.subjectId);
          return allocation.day === day && otherSubject && otherSubject.facultyId === faculty.id;
        }).length;
        const sameSubjectThatDay = placed.some((allocation) =>
          allocation.day === day && allocation.subjectId === subject.id
        ) ? 1 : 0;
        const preference = sameBatchThatDay * 4 + sameFacultyThatDay * 2 + sameSubjectThatDay * 6 +
          (subject.kind === "lab" && period < 2 ? 1 : 0);
        candidates.push({ ...candidate, preference });
      });
    }
  });
  candidates.sort((a, b) => a.preference - b.preference || a.day - b.day || a.period - b.period);
  return candidates;
}

function generateSchedule() {
  if (!state.subjects.length) {
    showToast("Add at least one subject before generating a timetable.", true);
    return;
  }
  if (!state.rooms.length || !state.faculty.length) {
    showToast("Add at least one faculty member and classroom first.", true);
    return;
  }

  const tasks = makeTasks(state.subjects);
  const placeable = [];
  tasks.forEach((task) => {
    if (getCandidates(task, []).length) placeable.push(task);
  });

  let nodes = 0;
  let best = [];
  const placed = [];
  const remaining = placeable.slice();
  let stoppedAtLimit = false;

  function search() {
    nodes += 1;
    if (placed.length > best.length) best = placed.slice();
    if (nodes > SEARCH_LIMIT) {
      stoppedAtLimit = true;
      return false;
    }
    if (!remaining.length) return true;

    let chosenIndex = -1;
    let chosenCandidates = null;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidates = getCandidates(remaining[index], placed);
      if (candidates.length === 0) return false;
      if (!chosenCandidates || candidates.length < chosenCandidates.length ||
          (candidates.length === chosenCandidates.length &&
           remaining[index].duration > remaining[chosenIndex].duration)) {
        chosenIndex = index;
        chosenCandidates = candidates;
      }
    }

    const [task] = remaining.splice(chosenIndex, 1);
    for (const candidate of chosenCandidates) {
      placed.push({
        id: idFor("allocation"),
        subjectId: task.subjectId,
        day: candidate.day,
        period: candidate.period,
        duration: task.duration,
        roomId: candidate.room.id
      });
      if (search()) return true;
      placed.pop();
      if (stoppedAtLimit) break;
    }
    remaining.splice(chosenIndex, 0, task);
    return false;
  }

  const solved = search();
  state.allocations = best;
  state.generated = true;
  saveState();
  render();

  const unscheduledCount = tasks.length - best.length;
  if (solved && unscheduledCount === 0) {
    showToast(`Done — all ${tasks.length} class sessions fit without a clash.`);
  } else if (unscheduledCount > 0) {
    const reason = stoppedAtLimit
      ? "The search reached its safety limit."
      : "Some requirements could not fit the available faculty, rooms or time slots.";
    showToast(`${best.length} of ${tasks.length} sessions scheduled. ${unscheduledCount} need attention. ${reason}`, true);
  }
}

function auditAllocations(allocations) {
  const violations = new Map();
  function add(allocation, message) {
    if (!violations.has(allocation.id)) violations.set(allocation.id, new Set());
    violations.get(allocation.id).add(message);
  }

  allocations.forEach((allocation, index) => {
    const subject = getSubject(allocation.subjectId);
    if (!subject) {
      add(allocation, "This class refers to a subject that no longer exists.");
      return;
    }
    const faculty = getFaculty(subject.facultyId);
    const room = getRoom(allocation.roomId);
    if (!faculty) add(allocation, "Assigned faculty member no longer exists.");
    else if (!faculty.availableDays.includes(allocation.day)) add(allocation, `${faculty.name} is unavailable on ${DAYS[allocation.day]}.`);
    if (!room) add(allocation, "Assigned classroom no longer exists.");
    else if (!hasRoomForSubject(subject, room)) {
      add(allocation, `${room.name} does not meet the capacity or equipment requirements.`);
    }
    if (allocation.period < 0 || allocation.period + allocation.duration > PERIODS.length) {
      add(allocation, "This class extends beyond the available periods.");
    }

    allocations.slice(index + 1).forEach((other) => {
      if (!overlaps(allocation, other)) return;
      const otherSubject = getSubject(other.subjectId);
      if (!otherSubject) return;
      if (subject.batch === otherSubject.batch) {
        add(allocation, `${subject.batch} has another class at this time.`);
        add(other, `${otherSubject.batch} has another class at this time.`);
      }
      if (faculty && faculty.id === otherSubject.facultyId) {
        add(allocation, `${faculty.name} is already booked at this time.`);
        add(other, `${faculty.name} is already booked at this time.`);
      }
      if (allocation.roomId === other.roomId) {
        const roomName = getRoom(allocation.roomId)?.name || "This room";
        add(allocation, `${roomName} is already booked at this time.`);
        add(other, `${roomName} is already booked at this time.`);
      }
    });
  });

  const hoursByFaculty = new Map(state.faculty.map((person) => [person.id, 0]));
  allocations.forEach((allocation) => {
    const subject = getSubject(allocation.subjectId);
    if (subject && hoursByFaculty.has(subject.facultyId)) {
      hoursByFaculty.set(subject.facultyId, hoursByFaculty.get(subject.facultyId) + allocation.duration);
    }
  });
  state.faculty.forEach((person) => {
    if (hoursByFaculty.get(person.id) > Number(person.maxHours)) {
      allocations.forEach((allocation) => {
        const subject = getSubject(allocation.subjectId);
        if (subject && subject.facultyId === person.id) {
          add(allocation, `${person.name} exceeds the ${person.maxHours}-hour weekly workload limit.`);
        }
      });
    }
  });
  return violations;
}

function renderHeader() {
  elements.timeHeader.innerHTML = `<div></div>${PERIODS.map((time, index) =>
    `<div>PERIOD ${index + 1}<small>${time} – ${PERIODS[index + 1] || "15:00"}</small></div>`
  ).join("")}`;
}

function visibleAllocations() {
  return state.allocations.filter((allocation) => {
    const subject = getSubject(allocation.subjectId);
    if (!subject) return false;
    return state.viewType === "batch"
      ? subject.batch === state.selectedFilter
      : subject.facultyId === state.selectedFilter;
  });
}

function renderGrid(violations) {
  const allocations = visibleAllocations();
  if (!state.generated) {
    elements.grid.innerHTML = `<div class="empty-state"><strong>Your week is ready to take shape.</strong><span>Add or adjust resources, then generate a timetable to fill this grid.</span></div>`;
    return;
  }
  const tasksForView = makeTasks(state.subjects.filter((subject) =>
    state.viewType === "batch" ? subject.batch === state.selectedFilter : subject.facultyId === state.selectedFilter
  )).length;
  if (!tasksForView) {
    elements.grid.innerHTML = `<div class="empty-state"><strong>Nothing to show just yet.</strong><span>Add a subject for this ${state.viewType === "batch" ? "batch" : "faculty member"} to build a schedule.</span></div>`;
    return;
  }

  elements.grid.innerHTML = DAYS.map((day, dayIndex) => {
    const slots = [];
    for (let period = 0; period < PERIODS.length; period += 1) {
      const allocation = allocations.find((item) =>
        item.day === dayIndex && period >= item.period && period < item.period + item.duration
      );
      let contents = "";
      if (allocation) {
        const subject = getSubject(allocation.subjectId);
        const faculty = subject && getFaculty(subject.facultyId);
        const room = getRoom(allocation.roomId);
        const atStart = period === allocation.period;
        const classType = subject && subject.kind === "lab" ? "lab" : "";
        const violationMessages = Array.from(violations.get(allocation.id) || []);
        const clashClass = violationMessages.length ? "is-clash" : "";
        if (atStart) {
          const meta = state.viewType === "batch"
            ? `${faculty ? faculty.name : "Faculty missing"} · ${room ? room.name : "Room missing"}`
            : `${subject ? subject.batch : "Batch"} · ${room ? room.name : "Room missing"}`;
          const title = `${subject ? subject.name : "Unknown class"} — ${meta}`;
          contents = `<div class="class-card ${classType} ${clashClass}" draggable="true"
            data-allocation-id="${allocation.id}" title="${escapeHtml(title)}"
            aria-label="${escapeHtml(title)}${violationMessages.length ? `. Clash: ${violationMessages.join(" ")}` : ""}">
            <span class="class-name">${escapeHtml(subject ? subject.name : "Unknown class")}</span>
            <span class="class-meta">${escapeHtml(meta)}</span>
            ${violationMessages.length ? '<span class="class-meta">⚠ Clash detected</span>' : ""}
          </div>`;
        } else {
          contents = `<div class="continuation ${classType} ${clashClass}" aria-label="Continued class">↳</div>`;
        }
      }
      slots.push(`<div class="${allocation ? "slot has-class" : "slot"}" data-day="${dayIndex}" data-period="${period}">${contents}</div>`);
    }
    return `<div class="day-row"><div class="day-label">${day}</div>${slots.join("")}</div>`;
  }).join("");
}

function renderAudit(violations, totalTasks, scheduledTasks) {
  const count = Array.from(violations.values()).reduce((sum, messages) => sum + messages.size, 0);
  const unscheduled = Math.max(0, totalTasks - scheduledTasks);
  elements.audit.classList.toggle("visible", state.generated);
  elements.audit.classList.toggle("has-errors", count > 0 || unscheduled > 0);
  if (!state.generated) {
    elements.audit.textContent = "";
  } else if (count === 0 && unscheduled === 0) {
    elements.audit.innerHTML = '<span class="audit-ok">✓</span> No clashes found. Every class is in a suitable room and available slot.';
  } else {
    const parts = [];
    if (count) parts.push(`<span class="audit-badge">${count} clash ${count === 1 ? "warning" : "warnings"}</span><span>Red classes need attention. Drag a class to try another slot.</span>`);
    if (unscheduled) parts.push(`<span class="audit-badge">${unscheduled} unallocated</span><span>Not every session could fit; add capacity or relax a constraint.</span>`);
    elements.audit.innerHTML = parts.join(" ");
  }
}

function renderFilter() {
  const options = state.viewType === "batch"
    ? Array.from(new Set(state.subjects.map((subject) => subject.batch))).sort()
    : state.faculty.map((person) => person.id);
  if (!options.includes(state.selectedFilter)) state.selectedFilter = options[0] || "";
  elements.filter.innerHTML = options.length
    ? options.map((value) => {
      const label = state.viewType === "batch" ? value : (getFaculty(value)?.name || "Unknown faculty");
      return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    }).join("")
    : `<option value="">No ${state.viewType === "batch" ? "batches" : "faculty"}</option>`;
  elements.filter.value = state.selectedFilter;
  elements.filter.setAttribute("aria-label", state.viewType === "batch" ? "Select a batch" : "Select faculty");
  document.getElementById("batch-view-button").classList.toggle("active", state.viewType === "batch");
  document.getElementById("faculty-view-button").classList.toggle("active", state.viewType === "faculty");
}

function renderResourceList(listId, items, details, type) {
  const list = document.getElementById(listId);
  list.innerHTML = items.map((item) => `<li class="resource-item">
    <span class="resource-bullet"></span>
    <span class="resource-item-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(details(item))}</small></span>
    <button class="remove-resource" type="button" data-remove-type="${type}" data-remove-id="${item.id}" aria-label="Remove ${escapeHtml(item.name)}">×</button>
  </li>`).join("");
}

function renderResources() {
  document.getElementById("subject-count").textContent = `${state.subjects.length} ${state.subjects.length === 1 ? "course" : "courses"}`;
  document.getElementById("faculty-count").textContent = `${state.faculty.length} ${state.faculty.length === 1 ? "person" : "people"}`;
  document.getElementById("room-count").textContent = `${state.rooms.length} ${state.rooms.length === 1 ? "room" : "rooms"}`;
  document.getElementById("resource-count").textContent = state.subjects.length + state.faculty.length + state.rooms.length;

  const facultySelect = elements.subjectForm.elements.facultyId;
  facultySelect.innerHTML = state.faculty.length
    ? state.faculty.map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`).join("")
    : '<option value="">Add faculty first</option>';
  facultySelect.disabled = state.faculty.length === 0;
  elements.subjectForm.querySelector('button[type="submit"]').disabled = state.faculty.length === 0;

  renderResourceList("subject-list", state.subjects,
    (subject) => `${subject.batch} · ${subject.hours} hrs · ${subject.kind === "lab" ? "Lab" : "Lecture"}`, "subject");
  renderResourceList("faculty-list", state.faculty,
    (person) => `${person.maxHours} hr limit · ${person.availableDays.length} available days`, "faculty");
  renderResourceList("room-list", state.rooms,
    (room) => `${room.capacity} seats${room.equipment.length ? ` · ${room.equipment.join(", ")}` : ""}`, "room");
}

function renderStats(violations, totalTasks) {
  const scheduled = state.allocations.length;
  const hours = state.allocations.reduce((sum, allocation) => sum + allocation.duration, 0);
  document.getElementById("scheduled-stat").innerHTML = `${scheduled} <small>of ${totalTasks}</small>`;
  const clashCount = Array.from(violations.values()).reduce((sum, messages) => sum + messages.size, 0);
  const status = document.getElementById("clash-status");
  document.getElementById("clash-stat").textContent = clashCount;
  status.textContent = clashCount ? "Needs a look" : "All clear";
  status.classList.toggle("has-clashes", clashCount > 0);
  document.getElementById("hours-stat").innerHTML = `${hours} <small>hrs / week</small>`;

  const loads = state.faculty.map((person) => state.allocations.reduce((sum, allocation) => {
    const subject = getSubject(allocation.subjectId);
    return sum + (subject && subject.facultyId === person.id ? allocation.duration : 0);
  }, 0));
  const totalLoad = loads.reduce((sum, load) => sum + load, 0);
  const differenceSum = loads.reduce((sum, load) =>
    sum + loads.reduce((inner, other) => inner + Math.abs(load - other), 0), 0);
  const gini = loads.length && totalLoad ? differenceSum / (2 * loads.length * totalLoad) : 0;
  document.getElementById("workload-stat").textContent = `Workload Gini ${gini.toFixed(2)}`;
}

function render() {
  renderHeader();
  renderFilter();
  renderResources();
  const violations = auditAllocations(state.allocations);
  const tasks = makeTasks(state.subjects);
  renderStats(violations, tasks.length);
  renderGrid(violations);
  renderAudit(violations, tasks.length, state.allocations.length);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function handleDrop(event) {
  event.preventDefault();
  const slot = event.target.closest(".slot");
  if (!slot || !draggedAllocationId) return;
  const allocation = state.allocations.find((item) => item.id === draggedAllocationId);
  if (!allocation) return;
  const day = Number(slot.dataset.day);
  const period = Number(slot.dataset.period);
  if (period + allocation.duration > PERIODS.length) {
    showToast("That class will not fit in the remaining periods of the day.", true);
    draggedAllocationId = null;
    return;
  }
  allocation.day = day;
  allocation.period = period;
  draggedAllocationId = null;
  saveState();
  render();
  const violations = auditAllocations(state.allocations).get(allocation.id);
  if (violations && violations.size) showToast(`Clash: ${Array.from(violations)[0]}`, true);
  else showToast("Class moved. No clash detected.");
}

function addSubject(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const subject = {
    id: idFor("subject"),
    name: String(data.get("name")).trim(),
    batch: String(data.get("batch")).trim(),
    students: Number(data.get("students")),
    facultyId: String(data.get("facultyId")),
    hours: Number(data.get("hours")),
    kind: String(data.get("kind")),
    equipment: String(data.get("equipment")).split(",").map((item) => item.trim()).filter(Boolean)
  };
  if (!subject.name || !subject.batch || !Number.isInteger(subject.hours) || subject.hours < 1 ||
      !Number.isInteger(subject.students) || subject.students < 1 || !getFaculty(subject.facultyId)) {
    showToast("Check the subject details and choose a valid faculty member.", true);
    return;
  }
  state.subjects.push(subject);
  state.allocations = [];
  state.generated = false;
  form.reset();
  form.elements.students.value = 40;
  form.elements.hours.value = 3;
  saveState();
  render();
  showToast("Subject added. Generate a fresh timetable to include it.");
}

function addFaculty(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const availableDays = data.getAll("days").map(Number);
  const person = {
    id: idFor("faculty"),
    name: String(data.get("name")).trim(),
    maxHours: Number(data.get("maxHours")),
    availableDays
  };
  if (!person.name || !Number.isInteger(person.maxHours) || person.maxHours < 1 || !availableDays.length) {
    showToast("Add a name, a workload limit and at least one available day.", true);
    return;
  }
  state.faculty.push(person);
  form.reset();
  form.elements.maxHours.value = 12;
  saveState();
  render();
  showToast("Faculty member added.");
}

function addRoom(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const room = {
    id: idFor("room"),
    name: String(data.get("name")).trim(),
    capacity: Number(data.get("capacity")),
    equipment: String(data.get("equipment")).split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)
  };
  if (!room.name || !Number.isInteger(room.capacity) || room.capacity < 1) {
    showToast("Add a classroom name and a valid seating capacity.", true);
    return;
  }
  state.rooms.push(room);
  form.reset();
  form.elements.capacity.value = 40;
  saveState();
  render();
  showToast("Classroom added.");
}

function removeResource(type, id) {
  if (type === "subject") {
    state.subjects = state.subjects.filter((subject) => subject.id !== id);
    state.allocations = state.allocations.filter((allocation) => allocation.subjectId !== id);
  } else if (type === "faculty") {
    if (state.subjects.some((subject) => subject.facultyId === id)) {
      showToast("Reassign or remove this faculty member’s subjects before removing them.", true);
      return;
    }
    state.faculty = state.faculty.filter((person) => person.id !== id);
  } else if (type === "room") {
    if (state.allocations.some((allocation) => allocation.roomId === id)) {
      showToast("This room is in the current timetable. Generate a new timetable before removing it.", true);
      return;
    }
    state.rooms = state.rooms.filter((room) => room.id !== id);
  }
  if (type === "subject") state.generated = false;
  saveState();
  render();
}

function escapeIcal(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function exportCalendar() {
  const allocations = visibleAllocations();
  if (!allocations.length) {
    showToast("There are no scheduled classes in this view to export.", true);
    return;
  }
  const now = new Date();
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
  const datePart = `${monday.getFullYear()}${String(monday.getMonth() + 1).padStart(2, "0")}${String(monday.getDate()).padStart(2, "0")}`;
  const events = allocations.map((allocation) => {
    const subject = getSubject(allocation.subjectId);
    const faculty = subject && getFaculty(subject.facultyId);
    const room = getRoom(allocation.roomId);
    const eventDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + allocation.day);
    const eventDatePart = `${eventDate.getFullYear()}${String(eventDate.getMonth() + 1).padStart(2, "0")}${String(eventDate.getDate()).padStart(2, "0")}`;
    const startTime = PERIODS[allocation.period].replace(":", "") + "00";
    const endMinutes = (Number(PERIODS[allocation.period].slice(0, 2)) * 60) + allocation.duration * 60;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}${String(endMinutes % 60).padStart(2, "0")}00`;
    const description = subject ? `${subject.batch} · ${faculty ? faculty.name : "Faculty"}` : "Class schedule";
    return [
      "BEGIN:VEVENT",
      `UID:${allocation.id}@classclockwork`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART:${eventDatePart}T${startTime}`,
      `DTEND:${eventDatePart}T${endTime}`,
      `SUMMARY:${escapeIcal(subject ? subject.name : "Class")}`,
      `DESCRIPTION:${escapeIcal(description)}`,
      `LOCATION:${escapeIcal(room ? room.name : "Room not assigned")}`,
      "END:VEVENT"
    ].join("\r\n");
  });
  const content = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ClassClockwork//Timetable//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `classclockwork-${datePart}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Calendar file exported for the selected view.");
}

function restoreSampleData() {
  state = createSampleData();
  saveState();
  render();
  showToast("Sample resources restored. Generate a timetable to start fresh.");
}

function bindEvents() {
  document.getElementById("generate-button").addEventListener("click", generateSchedule);
  document.getElementById("print-button").addEventListener("click", () => window.print());
  document.getElementById("calendar-button").addEventListener("click", exportCalendar);
  document.getElementById("reset-button").addEventListener("click", restoreSampleData);
  document.getElementById("batch-view-button").addEventListener("click", () => {
    state.viewType = "batch";
    state.selectedFilter = Array.from(new Set(state.subjects.map((subject) => subject.batch))).sort()[0] || "";
    render();
  });
  document.getElementById("faculty-view-button").addEventListener("click", () => {
    state.viewType = "faculty";
    state.selectedFilter = state.faculty[0]?.id || "";
    render();
  });
  elements.filter.addEventListener("change", (event) => {
    state.selectedFilter = event.target.value;
    render();
  });
  elements.subjectForm.addEventListener("submit", addSubject);
  elements.facultyForm.addEventListener("submit", addFaculty);
  elements.roomForm.addEventListener("submit", addRoom);
  document.querySelector(".resource-cards").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-type]");
    if (button) removeResource(button.dataset.removeType, button.dataset.removeId);
  });
  elements.grid.addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-allocation-id]");
    if (!card) return;
    draggedAllocationId = card.dataset.allocationId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedAllocationId);
    window.setTimeout(() => card.classList.add("dragging"), 0);
  });
  elements.grid.addEventListener("dragend", (event) => {
    event.target.closest("[data-allocation-id]")?.classList.remove("dragging");
    draggedAllocationId = null;
    elements.grid.querySelectorAll(".drop-target").forEach((slot) => slot.classList.remove("drop-target"));
  });
  elements.grid.addEventListener("dragover", (event) => {
    const slot = event.target.closest(".slot");
    if (!slot || !draggedAllocationId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    slot.classList.add("drop-target");
  });
  elements.grid.addEventListener("dragleave", (event) => {
    const slot = event.target.closest(".slot");
    if (slot && !slot.contains(event.relatedTarget)) slot.classList.remove("drop-target");
  });
  elements.grid.addEventListener("drop", handleDrop);
}

bindEvents();
render();