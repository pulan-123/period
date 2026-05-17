const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const PERIODS = ['第1-2节', '第3-4节', '第5-6节', '第7-8节', '第9-10节'];

let timetableData = Array.from({length: WEEKDAYS.length}, () => 
    Array.from({length: PERIODS.length}, () => ({ name: '', location: '' }))
);

let jobsDatabase = {};

let currentDay = 0;
let currentPeriod = 0;

let draggedJobId = null;
let dragOverTrashCount = 0;

let tempCourses = [];

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
    circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
    circle.classList.add('ripple-effect');
    const ripple = button.getElementsByClassName('ripple-effect')[0];
    if (ripple) ripple.remove();
    button.appendChild(circle);
}

function createDeleteParticles(x, y) {
    const colors = ['#ef4444', '#f97316', '#f59e0b', '#eab308'];
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.classList.add('delete-particle');
        const angle = (Math.PI * 2 / 12) * i;
        const distance = 30 + Math.random() * 30;
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 600);
    }
}

function saveAndRefresh() {
    localStorage.setItem('timetableData', JSON.stringify(timetableData));
    localStorage.setItem('jobsDatabase', JSON.stringify(jobsDatabase));
    renderTimetable();
}

function loadData() {
    const savedTimetable = localStorage.getItem('timetableData');
    const savedJobs = localStorage.getItem('jobsDatabase');
    const savedBg = localStorage.getItem('backgroundImage');
    if (savedTimetable) timetableData = JSON.parse(savedTimetable);
    if (savedJobs) jobsDatabase = JSON.parse(savedJobs);
    if (savedBg) document.body.style.backgroundImage = savedBg;
}

function renderTimetable() {
    const header = document.getElementById('tableHeader');
    const body = document.getElementById('tableBody');
    
    header.innerHTML = `<tr><th></th>${WEEKDAYS.map(d => `<th>${d}</th>`).join('')}</tr>`;
    
    body.innerHTML = PERIODS.map((p, pIdx) => `
        <tr>
            <td class="period-col">${p}</td>
            ${WEEKDAYS.map((d, dIdx) => {
                const course = timetableData[dIdx][pIdx];
                const jobKey = `${dIdx}-${pIdx}`;
                const jobs = jobsDatabase[jobKey] || [];
                const completedCount = jobs.filter(j => j.completed).length;
                const content = course.name.trim() ? `
                    <div class="course-card" draggable="true" data-day="${dIdx}" data-period="${pIdx}">
                        <div class="course-info">
                            <div class="course-name">${escapeHtml(course.name)}</div>
                            ${course.location ? `<div class="course-location">📍 ${escapeHtml(course.location)}</div>` : ''}
                        </div>
                        <div class="course-actions">
                            <button class="copy-course-btn" data-day="${dIdx}" data-period="${pIdx}" title="复制课程">➕</button>
                            <button class="delete-course-btn" data-day="${dIdx}" data-period="${pIdx}" title="删除课程">➖</button>
                            <button class="job-btn" data-day="${dIdx}" data-period="${pIdx}">
                                📋 作业 ${jobs.length > 0 ? `<span class="job-count">${completedCount}/${jobs.length}</span>` : '+'}
                            </button>
                        </div>
                    </div>
                ` : `<div class="empty-course" data-day="${dIdx}" data-period="${pIdx}">＋</div>`;
                return `<td class="course-cell" data-day="${dIdx}" data-period="${pIdx}">${content}</td>`;
            }).join('')}
        </tr>
    `).join('');
    
    attachEventListeners();
}

