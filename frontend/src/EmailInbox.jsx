import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import EmailCompose from './EmailCompose'

const API = import.meta.env.VITE_API_URL || ''

const tabs = [
  { id: 'all',      label: 'Все' },
  { id: 'in',       label: 'Входящие' },
  { id: 'out',      label: 'Исходящие' },
  { id: 'unread',   label: 'Непрочитанные' },
]

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ─────────────────────────── Thread View ────────────────────────────────────

function EmailThread({ message, onClose, onReply }) {
  const [thread, setThread] = useState(null)
  const [loading, setLoading] = useState(true)

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
  }, [message])

  if (!message) return null

  const msgs = thread || []

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, width: '90%', maxWidth: 780,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--inp-border)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
              {message.subject || '(без темы)'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
              {msgs.length} {msgs.length === 1 ? 'письмо' : 'письма'} в треде
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--text3)', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Загрузка...</div>
          ) : msgs.map(m => (
            <div key={m.id} style={{
              borderRadius: 10,
              border: '1px solid var(--inp-border)',
              background: m.direction === 'out' ? 'var(--surface2)' : 'var(--bg)',
              overflow: 'hidden',
            }}>
              {/* Message header */}
              <div style={{
                padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', borderBottom: '1px solid var(--inp-border)',
              }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {m.direction === 'out' ? 'Вы' : (m.from_name || m.from_email || 'Неизвестно')}
                  </span>
                  {m.from_email && m.direction !== 'out' && (
                    <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 6 }}>
                      &lt;{m.from_email}&gt;
                    </span>
                  )}
                  {m.to_email && (
                    <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 2 }}>
                      Кому: {m.to_email}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {formatDate(m.received_at || m.sent_at || m.created_at)}
                </div>
              </div>
              {/* Body */}
              <div style={{ padding: '12px 14px' }}>
                {m.body_html ? (
                  <div
                    style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}
                    dangerouslySetInnerHTML={{ __html: m.body_html }}
                  />
                ) : (
                  <pre style={{
                    fontSize: 14, lineHeight: 1.6, color: 'var(--text)',
                    whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0,
                  }}>{m.body_text || ''}</pre>
                )}
                {m.attachments && m.attachments.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {m.attachments.map((a, i) => (
                      <span key={i} style={{
                        background: 'var(--surface2)', border: '1px solid var(--inp-border)',
                        borderRadius: 6, padding: '3px 10px', fontSize: 12, color: 'var(--text2)',
                      }}>
                        📎 {a.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--inp-border)', display: 'flex', gap: 10 }}>
          <button
            onClick={() => onReply(message)}
            style={{
              background: 'var(--primary)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}
          >
            Ответить
          </button>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid var(--inp-border)', borderRadius: 8,
            padding: '8px 20px', cursor: 'pointer', fontSize: 14, color: 'var(--text)',
          }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}


// ─────────────────────────── Inbox ──────────────────────────────────────────

export default function EmailInbox({ clientId, requestId, compact = false }) {
  const [tab, setTab] = useState('all')
  const [messages, setMessages] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selected, setSelected] = useState(null)
  const [composing, setComposing] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const token = localStorage.getItem('token')
    const params = { limit: 100, offset: 0 }
    if (tab === 'in') params.direction = 'in'
    else if (tab === 'out') params.direction = 'out'
    else if (tab === 'unread') params.is_read = false
    if (clientId) params.client_id = clientId
    if (requestId) params.request_id = requestId
    if (search) params.search = search
    try {
      const r = await axios.get(`${API}/api/email/messages`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      })
      setMessages(r.data.items || [])
      setTotal(r.data.total || 0)
    } catch {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [tab, clientId, requestId, search])

  useEffect(() => { load() }, [load])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    const token = localStorage.getItem('token')
    try {
      const r = await axios.post(`${API}/api/email/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = r.data
      if (d.error) setSyncMsg({ ok: false, text: d.error })
      else setSyncMsg({ ok: true, text: `Получено ${d.synced} новых писем` })
      load()
    } catch (e) {
      setSyncMsg({ ok: false, text: 'Ошибка синхронизации' })
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (id) => {
    const token = localStorage.getItem('token')
    await axios.delete(`${API}/api/email/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    load()
  }

  const handleReply = (msg) => {
    setSelected(null)
    setReplyTo(msg)
    setComposing(true)
  }

  const unread = messages.filter(m => !m.is_read && m.direction === 'in').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: compact ? '100%' : 'calc(100vh - 120px)', minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: compact ? '0 0 12px' : '0 0 16px',
      }}>
        <button
          onClick={() => { setComposing(true); setReplyTo(null) }}
          style={{
            background: 'var(--primary)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          + Написать
        </button>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            background: 'none', border: '1px solid var(--inp-border)', borderRadius: 8,
            padding: '7px 16px', cursor: 'pointer', fontSize: 13, color: 'var(--text)',
          }}
        >
          {syncing ? '⟳ Синхронизация...' : '⟳ Обновить'}
        </button>
        {syncMsg && (
          <span style={{ fontSize: 12, color: syncMsg.ok ? '#2d9a5b' : '#e53e3e' }}>
            {syncMsg.text}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 180, display: 'flex', gap: 6 }}>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }}
            placeholder="Поиск по письмам..."
            style={{
              flex: 1, padding: '7px 12px', border: '1px solid var(--inp-border)',
              borderRadius: 8, background: 'var(--inp-bg)', color: 'var(--text)', fontSize: 13,
            }}
          />
          <button
            onClick={() => setSearch(searchInput)}
            style={{
              border: '1px solid var(--inp-border)', borderRadius: 8, background: 'var(--surface2)',
              padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text)',
            }}
          >
            Найти
          </button>
          {search && (
            <button
              onClick={() => { setSearch(''); setSearchInput('') }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18 }}
            >✕</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--inp-border)', paddingBottom: 1 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              padding: '6px 16px', fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? 'var(--primary)' : 'var(--text3)',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {t.label}
            {t.id === 'unread' && unread > 0 && (
              <span style={{
                background: '#e53e3e', color: '#fff', borderRadius: 10,
                fontSize: 11, padding: '1px 6px', marginLeft: 6,
              }}>{unread}</span>
            )}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', alignSelf: 'center', paddingRight: 4 }}>
          {total} писем
        </span>
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Загрузка...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>
            Писем не найдено
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {messages.map(m => (
              <div
                key={m.id}
                onClick={() => setSelected(m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  background: m.is_read ? 'transparent' : 'var(--surface2)',
                  border: '1px solid transparent',
                  transition: 'border-color .15s, background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--inp-border)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
              >
                {/* Direction badge */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: m.direction === 'out' ? '#dbeafe' : '#dcfce7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>
                  {m.direction === 'out' ? '↗' : '↙'}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{
                      fontWeight: m.is_read ? 400 : 700,
                      fontSize: 13, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280,
                    }}>
                      {m.direction === 'out' ? `→ ${m.to_email || ''}` : (m.from_name || m.from_email || 'Неизвестно')}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, marginLeft: 8 }}>
                      {formatDate(m.received_at || m.sent_at || m.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: m.is_read ? 400 : 600, color: 'var(--text2)', marginTop: 1 }}>
                    {m.subject || '(без темы)'}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--text3)', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {stripHtml(m.body_html) || m.body_text || ''}
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(m.id) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text3)', fontSize: 16, opacity: 0.5, flexShrink: 0,
                  }}
                  title="Удалить"
                >🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Thread modal */}
      {selected && (
        <EmailThread
          message={selected}
          onClose={() => { setSelected(null); load() }}
          onReply={handleReply}
        />
      )}

      {/* Compose modal */}
      {composing && (
        <EmailCompose
          replyTo={replyTo}
          defaultLinkedClientId={clientId}
          defaultLinkedRequestId={requestId}
          onClose={() => { setComposing(false); setReplyTo(null) }}
          onSent={() => { setComposing(false); setReplyTo(null); load() }}
        />
      )}
    </div>
  )
}
