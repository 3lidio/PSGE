
(() => {
  'use strict';

  const KEY = 'itcl_apple_school_v2';

  const blankDB = () => ({
    students: [],
    teachers: [],
    subjects: [],
    grades: [],
    attendance: [],
    schedules: [],
    settings: {
      schoolName: 'Instituto Técnico Comercial de Luanda',
      shortName: 'ITCL',
      year: '2026',
      theme: 'light'
    }
  });

  const $ = id => document.getElementById(id);
  const uid = () => crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

  let db = blankDB();
  let toastTimer;

  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || 'null');

    if (stored && typeof stored === 'object') {
      db = { ...blankDB(), ...stored };
      db.settings = { ...blankDB().settings, ...(stored.settings || {}) };

      ['students', 'teachers', 'subjects', 'grades', 'attendance', 'schedules']
        .forEach(key => {
          if (!Array.isArray(db[key])) db[key] = [];
        });
    }
  } catch {
    db = blankDB();
  }

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);

  const today = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const datePT = value => {
    if (!value) return '—';
    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  };

  function notify(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000);
  }

  function persist(message = '') {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      notify('Não foi possível guardar os dados. Verifica o espaço do navegador.');
      return;
    }

    render();
    if (message) notify(message);
  }

  function getStudent(id) {
    return db.students.find(item => item.id === id);
  }

  function studentName(id) {
    return getStudent(id)?.name || 'Aluno não encontrado';
  }

  function getTeacher(id) {
    return db.teachers.find(item => item.id === id);
  }

  function teacherName(id) {
    return getTeacher(id)?.name || 'Não atribuído';
  }

  function getSubject(id) {
    return db.subjects.find(item => item.id === id);
  }

  function subjectName(id) {
    return getSubject(id)?.name || '';
  }

  function emptyRow(columns, message) {
    return `<tr><td colspan="${columns}" class="empty">${escapeHTML(message)}</td></tr>`;
  }

  function actionButtons(type, id) {
    return `
      <button class="table-action" data-edit="${type}" data-id="${escapeHTML(id)}">Editar</button>
      <button class="table-action delete" data-delete="${type}" data-id="${escapeHTML(id)}">Apagar</button>
    `;
  }

  function statusPill(status) {
    const value = String(status || 'Activo');
    const kind = /activo|presente|aprovado/i.test(value)
      ? 'success'
      : /falta|reprovado|inactivo|transferido/i.test(value)
        ? 'danger'
        : 'warning';

    return `<span class="pill ${kind}">${escapeHTML(value)}</span>`;
  }

  /* NAVEGAÇÃO */

  const pageNames = {
    dashboard: 'Painel geral',
    students: 'Alunos',
    teachers: 'Professores',
    subjects: 'Disciplinas',
    classes: 'Turmas e salas',
    grades: 'Notas',
    attendance: 'Presenças',
    schedule: 'Horários',
    reports: 'Relatórios',
    settings: 'Configurações'
  };

  function navigate(page) {
    if (!pageNames[page]) return;

    document.querySelectorAll('.page').forEach(element => {
      element.classList.toggle('active', element.id === `page-${page}`);
    });

    document.querySelectorAll('.nav-item').forEach(button => {
      button.classList.toggle('active', button.dataset.page === page);
    });

    $('pageTitle').textContent = pageNames[page];
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeSidebar() {
    $('sidebar').classList.remove('open');
    $('sidebarOverlay').classList.remove('show');
  }

  document.querySelectorAll('.nav-item[data-page]').forEach(button => {
    button.addEventListener('click', () => navigate(button.dataset.page));
  });

  document.querySelectorAll('[data-open-page]').forEach(button => {
    button.addEventListener('click', () => navigate(button.dataset.openPage));
  });

  $('menuToggle').addEventListener('click', () => {
    $('sidebar').classList.toggle('open');
    $('sidebarOverlay').classList.toggle('show');
  });

  $('sidebarOverlay').addEventListener('click', closeSidebar);

  /* ABRIR E FECHAR FORMULÁRIOS */

  function openPanel(id) {
    const panel = $(id);
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closePanel(id) {
    $(id).hidden = true;
  }

  function resetForm(formId) {
    $(formId).reset();

    const hidden = $(formId).querySelector('input[type="hidden"]');
    if (hidden) hidden.value = '';
  }

  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => closePanel(button.dataset.close));
  });

  /* MODO ESCURO */

  $('themeToggle').addEventListener('click', () => {
    const dark = !document.body.classList.contains('dark');

    document.body.classList.toggle('dark', dark);
    db.settings.theme = dark ? 'dark' : 'light';

    persist('Aparência actualizada.');
  });

  /* SELECTS DINÂMICOS */

  function fillSelect(id, entries, placeholder, selected = '') {
    const element = $(id);
    if (!element) return;

    const current = selected || element.value;

    element.innerHTML =
      `<option value="">${escapeHTML(placeholder)}</option>` +
      entries.map(item => `
        <option value="${escapeHTML(item.value)}">${escapeHTML(item.label)}</option>
      `).join('');

    if (entries.some(item => item.value === current)) {
      element.value = current;
    }
  }

  function refreshSelects() {
    const students = db.students
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
      .map(item => ({
        value: item.id,
        label: `${item.name} — ${item.number}`
      }));

    const subjects = db.subjects
      .filter(item => item.status !== 'Inactiva')
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
      .map(item => ({
        value: item.id,
        label: `${item.name} (${item.clazz})`
      }));

    const teachers = db.teachers
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
      .map(item => ({ value: item.id, label: item.name }));

    fillSelect('gStudent', students, 'Seleccionar aluno');
    fillSelect('aStudent', students, 'Seleccionar aluno');
    fillSelect('gSubject', subjects, 'Seleccionar disciplina');
    fillSelect('hSubject', subjects, 'Seleccionar disciplina');
    fillSelect('subjectTeacher', teachers, 'Sem professor atribuído');
  }

  /* EXPORTAÇÃO CSV */

  function exportCSV(filename, headers, rows) {
    if (!rows.length) {
      notify('Não existem registos para exportar.');
      return;
    }

    const allRows = [headers, ...rows];

    const content = allRows.map(row =>
      row.map(value =>
        '"' + String(value ?? '').replace(/"/g, '""') + '"'
      ).join(';')
    ).join('\r\n');

    const blob = new Blob(['\ufeff' + content], {
      type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportStudents() {
    exportCSV('ITCL-alunos.csv',
      ['Nome', 'Processo', 'BI', 'Telefone', 'Email', 'Classe', 'Turma', 'Sala', 'Curso', 'Turno', 'Estado'],
      db.students.map(s => [
        s.name, s.number, s.bi, s.phone, s.email,
        s.clazz, s.group, s.room, s.course, s.shift, s.status
      ])
    );
  }

  function exportTeachers() {
    exportCSV('ITCL-professores.csv',
      ['Nome', 'Disciplina', 'Número', 'Telefone', 'Email', 'Estado'],
      db.teachers.map(t => [
        t.name, t.subject, t.number, t.phone, t.email, t.status
      ])
    );
  }

  function exportSubjects() {
    exportCSV('ITCL-disciplinas.csv',
      ['Disciplina', 'Código', 'Classe', 'Professor', 'Horas semanais', 'Estado', 'Descrição'],
      db.subjects.map(s => [
        s.name, s.code, s.clazz, teacherName(s.teacherId),
        s.hours, s.status, s.description
      ])
    );
  }

  function exportGrades() {
    exportCSV('ITCL-notas.csv',
      ['Aluno', 'Disciplina', 'Trimestre', 'Nota', 'Resultado', 'Data'],
      db.grades.map(g => [
        studentName(g.studentId), g.subject, g.term, g.value,
        Number(g.value) >= 10 ? 'Aprovado' : 'Reprovado', g.date
      ])
    );
  }

  function exportAttendance() {
    exportCSV('ITCL-presencas.csv',
      ['Aluno', 'Data', 'Estado', 'Observação'],
      db.attendance.map(a => [
        studentName(a.studentId), a.date, a.status, a.note
      ])
    );
  }

  $('exportStudents').onclick = $('reportStudents').onclick = exportStudents;
  $('exportTeachers').onclick = $('reportTeachers').onclick = exportTeachers;
  $('exportSubjects').onclick = $('reportSubjects').onclick = exportSubjects;
  $('exportGrades').onclick = $('reportGrades').onclick = exportGrades;
  $('exportAttendance').onclick = $('reportAttendance').onclick = exportAttendance;

  /* CÓPIA DE SEGURANÇA */

  function backup() {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `ITCL-backup-${today()}.json`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Cópia de segurança criada.');
  }

  $('backup').onclick = $('backupSettings').onclick = backup;
  $('printReport').onclick = () => window.print();

  /* FORMULÁRIO DE ALUNOS */

  $('addStudent').onclick = () => {
    resetForm('studentForm');
    $('studentFormTitle').textContent = 'Novo aluno';
    openPanel('studentPanel');
  };

  $('studentForm').addEventListener('submit', event => {
    event.preventDefault();

    const id = $('studentId').value;
    const number = $('sNumber').value.trim();

    const duplicate = db.students.some(student =>
      student.number.toLowerCase() === number.toLowerCase() &&
      student.id !== id
    );

    if (duplicate) {
      notify('Este número de processo já está registado.');
      return;
    }

    const student = {
      id: id || uid(),
      name: $('sName').value.trim(),
      number,
      bi: $('sBI').value.trim(),
      phone: $('sPhone').value.trim(),
      email: $('sEmail').value.trim(),
      clazz: $('sClass').value,
      group: $('sGroup').value.trim(),
      room: $('sRoom').value.trim(),
      course: $('sCourse').value.trim(),
      shift: $('sShift').value,
      birth: $('sBirth').value,
      status: $('sStatus').value,
      note: $('sNote').value.trim()
    };

    if (id) {
      db.students = db.students.map(item => item.id === id ? student : item);
    } else {
      db.students.push(student);
    }

    closePanel('studentPanel');
    resetForm('studentForm');
    persist(id ? 'Dados do aluno actualizados.' : 'Aluno cadastrado com sucesso.');
  });

  /* FORMULÁRIO DE PROFESSORES */

  $('addTeacher').onclick = () => {
    resetForm('teacherForm');
    $('teacherFormTitle').textContent = 'Novo professor';
    openPanel('teacherPanel');
  };

  $('teacherForm').addEventListener('submit', event => {
    event.preventDefault();

    const id = $('teacherId').value;

    const teacher = {
      id: id || uid(),
      name: $('tName').value.trim(),
      subject: $('tSubject').value.trim(),
      number: $('tNumber').value.trim(),
      phone: $('tPhone').value.trim(),
      email: $('tEmail').value.trim(),
      status: $('tStatus').value
    };

    if (id) {
      db.teachers = db.teachers.map(item => item.id === id ? teacher : item);
    } else {
      db.teachers.push(teacher);
    }

    closePanel('teacherPanel');
    resetForm('teacherForm');
    persist(id ? 'Professor actualizado.' : 'Professor cadastrado.');
  });

  /* FORMULÁRIO DE DISCIPLINAS */

  $('addSubject').onclick = () => {
    resetForm('subjectForm');
    $('subjectFormTitle').textContent = 'Nova disciplina';
    refreshSelects();
    openPanel('subjectPanel');
  };

  $('subjectForm').addEventListener('submit', event => {
    event.preventDefault();

    const id = $('subjectId').value;
    const name = $('subjectName').value.trim();
    const clazz = $('subjectClass').value;

    const duplicate = db.subjects.some(subject =>
      subject.name.toLowerCase() === name.toLowerCase() &&
      subject.clazz === clazz &&
      subject.id !== id
    );

    if (duplicate) {
      notify('Esta disciplina já existe nesta classe.');
      return;
    }

    const subject = {
      id: id || uid(),
      name,
      code: $('subjectCode').value.trim(),
      clazz,
      teacherId: $('subjectTeacher').value,
      hours: Number($('subjectHours').value) || 0,
      status: $('subjectStatus').value,
      description: $('subjectDescription').value.trim()
    };

    if (id) {
      db.subjects = db.subjects.map(item => item.id === id ? subject : item);
    } else {
      db.subjects.push(subject);
    }

    closePanel('subjectPanel');
    resetForm('subjectForm');
    persist(id ? 'Disciplina actualizada.' : 'Disciplina criada.');
  });

  /* FORMULÁRIO DE NOTAS */

  $('addGrade').onclick = () => {
    if (!db.students.length) {
      notify('Cadastra primeiro um aluno.');
      return;
    }

    if (!db.subjects.length) {
      notify('Cadastra primeiro uma disciplina.');
      navigate('subjects');
      return;
    }

    resetForm('gradeForm');
    refreshSelects();
    $('gDate').value = today();
    openPanel('gradePanel');
  };

  $('gradeForm').addEventListener('submit', event => {
    event.preventDefault();

    const value = Number($('gValue').value);

    if (!Number.isFinite(value) || value < 0 || value > 20) {
      notify('A nota deve estar entre 0 e 20.');
      return;
    }

    db.grades.push({
      id: uid(),
      studentId: $('gStudent').value,
      subject: subjectName($('gSubject').value),
      subjectId: $('gSubject').value,
      term: $('gTerm').value,
      value,
      date: $('gDate').value || today()
    });

    closePanel('gradePanel');
    resetForm('gradeForm');
    persist('Nota registada com sucesso.');
  });

  /* FORMULÁRIO DE PRESENÇAS */

  $('addAttendance').onclick = () => {
    if (!db.students.length) {
      notify('Cadastra primeiro um aluno.');
      return;
    }

    resetForm('attendanceForm');
    refreshSelects();
    $('aDate').value = today();
    openPanel('attendancePanel');
  };

  $('attendanceForm').addEventListener('submit', event => {
    event.preventDefault();

    const studentId = $('aStudent').value;
    const dateValue = $('aDate').value;

    const alreadyExists = db.attendance.some(item =>
      item.studentId === studentId &&
      item.date === dateValue
    );

    if (alreadyExists && !confirm(
      'Já existe um registo de presença deste aluno nesta data. Registar outro?'
    )) {
      return;
    }

    db.attendance.push({
      id: uid(),
      studentId,
      date: dateValue,
      status: $('aStatus').value,
      note: $('aNote').value.trim()
    });

    closePanel('attendancePanel');
    resetForm('attendanceForm');
    persist('Presença registada.');
  });

  /* FORMULÁRIO DE HORÁRIOS */

  $('addSchedule').onclick = () => {
    resetForm('scheduleForm');
    refreshSelects();
    openPanel('schedulePanel');
  };

  $('scheduleForm').addEventListener('submit', event => {
    event.preventDefault();

    const start = $('hStart').value;
    const end = $('hEnd').value;

    if (end <= start) {
      notify('A hora de fim deve ser posterior à hora de início.');
      return;
    }

    const schedule = {
      id: uid(),
      day: $('hDay').value,
      clazz: $('hClass').value,
      group: $('hGroup').value.trim(),
      subject: subjectName($('hSubject').value),
      subjectId: $('hSubject').value,
      teacher: $('hTeacher').value.trim(),
      room: $('hRoom').value.trim(),
      start,
      end
    };

    const conflict = db.schedules.some(item =>
      item.day === schedule.day &&
      item.clazz === schedule.clazz &&
      item.group.toLowerCase() === schedule.group.toLowerCase() &&
      start < item.end &&
      end > item.start
    );

    if (conflict && !confirm(
      'Este horário sobrepõe-se a outra aula da mesma turma. Pretendes continuar?'
    )) {
      return;
    }

    db.schedules.push(schedule);

    closePanel('schedulePanel');
    resetForm('scheduleForm');
    persist('Aula adicionada ao horário.');
  });

  /* PESQUISA E FILTROS */

  [
    'studentSearch', 'classFilter',
    'teacherSearch', 'subjectSearch', 'subjectClassFilter',
    'gradeSearch', 'attendanceSearch',
    'scheduleDayFilter', 'scheduleClassFilter'
  ].forEach(id => {
    $(id).addEventListener(
      id.toLowerCase().includes('filter') ? 'change' : 'input',
      render
    );
  });

  /* EDIÇÃO */

  function setValues(mapping, record) {
    Object.entries(mapping).forEach(([field, property]) => {
      $(field).value = record[property] ?? '';
    });
  }

  function editRecord(type, id) {
    const collections = {
      student: 'students',
      teacher: 'teachers',
      subject: 'subjects'
    };

    const key = collections[type];

    if (!key) {
      notify('Para alterar este registo, apaga-o e cria um novo.');
      return;
    }

    const record = db[key].find(item => item.id === id);
    if (!record) return;

    if (type === 'student') {
      navigate('students');
      resetForm('studentForm');
      setValues({
        studentId: 'id',
        sName: 'name',
        sNumber: 'number',
        sBI: 'bi',
        sPhone: 'phone',
        sEmail: 'email',
        sClass: 'clazz',
        sGroup: 'group',
        sRoom: 'room',
        sCourse: 'course',
        sShift: 'shift',
        sBirth: 'birth',
        sStatus: 'status',
        sNote: 'note'
      }, record);

      $('studentFormTitle').textContent = 'Editar aluno';
      openPanel('studentPanel');
    }

    if (type === 'teacher') {
      navigate('teachers');
      resetForm('teacherForm');
      setValues({
        teacherId: 'id',
        tName: 'name',
        tSubject: 'subject',
        tNumber: 'number',
        tPhone: 'phone',
        tEmail: 'email',
        tStatus: 'status'
      }, record);

      $('teacherFormTitle').textContent = 'Editar professor';
      openPanel('teacherPanel');
    }

    if (type === 'subject') {
      navigate('subjects');
      resetForm('subjectForm');
      refreshSelects();

      setValues({
        subjectId: 'id',
        subjectName: 'name',
        subjectCode: 'code',
        subjectClass: 'clazz',
        subjectTeacher: 'teacherId',
        subjectHours: 'hours',
        subjectStatus: 'status',
        subjectDescription: 'description'
      }, record);

      $('subjectFormTitle').textContent = 'Editar disciplina';
      openPanel('subjectPanel');
    }
  }

  /* ELIMINAÇÃO */

  function deleteRecord(type, id) {
    const map = {
      student: 'students',
      teacher: 'teachers',
      subject: 'subjects',
      grade: 'grades',
      attendance: 'attendance',
      schedule: 'schedules'
    };

    const key = map[type];
    if (!key) return;

    const record = db[key].find(item => item.id === id);
    if (!record) return;

    if (!confirm('Tens a certeza de que pretendes apagar este registo?')) {
      return;
    }

    if (type === 'student') {
      db.grades = db.grades.filter(item => item.studentId !== id);
      db.attendance = db.attendance.filter(item => item.studentId !== id);
    }

    if (type === 'subject') {
      db.grades = db.grades.filter(item =>
        item.subjectId !== id && item.subject !== record.name
      );

      db.schedules = db.schedules.filter(item =>
        item.subjectId !== id && item.subject !== record.name
      );
    }

    db[key] = db[key].filter(item => item.id !== id);
    persist('Registo eliminado.');
  }

  document.addEventListener('click', event => {
    const editButton = event.target.closest('[data-edit]');
    const deleteButton = event.target.closest('[data-delete]');

    if (editButton) {
      editRecord(editButton.dataset.edit, editButton.dataset.id);
    }

    if (deleteButton) {
      deleteRecord(deleteButton.dataset.delete, deleteButton.dataset.id);
    }
  });

  /* CONFIGURAÇÕES */

  $('settingsForm').addEventListener('submit', event => {
    event.preventDefault();

    db.settings.schoolName = $('schoolName').value.trim();
    db.settings.shortName = $('schoolShort').value.trim();
    db.settings.year = $('schoolYear').value.trim();

    persist('Configurações guardadas.');
  });

  $('restore').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const imported = JSON.parse(await file.text());

      const requiredArrays = [
        'students', 'teachers', 'subjects',
        'grades', 'attendance', 'schedules'
      ];

      if (!requiredArrays.every(key => Array.isArray(imported[key]))) {
        throw new Error('Estrutura inválida');
      }

      if (!confirm(
        'Restaurar esta cópia substituirá os dados actuais. Continuar?'
      )) {
        return;
      }

      db = {
        ...blankDB(),
        ...imported,
        settings: { ...blankDB().settings, ...(imported.settings || {}) }
      };

      document.body.classList.toggle('dark', db.settings.theme === 'dark');
      persist('Cópia de segurança restaurada.');
    } catch {
      notify('Não foi possível restaurar. Verifica o ficheiro JSON.');
    } finally {
      event.target.value = '';
    }
  });

  $('clearData').addEventListener('click', () => {
    if (!confirm(
      'ATENÇÃO: vais apagar alunos, professores, disciplinas, notas, presenças e horários. Esta acção não pode ser desfeita. Continuar?'
    )) return;

    const settings = db.settings;
    db = blankDB();
    db.settings = settings;

    persist('Os registos foram apagados.');
  });

  /* FUNÇÕES DE RENDERIZAÇÃO */

  function renderDashboard() {
    $('totalStudents').textContent = db.students.length;
    $('totalTeachers').textContent = db.teachers.length;
    $('totalSubjects').textContent = db.subjects.length;

    const groups = new Set(db.students.map(student =>
      [student.clazz, student.group, student.room, student.shift].join('|')
    ));

    $('totalClasses').textContent = groups.size;
    $('studentBadge').textContent = db.students.length;
    $('dashboardYear').textContent = db.settings.year;

    const recent = db.students.slice().reverse().slice(0, 5);

    $('recentStudents').innerHTML = recent.length
      ? recent.map(student => `
          <tr>
            <td><strong>${escapeHTML(student.name)}</strong></td>
            <td>${escapeHTML(student.number)}</td>
            <td>${escapeHTML(student.clazz)}</td>
            <td>${escapeHTML(student.group)}</td>
            <td>${escapeHTML(student.shift || '—')}</td>
          </tr>
        `).join('')
      : emptyRow(5, 'Ainda não existem alunos registados.');

    const classes = ['10.ª', '11.ª', '12.ª', '13.ª'];
    const counts = classes.map(clazz =>
      db.students.filter(student => student.clazz === clazz).length
    );

    const max = Math.max(1, ...counts);

    $('classChart').innerHTML = counts.some(count => count > 0)
      ? classes.map((clazz, index) => `
          <div class="chart-row">
            <span class="chart-label">${clazz}</span>
            <div class="chart-track">
              <div class="chart-bar" style="width:${counts[index] / max * 100}%"></div>
            </div>
            <span class="chart-value">${counts[index]}</span>
          </div>
        `).join('')
      : '<div class="empty-chart">Os gráficos aparecerão depois de registares alunos.</div>';
  }

  function renderStudents() {
    const query = $('studentSearch').value.toLowerCase();
    const clazz = $('classFilter').value;

    const records = db.students.filter(student =>
      (!clazz || student.clazz === clazz) &&
      [
        student.name, student.number, student.bi,
        student.phone, student.group, student.room, student.course
      ].some(value => String(value || '').toLowerCase().includes(query))
    );

    $('studentsTable').innerHTML = records.length
      ? records.map(student => `
          <tr>
            <td><strong>${escapeHTML(student.name)}</strong></td>
            <td>${escapeHTML(student.number)}</td>
            <td>${escapeHTML(student.clazz)}</td>
            <td>${escapeHTML(student.group)}</td>
            <td>${escapeHTML(student.room)}</td>
            <td>${statusPill(student.status)}</td>
            <td>${actionButtons('student', student.id)}</td>
          </tr>
        `).join('')
      : emptyRow(7, 'Nenhum aluno encontrado.');

    $('studentCount').textContent =
      `${records.length} de ${db.students.length} aluno(s)`;
  }

  function renderTeachers() {
    const query = $('teacherSearch').value.toLowerCase();

    const records = db.teachers.filter(teacher =>
      [
        teacher.name, teacher.subject, teacher.number,
        teacher.phone, teacher.email
      ].some(value => String(value || '').toLowerCase().includes(query))
    );

    $('teachersTable').innerHTML = records.length
      ? records.map(teacher => `
          <tr>
            <td><strong>${escapeHTML(teacher.name)}</strong></td>
            <td>${escapeHTML(teacher.subject)}</td>
            <td>${escapeHTML(teacher.number || '—')}</td>
            <td>${escapeHTML(teacher.phone || '—')}</td>
            <td>${escapeHTML(teacher.email || '—')}</td>
            <td>${statusPill(teacher.status)}</td>
            <td>${actionButtons('teacher', teacher.id)}</td>
          </tr>
        `).join('')
      : emptyRow(7, 'Nenhum professor encontrado.');
  }

  function renderSubjects() {
    const query = $('subjectSearch').value.toLowerCase();
    const clazz = $('subjectClassFilter').value;

    const records = db.subjects.filter(subject =>
      (!clazz || subject.clazz === clazz) &&
      [subject.name, subject.code, teacherName(subject.teacherId)]
        .some(value => String(value || '').toLowerCase().includes(query))
    );

    $('subjectsTable').innerHTML = records.length
      ? records.map(subject => `
          <tr>
            <td><strong>${escapeHTML(subject.name)}</strong></td>
            <td>${escapeHTML(subject.code || '—')}</td>
            <td>${escapeHTML(subject.clazz)}</td>
            <td>${escapeHTML(teacherName(subject.teacherId))}</td>
            <td>${Number(subject.hours) || 0} h</td>
            <td>${statusPill(subject.status)}</td>
            <td>${actionButtons('subject', subject.id)}</td>
          </tr>
        `).join('')
      : emptyRow(7, 'Nenhuma disciplina encontrada.');

    $('subjectTotal').textContent = db.subjects.length;
    $('subjectActive').textContent =
      db.subjects.filter(subject => subject.status === 'Activa').length;

    $('subjectHoursTotal').textContent =
      db.subjects
        .filter(subject => subject.status === 'Activa')
        .reduce((sum, subject) => sum + (Number(subject.hours) || 0), 0) + ' h';
  }

  function renderClasses() {
    const classes = ['10.ª', '11.ª', '12.ª', '13.ª'];

    $('classCards').innerHTML = classes.map(clazz => `
      <article class="stat-card">
        <div class="stat-top"><span>${clazz} classe</span><span class="stat-symbol blue-symbol">A</span></div>
        <strong>${db.students.filter(student => student.clazz === clazz).length}</strong>
        <small>Alunos registados</small>
      </article>
    `).join('');

    const map = new Map();

    db.students.forEach(student => {
      const key = [
        student.clazz, student.group, student.room, student.shift || '—'
      ].join('|');

      if (!map.has(key)) {
        map.set(key, {
          clazz: student.clazz,
          group: student.group,
          room: student.room,
          shift: student.shift || '—',
          total: 0
        });
      }

      map.get(key).total++;
    });

    const records = [...map.values()].sort((a, b) =>
      a.clazz.localeCompare(b.clazz, 'pt') ||
      a.group.localeCompare(b.group, 'pt')
    );

    $('classesTable').innerHTML = records.length
      ? records.map(item => `
          <tr>
            <td>${escapeHTML(item.clazz)}</td>
            <td>${escapeHTML(item.group)}</td>
            <td>${escapeHTML(item.room)}</td>
            <td>${escapeHTML(item.shift)}</td>
            <td><strong>${item.total}</strong></td>
          </tr>
        `).join('')
      : emptyRow(5, 'As turmas serão identificadas a partir dos alunos cadastrados.');
  }

  function renderGrades() {
    const query = $('gradeSearch').value.toLowerCase();

    const records = db.grades.filter(grade =>
      `${studentName(grade.studentId)} ${grade.subject} ${grade.term}`
        .toLowerCase().includes(query)
    ).slice().reverse();

    $('gradesTable').innerHTML = records.length
      ? records.map(grade => `
          <tr>
            <td>${escapeHTML(studentName(grade.studentId))}</td>
            <td>${escapeHTML(grade.subject)}</td>
            <td>${escapeHTML(grade.term)}</td>
            <td><strong>${Number(grade.value).toFixed(1).replace('.0', '')}/20</strong></td>
            <td>${statusPill(Number(grade.value) >= 10 ? 'Aprovado' : 'Reprovado')}</td>
            <td>${datePT(grade.date)}</td>
            <td>${actionButtons('grade', grade.id)}</td>
          </tr>
        `).join('')
      : emptyRow(7, 'Nenhuma avaliação registada.');
  }

  function renderAttendance() {
    const query = $('attendanceSearch').value.toLowerCase();

    const records = db.attendance.filter(item =>
      studentName(item.studentId).toLowerCase().includes(query)
    ).slice().reverse();

    $('attendanceTable').innerHTML = records.length
      ? records.map(item => `
          <tr>
            <td>${escapeHTML(studentName(item.studentId))}</td>
            <td>${datePT(item.date)}</td>
            <td>${statusPill(item.status)}</td>
            <td>${escapeHTML(item.note || '—')}</td>
            <td>${actionButtons('attendance', item.id)}</td>
          </tr>
        `).join('')
      : emptyRow(5, 'Nenhuma presença registada.');
  }

  function renderSchedules() {
    const day = $('scheduleDayFilter').value;
    const clazz = $('scheduleClassFilter').value;

    const order = [
      'Segunda-feira', 'Terça-feira', 'Quarta-feira',
      'Quinta-feira', 'Sexta-feira', 'Sábado'
    ];

    const records = db.schedules
      .filter(item =>
        (!day || item.day === day) &&
        (!clazz || item.clazz === clazz)
      )
      .slice()
      .sort((a, b) =>
        order.indexOf(a.day) - order.indexOf(b.day) ||
        a.start.localeCompare(b.start)
      );

    $('scheduleTable').innerHTML = records.length
      ? records.map(item => `
          <tr>
            <td>${escapeHTML(item.day)}</td>
            <td><strong>${escapeHTML(item.start)}–${escapeHTML(item.end)}</strong></td>
            <td>${escapeHTML(item.clazz)} / ${escapeHTML(item.group)}</td>
            <td>${escapeHTML(item.subject)}</td>
            <td>${escapeHTML(item.teacher || '—')}</td>
            <td>${escapeHTML(item.room || '—')}</td>
            <td>${actionButtons('schedule', item.id)}</td>
          </tr>
        `).join('')
      : emptyRow(7, 'Nenhuma aula encontrada.');
  }

  function renderReports() {
    const cards = [
      ['Alunos', db.students.length],
      ['Professores', db.teachers.length],
      ['Disciplinas', db.subjects.length],
      ['Avaliações', db.grades.length],
      ['Registos de presença', db.attendance.length],
      ['Aulas no horário', db.schedules.length]
    ];

    $('reportCards').innerHTML = cards.map(([label, value]) => `
      <article class="stat-card">
        <div class="stat-top"><span>${escapeHTML(label)}</span></div>
        <strong>${value}</strong>
        <small>Registos no sistema</small>
      </article>
    `).join('');
  }

  function renderSettings() {
    $('schoolName').value = db.settings.schoolName || '';
    $('schoolShort').value = db.settings.shortName || '';
    $('schoolYear').value = db.settings.year || '';

    document.title = `${db.settings.shortName || 'ITCL'} — Gestão Escolar`;
  }

  function render() {
    renderDashboard();
    renderStudents();
    renderTeachers();
    refreshSelects();
    renderSubjects();
    renderClasses();
    renderGrades();
    renderAttendance();
    renderSchedules();
    renderReports();
    renderSettings();
  }

  /* DATA E ANO NO CABEÇALHO */

  $('currentDate').textContent = new Intl.DateTimeFormat('pt-AO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  $('footerYear').textContent = new Date().getFullYear();

  document.body.classList.toggle('dark', db.settings.theme === 'dark');

  /* INICIAR */

  render();
})();
