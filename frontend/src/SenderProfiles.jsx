import { useEffect, useState } from 'react'
import axios from 'axios'
import Modal from './Modal'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use(c => {
  const t = localStorage.getItem('token')
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

const inp = { width: '100%', padding: '8px 10px', border: '1px solid var(--inp-border)', borderRadius: 6, background: 'var(--inp-bg)', color: 'var(--text)', boxSizing: 'border-box', marginBottom: 8, fontSize: 14 }
const lbl = { display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 4, fontWeight: 500 }

function emptyForm() {
  return {
    id: null,
    name: '',
    legal_form: '',
    legal_name: '',
    legal_address: '',
    tax_number: '',
    kpp: '',
    ogrn: '',
    email: '',
    phone: '',
    website: '',
    signer_name: '',
    signer_position: '',
    intro_template: '',
    logo_url: '',
    signature_url: '',
    stamp_url: '',
    default_currency: 'RUB',
    vat_rate: 20,
    is_active: true,
  }
}

export default function SenderProfiles() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/crm/quotes/sender-profiles')
      setRows(r.data)
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(emptyForm()); setOpen(true) }

  const openEdit = p => {
    setForm({
      id: p.id,
      name: p.name || '',
      legal_form: p.legal_form || '',
      legal_name: p.legal_name || '',
      legal_address: p.legal_address || '',
      tax_number: p.tax_number || '',
      kpp: p.kpp || '',
      ogrn: p.ogrn || '',
      email: p.email || '',
      phone: p.phone || '',
      website: p.website || '',
      signer_name: p.signer_name || '',
      signer_position: p.signer_position || '',
      intro_template: p.intro_template || '',
      logo_url: p.logo_url || '',
      signature_url: p.signature_url || '',
      stamp_url: p.stamp_url || '',
      default_currency: p.default_currency || 'RUB',
      vat_rate: p.vat_rate ?? 20,
      is_active: p.is_active !== false,
    })
    setOpen(true)
  }

  const f = k => e => setForm(prev => ({ ...prev, [k]: e.target.value }))
  const fb = k => e => setForm(prev => ({ ...prev, [k]: e.target.checked }))

  const save = async () => {
    try {
      const payload = {
        name: form.name,
        legal_form: form.legal_form || null,
        legal_name: form.legal_name,
        legal_address: form.legal_address || null,
        tax_number: form.tax_number || null,
        kpp: form.kpp || null,
        ogrn: form.ogrn || null,
        email: form.email || null,
        phone: form.phone || null,
        website: form.website || null,
        signer_name: form.signer_name || null,
        signer_position: form.signer_position || null,
        intro_template: form.intro_template || null,
        logo_url: form.logo_url || null,
        signature_url: form.signature_url || null,
        stamp_url: form.stamp_url || null,
        default_currency: form.default_currency || 'RUB',
        vat_rate: Number(form.vat_rate) || 20,
        is_active: form.is_active,
      }
      if (form.id) await api.put(`/crm/quotes/sender-profiles/${form.id}`, payload)
      else await api.post('/crm/quotes/sender-profiles', payload)
      setOpen(false)
      await load()
    } catch (e) {
      alert(e.response?.data?.detail || e.message || 'Ошибка сохранения')
    }
  }

  const remove = async id => {
    if (!window.confirm('Удалить профиль?')) return
    await api.delete(`/crm/quotes/sender-profiles/${id}`)
    await load()
  }

  const sec = { marginBottom: 16, padding: '12px 14px', background: 'var(--bg2, #f8fafc)', borderRadius: 8, border: '1px solid var(--border2, #e2e8f0)' }
  const secTitle = { fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '1.25rem', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>Профили отправителей</h2>
        <button type="button" onClick={openNew} style={{ padding: '10px 18px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: '#fff', fontWeight: 500, cursor: 'pointer' }}>Добавить профиль</button>
      </div>
      {err && <div style={{ background: '#fff1f2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {loading ? <p style={{ color: 'var(--text3)' }}>Загрузка…</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>
            {['Название', 'Орг.-правовая форма', 'Юр. наименование', 'ИНН', 'Подписант', 'Должность', 'Статус', ''].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                <td style={{ padding: '10px', color: 'var(--text)', fontWeight: 500 }}>{r.name}</td>
                <td style={{ padding: '10px', color: 'var(--text2)' }}>{r.legal_form || '—'}</td>
                <td style={{ padding: '10px', color: 'var(--text2)' }}>{r.legal_name}</td>
                <td style={{ padding: '10px', color: 'var(--text2)' }}>{r.tax_number || '—'}</td>
                <td style={{ padding: '10px', color: 'var(--text2)' }}>{r.signer_name || '—'}</td>
                <td style={{ padding: '10px', color: 'var(--text2)' }}>{r.signer_position || '—'}</td>
                <td style={{ padding: '10px' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: r.is_active ? '#dcfce7' : '#f1f5f9', color: r.is_active ? '#166534' : '#64748b' }}>
                    {r.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </td>
                <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button type="button" onClick={() => openEdit(r)} style={{ marginRight: 8, padding: '4px 12px', border: '1px solid #185fa5', background: '#eff6ff', color: '#185fa5', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>Изменить</button>
                  <button type="button" onClick={() => remove(r.id)} style={{ padding: '4px 12px', border: '1px solid #fecaca', background: '#fff5f5', color: '#dc2626', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>Удалить</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Нет профилей. Добавьте первый.</td></tr>
            )}
          </tbody>
        </table>
      )}

      {open && (
        <Modal onClose={() => setOpen(false)} zIndex={1200} maxWidth={700}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text)' }}>{form.id ? 'Редактирование профиля' : 'Новый профиль'}</h3>

            <div style={sec}>
              <div style={secTitle}>Системное название (для выбора в КП)</div>
              <label style={lbl}>Название профиля *</label>
              <input style={inp} value={form.name} onChange={f('name')} placeholder="РУТЕСТ, QazaqTest, …" />
            </div>

            <div style={sec}>
              <div style={secTitle}>Реквизиты</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Орг.-правовая форма</label>
                  <input style={inp} value={form.legal_form} onChange={f('legal_form')} placeholder="ООО, АО, ИП…" />
                </div>
                <div>
                  <label style={lbl}>Юридическое наименование *</label>
                  <input style={inp} value={form.legal_name} onChange={f('legal_name')} placeholder="РУТЕСТ" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Юридический адрес</label>
                  <textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={form.legal_address} onChange={f('legal_address')} placeholder="123456, г. Москва, ул. …" />
                </div>
                <div>
                  <label style={lbl}>ИНН</label>
                  <input style={inp} value={form.tax_number} onChange={f('tax_number')} />
                </div>
                <div>
                  <label style={lbl}>КПП</label>
                  <input style={inp} value={form.kpp} onChange={f('kpp')} />
                </div>
                <div>
                  <label style={lbl}>ОГРН</label>
                  <input style={inp} value={form.ogrn} onChange={f('ogrn')} />
                </div>
                <div>
                  <label style={lbl}>E-mail</label>
                  <input style={inp} value={form.email} onChange={f('email')} type="email" />
                </div>
                <div>
                  <label style={lbl}>Телефон</label>
                  <input style={inp} value={form.phone} onChange={f('phone')} placeholder="+7 (495) …" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Сайт</label>
                  <input style={inp} value={form.website} onChange={f('website')} placeholder="https://…" />
                </div>
              </div>
            </div>

            <div style={sec}>
              <div style={secTitle}>Подписант</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>ФИО подписанта</label>
                  <input style={inp} value={form.signer_name} onChange={f('signer_name')} placeholder="Иванов Иван Иванович" />
                </div>
                <div>
                  <label style={lbl}>Должность подписанта</label>
                  <input style={inp} value={form.signer_position} onChange={f('signer_position')} placeholder="Генеральный директор" />
                </div>
              </div>
            </div>

            <div style={sec}>
              <div style={secTitle}>Приветственная фраза (авто-заполняется в КП)</div>
              <label style={lbl}>Вводный текст по умолчанию</label>
              <textarea
                style={{ ...inp, minHeight: 100, resize: 'vertical' }}
                value={form.intro_template}
                onChange={f('intro_template')}
                placeholder={'Уважаемый(ая) {{greeting_name}}!\n\nВ ответ на Ваш запрос направляем коммерческое предложение на поставку оборудования.\n\nБудем рады ответить на Ваши вопросы.'}
              />
              <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 2 }}>
                Используйте <b>{'{{greeting_name}}'}</b> — будет заменено на имя и отчество контакта
              </div>
            </div>

            <div style={sec}>
              <div style={secTitle}>Логотип и печати</div>
              {[
                { key: 'logo_url',      label: 'Логотип',  width: 4.0 },
                { key: 'signature_url', label: 'Подпись',  width: 3.5 },
                { key: 'stamp_url',     label: 'Печать',   width: 3.5 },
              ].map(({ key, label }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label style={lbl}>{label}</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      style={{ ...inp, marginBottom: 0, flex: 1 }}
                      value={form[key]}
                      onChange={f(key)}
                      placeholder="Загрузите файл кнопкой →"
                      readOnly
                    />
                    <label style={{
                      padding: '7px 12px', background: 'var(--accent)', color: '#fff',
                      borderRadius: 6, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      Загрузить
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={async e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const fd = new FormData()
                          fd.append('file', file)
                          try {
                            const r = await api.post('/uploads/image', fd)
                            setForm(prev => ({ ...prev, [key]: r.data.url }))
                          } catch {
                            alert('Ошибка загрузки файла')
                          }
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {form[key] && (
                      <img
                        src={form[key]}
                        alt={label}
                        style={{ height: 36, maxWidth: 80, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 4 }}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={sec}>
              <div style={secTitle}>Параметры по умолчанию</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Валюта по умолчанию</label>
                  <select style={inp} value={form.default_currency} onChange={f('default_currency')}>
                    <option value="RUB">RUB — Рубль</option>
                    <option value="KZT">KZT — Тенге</option>
                    <option value="USD">USD — Доллар</option>
                    <option value="EUR">EUR — Евро</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Ставка НДС, %</label>
                  <input style={inp} type="number" min="0" max="100" step="0.01" value={form.vat_rate} onChange={f('vat_rate')} />
                </div>
              </div>
              <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                <input type="checkbox" checked={form.is_active} onChange={fb('is_active')} />
                Активен (виден в списке выбора)
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={() => setOpen(false)} style={{ padding: '9px 20px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', borderRadius: 6, cursor: 'pointer' }}>Отмена</button>
              <button type="button" onClick={save} style={{ padding: '9px 20px', border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>Сохранить</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