function attachEventListeners() {
    document.querySelectorAll('.copy-course-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            createRipple(e);
            const day = parseInt(btn.dataset.day);
            const period = parseInt(btn.dataset.period);
            copyCourse(day, period);
        });
    });
    
    document.querySelectorAll('.delete-course-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            createRipple(e);
            const day = parseInt(btn.dataset.day);
            const period = parseInt(btn.dataset.period);
            deleteCourse(day, period);
        });
    });
    
    document.querySelectorAll('.job-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            createRipple(e);
            currentDay = parseInt(btn.dataset.day);
            currentPeriod = parseInt(btn.dataset.period);
            openJobsModal();
        });
    });
    
    document.querySelectorAll('.course-cell').forEach(cell => {
        cell.addEventListener('dblclick', () => {
            const day = parseInt(cell.dataset.day);
            const period = parseInt(cell.dataset.period);
            editCourse(day, period);
        });
    });
    
    document.querySelectorAll('.course-card[draggable="true"]').forEach(card => {
        card.addEventListener('dragstart', handleCourseDragStart);
        card.addEventListener('dragend', handleCourseDragEnd);
    });
    
    document.querySelectorAll('.course-cell, .empty-course').forEach(cell => {
        cell.addEventListener('dragover', handleCourseDragOver);
        cell.addEventListener('dragleave', handleCourseDragLeave);
        cell.addEventListener('drop', handleCourseDrop);
    });
}

function copyCourse(day, period) {
    const course = timetableData[day][period];
    if (!course.name.trim()) return;
    
    for (let p = 0; p < PERIODS.length; p++) {
        for (let d = 0; d < WEEKDAYS.length; d++) {
            if (!timetableData[d][p].name.trim()) {
                timetableData[d][p] = {...course};
                const jobKey = `${day}-${period}`;
                const jobs = jobsDatabase[jobKey];
                if (jobs) {
                    jobsDatabase[`${d}-${p}`] = jobs.map(j => ({...j}));
                }
                saveAndRefresh();
                return;
            }
        }
    }
    alert('没有空位可以复制！');
}

function deleteCourse(day, period) {
    if (!confirm('确定删除这门课程吗？相关作业也会被删除。')) return;
    timetableData[day][period] = {name: '', location: ''};
    const jobKey = `${day}-${period}`;
    delete jobsDatabase[jobKey];
    saveAndRefresh();
}

let draggedCourse = null;

function handleCourseDragStart(e) {
    draggedCourse = {
        day: parseInt(e.target.dataset.day),
        period: parseInt(e.target.dataset.period)
    };
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleCourseDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.course-cell, .empty-course').forEach(el => {
        el.classList.remove('drag-over');
    });
    draggedCourse = null;
}

function handleCourseDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleCourseDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleCourseDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    if (!draggedCourse) return;
    
    const targetDay = parseInt(e.currentTarget.dataset.day);
    const targetPeriod = parseInt(e.currentTarget.dataset.period);
    
    if (draggedCourse.day === targetDay && draggedCourse.period === targetPeriod) return;
    
    const tempCourse = {...timetableData[targetDay][targetPeriod]};
    const tempJobKey = `${targetDay}-${targetPeriod}`;
    const tempJobs = jobsDatabase[tempJobKey] ? [...jobsDatabase[tempJobKey]] : null;
    
    timetableData[targetDay][targetPeriod] = {...timetableData[draggedCourse.day][draggedCourse.period]};
    const sourceJobKey = `${draggedCourse.day}-${draggedCourse.period}`;
    if (jobsDatabase[sourceJobKey]) {
        jobsDatabase[tempJobKey] = [...jobsDatabase[sourceJobKey]];
    } else {
        delete jobsDatabase[tempJobKey];
    }
    
    timetableData[draggedCourse.day][draggedCourse.period] = tempCourse;
    if (tempJobs) {
        jobsDatabase[sourceJobKey] = tempJobs;
    } else {
        delete jobsDatabase[sourceJobKey];
    }
    
    saveAndRefresh();
}

function editCourse(day, period) {
    const course = timetableData[day][period];
    const name = prompt('课程名称（留空删除课程）:', course.name);
    if (name === null) return;
    if (name.trim() === '') {
        timetableData[day][period] = {name: '', location: ''};
        const jobKey = `${day}-${period}`;
        delete jobsDatabase[jobKey];
    } else {
        const location = prompt('上课地点:', course.location);
        if (location !== null) {
            timetableData[day][period] = {name: name.trim(), location: location.trim()};
        }
    }
    saveAndRefresh();
}

