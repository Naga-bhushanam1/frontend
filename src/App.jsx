import { useEffect, useRef, useState } from 'react'
import './App.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/tasks'
const LOCAL_STORAGE_KEY = 'smart_task_manager_tasks'
const THEME_KEY = 'smart_task_theme'

const COLUMNS = [
  { key: 'TODO', label: 'To Do', icon: '📋', accent: 'var(--col-todo-accent)' },
  { key: 'IN_PROGRESS', label: 'In Progress', icon: '⚡', accent: 'var(--col-progress-accent)' },
  { key: 'DONE', label: 'Completed', icon: '✅', accent: 'var(--col-done-accent)' },
]

const DEMO_TASKS = [
  {
    id: 101,
    title: 'Fix urgent payment webhook timeout',
    description: 'Investigate stripe webhook retry storm causing latency spikes on checkout.',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    dueDate: new Date().toISOString().slice(0, 10), // Today
    tag: 'Bug'
  },
  {
    id: 102,
    title: 'Redesign Kanban UI & Drag-Drop',
    description: 'Implement modern glassmorphic theme with fluid card dragging and dark mode.',
    priority: 'HIGH',
    status: 'DONE',
    dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10), // Yesterday
    tag: 'Feature'
  },
  {
    id: 103,
    title: 'Review quarterly architecture roadmap',
    description: 'Sync with core platform team to prioritize microservices decoupling.',
    priority: 'MEDIUM',
    status: 'TODO',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10), // In 2 days
    tag: 'Planning'
  },
  {
    id: 104,
    title: 'Update Spring Boot security dependencies',
    description: 'Bump Spring Boot to latest release and run vulnerability check.',
    priority: 'LOW',
    status: 'TODO',
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
    tag: 'DevOps'
  },
  {
    id: 105,
    title: 'Submit quarterly expense reports',
    description: 'Gather travel and cloud hosting receipts for finance department audit.',
    priority: 'HIGH',
    status: 'TODO',
    dueDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10), // Overdue!
    tag: 'Finance'
  }
]

const EMPTY_FORM = {
  title: '',
  description: '',
  dueDate: '',
  priority: '',
  tag: 'General'
}

// Confetti blast helper
function triggerConfetti() {
  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100vw'
  canvas.style.height = '100vh'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '9999'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const particles = []
  const colors = ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b']

  for (let i = 0; i < 75; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 16,
      vy: Math.random() * -14 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10
    })
  }

  let animationFrame
  const startTime = Date.now()

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach(p => {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.4 // gravity
      p.rotation += p.rotSpeed
      p.alpha = Math.max(0, 1 - (Date.now() - startTime) / 1800)

      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7)
      ctx.restore()
    })

    if (Date.now() - startTime < 1800) {
      animationFrame = requestAnimationFrame(update)
    } else {
      cancelAnimationFrame(animationFrame)
      canvas.remove()
    }
  }

  update()
}

