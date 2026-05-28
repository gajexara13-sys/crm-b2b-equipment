import React, { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import EmailCompose from './EmailCompose'

const API = import.meta.env.VITE_API_URL || ''

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const isYesterday = new Date(now - 86400000).toDateString() === d.toDateString()
  if (isToday) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (isYesterday) return 'вчера'
  const isThisYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', ...(isThisYear ? {} : { year: 'numeric' }) })
}

function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name[0].toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

const AVATAR_COLORS = [
  '#4f46e5','#7c3aed','#db2777','#dc2626','#ea580c',
  '#d97706','#16a34a','#0891b2','#0284c7','#6d28d9',
]

function avatarColor(str) {
  if (!str) return AVATAR_COLORS[0]
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
}

function parseAttachments(json) {
  try { return json ? JSON.parse(json) : [] } catch { return [] }
}

// ─── Аватар отправителя ───────────────────────────────────────────────────────

function Avatar({ name, email, size = 36 }) {
  const initials = getInitials(name, email)
  const bg = avatarColor(email || name)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
      userSelect: 'none',
    }}>{initials}</div>
  )
}

// ─── Просмотр треда (правая панель) ──────────────────────────────────────────

function ThreadPane({ message, allMessages, onClose, onReply, onDelete }) {
  const [thread, setThread] = useState(null)
  const [loading, setLoading] = useState(true)
  const bodyRef = useRef(null)

  useEffect(() => {
    if (!message) return
    setLoading(true)
    const token = localStorage.getItem('token')
    axios.get(`${API}/api/email/thread/${encodeURIComponent(message.thread_id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => setThread(r.data)).catch(() => setThread([message])).finally(() => setLoading(false))

    if (!message.is_read && message.direction === 'in') {
      axios.put(`${API}/api/email/messages/${message.id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
  }, [message?.id])

  if (!message) return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text3)', fontSize: 14, gap: 12,
    }}>
      <span style={{ fontSize: 48, opacity: 0.3 }}>✉</span>
      <span>Выберите письмо</span>
    </div>
  )

  const msgs = thread || [message]
  const attachments = msgs.flatMap(m => parseAttachments(m.attachments_json || m.attachments))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      {/* Thread header */}
      <div style={{
        padding: '16px 20px 12px', borderBottom: '1px solid var(--inp-border)',
        display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
            {message.subject || '(без темы)'}
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            {msgs.length} {msgs.length === 1 ? 'письмо' : msgs.length < 5 ? 'письма' : 'писем'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <BtnIcon title="Ответить" onClick={() => onReply(message)}>↩</BtnIcon>
          <BtnIcon title="Удалить" onClick={() => { onDelete(message.id); onClose() }} danger>🗑</BtnIcon>
          <BtnIcon title="Закрыть" onClick={onClose}>✕</BtnIcon>
        </div>
      </div>

      {/* Messages scroll */}
      <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Загрузка...</div>
        ) : msgs.map((m, idx) => (
          <MessageCard key={m.id} m={m} defaultOpen={idx === msgs.length - 1} />
        ))}
      </div>

      {/* Quick reply bar */}
      <QuickReply message={message} onSent={() => {
        const token = localStorage.getItem('token')
        axios.get(`${API}/api/email/thread/${encodeURIComponent(message.thread_id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => setThread(r.data)).catch(() => {})
      }} />
    </div>
  )
}

function MessageCard({ m, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const attachments = parseAttachments(m.attachments_json || m.attachments)

  return (
    <div style={{
      border: '1px solid var(--inp-border)', borderRadius: 10,
      background: 'var(--surface)', overflow: 'hidden',
    }}>
      {/* Card header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center',
          cursor: 'pointer', background: open ? 'transparent' : 'var(--surface2)',
        }}
      >
        <Avatar name={m.direction === 'out' ? 'Я' : (m.from_name || m.from_email)} email={m.from_email} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
            {m.direction === 'out' ? 'Вы (исходящее)' : (m.from_name || m.from_email || 'Неизвестно')}
            {m.from_email && m.direction !== 'out' && (
              <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 12, marginLeft: 6 }}>
                &lt;{m.from_email}&gt;
              </span>
            )}
          </div>
          {!open && (
            <div style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {stripHtml(m.body_html) || m.body_text || ''}
            </div>
          )}
          {open && m.to_email && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              Кому: {m.to_email}
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
          {formatDate(m.received_at || m.sent_at || m.created_at)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Card body */}
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--inp-border)' }}>
          <div style={{ paddingTop: 14 }}>
            {m.body_html ? (
              <div
                style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', wordBreak: 'break-word' }}
                dangerouslySetInnerHTML={{ __html: m.body_html }}
              />
            ) : (
              <pre style={{
                fontSize: 14, lineHeight: 1.7, color: 'var(--text)',
                whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0,
              }}>{m.body_text || ''}</pre>
            )}
          </div>
          {attachments.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {attachments.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--surface2)', border: '1px solid var(--inp-border)',
                  borderRadius: 8, padding: '5px 12px', fontSize: 12, color: 'var(--text2)',
                }}>
                  <span style={{ fontSize: 16 }}>📎</span>
                  <span>{a.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function QuickReply({ message, onSent }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [focused, setFocused] = useState(false)

  const send = async () => {
    if (!text.trim()) return
    setSending(true)
    const token = localStorage.getItem('token')
    try {
      await axios.post(`${API}/api/email/send`, {
        to_emails: [message.from_email],
        subject: message.subject?.startsWith('Re:') ? message.subject : `Re: ${message.subject || ''}`,
        body_text: text,
        linked_client_id: message.linked_client_id,
        linked_request_id: message.linked_request_id,
      }, { headers: { Authorization: `Bearer ${token}` } })
      setText('')
      onSent?.()
    } catch (e) {
      alert(e.response?.data?.detail || 'Ошибка отправки')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      borderTop: '1px solid var(--inp-border)', padding: '12px 16px', flexShrink: 0,
      background: focused ? 'var(--surface)' : 'var(--surface2)',
      transition: 'background .15s',
    }}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') send() }}
        placeholder={`Ответить на письмо... (Ctrl+Enter для отправки)`}
        rows={focused ? 4 : 2}
        style={{
          width: '100%', boxSizing: 'border-box', resize: 'none',
          padding: '10px 12px', border: '1px solid var(--inp-border)',
          borderRadius: 8, background: 'var(--inp-bg)', color: 'var(--text)',
          fontSize: 13, fontFamily: 'inherit', outline: 'none',
          transition: 'height .15s',
        }}
      />
      {(focused || text) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={send} disabled={sending || !text.trim()} style={{
            background: 'var(--primary)', color: '#fff', border: 'none',
            borderRadius: 7, padding: '7px 20px', cursor: sending || !text.trim() ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, opacity: sending || !text.trim() ? 0.6 : 1,
          }}>
            {sending ? 'Отправка...' : '↩ Ответить'}
          </button>
          <button onClick={() => { setText(''); setFocused(false) }} style={{
            background: 'none', border: '1px solid var(--inp-border)', borderRadius: 7,
            padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text3)',
          }}>Отмена</button>
        </div>
      )}
    </div>
  )
}

function BtnIcon({ children, onClick, title, danger }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? (danger ? '#fff5f5' : 'var(--surface2)') : 'none',
        border: 'none', borderRadius: 6, cursor: 'pointer',
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, color: hover && danger ? '#e53e3e' : 'var(--text3)',
        transition: 'background .1s',
      }}
    >{children}</button>
  )
}

// ─── Строка письма в списке ───────────────────────────────────────────────────

function MessageRow({ m, selected, onClick }) {
  const [hover, setHover] = useState(false)
  const isUnread = !m.is_read && m.direction === 'in'
  const attachments = parseAttachments(m.attachments_json || m.attachments)
  const name = m.direction === 'out' ? (m.to_email || 'Вы') : (m.from_name || m.from_email || 'Неизвестно')
  const preview = stripHtml(m.body_html) || m.body_text || ''
  const dateStr = formatDate(m.received_at || m.sent_at || m.created_at)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
        cursor: 'pointer', borderBottom: '1px solid var(--inp-border)',
        background: selected ? 'var(--primary-bg, rgba(24,95,165,0.1))' : hover ? 'var(--surface2)' : 'transparent',
        borderLeft: selected ? '3px solid var(--primary)' : '3px solid transparent',
        transition: 'background .1s',
      }}
    >
      {/* Avatar */}
      <div style={{ paddingTop: 2 }}>
        <Avatar
          name={m.direction === 'out' ? null : (m.from_name || m.from_email)}
          email={m.direction === 'out' ? null : m.from_email}
          size={36}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: Name + date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{
            fontWeight: isUnread ? 700 : 500, fontSize: 13, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8,
          }}>
            {m.direction === 'out' && <span style={{ color: 'var(--text3)', marginRight: 4, fontWeight: 400 }}>→</span>}
            {name}
          </span>
          <span style={{ fontSize: 11, color: isUnread ? 'var(--primary)' : 'var(--text3)', flexShrink: 0, fontWeight: isUnread ? 600 : 400 }}>
            {dateStr}
          </span>
        </div>

        {/* Row 2: Subject */}
        <div style={{
          fontWeight: isUnread ? 700 : 400, fontSize: 13, color: isUnread ? 'var(--text)' : 'var(--text2)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2,
        }}>
          {m.subject || '(без темы)'}
        </div>

        {/* Row 3: Preview + attachments */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 12, color: 'var(--text3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>{preview}</span>
          {attachments.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <span style={{ fontSize: 12 }}>📎</span>
              {attachments.length > 1 && (
                <span style={{
                  fontSize: 10, background: '#e2e8f0', borderRadius: 4,
                  padding: '1px 5px', color: 'var(--text3)', fontWeight: 600,
                }}>{attachments.length}</span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {attachments[0]?.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)',
          flexShrink: 0, marginTop: 14,
        }} />
      )}
    </div>
  )
}

// ─── Левая панель (дерево папок) ─────────────────────────────────────────────

const FOLDERS = [
  { id: 'all',    icon: '📬', label: 'Все письма',    direction: null,  read: null },
  { id: 'in',     icon: '📥', label: 'Входящие',      direction: 'in',  read: null },
  { id: 'out',    icon: '📤', label: 'Отправленные',  direction: 'out', read: null },
  { id: 'unread', icon: '✉',  label: 'Непрочитанные', direction: 'in',  read: false },
]

function FolderTree({ active, onSelect, counts, onCompose }) {
  return (
    <div style={{
      width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--inp-border)', background: 'var(--surface)',
      height: '100%',
    }}>
      {/* Compose */}
      <div style={{ padding: '14px 12px 10px' }}>
        <button
          onClick={onCompose}
          style={{
            width: '100%', padding: '9px 0', background: 'var(--primary)', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          ✏ Написать
        </button>
      </div>

      {/* Folders */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
        {FOLDERS.map(f => {
          const cnt = counts[f.id] || 0
          const isActive = active === f.id
          return (
            <div
              key={f.id}
              onClick={() => onSelect(f.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 10px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                background: isActive ? 'var(--primary-bg, rgba(24,95,165,0.12))' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text2)',
                fontWeight: isActive ? 700 : 400, fontSize: 13,
                transition: 'background .1s',
              }}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{f.icon}</span>
              <span style={{ flex: 1 }}>{f.label}</span>
              {cnt > 0 && (
                <span style={{
                  background: f.id === 'unread' ? 'var(--primary)' : '#e2e8f0',
                  color: f.id === 'unread' ? '#fff' : 'var(--text3)',
                  borderRadius: 10, fontSize: 11, padding: '1px 7px', fontWeight: 700,
                }}>{cnt}</span>
              )}
            </div>
          )
        })}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--inp-border)', margin: '8px 6px' }} />

        {/* Linked clients section label */}
        <div style={{ fontSize: 11, color: 'var(--text4)', padding: '4px 10px 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          По клиентам
        </div>
        <div
          onClick={() => onSelect('linked')}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
            background: active === 'linked' ? 'var(--primary-bg, rgba(24,95,165,0.12))' : 'transparent',
            color: active === 'linked' ? 'var(--primary)' : 'var(--text2)',
            fontWeight: active === 'linked' ? 700 : 400, fontSize: 13,
          }}
        >
          <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>🔗</span>
          <span>Привязанные</span>
        </div>
        <div
          onClick={() => onSelect('unlinked')}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
            background: active === 'unlinked' ? 'var(--primary-bg, rgba(24,95,165,0.12))' : 'transparent',
            color: active === 'unlinked' ? 'var(--primary)' : 'var(--text2)',
            fontWeight: active === 'unlinked' ? 700 : 400, fontSize: 13,
          }}
        >
          <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>📩</span>
          <span>Без привязки</span>
        </div>
      </div>
    </div>
  )
}

// ─── Тулбар списка писем ──────────────────────────────────────────────────────

function ListToolbar({ folder, total, unread, search, onSearch, onSync, syncing, syncMsg }) {
  const [val, setVal] = useState(search)

  const FOLDER_TITLES = {
    all: 'Все письма', in: 'Входящие', out: 'Отправленные',
    unread: 'Непрочитанные', linked: 'Привязанные к клиентам/заявкам',
    unlinked: 'Без привязки',
  }

  return (
    <div style={{
      padding: '10px 12px', borderBottom: '1px solid var(--inp-border)',
      display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap',
    }}>
      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginRight: 4 }}>
        {FOLDER_TITLES[folder] || folder}
      </span>
      {unread > 0 && folder !== 'out' && (
        <span style={{
          background: 'var(--primary)', color: '#fff', borderRadius: 10,
          fontSize: 11, padding: '1px 7px', fontWeight: 700,
        }}>{unread} новых</span>
      )}
      <div style={{ flex: 1, minWidth: 140, display: 'flex', gap: 6 }}>
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSearch(val) }}
          placeholder="Поиск..."
          style={{
            flex: 1, padding: '6px 10px', border: '1px solid var(--inp-border)',
            borderRadius: 7, background: 'var(--inp-bg)', color: 'var(--text)', fontSize: 12, outline: 'none',
          }}
        />
        {val !== search && (
          <button onClick={() => onSearch(val)} style={{
            border: '1px solid var(--inp-border)', borderRadius: 7, background: 'var(--surface2)',
            padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--text)',
          }}>Найти</button>
        )}
        {search && (
          <button onClick={() => { setVal(''); onSearch('') }} style={{
            border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16,
          }}>✕</button>
        )}
      </div>
      <button
        onClick={onSync}
        disabled={syncing}
        title="Синхронизировать входящие"
        style={{
          background: 'none', border: '1px solid var(--inp-border)', borderRadius: 7,
          padding: '6px 10px', cursor: syncing ? 'not-allowed' : 'pointer',
          fontSize: 13, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <span style={{ display: 'inline-block', animation: syncing ? 'spin 1s linear infinite' : 'none', fontSize: 14 }}>⟳</span>
        {syncMsg && <span style={{ fontSize: 11, color: syncMsg.ok ? '#16a34a' : '#e53e3e' }}>{syncMsg.text}</span>}
      </button>
      <span style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{total} писем</span>
    </div>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function EmailInbox({ clientId, requestId, compact = false }) {
  const [folder, setFolder] = useState(clientId ? 'all' : requestId ? 'all' : 'in')
  const [messages, setMessages] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [composing, setComposing] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

  // Counts per folder
  const [counts, setCounts] = useState({})

  const buildParams = useCallback((f, s) => {
    const params = { limit: 100, offset: 0 }
    if (clientId) params.client_id = clientId
    if (requestId) params.request_id = requestId
    if (s) params.search = s

    if (f === 'in') params.direction = 'in'
    else if (f === 'out') params.direction = 'out'
    else if (f === 'unread') { params.direction = 'in'; params.is_read = false }
    else if (f === 'linked') { /* filter client_id or request_id set */ }
    else if (f === 'unlinked') { params.no_link = true } // not implemented in API, will filter client-side

    return params
  }, [clientId, requestId])

  const load = useCallback(async () => {
    setLoading(true)
    const token = localStorage.getItem('token')
    try {
      const r = await axios.get(`${API}/api/email/messages`, {
        params: buildParams(folder, search),
        headers: { Authorization: `Bearer ${token}` },
      })
      let items = r.data.items || []

      // Client-side filter for 'unlinked'
      if (folder === 'unlinked') {
        items = items.filter(m => !m.linked_client_id && !m.linked_request_id)
      } else if (folder === 'linked') {
        items = items.filter(m => m.linked_client_id || m.linked_request_id)
      }

      setMessages(items)
      setTotal(r.data.total || 0)
    } catch {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [folder, search, buildParams])

  // Load counts for badges
  const loadCounts = useCallback(async () => {
    const token = localStorage.getItem('token')
    const base = { headers: { Authorization: `Bearer ${token}` } }
    const lim = { limit: 1 }
    if (clientId) lim.client_id = clientId
    if (requestId) lim.request_id = requestId
    try {
      const [allR, unreadR] = await Promise.all([
        axios.get(`${API}/api/email/messages`, { params: { ...lim }, ...base }),
        axios.get(`${API}/api/email/messages`, { params: { ...lim, direction: 'in', is_read: false }, ...base }),
      ])
      setCounts({
        all: allR.data.total || 0,
        unread: unreadR.data.total || 0,
      })
    } catch { /* */ }
  }, [clientId, requestId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadCounts() }, [loadCounts])

  const handleSync = async () => {
    setSyncing(true); setSyncMsg(null)
    const token = localStorage.getItem('token')
    try {
      const r = await axios.post(`${API}/api/email/sync`, {}, { headers: { Authorization: `Bearer ${token}` } })
      const d = r.data
      if (d.error) setSyncMsg({ ok: false, text: d.error })
      else setSyncMsg({ ok: true, text: `+${d.synced} писем` })
      load(); loadCounts()
      setTimeout(() => setSyncMsg(null), 4000)
    } catch {
      setSyncMsg({ ok: false, text: 'Ошибка' })
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (id) => {
    const token = localStorage.getItem('token')
    await axios.delete(`${API}/api/email/messages/${id}`, { headers: { Authorization: `Bearer ${token}` } })
    if (selected?.id === id) setSelected(null)
    load(); loadCounts()
  }

  const handleSelect = (m) => {
    setSelected(m)
    // Mark as read locally
    if (!m.is_read) {
      setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, is_read: true } : msg))
      setCounts(c => ({ ...c, unread: Math.max(0, (c.unread || 0) - 1) }))
    }
  }

  const unreadCount = messages.filter(m => !m.is_read && m.direction === 'in').length

  // Compact mode (embedded in client/request card) — simplified layout
  if (compact) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 520, minHeight: 0 }}>
      <CompactInbox
        clientId={clientId} requestId={requestId}
        messages={messages} total={total} loading={loading}
        unread={unreadCount} selected={selected} onSelect={handleSelect}
        search={search} onSearch={setSearch}
        onSync={handleSync} syncing={syncing} syncMsg={syncMsg}
        onDelete={handleDelete}
        composing={composing} replyTo={replyTo}
        onCompose={() => { setComposing(true); setReplyTo(null) }}
        onReply={m => { setReplyTo(m); setComposing(true) }}
        onCloseCompose={() => { setComposing(false); setReplyTo(null) }}
        onSent={() => { setComposing(false); setReplyTo(null); load(); loadCounts() }}
      />
    </div>
  )

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)', minHeight: 0, overflow: 'hidden', borderRadius: 10, border: '1px solid var(--inp-border)', background: 'var(--surface)' }}>
      {/* Left: folder tree */}
      <FolderTree
        active={folder}
        onSelect={f => { setFolder(f); setSelected(null) }}
        counts={counts}
        onCompose={() => { setComposing(true); setReplyTo(null) }}
      />

      {/* Middle: message list */}
      <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--inp-border)', minHeight: 0 }}>
        <ListToolbar
          folder={folder} total={total} unread={unreadCount}
          search={search} onSearch={setSearch}
          onSync={handleSync} syncing={syncing} syncMsg={syncMsg}
        />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40, fontSize: 13 }}>Загрузка...</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 60, fontSize: 13 }}>
              <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.3 }}>✉</div>
              Писем нет
            </div>
          ) : messages.map(m => (
            <MessageRow
              key={m.id}
              m={m}
              selected={selected?.id === m.id}
              onClick={() => handleSelect(m)}
            />
          ))}
        </div>
      </div>

      {/* Right: thread/detail */}
      <ThreadPane
        message={selected}
        onClose={() => setSelected(null)}
        onReply={m => { setReplyTo(m); setComposing(true) }}
        onDelete={handleDelete}
      />

      {/* Compose modal */}
      {composing && (
        <EmailCompose
          replyTo={replyTo}
          defaultLinkedClientId={clientId}
          defaultLinkedRequestId={requestId}
          onClose={() => { setComposing(false); setReplyTo(null) }}
          onSent={() => { setComposing(false); setReplyTo(null); load(); loadCounts() }}
        />
      )}
    </div>
  )
}

// ─── Компактный режим (внутри карточек) ──────────────────────────────────────

function CompactInbox({
  messages, total, loading, unread, selected, onSelect,
  search, onSearch, onSync, syncing, syncMsg, onDelete,
  composing, replyTo, onCompose, onReply, onCloseCompose, onSent,
}) {
  const showThread = !!selected

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* Message list */}
      <div style={{ display: showThread ? 'none' : 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Compact toolbar */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--inp-border)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={onCompose} style={{
            background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 7,
            padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>✏ Написать</button>
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Поиск..."
            style={{
              flex: 1, padding: '5px 10px', border: '1px solid var(--inp-border)',
              borderRadius: 7, background: 'var(--inp-bg)', color: 'var(--text)', fontSize: 12, outline: 'none',
            }}
          />
          <button onClick={onSync} disabled={syncing} style={{
            background: 'none', border: '1px solid var(--inp-border)', borderRadius: 7,
            padding: '5px 8px', cursor: 'pointer', fontSize: 14, color: 'var(--text3)',
          }}>⟳</button>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{total}</span>
        </div>
        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 30, fontSize: 13 }}>Загрузка...</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40, fontSize: 13 }}>Писем нет</div>
          ) : messages.map(m => (
            <MessageRow key={m.id} m={m} selected={false} onClick={() => onSelect(m)} />
          ))}
        </div>
      </div>

      {/* Thread pane (compact) */}
      {showThread && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <ThreadPane
            message={selected}
            onClose={() => onSelect(null)}
            onReply={onReply}
            onDelete={onDelete}
          />
        </div>
      )}

      {composing && (
        <EmailCompose
          replyTo={replyTo}
          onClose={onCloseCompose}
          onSent={onSent}
        />
      )}
    </div>
  )
}