function openJobsModal() {
    const course = timetableData[currentDay][currentPeriod];
    const modalTitle = document.getElementById('modalTitle');
    modalTitle.textContent = `📝 ${course.name || WEEKDAYS[currentDay]} ${PERIODS[currentPeriod]} 作业`;
    renderJobs();
    document.getElementById('jobsModal').classList.add('active');
}

function closeModal() {
    document.getElementById('jobsModal').classList.remove('active');
    dragOverTrashCount = 0;
    document.getElementById('trashCount').textContent = '0';
}

function renderJobs() {
    const jobKey = `${currentDay}-${currentPeriod}`;
    const jobs = jobsDatabase[jobKey] || [];
    const jobList = document.getElementById('jobList');
    jobList.innerHTML = jobs.map((job, idx) => `
        <li class="job-item" data-id="${job.id}" draggable="true">
            <div class="job-info">
                <input type="checkbox" ${job.completed ? 'checked' : ''} onchange="toggleJob('${jobKey}', ${idx})">
                <span class="job-text ${job.completed ? 'completed' : ''}">${escapeHtml(job.text)}</span>
            </div>
            <button class="delete-job" onclick="deleteJob('${jobKey}', ${idx}, event)">🗑️</button>
        </li>
    `).join('');
    
    document.querySelectorAll('.job-item[draggable="true"]').forEach(item => {
        item.addEventListener('dragstart', handleJobDragStart);
        item.addEventListener('dragend', handleJobDragEnd);
    });
}

function handleJobDragStart(e) {
    draggedJobId = e.target.dataset.id;
    e.target.classList.add('dragging');
    document.getElementById('trashZone').classList.add('visible');
    e.dataTransfer.effectAllowed = 'move';
}

function handleJobDragEnd(e) {
    e.target.classList.remove('dragging');
    document.getElementById('trashZone').classList.remove('visible');
    document.getElementById('trashZone').classList.remove('drag-over');
    draggedJobId = null;
}

document.addEventListener('DOMContentLoaded', () => {
    const trashZone = document.getElementById('trashZone');
    
    trashZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        trashZone.classList.add('drag-over');
    });
    
    trashZone.addEventListener('dragleave', () => {
        trashZone.classList.remove('drag-over');
    });
    
    trashZone.addEventListener('drop', (e) => {
        e.preventDefault();
        trashZone.classList.remove('drag-over');
        if (draggedJobId) {
            const jobKey = `${currentDay}-${currentPeriod}`;
            const jobs = jobsDatabase[jobKey] || [];
            const idx = jobs.findIndex(j => j.id === draggedJobId);
            if (idx !== -1) {
                const jobItem = document.querySelector(`.job-item[data-id="${draggedJobId}"]`);
                if (jobItem) {
                    const rect = jobItem.getBoundingClientRect();
                    createDeleteParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);
                }
                jobItem?.classList.add('fly-out');
                setTimeout(() => {
                    jobs.splice(idx, 1);
                    if (jobs.length === 0) delete jobsDatabase[jobKey];
                    saveAndRefresh();
                    renderJobs();
                    draggedJobId = null;
                }, 400);
            }
        }
    });
});

function addJob() {
    const input = document.getElementById('jobInput');
    const text = input.value.trim();
    if (!text) return;
    const jobKey = `${currentDay}-${currentPeriod}`;
    if (!jobsDatabase[jobKey]) jobsDatabase[jobKey] = [];
    jobsDatabase[jobKey].push({ id: Date.now().toString(), text: text, completed: false });
    input.value = '';
    saveAndRefresh();
    renderJobs();
}

function toggleJob(jobKey, idx) {
    jobsDatabase[jobKey][idx].completed = !jobsDatabase[jobKey][idx].completed;
    saveAndRefresh();
    renderJobs();
}

function deleteJob(jobKey, idx, event) {
    if (event) {
        event.stopPropagation();
        const btn = event.currentTarget;
        const rect = btn.getBoundingClientRect();
        createDeleteParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    jobsDatabase[jobKey].splice(idx, 1);
    if (jobsDatabase[jobKey].length === 0) delete jobsDatabase[jobKey];
    saveAndRefresh();
    renderJobs();
}

document.getElementById('jobInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addJob();
});

