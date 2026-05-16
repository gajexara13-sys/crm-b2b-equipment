import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { STAGES } from './Funnel'
import Modal from './Modal'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use(c => {
  const t = localStorage.getItem('token')
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

// кнопки (как в App.jsx до soft-badge)
const btnT = { fontSize:12, padding:'5px 14px', borderRadius:6, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' }
const btnGreen = { ...btnT, border:'none', background:'#16a34a', color:'#fff' }
const btnRedOutline = { ...btnT, border:'1px solid #fca5a5', background:'#fff', color:'#dc2626' }
const btnRedSolid = { ...btnT, border:'none', background:'#dc2626', color:'#fff' }
const btnGray   = { ...btnT, border:'1px solid var(--border)', background:'#fff', color:'var(--text3)', fontWeight:500 }
const btnPrimary= { padding:'9px 18px', borderRadius:8, fontSize:13, cursor:'pointer', border:'none', background:'#0f172a', color:'#fff', fontWeight:600, whiteSpace:'nowrap', alignSelf:'flex-end' }

const TASK_TYPE_LABELS = {
  call: 'Звонок',
  kp: 'Отправка КП',
  meeting: 'Встреча',
  payment: 'Контроль оплаты',
}
const TYPE_COLORS = {
  call: { bg: '#eff6ff', color: '#2563eb' },
  kp: { bg: '#fef9c3', color: '#854d0e' },
  meeting: { bg: '#f0fdf4', color: '#166534' },
  payment: { bg: '#fdf4ff', color: '#7e22ce' },
}

function stageOf(r) { return r?.stage || 'new_request' }

function defaultDue() {
  const t = new Date()
  t.setDate(t.getDate() + 1)
  t.setHours(12, 0, 0, 0)
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  const hh = String(t.getHours()).padStart(2, '0')
  const mm = String(t.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${hh}:${mm}`
}

function startOfDay(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function groupTasks(tasks) {
  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = startOfDay(addDays(now, 1))
  const dayAfter = startOfDay(addDays(now, 2))
  const dayAfterEnd = startOfDay(addDays(now, 3))

  const overdue = [], todayArr = [], tomorrowArr = [], dayAfterArr = [], future = []

  for (const t of tasks) {
    const d = new Date(t.due_at)
    if (d < today) overdue.push(t)
    else if (d < tomorrow) todayArr.push(t)
    else if (d < dayAfter) tomorrowArr.push(t)
    else if (d < dayAfterEnd) dayAfterArr.push(t)
    else future.push(t)
  }
  return { overdue, today: todayArr, tomorrow: tomorrowArr, dayAfter: dayAfterArr, future }
}

export default function PageTasks({ user }) {
  const [tab, setTab] = useState('active') // 'active' | 'history'
  const [tasks, setTasks] = useState([])
  const [history, setHistory] = useState([])
  const [histFilter, setHistFilter] = useState('all') // 'all' | 'done' | 'fail'
  const [allReqs, setAllReqs] = useState([])
  const [clients, setClients] = useState([])
  const [quick, setQuick] = useState({ request_id: '', task_type: 'call', due_at: defaultDue(), note: '' })
  const [err, setErr] = useState('')
  const [failPending, setFailPending] = useState(null)
  const [sel, setSel] = useState(null)
  const [reqDetail, setReqDetail] = useState(null)
  const [reqTasks, setReqTasks] = useState([])
  const [newTask, setNewTask] = useState({ task_type: 'call', due_at: defaultDue(), note: '' })

  const load = useCallback(() => {
    api.get('/tasks/all').then(r => setTasks(r.data)).catch(() => setTasks([]))
    api.get('/tasks/history').then(r => setHistory(r.data)).catch(() => setHistory([]))
    api.get('/requests').then(r => setAllReqs(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    api.get('/clients').then(r => setClients(r.data)).catch(() => {})
  }, [load])

  const cName = id => clients.find(x => x.id === id)?.name || '—'

  const submitQuick = async e => {
    e.preventDefault()
    if (!quick.request_id || !quick.due_at) return
    setErr('')
    try {
      await api.post('/tasks', {
        request_id: +quick.request_id,
        task_type: quick.task_type,
        due_at: quick.due_at,
        note: quick.note || null,
        assigned_to: user?.id,
      })
      setQuick({ request_id: '', task_type: 'call', due_at: defaultDue(), note: '' })
      load()
    } catch (ex) {
      const d = ex.response?.data?.detail
      setErr(typeof d === 'string' ? d : 'Не удалось создать задачу')
    }
  }

  const completeTask = async id => {
    await api.patch('/tasks/' + id, { completed: true })
    setFailPending(null)
    load()
    if (sel) {
      const tRes = await api.get('/tasks/by-request/' + sel.request_id)
      setReqTasks(tRes.data || [])
    }
  }

  const submitFail = async e => {
    e.preventDefault()
    if (!failPending?.reason?.trim()) return
    const task = tasks.find(t => t.id === failPending.taskId)
    const note = '❌ ' + failPending.reason.trim()
    await api.patch('/tasks/' + failPending.taskId, { completed: true, note })
    setFailPending(null)
    load()
    if (sel && task) {
      const tRes = await api.get('/tasks/by-request/' + task.request_id)
      setReqTasks(tRes.data || [])
    }
  }

  const openDeal = async taskRow => {
    setErr('')
    setSel(taskRow)
    try {
      const [reqRes, tRes] = await Promise.all([
        api.get('/requests/' + taskRow.request_id),
        api.get('/tasks/by-request/' + taskRow.request_id),
      ])
      setReqDetail(reqRes.data)
      setReqTasks(tRes.data || [])
      setNewTask({ task_type: 'call', due_at: defaultDue(), note: '' })
    } catch { setReqDetail(null); setReqTasks([]) }
  }

  const closeModal = () => { setSel(null); setReqDetail(null); setReqTasks([]); setErr('') }

  const addTask = async e => {
    e.preventDefault()
    if (!sel || !newTask.due_at) return
    setErr('')
    try {
      await api.post('/tasks', {
        request_id: sel.request_id,
        task_type: newTask.task_type,
        due_at: newTask.due_at,
        note: newTask.note || null,
        assigned_to: user?.id,
      })
      const tRes = await api.get('/tasks/by-request/' + sel.request_id)
      setReqTasks(tRes.data || [])
      setNewTask({ task_type: 'call', due_at: defaultDue(), note: '' })
      load()
    } catch (ex) {
      const d = ex.response?.data?.detail
      setErr(typeof d === 'string' ? d : 'Не удалось сохранить задачу')
    }
  }

  const moveCard = async (reqId, newStage) => {
    setErr('')
    try {
      const { data } = await api.patch('/requests/' + reqId + '/stage', { stage: newStage })
      setReqDetail(d => d && d.id === reqId ? { ...d, ...data } : d)
      load()
    } catch (ex) {
      const d = ex.response?.data?.detail
      setErr(typeof d === 'string' ? d : 'Нельзя сменить этап без задачи на следующий шаг')
    }
  }

  const groups = groupTasks(tasks)
  const now = Date.now()

  const sections = [
    { key: 'overdue', label: 'Просрочено', accent: '#dc2626', bg: '#fef2f2', icon: '🔴' },
    { key: 'today',   label: 'Сегодня',    accent: '#d97706', bg: '#fffbeb', icon: '⚡' },
    { key: 'tomorrow',label: 'Завтра',     accent: '#2563eb', bg: '#eff6ff', icon: '📅' },
    { key: 'dayAfter',label: 'Послезавтра',accent: '#7c3aed', bg: '#f5f3ff', icon: '📅' },
    { key: 'future',  label: 'Позже',      accent: '#64748b', bg: '#f8fafc', icon: '🗓' },
  ]

  return (
    <div style={{ fontFamily: '-apple-system, sans-serif' }}>
      {/* Заголовок + вкладки */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Задачи</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color:'var(--text3)' }}>
            Все активные задачи по сделкам. Без задачи с дедлайном нельзя сменить этап в воронке.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background:'var(--surface2)', borderRadius: 10, padding: 4 }}>
          {[
            { key: 'active', label: `Активные${tasks.length ? ` (${tasks.length})` : ''}` },
            { key: 'history', label: `История${history.length ? ` (${history.length})` : ''}` },
          ].map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              style={{ padding: '6px 16px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#0f172a' : '#64748b', boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Форма быстрого создания */}
      {tab === 'active' && (<>
      <form onSubmit={submitQuick} style={{ background:'var(--surface)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 10 }}>Запланировать задачу</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 200px 1fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={lbl}>Заявка</label>
            <select value={quick.request_id} onChange={e => setQuick({ ...quick, request_id: e.target.value })} required style={sel_}>
              <option value="">Выберите заявку</option>
              {allReqs.map(rq => (
                <option key={rq.id} value={rq.id}>
                  {rq.number || '#' + rq.id}{!rq.has_active_task ? ' ⚠' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>Тип</label>
            <select value={quick.task_type} onChange={e => setQuick({ ...quick, task_type: e.target.value })} style={sel_}>
              {Object.entries(TASK_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Срок</label>
            <input type="datetime-local" value={quick.due_at} required
              onChange={e => setQuick({ ...quick, due_at: e.target.value })} style={inp_} />
          </div>
          <div>
            <label style={lbl}>Комментарий</label>
            <input value={quick.note} onChange={e => setQuick({ ...quick, note: e.target.value })}
              placeholder="необязательно" style={inp_} />
          </div>
          <button type="submit" style={btnPrimary}>Создать задачу</button>
        </div>
      </form>

      {err && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{err}</div>}

      {/* Секции по датам */}
      {sections.map(sec => {
        const list = groups[sec.key]
        if (!list || list.length === 0) return null
        return (
          <div key={sec.key} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: sec.accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: sec.accent }}>{sec.label}</span>
              <span style={{ background: sec.accent, color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{list.length}</span>
            </div>
            <div style={{ background:'var(--surface)', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {list.map(t => {
                    const tc = TYPE_COLORS[t.task_type] || { bg: '#f8fafc', color: '#334155' }
                    const overdue = new Date(t.due_at).getTime() < now
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', width: 120, whiteSpace: 'nowrap' }}>
                          {overdue && sec.key !== 'overdue' && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#b91c1c', background: '#fee2e2', padding: '2px 5px', borderRadius: 4, marginRight: 6 }}>!</span>
                          )}
                          <span style={{ fontSize: 12, color: overdue ? '#dc2626' : '#64748b' }}>
                            {new Date(t.due_at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', width: 130 }}>
                          <button type="button" onClick={() => openDeal(t)}
                            style={{ background: 'none', border: 'none', padding: 0, fontWeight: 600, fontSize: 13, color: '#185fa5', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                            {t.request_number || '—'}
                          </button>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>
                          {t.client_name || '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: tc.bg, color: tc.color, fontWeight: 600 }}>
                            {TASK_TYPE_LABELS[t.task_type] || t.task_type}
                          </span>
                          {t.note && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{t.note}</span>}
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                          {failPending?.taskId === t.id ? (
                            <form onSubmit={submitFail} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <input
                                autoFocus
                                required
                                placeholder="Причина невыполнения…"
                                value={failPending.reason}
                                onChange={e => setFailPending(p => ({ ...p, reason: e.target.value }))}
                                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fca5a5', fontSize: 12, width: 200 }}
                              />
                              <button type="submit" style={btnRedSolid}>Подтвердить</button>
                              <button type="button" onClick={() => setFailPending(null)} style={btnGray}>✕</button>
                            </form>
                          ) : (
                            <span style={{ display: 'inline-flex', gap: 6, whiteSpace: 'nowrap' }}>
                              <button type="button" onClick={() => completeTask(t.id)} style={btnGreen}>Выполнено</button>
                              <button type="button" onClick={() => setFailPending({ taskId: t.id, reason: '' })} style={btnRedOutline}>Не выполнено</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {tasks.length === 0 && (
        <div style={{ background:'var(--surface)', borderRadius: 12, padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          Активных задач нет — отличная работа.
        </div>
      )}
      </>)}

      {/* История задач */}
      {tab === 'history' && (
        <div>
          {/* Фильтр */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[
              { key: 'all', label: 'Все' },
              { key: 'done', label: '✅ Выполненные' },
              { key: 'fail', label: '❌ Не выполненные' },
            ].map(f => (
              <button key={f.key} type="button" onClick={() => setHistFilter(f.key)}
                style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid ' + (histFilter === f.key ? '#185fa5' : '#e2e8f0'), background: histFilter === f.key ? '#eff6ff' : '#fff', color: histFilter === f.key ? '#185fa5' : '#64748b', fontSize: 13, fontWeight: histFilter === f.key ? 600 : 400, cursor: 'pointer' }}>
                {f.label}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>
              {history.filter(t => histFilter === 'all' ? true : histFilter === 'fail' ? t.note?.startsWith('❌') : !t.note?.startsWith('❌')).length} записей
            </span>
          </div>

          {history.length === 0 ? (
            <div style={{ background:'var(--surface)', borderRadius: 12, padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              История пустая — завершённых задач ещё нет.
            </div>
          ) : (
            <div style={{ background:'var(--surface)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background:'var(--surface2)', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={th}>Завершена</th>
                    <th style={th}>Дедлайн</th>
                    <th style={th}>Заявка</th>
                    <th style={th}>Клиент</th>
                    <th style={th}>Тип</th>
                    <th style={th}>Статус</th>
                    <th style={th}>Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {history
                    .filter(t => {
                      if (histFilter === 'fail') return t.note?.startsWith('❌')
                      if (histFilter === 'done') return !t.note?.startsWith('❌')
                      return true
                    })
                    .map(t => {
                      const isFail = t.note?.startsWith('❌')
                      const tc = TYPE_COLORS[t.task_type] || { bg: '#f8fafc', color: '#334155' }
                      const wasLate = t.due_at && t.completed_at && new Date(t.completed_at) > new Date(t.due_at)
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9', background: isFail ? '#fff9f9' : '#fff' }}>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color:'var(--text3)', fontSize: 12 }}>
                            {new Date(t.completed_at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: 12 }}>
                            <span style={{ color: wasLate ? '#dc2626' : '#64748b' }}>
                              {t.due_at ? new Date(t.due_at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                            {wasLate && <span style={{ fontSize: 10, marginLeft: 5, color: '#dc2626', background: '#fee2e2', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>просрочено</span>}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                            {t.request_number || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569' }}>
                            {t.client_name || '—'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: tc.bg, color: tc.color, fontWeight: 600 }}>
                              {TASK_TYPE_LABELS[t.task_type] || t.task_type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {isFail ? (
                              <span style={{ color: '#dc2626', fontWeight: 600 }}>Не выполнено</span>
                            ) : (
                              <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Выполнено</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', color:'var(--text3)', fontSize: 12 }}>
                            {isFail
                              ? t.note.replace('❌ ', '')
                              : t.note ? t.note : '—'
                            }
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Модалка сделки */}
      {sel && (
        <Modal noConfirm onClose={closeModal} zIndex={1000} maxWidth={520}>
          <div style={{ background:'var(--surface)', borderRadius: 14, padding: '1.5rem', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{sel.request_number || 'Заявка'}</h3>
              <button type="button" onClick={closeModal} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>

            {err && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{err}</div>}

            {reqDetail && (
              <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.7, marginBottom: 14, background:'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
                <div><b>Клиент:</b> {cName(reqDetail.client_id)}</div>
                <div><b>Этап:</b> {STAGES.find(s => s.id === stageOf(reqDetail))?.label || stageOf(reqDetail)}</div>
                {reqDetail.notes && <div><b>Примечание:</b> {reqDetail.notes}</div>}
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 600, color:'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>Этап</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
              {STAGES.map(st => (
                <button key={st.id} type="button" onClick={() => moveCard(sel.request_id, st.id)}
                  style={{ padding: '5px 10px', borderRadius: 7, border: '2px solid ' + (stageOf(reqDetail) === st.id ? st.color : '#e2e8f0'), background: stageOf(reqDetail) === st.id ? st.bg : '#fff', color: stageOf(reqDetail) === st.id ? st.color : '#64748b', fontSize: 11, fontWeight: stageOf(reqDetail) === st.id ? 700 : 500, cursor: 'pointer' }}>
                  {st.label}
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color:'var(--text3)', marginBottom: 8, textTransform: 'uppercase' }}>Задачи по сделке</div>
              {reqTasks.filter(t => !t.completed_at).length === 0 && (
                <p style={{ fontSize: 13, color: '#f97316', margin: '0 0 10px', padding: '8px 10px', background: '#fff7ed', borderRadius: 7, border: '1px solid #fed7aa' }}>
                  ⚠ Нет открытой задачи — сделку нельзя перевести на следующий этап
                </p>
              )}
              <ul style={{ margin: '0 0 12px', paddingLeft: 0, listStyle: 'none' }}>
                {reqTasks.filter(t => !t.completed_at).map(t => (
                  <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '7px 10px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 5 }}>
                    <span>
                      <b>{TASK_TYPE_LABELS[t.task_type] || t.task_type}</b>
                      {t.due_at && <span style={{ color:'var(--text3)', marginLeft: 6 }}>{new Date(t.due_at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                      {t.note && <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 12 }}>— {t.note}</span>}
                    </span>
                    <button type="button" onClick={() => completeTask(t.id)} style={{ ...btnGreen, flexShrink: 0, marginLeft: 8 }}>Выполнено</button>
                  </li>
                ))}
              </ul>

              <form onSubmit={addTask} style={{ background:'var(--surface2)', borderRadius: 10, padding: '12px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Новая задача</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <select value={newTask.task_type} onChange={e => setNewTask({ ...newTask, task_type: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
                      {Object.entries(TASK_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <input type="datetime-local" value={newTask.due_at} required onChange={e => setNewTask({ ...newTask, due_at: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
                  </div>
                  <input placeholder="Комментарий" value={newTask.note} onChange={e => setNewTask({ ...newTask, note: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
                  <button type="submit" style={{ padding: '9px', borderRadius: 8, border: 'none', background: '#185fa5', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Добавить задачу</button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

const lbl = { display: 'block', fontSize: 11, color:'var(--text3)', marginBottom: 4, fontWeight: 500 }
const inp_ = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }
const sel_ = { ...inp_, background: '#fff', cursor: 'pointer' }
const th = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color:'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }
