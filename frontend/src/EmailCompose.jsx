import React, { useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || ''

export default function EmailCompose({
  replyTo = null,
  defaultLinkedClientId = null,
  defaultLinkedRequestId = null,
  onClose,
  onSent,
}) {
  const [form, setForm] = useState({
    to: replyTo ? (replyTo.from_email || '') : '',
    cc: '',
    subject: replyTo
      ? (replyTo.subject?.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject || ''}`)
      : '',
    body: '',
    linked_client_id: defaultLinkedClientId || '',
    linked_request_id: defaultLinkedRequestId || '',
  })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const handleSend = async () => {
    if (!form.to.trim()) { setError('Укажите получателя'); return }
    if (!form.subject.trim()) { setError('Укажите тему письма'); return }
    if (!form.body.trim()) { setError('Напишите текст письма'); return }

    setSending(true)
    setError(null)
    const token = localStorage.getItem('token')
    try {
      await axios.post(`${API}/api/email/send`, {
        to_emails: form.to.split(',').map(s => s.trim()).filter(Boolean),
        cc_emails: form.cc ? form.cc.split(',').map(s => s.trim()).filter(Boolean) : null,
        subject: form.subject,
        body_text: form.body,
        linked_client_id: form.linked_client_id ? Number(form.linked_client_id) : null,
        linked_request_id: form.linked_request_id ? Number(form.linked_request_id) : null,
      }, { headers: { Authorization: `Bearer ${token}` } })
      onSent?.()
    } catch (e) {
      const detail = e.response?.data?.detail || 'Ошибка отправки'
      setError(detail)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, width: '90%', maxWidth: 680,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--inp-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>
            {replyTo ? 'Ответить' : 'Новое письмо'}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--text3)',
          }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FieldRow label="Кому">
            <input
              value={form.to}
              onChange={e => set('to', e.target.value)}
              placeholder="email@example.com, email2@example.com"
              style={inpStyle}
            />
          </FieldRow>

          <FieldRow label="Копия">
            <input
              value={form.cc}
              onChange={e => set('cc', e.target.value)}
              placeholder="Необязательно"
              style={inpStyle}
            />
          </FieldRow>

          <FieldRow label="Тема">
            <input
              value={form.subject}
              onChange={e => set('subject', e.target.value)}
              placeholder="Тема письма"
              style={inpStyle}
            />
          </FieldRow>

          <FieldRow label="Клиент ID">
            <input
              type="number"
              value={form.linked_client_id}
              onChange={e => set('linked_client_id', e.target.value)}
              placeholder="ID клиента (необязательно)"
              style={{ ...inpStyle, width: 180 }}
            />
          </FieldRow>

          <FieldRow label="Заявка ID">
            <input
              type="number"
              value={form.linked_request_id}
              onChange={e => set('linked_request_id', e.target.value)}
              placeholder="ID заявки (необязательно)"
              style={{ ...inpStyle, width: 180 }}
            />
          </FieldRow>

          {/* Quote context */}
          {replyTo && (
            <div style={{
              padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8,
              borderLeft: '3px solid var(--primary)', fontSize: 12, color: 'var(--text3)',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Цитата:</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {(replyTo.body_text || '').slice(0, 500)}
                {(replyTo.body_text || '').length > 500 ? '...' : ''}
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Текст</label>
            <textarea
              value={form.body}
              onChange={e => set('body', e.target.value)}
              rows={10}
              placeholder="Текст письма..."
              style={{
                ...inpStyle, width: '100%', resize: 'vertical', minHeight: 180,
                fontFamily: 'inherit', lineHeight: 1.6,
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8,
              padding: '10px 14px', color: '#c53030', fontSize: 13,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--inp-border)',
          display: 'flex', gap: 10,
        }}>
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              background: 'var(--primary)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 24px', cursor: sending ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? 'Отправка...' : '→ Отправить'}
          </button>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid var(--inp-border)', borderRadius: 8,
            padding: '9px 20px', cursor: 'pointer', fontSize: 14, color: 'var(--text)',
          }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <label style={{
        fontSize: 12, color: 'var(--text3)', width: 72, flexShrink: 0, textAlign: 'right',
      }}>{label}</label>
      {children}
    </div>
  )
}

const inpStyle = {
  flex: 1,
  padding: '7px 12px',
  border: '1px solid var(--inp-border)',
  borderRadius: 8,
  background: 'var(--inp-bg)',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}