document.getElementById('bgInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                const bgUrl = `url(${canvas.toDataURL()})`;
                document.body.style.backgroundImage = bgUrl;
                localStorage.setItem('backgroundImage', bgUrl);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('resetBgBtn').addEventListener('click', (e) => {
    createRipple(e);
    document.body.style.backgroundImage = '';
    localStorage.removeItem('backgroundImage');
});

document.getElementById('exportBtn').addEventListener('click', (e) => {
    createRipple(e);
    const data = { timetableData, jobsDatabase };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule_backup.json';
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('importBtn').addEventListener('click', (e) => {
    createRipple(e);
    document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.timetableData && data.jobsDatabase) {
                    timetableData = data.timetableData;
                    jobsDatabase = data.jobsDatabase;
                    saveAndRefresh();
                    alert('导入成功！');
                } else {
                    alert('文件格式不正确！');
                }
            } catch (err) {
                alert('导入失败：' + err.message);
            }
        };
        reader.readAsText(file);
    }
    e.target.value = '';
});

document.getElementById('resetDataBtn').addEventListener('click', (e) => {
    createRipple(e);
    if (confirm('确定要重置所有数据吗？这会清空所有课程和作业！')) {
        timetableData = Array.from({length: WEEKDAYS.length}, () => 
            Array.from({length: PERIODS.length}, () => ({ name: '', location: '' }))
        );
        jobsDatabase = {};
        saveAndRefresh();
    }
});

document.getElementById('clearAllCoursesBtn').addEventListener('click', (e) => {
    createRipple(e);
    if (confirm('确定清空所有课程吗？')) {
        timetableData = Array.from({length: WEEKDAYS.length}, () => 
            Array.from({length: PERIODS.length}, () => ({ name: '', location: '' }))
        );
        jobsDatabase = {};
        saveAndRefresh();
    }
});

document.getElementById('clearAllJobsBtn').addEventListener('click', (e) => {
    createRipple(e);
    if (confirm('确定清空所有作业吗？')) {
        jobsDatabase = {};
        saveAndRefresh();
    }
});

document.getElementById('textImportBtn').addEventListener('click', (e) => {
    createRipple(e);
    document.getElementById('textImportModal').classList.add('active');
});

function closeTextImportModal() {
    document.getElementById('textImportModal').classList.remove('active');
}

function closeOcrResultModal() {
    document.getElementById('ocrResultModal').classList.remove('active');
}

function importTextSchedule() {
    const text = document.getElementById('textImportArea').value.trim();
    if (!text) {
        alert('请输入课表内容！');
        return;
    }
    
    const courses = parseTextImport(text);
    if (courses.length === 0) {
        alert('未能识别任何课程，请检查格式！');
        return;
    }
    
    let imported = 0;
    courses.forEach(course => {
        if (course.day >= 0 && course.day < WEEKDAYS.length) {
            course.periods.forEach(pIdx => {
                if (pIdx >= 0 && pIdx < PERIODS.length) {
                    timetableData[course.day][pIdx] = {
                        name: course.name,
                        location: course.location
                    };
                    imported++;
                }
            });
        }
    });
    
    saveAndRefresh();
    closeTextImportModal();
    alert(`成功导入 ${imported} 个课程！`);
    document.getElementById('textImportArea').value = '';
}