export default function App() {
  /* =========================================
     THEME
     ========================================= */
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(THEME_KEY) || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  /* =========================================
     TASK STATE & STORAGE
     ========================================= */
  const [tasks, setTasks] = useState([])
  const [isBackendConnected, setIsBackendConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [suggestedPriority, setSuggestedPriority] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  /* =========================================
     SEARCH, FILTER & SORT
     ========================================= */
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('DATE_ASC')

  /* =========================================
     DRAG & DROP STATE
     ========================================= */
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [activeDropColumn, setActiveDropColumn] = useState(null)

  /* =========================================
     ALARM & AUDIO
     ========================================= */
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [alarmActive, setAlarmActive] = useState(false)
  const [alarmDismissed, setAlarmDismissed] = useState(false)
  const [alarmPanelOpen, setAlarmPanelOpen] = useState(false)
  const [snoozeUntil, setSnoozeUntil] = useState(null)

  const audioContext = useRef(null)
  const alarmTimer = useRef(null)

  /* =========================================
     LOAD TASKS (BACKEND -> LOCALSTORAGE FALLBACK)
     ========================================= */
  async function loadTasks() {
    setLoading(true)
    try {
      const res = await fetch(API, { signal: AbortSignal.timeout(2000) })
      if (!res.ok) throw new Error('Backend HTTP error')
      const data = await res.json()
      setTasks(data)
      setIsBackendConnected(true)
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Backend unavailable: fallback gracefully to LocalStorage
      setIsBackendConnected(false)
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (cached) {
        try {
          setTasks(JSON.parse(cached))
        } catch {
          setTasks([])
        }
      } else {
        // First-time users see demo data for instant delight
        setTasks(DEMO_TASKS)
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEMO_TASKS))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  // Sync to local storage whenever tasks change
  useEffect(() => {
    if (!loading && tasks.length >= 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks))
    }
  }, [tasks, loading])

  /* =========================================
     SAVE TASK (CREATE OR UPDATE)
     ========================================= */
  async function handleSaveTask(e) {
    e.preventDefault()
    if (!form.title.trim()) return

    const finalPriority = form.priority || suggestedPriority || 'MEDIUM'
    const taskPayload = {
      ...form,
      priority: finalPriority,
      dueDate: form.dueDate || null,
      status: editId ? tasks.find(t => t.id === editId)?.status || 'TODO' : 'TODO'
    }

    if (isBackendConnected) {
      try {
        if (editId) {
          const old = tasks.find(t => t.id === editId)
          const res = await fetch(`${API}/${editId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...old, ...taskPayload })
          })
          if (res.ok) {
            const updated = await res.json()
            setTasks(prev => prev.map(t => (t.id === editId ? updated : t)))
          }
        } else {
          const res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskPayload)
          })
          if (res.ok) {
            const created = await res.json()
            setTasks(prev => [created, ...prev])
          }
        }
      } catch {
        // Fallback local update
        saveLocally(taskPayload)
      }
    } else {
      saveLocally(taskPayload)
    }

    setForm(EMPTY_FORM)
    setEditId(null)
    setSuggestedPriority(null)
    setIsFormOpen(false)
  }

  function saveLocally(taskPayload) {
    if (editId) {
      setTasks(prev => prev.map(t => (t.id === editId ? { ...t, ...taskPayload, id: editId } : t)))
    } else {
      const newTask = {
        ...taskPayload,
        id: Date.now()
      }
      setTasks(prev => [newTask, ...prev])
    }
  }

  /* =========================================
     MOVE TASK / STATUS CHANGE
     ========================================= */
  async function moveTask(task, newStatus) {
    if (task.status === newStatus) return

    if (newStatus === 'DONE') {
      triggerConfetti()
    }

    const updatedTask = { ...task, status: newStatus }
    setTasks(prev => prev.map(t => (t.id === task.id ? updatedTask : t)))

    if (isBackendConnected) {
      try {
        await fetch(`${API}/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedTask)
        })
      } catch {
        // Already updated locally in state & localStorage
      }
    }
  }

  /* =========================================
     DELETE TASK
     ========================================= */
  async function deleteTask(id) {
    if (!window.confirm('Delete this task?')) return

    setTasks(prev => prev.filter(t => t.id !== id))
    if (isBackendConnected) {
      try {
        await fetch(`${API}/${id}`, { method: 'DELETE' })
      } catch {
        // ignore
      }
    }
  }

  /* =========================================
     EDIT TASK
     ========================================= */
  function startEdit(t) {
    setEditId(t.id)
    setForm({
      title: t.title || '',
      description: t.description || '',
      dueDate: t.dueDate || '',
      priority: t.priority || '',
      tag: t.tag || 'General'
    })
    setIsFormOpen(true)
    window.scrollTo({ top: 120, behavior: 'smooth' })
  }

  /* =========================================
     SMART AUTO-PRIORITY INFERENCE
     ========================================= */
  function handleTitleChange(e) {
    const val = e.target.value
    setForm(f => ({ ...f, title: val }))

    const lower = val.toLowerCase()
    const highKeywords = ['urgent', 'asap', 'critical', 'emergency', 'deadline', 'blocker', 'crash', 'exam', 'now']
    const lowKeywords = ['minor', 'someday', 'optional', 'trivial', 'later', 'reading']

    if (highKeywords.some(w => lower.includes(w))) {
      setSuggestedPriority('HIGH')
      if (!form.priority) setForm(f => ({ ...f, priority: 'HIGH' }))
    } else if (lowKeywords.some(w => lower.includes(w))) {
      setSuggestedPriority('LOW')
      if (!form.priority) setForm(f => ({ ...f, priority: 'LOW' }))
    } else {
      setSuggestedPriority(null)
    }
  }

  /* =========================================
     DRAG AND DROP HANDLERS
     ========================================= */
  function onDragStart(e, task) {
    setDraggedTaskId(task.id)
    e.dataTransfer.setData('text/plain', String(task.id))
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e, colKey) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (activeDropColumn !== colKey) {
      setActiveDropColumn(colKey)
    }
  }

  function onDragLeave(e, colKey) {
    if (activeDropColumn === colKey) {
      setActiveDropColumn(null)
    }
  }

  function onDrop(e, colKey) {
    e.preventDefault()
    setActiveDropColumn(null)
    const id = draggedTaskId || Number(e.dataTransfer.getData('text/plain'))
    if (!id) return

    const task = tasks.find(t => t.id === id)
    if (task && task.status !== colKey) {
      moveTask(task, colKey)
    }
    setDraggedTaskId(null)
  }

  /* =========================================
     MELODIC CHIME & ALARM SYSTEM
     ========================================= */
  function initAudio() {
    if (!audioContext.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      audioContext.current = new AudioCtx()
    }
    if (audioContext.current.state === 'suspended') {
      audioContext.current.resume()
    }
  }

  function playHarmonicChime() {
    initAudio()
    const ctx = audioContext.current
    if (!ctx) return

    const now = ctx.currentTime
    // Pleasant dual-note marimba chime (E5 -> B5)
    const notes = [659.25, 987.77]

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + idx * 0.12)

      gain.gain.setValueAtTime(0.0001, now + idx * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.45)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + idx * 0.12)
      osc.stop(now + idx * 0.12 + 0.5)
    })
  }

  function enableAlarm() {
    initAudio()
    setAlarmEnabled(true)
    setAlarmDismissed(false)
    if ('Notification' in window) {
      Notification.requestPermission()
    }
    playHarmonicChime()
  }

  function stopAlarm() {
    if (alarmTimer.current) {
      clearInterval(alarmTimer.current)
      alarmTimer.current = null
    }
    setAlarmActive(false)
    setAlarmDismissed(true)
  }

  function snoozeAlarm(minutes = 5) {
    stopAlarm()
    const resumeTime = Date.now() + minutes * 60 * 1000
    setSnoozeUntil(resumeTime)
    setTimeout(() => {
      setAlarmDismissed(false)
      setSnoozeUntil(null)
    }, minutes * 60 * 1000)
  }

  function loadDemoData() {
    setTasks(DEMO_TASKS)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEMO_TASKS))
    triggerConfetti()
  }

  /* =========================================
     CALCULATED METRICS & RELATIVE DATES
     ========================================= */
  const todayStr = new Date().toISOString().slice(0, 10)

  const isOverdue = t => t.dueDate && t.dueDate < todayStr && t.status !== 'DONE'

  const getDueBadgeInfo = dueDate => {
    if (!dueDate) return null
    if (dueDate < todayStr) {
      const diffDays = Math.round((new Date(todayStr) - new Date(dueDate)) / 86400000)
      return { text: `Overdue ${diffDays}d`, className: 'badge-overdue', icon: '⚠️' }
    }
    if (dueDate === todayStr) {
      return { text: 'Due Today', className: 'badge-today', icon: '🔥' }
    }
    const diffDays = Math.round((new Date(dueDate) - new Date(todayStr)) / 86400000)
    if (diffDays === 1) {
      return { text: 'Tomorrow', className: 'badge-soon', icon: '⏳' }
    }
    return { text: `${dueDate.slice(5)}`, className: 'badge-future', icon: '📅' }
  }

  const totalCount = tasks.length
  const doneCount = tasks.filter(t => t.status === 'DONE').length
  const inProgressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length
  const overdueCount = tasks.filter(isOverdue).length
  const dueTodayTasks = tasks.filter(t => t.dueDate === todayStr && t.status !== 'DONE')
  const completionPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  /* Alarm trigger check */
  useEffect(() => {
    if (!alarmEnabled || alarmDismissed || alarmActive) return
    if (snoozeUntil && Date.now() < snoozeUntil) return

    if (overdueCount > 0 || dueTodayTasks.length > 0) {
      playHarmonicChime()
      alarmTimer.current = setInterval(playHarmonicChime, 3500)
      setAlarmActive(true)

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('TaskPulse Alarm', {
          body: overdueCount > 0 ? `⚠️ You have ${overdueCount} overdue task(s)!` : `🔥 ${dueTodayTasks.length} task(s) are due today!`,
          icon: '/favicon.svg'
        })
      }
    }
  }, [alarmEnabled, alarmDismissed, alarmActive, overdueCount, dueTodayTasks.length, snoozeUntil])

  /* =========================================
     FILTER & SORT TASKS
     ========================================= */
  const filteredTasks = tasks
    .filter(t => {
      const q = search.toLowerCase().trim()
      const matchesSearch =
        !q ||
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tag?.toLowerCase().includes(q)

      let matchesFilter = true
      if (filter === 'TODAY') matchesFilter = t.dueDate === todayStr && t.status !== 'DONE'
      if (filter === 'OVERDUE') matchesFilter = isOverdue(t)
      if (filter === 'HIGH') matchesFilter = t.priority === 'HIGH'
      if (filter === 'MEDIUM') matchesFilter = t.priority === 'MEDIUM'
      if (filter === 'LOW') matchesFilter = t.priority === 'LOW'

      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      if (sortBy === 'DATE_ASC') {
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      }
      if (sortBy === 'PRIORITY_DESC') {
        const pOrder = { HIGH: 1, MEDIUM: 2, LOW: 3, '': 4 }
        return (pOrder[a.priority] || 4) - (pOrder[b.priority] || 4)
      }
      if (sortBy === 'TITLE') {
        return a.title.localeCompare(b.title)
      }
      return 0
    })

  return (
    <div className="app-container">
      {/* =========================================
          TOP NAVBAR
          ========================================= */}
      <header className="navbar">
        <div className="nav-brand">
          <div className="brand-logo">
            <span className="logo-pulse"></span>
            ⚡
          </div>
          <div className="brand-text">
            <h1>TaskPulse</h1>
            <p>Smart Workflow & Kanban System</p>
          </div>
        </div>

        <div className="nav-actions">
          {/* Backend / Offline Status badge */}
          <div
            className={`status-pill ${isBackendConnected ? 'online' : 'offline'}`}
            title={isBackendConnected ? 'Connected to Spring Boot API' : 'Backend offline. Changes saved locally.'}
            onClick={loadTasks}
          >
            <span className="status-dot"></span>
            {isBackendConnected ? 'Backend Live' : 'Offline / Local'}
            <button className="sync-btn" title="Retry Connection">🔄</button>
          </div>

          {/* Alarm Control Widget */}
          <div className="alarm-widget-container">
            <button
              className={`nav-btn alarm-toggle ${alarmActive ? 'alarm-ringing' : alarmEnabled ? 'active' : ''}`}
              onClick={() => setAlarmPanelOpen(!alarmPanelOpen)}
              title="Alarm & Sound Reminders"
            >
              {alarmActive ? '🚨' : alarmEnabled ? '🔔' : '🔕'}
              <span className="btn-label">{alarmActive ? 'Alarm Ringing!' : alarmEnabled ? 'Alarm On' : 'Alarm'}</span>
            </button>

            {alarmPanelOpen && (
              <div className="alarm-popover">
                <div className="popover-header">
                  <strong>Smart Audio Reminders</strong>
                  <button className="close-mini" onClick={() => setAlarmPanelOpen(false)}>✕</button>
                </div>
                <p className="popover-desc">
                  Plays harmonic alerts when tasks are due today or overdue.
                </p>

                <div className="popover-buttons">
                  {!alarmEnabled ? (
                    <button className="btn-primary-sm" onClick={enableAlarm}>
                      🔔 Turn On Alarm
                    </button>
                  ) : (
                    <button className="btn-secondary-sm" onClick={() => { stopAlarm(); setAlarmEnabled(false); }}>
                      🔕 Turn Off Alarm
                    </button>
                  )}

                  <button className="btn-outline-sm" onClick={playHarmonicChime}>
                    🎵 Test Sound
                  </button>

                  {alarmActive && (
                    <div className="snooze-group">
                      <button className="btn-danger-sm" onClick={stopAlarm}>
                        🛑 Stop Alarm
                      </button>
                      <button className="btn-warning-sm" onClick={() => snoozeAlarm(5)}>
                        💤 Snooze 5m
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme Switcher */}
          <button className="nav-btn theme-toggle" onClick={toggleTheme} title="Toggle Dark/Light Mode">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>

      {/* =========================================
          MAIN CONTENT WRAPPER
          ========================================= */}
      <main className="main-content">
        {/* Active Alarm Banner */}
        {alarmActive && (
          <div className="alarm-alert-banner">
            <div className="alert-content">
              <span className="alert-icon">⏰</span>
              <div>
                <strong>Attention! Urgent Task Reminder</strong>
                <p>{overdueCount > 0 ? `You have ${overdueCount} overdue task(s)!` : `${dueTodayTasks.length} task(s) are due today!`}</p>
              </div>
            </div>
            <div className="alert-actions">
              <button className="btn-alert-snooze" onClick={() => snoozeAlarm(5)}>Snooze 5m</button>
              <button className="btn-alert-dismiss" onClick={stopAlarm}>Dismiss</button>
            </div>
          </div>
        )}

        {/* METRICS & OVERVIEW CARDS */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-title">Total Tasks</span>
              <span className="metric-icon-wrap" style={{ background: 'var(--accent-primary-light)' }}>📁</span>
            </div>
            <div className="metric-value">{totalCount}</div>
            <div className="metric-caption">Active Kanban items</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-title">In Progress</span>
              <span className="metric-icon-wrap" style={{ background: 'var(--col-progress-light)' }}>⚡</span>
            </div>
            <div className="metric-value">{inProgressCount}</div>
            <div className="metric-caption">Tasks being executed</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-title">Completion Rate</span>
              <span className="metric-icon-wrap" style={{ background: 'var(--col-done-light)' }}>🎯</span>
            </div>
            <div className="metric-value">{completionPercent}%</div>
            <div className="metric-caption">{doneCount} of {totalCount} completed</div>
          </div>

          <div className={`metric-card ${overdueCount > 0 ? 'metric-overdue-alert' : ''}`}>
            <div className="metric-header">
              <span className="metric-title">Overdue</span>
              <span className="metric-icon-wrap" style={{ background: 'var(--p-high-bg)' }}>⚠️</span>
            </div>
            <div className="metric-value" style={{ color: overdueCount > 0 ? 'var(--p-high-text)' : 'inherit' }}>
              {overdueCount}
            </div>
            <div className="metric-caption">
              {overdueCount > 0 ? 'Requires immediate action' : 'All deadlines on track'}
            </div>
          </div>
        </div>

        {/* PROGRESS BAR STRIP */}
        <div className="progress-card">
          <div className="progress-info">
            <div className="progress-label-wrap">
              <strong>Kanban Sprint Progress</strong>
              <span>{doneCount} / {totalCount} tasks completed</span>
            </div>
            <span className="progress-pct-badge">{completionPercent}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${completionPercent}%` }} />
          </div>
        </div>

        {/* CONTROLS BAR: SEARCH, FILTERS, ACTIONS */}
        <div className="toolbar-section">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search tasks, descriptions, or tags..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="clear-btn" onClick={() => setSearch('')}>✕</button>}
          </div>

          <div className="filter-chips">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'TODAY', label: 'Due Today' },
              { id: 'OVERDUE', label: 'Overdue' },
              { id: 'HIGH', label: 'High Priority' },
              { id: 'MEDIUM', label: 'Medium' },
              { id: 'LOW', label: 'Low' }
            ].map(f => (
              <button
                key={f.id}
                className={`filter-chip ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="toolbar-right">
            <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="DATE_ASC">📅 Sort: Due Date</option>
              <option value="PRIORITY_DESC">⚡ Sort: Priority</option>
              <option value="TITLE">🔤 Sort: Title A-Z</option>
            </select>

            <button className="btn-add-trigger" onClick={() => setIsFormOpen(!isFormOpen)}>
              {isFormOpen ? '✕ Close Form' : '+ New Task'}
            </button>

            {tasks.length === 0 && (
              <button className="btn-demo-data" onClick={loadDemoData}>
                ✨ Load Sample Tasks
              </button>
            )}
          </div>
        </div>

        {/* EXPANDABLE TASK CREATION / EDITING FORM */}
        {isFormOpen && (
          <div className="form-card animate-slide-down">
            <div className="form-header">
              <h3>{editId ? '✏️ Edit Task' : '✨ Create New Task'}</h3>
              <p>Type keywords like "urgent" or "asap" to auto-recommend high priority.</p>
            </div>

            <form onSubmit={handleSaveTask} className="task-form-grid">
              <div className="form-group full-width">
                <label>Task Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Deploy urgent bug fix to production server"
                  value={form.title}
                  onChange={handleTitleChange}
                  required
                  autoFocus
                />
                {suggestedPriority && (
                  <span className="smart-tag">
                    ⚡ Auto-detected priority: <b>{suggestedPriority}</b>
                  </span>
                )}
              </div>

              <div className="form-group full-width">
                <label>Description</label>
                <textarea
                  rows="2"
                  placeholder="Add details, links, or notes..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Due Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })}
                />
                <div className="quick-date-pills">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, dueDate: todayStr })}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tmrw = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
                      setForm({ ...form, dueDate: tmrw })
                    }}
                  >
                    Tomorrow
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="">Auto / Default (Medium)</option>
                  <option value="LOW">🟢 Low</option>
                  <option value="MEDIUM">🟡 Medium</option>
                  <option value="HIGH">🔴 High (Urgent)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Tag / Category</label>
                <select
                  value={form.tag}
                  onChange={e => setForm({ ...form, tag: e.target.value })}
                >
                  <option value="General">General</option>
                  <option value="DevOps">DevOps</option>
                  <option value="Bug">Bug</option>
                  <option value="Feature">Feature</option>
                  <option value="Design">Design</option>
                  <option value="Personal">Personal</option>
                </select>
              </div>

              <div className="form-actions full-width">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setForm(EMPTY_FORM)
                    setEditId(null)
                    setIsFormOpen(false)
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editId ? 'Save Changes' : '+ Add to Kanban'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =========================================
            KANBAN BOARD (DRAG & DROP)
            ========================================= */}
        <div className="kanban-board">
          {COLUMNS.map(col => {
            const columnTasks = filteredTasks.filter(t => t.status === col.key)
            const isHovered = activeDropColumn === col.key

            return (
              <div
                key={col.key}
                className={`kanban-column ${isHovered ? 'drag-over-active' : ''}`}
                onDragOver={e => onDragOver(e, col.key)}
                onDragLeave={e => onDragLeave(e, col.key)}
                onDrop={e => onDrop(e, col.key)}
              >
                {/* COLUMN HEADER */}
                <div className="column-header" style={{ borderTopColor: col.accent }}>
                  <div className="column-title">
                    <span className="col-icon">{col.icon}</span>
                    <h3>{col.label}</h3>
                  </div>
                  <span className="column-count-badge">{columnTasks.length}</span>
                </div>

                {/* TASK LIST OR EMPTY STATE */}
                <div className="column-content">
                  {columnTasks.length === 0 ? (
                    <div className="column-empty-state">
                      <div className="empty-icon">{col.key === 'DONE' ? '🎉' : '📂'}</div>
                      <p>{col.key === 'DONE' ? 'No finished tasks yet' : 'Drag tasks here or add one'}</p>
                    </div>
                  ) : (
                    columnTasks.map(task => {
                      const dueInfo = getDueBadgeInfo(task.dueDate)
                      const isTaskOverdue = isOverdue(task)

                      return (
                        <div
                          key={task.id}
                          className={`task-card ${isTaskOverdue ? 'card-overdue' : ''} ${draggedTaskId === task.id ? 'is-dragging' : ''}`}
                          draggable
                          onDragStart={e => onDragStart(e, task)}
                          onDragEnd={() => setDraggedTaskId(null)}
                        >
                          <div className="card-top">
                            <span className="drag-handle" title="Drag to move">⠿</span>
                            <div className="card-tags">
                              {task.tag && <span className="pill-tag">{task.tag}</span>}
                              <span className={`pill-priority ${task.priority || 'MEDIUM'}`}>
                                {task.priority ? task.priority : 'MEDIUM'}
                              </span>
                            </div>
                          </div>

                          <h4 className="card-title">{task.title}</h4>

                          {task.description && (
                            <p className="card-description">{task.description}</p>
                          )}

                          <div className="card-footer">
                            {dueInfo ? (
                              <span className={`due-badge ${dueInfo.className}`}>
                                <span>{dueInfo.icon}</span>
                                {dueInfo.text}
                              </span>
                            ) : (
                              <span className="due-badge badge-none">No date</span>
                            )}

                            {/* MOVE ARROWS & QUICK ACTIONS */}
                            <div className="card-actions">
                              {task.status !== 'TODO' && (
                                <button
                                  className="action-icon-btn"
                                  onClick={() => moveTask(task, task.status === 'DONE' ? 'IN_PROGRESS' : 'TODO')}
                                  title="Move Left"
                                >
                                  ←
                                </button>
                              )}

                              {task.status !== 'DONE' && (
                                <button
                                  className="action-icon-btn"
                                  onClick={() => moveTask(task, task.status === 'TODO' ? 'IN_PROGRESS' : 'DONE')}
                                  title="Move Right"
                                >
                                  →
                                </button>
                              )}

                              <button
                                className="action-icon-btn"
                                onClick={() => startEdit(task)}
                                title="Edit Task"
                              >
                                ✏️
                              </button>

                              <button
                                className="action-icon-btn delete-btn"
                                onClick={() => deleteTask(task.id)}
                                title="Delete Task"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}