function parseTextImport(text) {
    const courses = [];
    const lines = text.split('\n').filter(l => l.trim());
    
    const dayMap = {
        '周一': 0, '一': 0, 'Monday': 0, 'Mon': 0,
        '周二': 1, '二': 1, 'Tuesday': 1, 'Tue': 1,
        '周三': 2, '三': 2, 'Wednesday': 2, 'Wed': 2,
        '周四': 3, '四': 3, 'Thursday': 3, 'Thu': 3,
        '周五': 4, '五': 4, 'Friday': 4, 'Fri': 4,
        '周六': 5, '六': 5, 'Saturday': 5, 'Sat': 5,
        '周日': 6, '日': 6, 'Sunday': 6, 'Sun': 6
    };
    
    let currentDay = -1;
    
    for (const line of lines) {
        let day = -1;
        let periods = [];
        let name = '';
        let location = '';
        
        for (const [key, val] of Object.entries(dayMap)) {
            if (line.includes(key)) {
                day = val;
                break;
            }
        }
        
        if (day === -1) day = currentDay;
        if (day !== -1) currentDay = day;
        
        const periodMatches = line.match(/(\d+)[\-~至到—、,，和]{1,2}(\d+)|第?(\d+)-(\d+)节?|(\d+)、(\d+)/g);
        if (periodMatches) {
            for (const match of periodMatches) {
                const nums = match.match(/\d+/g).map(n => parseInt(n));
                if (nums.length >= 2) {
                    const start = Math.min(...nums);
                    const end = Math.max(...nums);
                    for (let i = start; i <= end; i++) {
                        if (i % 2 === 1 && i <= 9) {
                            periods.push(Math.floor((i - 1) / 2));
                        }
                    }
                }
            }
        } else {
            const singlePeriod = line.match(/第?(\d+)[节堂]/);
            if (singlePeriod) {
                const p = parseInt(singlePeriod[1]);
                if (p % 2 === 1 && p <= 9) {
                    periods.push(Math.floor((p - 1) / 2));
                }
            }
        }
        
        const parts = line.split(/\s+/).filter(p => p.trim());
        const possibleNameParts = [];
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (/^[周星期一二三四五六日MonTueWedThuFriSatSun]+/.test(part)) continue;
            if (/^\d+[\-~至到—、,，和]?\d*[节堂]?/.test(part)) continue;
            if (/^教室|^教学楼|^机房|^实验|^楼|^A\d+$|^B\d+$|^C\d+$|^\d+楼|^\d+号/.test(part) && !location) {
                location = part;
                continue;
            }
            possibleNameParts.push(part);
        }
        
        name = possibleNameParts.join(' ').trim();
        
        if (day >= 0 && periods.length > 0 && name) {
            courses.push({ day, periods, name, location });
        }
    }
    
    return courses;
}

document.getElementById('docInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    const fileName = file.name.toLowerCase();
    
    reader.onload = (ev) => {
        let text = '';
        
        if (fileName.endsWith('.txt')) {
            text = ev.target.result;
            processDocumentImport(text);
        } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
            alert('DOC/DOCX格式暂不支持，请使用TXT格式或复制内容到文字导入');
            e.target.value = '';
            return;
        } else if (fileName.endsWith('.pdf')) {
            alert('PDF格式暂不支持，请使用TXT格式或复制内容到文字导入');
            e.target.value = '';
            return;
        } else {
            text = ev.target.result;
            processDocumentImport(text);
        }
    };
    
    reader.onerror = () => {
        alert('读取文件失败，请重试！');
    };
    
    if (fileName.endsWith('.txt')) {
        reader.readAsText(file);
    } else {
        reader.readAsText(file);
    }
});

function processDocumentImport(text) {
    if (!text || !text.trim()) {
        alert('文档内容为空！');
        return;
    }
    
    const courses = parseTextImport(text);
    
    if (courses.length === 0) {
        document.getElementById('textImportArea').value = text;
        document.getElementById('textImportModal').classList.add('active');
        alert('未能自动识别课程，已复制到文字导入，请手动调整');
    } else {
        let imported = 0;
        courses.forEach(course => {
            if (course.day >= 0 && course.day < WEEKDAYS.length) {
                course.periods.forEach(pIdx => {
                    if (pIdx >= 0 && pIdx < PERIODS.length) {
                        timetableData[course.day][pIdx] = {
                            name: course.name,
                            location: course.location
                        };
                        imported++;
                    }
                });
            }
        });
        
        saveAndRefresh();
        alert(`从文档成功导入 ${imported} 个课程！`);
    }
    
    e.target.value = '';
}

document.getElementById('jobsModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeModal();
});

document.getElementById('textImportModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeTextImportModal();
});

document.querySelectorAll('button, .bg-input-label').forEach(el => {
    el.addEventListener('click', createRipple);
});

loadData();
renderTimetable();
