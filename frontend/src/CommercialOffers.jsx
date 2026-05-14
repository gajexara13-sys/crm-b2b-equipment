import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

/* Комбо-поле: текстовый ввод + выпадающий список вариантов */
function ComboInput({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = opt => { onChange(opt); setOpen(false) }

  return (
    <div ref={wrapRef} style={{ position: 'relative', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--inp-border)', borderRadius: 6, background: 'var(--inp-bg)', overflow: 'hidden' }}>
        <input
          style={{ flex: 1, padding: '8px 10px', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 14, outline: 'none', minWidth: 0 }}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || 'Выберите или введите...'}
        />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{ padding: '0 10px', height: 36, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
        >▾</button>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.10)', marginTop: 3, overflow: 'hidden' }}>
          {options.map((opt, i) => (
            <div
              key={i}
              onMouseDown={() => pick(opt)}
              style={{ padding: '9px 14px', fontSize: 14, color: '#1e293b', cursor: 'pointer', borderBottom: i < options.length - 1 ? '1px solid #f1f5f9' : 'none', background: value === opt ? '#f0f6ff' : '#fff' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = value === opt ? '#f0f6ff' : '#fff'}
            >{opt}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function emptyItem(overrides = {}) {
  return {
    title: '',
    product_id: null,
    model: '',
    country: '',
    intro: '',
    features_text: '',
    kit_text: '',
    specs: [],
    photo_urls: [],
    show_intro: true,
    show_features: true,
    show_kit: true,
    show_specs: true,
    show_photos: true,
    quantity: 1,
    price_without_vat: 0,
    price_with_vat: 0,
    discount_pct: 0,
    discount_amount: 0,
    ...overrides,
  }
}

// ─── Company autocomplete ────────────────────────────────────────────────────
function CompanyAutocomplete({ value, companyName, onSelect }) {
  const [query, setQuery] = useState(companyName || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => { setQuery(companyName || '') }, [companyName])

  const doSearch = q => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const r = await api.get('/crm/quotes/companies/search', { params: { q } })
        setResults(r.data || [])
        setOpen(true)
      } catch (_) {}
    }, q ? 220 : 0)
  }

  const handleChange = e => {
    const q = e.target.value
    setQuery(q)
    doSearch(q)
  }

  const handleFocus = () => {
    if (results.length) { setOpen(true); return }
    doSearch(query)
  }

  const pick = item => {
    setQuery(item.name)
    setOpen(false)
    onSelect(item)
  }

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        style={inp}
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder="Начните вводить название компании…"
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2000,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxHeight: 260, overflowY: 'auto',
        }}>
          {results.map(item => (
            <div
              key={item.id}
              onMouseDown={() => pick(item)}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border2)', fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2, #f1f5f9)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
              {item.contact_full_name && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {item.contact_position ? `${item.contact_position} — ` : ''}{item.contact_full_name}
                </div>
              )}
              {item.address && <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 1 }}>{item.address}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function emptyForm() {
  return {
    id: null,
    number: '',
    quote_date: new Date().toISOString().slice(0, 10),
    sender_profile_id: '',
    recipient_company_id: '',
    recipient_company_name: '',
    recipient_name: '',
    recipient_address: '',
    recipient_contact_name: '',
    recipient_contact_position: '',
    greeting_name: '',
    intro_text: '',
    terms_price_validity: 'Цена действительна в течение 3-х дней.',
    terms_delivery: '',
    terms_lead_time: '',
    terms_payment: '',
    terms_currency_note: '',
    currency: 'RUB',
    vat_rate: 20,
    show_discount_column: true,
    items: [],
  }
}

// ─── Панель редактирования деталей одной позиции ────────────────────────────
function ItemDetailModal({ item, onUpdate, onClose }) {
  const [newParam, setNewParam] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newPhotoUrl, setNewPhotoUrl] = useState('')

  const set = patch => onUpdate({ ...item, ...patch })

  const addSpec = () => {
    if (!newParam.trim() && !newValue.trim()) return
    set({ specs: [...(item.specs || []), { param: newParam, value: newValue }] })
    setNewParam('')
    setNewValue('')
  }

  const updateSpec = (si, field, val) =>
    set({ specs: item.specs.map((s, i) => i === si ? { ...s, [field]: val } : s) })

  const removeSpec = si =>
    set({ specs: item.specs.filter((_, i) => i !== si) })

  const addPhoto = () => {
    if (!newPhotoUrl.trim()) return
    set({ photo_urls: [...(item.photo_urls || []), newPhotoUrl.trim()] })
    setNewPhotoUrl('')
  }

  const updatePhoto = (ui, val) =>
    set({ photo_urls: item.photo_urls.map((x, i) => i === ui ? val : x) })

  const removePhoto = ui =>
    set({ photo_urls: item.photo_urls.filter((_, i) => i !== ui) })

  const sec = {
    marginBottom: 14, padding: '12px 14px',
    background: 'var(--bg, #f8fafc)', borderRadius: 8,
    border: '1px solid var(--border2, #e2e8f0)',
  }
  const checkLbl = {
    display: 'inline-flex', gap: 6, alignItems: 'center',
    fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8, cursor: 'pointer',
  }

  return (
    <Modal onClose={onClose} zIndex={1300} maxWidth={700}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1.25rem', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ margin: 0, color: 'var(--text)', fontSize: 15 }}>Детали позиции: {item.title}</h4>
          <button type="button" onClick={onClose} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text)' }}>✕ Закрыть</button>
        </div>

        {/* Страна */}
        <div style={sec}>
          <label style={lbl}>Страна происхождения</label>
          <input style={inp} value={item.country || ''} onChange={e => set({ country: e.target.value })} placeholder="Россия, Германия…" />
        </div>

        {/* Заголовок / описание */}
        <div style={sec}>
          <label style={checkLbl}>
            <input type="checkbox" checked={item.show_intro !== false} onChange={e => set({ show_intro: e.target.checked })} />
            Описание (показывать в КП)
          </label>
          <textarea style={{ ...inp, minHeight: 90, resize: 'vertical' }} value={item.intro || ''} onChange={e => set({ intro: e.target.value })} placeholder="Краткое описание товара, назначение, применение…" />
        </div>

        {/* Особенности / преимущества */}
        <div style={sec}>
          <label style={checkLbl}>
            <input type="checkbox" checked={item.show_features !== false} onChange={e => set({ show_features: e.target.checked })} />
            Особенности / преимущества (показывать в КП)
          </label>
          <textarea
            style={{ ...inp, minHeight: 80, resize: 'vertical' }}
            value={item.features_text || ''}
            onChange={e => set({ features_text: e.target.value })}
            placeholder={'Каждая строка — отдельный пункт, например:\nВысокая точность измерений\nЗащита IP67\nНебольшие габариты'}
          />
        </div>

        {/* Комплект поставки */}
        <div style={sec}>
          <label style={checkLbl}>
            <input type="checkbox" checked={item.show_kit !== false} onChange={e => set({ show_kit: e.target.checked })} />
            Комплект поставки (показывать в КП)
          </label>
          <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={item.kit_text || ''} onChange={e => set({ kit_text: e.target.value })} placeholder="Что входит в комплект: прибор, кабель, ПО…" />
        </div>

        {/* Технические характеристики */}
        <div style={sec}>
          <label style={checkLbl}>
            <input type="checkbox" checked={item.show_specs !== false} onChange={e => set({ show_specs: e.target.checked })} />
            Технические характеристики (показывать в КП)
          </label>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text3)', fontWeight: 500, width: '45%' }}>Параметр</th>
                <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text3)', fontWeight: 500 }}>Значение</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {(item.specs || []).map((s, si) => (
                <tr key={si} style={{ borderBottom: '1px solid var(--border2, #e2e8f0)' }}>
                  <td style={{ padding: '3px 4px' }}>
                    <input style={{ ...inp, marginBottom: 0, fontSize: 13 }} value={s.param || ''} onChange={e => updateSpec(si, 'param', e.target.value)} placeholder="Диапазон измерений" />
                  </td>
                  <td style={{ padding: '3px 4px' }}>
                    <input style={{ ...inp, marginBottom: 0, fontSize: 13 }} value={s.value || ''} onChange={e => updateSpec(si, 'value', e.target.value)} placeholder="0…100 кПа" />
                  </td>
                  <td style={{ padding: '3px 4px' }}>
                    <button type="button" onClick={() => removeSpec(si)} style={{ padding: '3px 7px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <input style={{ ...inp, marginBottom: 0, fontSize: 13 }} value={newParam} onChange={e => setNewParam(e.target.value)} placeholder="Параметр" onKeyDown={e => e.key === 'Enter' && addSpec()} />
            </div>
            <div style={{ flex: 1 }}>
              <input style={{ ...inp, marginBottom: 0, fontSize: 13 }} value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="Значение" onKeyDown={e => e.key === 'Enter' && addSpec()} />
            </div>
            <button type="button" onClick={addSpec} style={{ padding: '8px 12px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: 8, fontSize: 13 }}>+ Строка</button>
          </div>
        </div>

        {/* Фотографии */}
        <div style={sec}>
          <label style={checkLbl}>
            <input type="checkbox" checked={item.show_photos !== false} onChange={e => set({ show_photos: e.target.checked })} />
            Фотографии (показывать в КП)
          </label>
          {(item.photo_urls || []).map((url, ui) => (
            <div key={ui} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              {url && <img src={url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border2)', flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />}
              <input style={{ ...inp, marginBottom: 0, flex: 1, fontSize: 13 }} value={url} onChange={e => updatePhoto(ui, e.target.value)} placeholder="https://…" />
              <button type="button" onClick={() => removePhoto(ui)} style={{ padding: '4px 8px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input
              style={{ ...inp, marginBottom: 0, flex: 1, fontSize: 13 }}
              value={newPhotoUrl}
              onChange={e => setNewPhotoUrl(e.target.value)}
              placeholder="https://… URL фото"
              onKeyDown={e => e.key === 'Enter' && addPhoto()}
            />
            <button type="button" onClick={addPhoto} style={{ padding: '8px 12px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: 8, fontSize: 13 }}>+ Фото</button>
          </div>
        </div>

        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 24px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: '#fff', fontWeight: 500, cursor: 'pointer' }}>Готово</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Основной компонент ──────────────────────────────────────────────────────
export default function CommercialOffers() {
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [companies, setCompanies] = useState([])
  const [senders, setSenders] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [detailIdx, setDetailIdx] = useState(null)

  const load = useCallback(async () => {
    setErr('')
    setLoading(true)
    try {
      const [q, p, c, s] = await Promise.all([
        api.get('/crm/quotes'),
        api.get('/crm/catalog/products'),
        api.get('/crm/companies'),
        api.get('/crm/quotes/sender-profiles'),
      ])
      setRows(q.data || [])
      setProducts(p.data || [])
      setCompanies(c.data || [])
      setSenders(s.data || [])
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Ошибка загрузки КП')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const subtotal = useMemo(() => {
    return (form.items || []).reduce((sum, i) => {
      const qty = Number(i.quantity) || 0
      const price = Number(i.price_with_vat) || 0
      return sum + qty * price
    }, 0)
  }, [form.items])

  const total = useMemo(() => {
    return (form.items || []).reduce((sum, i) => {
      const qty = Number(i.quantity) || 0
      const price = Number(i.price_with_vat) || 0
      const raw = qty * price
      const pct = Number(i.discount_pct) || 0
      const amount = Number(i.discount_amount) || 0
      return sum + Math.max(raw * (1 - pct / 100) - amount, 0)
    }, 0)
  }, [form.items])

  const openNew = () => {
    setForm(emptyForm())
    setOpen(true)
  }

  const openEdit = q => {
    setForm({
      id: q.id,
      number: q.number || '',
      quote_date: q.quote_date || new Date().toISOString().slice(0, 10),
      sender_profile_id: q.sender_profile_id ? String(q.sender_profile_id) : '',
      recipient_company_id: q.recipient_company_id ? String(q.recipient_company_id) : '',
      recipient_company_name: q.recipient_name || '',
      recipient_name: q.recipient_name || '',
      recipient_address: q.recipient_address || '',
      recipient_contact_name: q.recipient_contact_name || '',
      recipient_contact_position: q.recipient_contact_position || '',
      greeting_name: q.greeting_name || '',
      intro_text: q.intro_text || '',
      terms_price_validity: q.terms_price_validity || '',
      terms_delivery: q.terms_delivery || '',
      terms_lead_time: q.terms_lead_time || '',
      terms_payment: q.terms_payment || '',
      terms_currency_note: q.terms_currency_note || '',
      currency: q.currency || 'RUB',
      vat_rate: q.vat_rate ?? 20,
      show_discount_column: q.show_discount_column !== false,
      items: (q.items || []).map(i => ({
        ...i,
        specs: Array.isArray(i.specs) ? i.specs : [],
        photo_urls: Array.isArray(i.photo_urls) ? i.photo_urls : [],
        show_intro: i.show_intro !== false,
        show_features: i.show_features !== false,
        show_kit: i.show_kit !== false,
        show_specs: i.show_specs !== false,
        show_photos: i.show_photos !== false,
      })),
    })
    setOpen(true)
  }

  // При добавлении товара из каталога — авто-заполняем rich-поля из карточки товара
  const addProduct = id => {
    const p = products.find(x => Number(x.id) === Number(id))
    if (!p) return
    let photo_urls = []
    try { photo_urls = JSON.parse(p.photo_urls_json || '[]') } catch (_) {}
    if (!Array.isArray(photo_urls)) photo_urls = []
    setForm(f => ({
      ...f,
      items: [
        ...f.items,
        emptyItem({
          title: p.name,
          product_id: p.id,
          model: p.sku || '',
          intro: p.description || '',
          features_text: (() => { try { const r = JSON.parse(p.tech_specs || ''); if (Array.isArray(r)) return r.map(x => x.key ? `${x.key}: ${x.value}` : x.value).join('\n') } catch (_) {} return p.tech_specs || '' })(),
          photo_urls,
          price_without_vat: Number(p.recommended_price || 0),
          price_with_vat: Number(p.price_end_vat || p.recommended_price || 0),
        }),
      ],
    }))
  }

  const updateItem = useCallback((idx, patch) => {
    setForm(f => ({ ...f, items: f.items.map((x, i) => i === idx ? { ...x, ...patch } : x) }))
  }, [])

  const save = async () => {
    try {
      const payload = {
        number: form.number || null,
        quote_date: form.quote_date,
        sender_profile_id: form.sender_profile_id ? Number(form.sender_profile_id) : null,
        recipient_company_id: form.recipient_company_id ? Number(form.recipient_company_id) : null,
        recipient_name: form.recipient_name || null,
        recipient_address: form.recipient_address || null,
        recipient_contact_name: form.recipient_contact_name || null,
        recipient_contact_position: form.recipient_contact_position || null,
        greeting_name: form.greeting_name || null,
        intro_text: form.intro_text || null,
        terms_price_validity: form.terms_price_validity || null,
        terms_delivery: form.terms_delivery || null,
        terms_lead_time: form.terms_lead_time || null,
        terms_payment: form.terms_payment || null,
        terms_currency_note: form.terms_currency_note || null,
        currency: form.currency,
        vat_rate: Number(form.vat_rate) || 20,
        show_discount_column: form.show_discount_column,
        items: form.items.map((i, idx) => ({
          sort_order: idx,
          title: i.title,
          product_id: i.product_id || null,
          model: i.model || null,
          country: i.country || null,
          intro: i.intro || null,
          features_text: i.features_text || null,
          kit_text: i.kit_text || null,
          specs: Array.isArray(i.specs) ? i.specs : [],
          photo_urls: Array.isArray(i.photo_urls) ? i.photo_urls : [],
          show_intro: i.show_intro !== false,
          show_features: i.show_features !== false,
          show_kit: i.show_kit !== false,
          show_specs: i.show_specs !== false,
          show_photos: i.show_photos !== false,
          quantity: Number(i.quantity) || 1,
          price_without_vat: Number(i.price_without_vat) || 0,
          price_with_vat: Number(i.price_with_vat) || 0,
          discount_pct: Number(i.discount_pct) || 0,
          discount_amount: Number(i.discount_amount) || 0,
        })),
      }
      if (form.id) await api.put(`/crm/quotes/${form.id}`, payload)
      else await api.post('/crm/quotes', payload)
      setOpen(false)
      await load()
    } catch (e) {
      alert(e.response?.data?.detail || e.message || 'Ошибка сохранения КП')
    }
  }

  const duplicate = async id => {
    await api.post(`/crm/quotes/${id}/duplicate`)
    await load()
  }

  const remove = async id => {
    await api.delete(`/crm/quotes/${id}`)
    await load()
  }

  const downloadExport = async (kind, id, fallbackBase) => {
    const token = localStorage.getItem('token')
    const url = `/api/crm/quotes/${id}/export.${kind}`
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        let detail = await res.text()
        try {
          const j = JSON.parse(detail)
          detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail || j)
        } catch (_) { /* use raw text */ }
        alert(detail || `Ошибка экспорта (${res.status})`)
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition')
      let name = `${fallbackBase}.${kind}`
      if (cd) {
        let m = cd.match(/filename\*=UTF-8''([^;]+)/i)
        if (m) {
          try { name = decodeURIComponent(m[1].trim()) } catch (_) { name = m[1].trim() }
        } else {
          m = cd.match(/filename="([^"]+)"/i) || cd.match(/filename=([^;\s]+)/i)
          if (m) name = m[1].trim()
        }
      }
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u; a.download = name; a.click()
      URL.revokeObjectURL(u)
    } catch (e) {
      alert(e.message || 'Ошибка скачивания')
    }
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '1.25rem', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>Коммерческие предложения</h2>
        <button type="button" onClick={openNew} style={{ padding: '10px 18px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: '#fff', fontWeight: 500, cursor: 'pointer' }}>Создать КП</button>
      </div>
      {err && <div style={{ background: '#fff1f2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {loading ? <p style={{ color: 'var(--text3)' }}>Загрузка…</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>№</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Дата</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Получатель</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Сумма</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Статус</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid var(--border)' }}></th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                <td style={{ padding: '10px', color: 'var(--text)' }}>{r.number || `КП-${r.id}`}</td>
                <td style={{ padding: '10px', color: 'var(--text2)' }}>{r.quote_date || '—'}</td>
                <td style={{ padding: '10px', color: 'var(--text2)' }}>{r.recipient_name || '—'}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text2)' }}>{Number(r.total_with_vat || 0).toLocaleString('ru-RU')}</td>
                <td style={{ padding: '10px', color: 'var(--text2)' }}>{r.status}</td>
                <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <button type="button" onClick={() => downloadExport('docx', r.id, r.number || `KP-${r.id}`)} title="Скачать Word"
                      style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--primary)', borderRadius: 6, background: 'transparent', color: 'var(--primary)', cursor: 'pointer', letterSpacing: '0.03em' }}>
                      DOCX
                    </button>
                    <button type="button" onClick={() => downloadExport('pdf', r.id, r.number || `KP-${r.id}`)} title="Скачать PDF"
                      style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--primary)', borderRadius: 6, background: 'transparent', color: 'var(--primary)', cursor: 'pointer', letterSpacing: '0.03em' }}>
                      PDF
                    </button>
                    <button type="button" onClick={() => openEdit(r)}
                      style={{ padding: '5px 12px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 6, background: 'var(--primary)', color: '#fff', cursor: 'pointer' }}>
                      Изменить
                    </button>
                    <button type="button" onClick={() => duplicate(r.id)}
                      style={{ padding: '5px 12px', fontSize: 13, fontWeight: 500, border: '1.5px solid #64748b', borderRadius: 6, background: 'transparent', color: '#64748b', cursor: 'pointer' }}>
                      Дубль
                    </button>
                    <button type="button" onClick={() => remove(r.id)}
                      style={{ padding: '5px 12px', fontSize: 13, fontWeight: 500, border: '1.5px solid #dc2626', borderRadius: 6, background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ─── Форма создания / редактирования КП ─────────────────────────── */}
      {open && (
        <Modal onClose={() => setOpen(false)} zIndex={1200} maxWidth={980}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1.25rem' }}>
            <h3 style={{ marginTop: 0 }}>{form.id ? 'Редактирование КП' : 'Новое КП'}</h3>

            {/* Шапка */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>Номер</label><input style={inp} value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} /></div>
              <div><label style={lbl}>Дата</label><input type="date" style={inp} value={form.quote_date} onChange={e => setForm(f => ({ ...f, quote_date: e.target.value }))} /></div>
              <div><label style={lbl}>Отправитель</label>
                <select style={inp} value={form.sender_profile_id} onChange={e => {
                  const pid = e.target.value
                  const profile = senders.find(s => String(s.id) === pid)
                  setForm(f => ({
                    ...f,
                    sender_profile_id: pid,
                    intro_text: (profile?.intro_template && !f.intro_text) ? profile.intro_template : f.intro_text,
                  }))
                }}>
                  <option value="">— выберите компанию-отправителя</option>
                  {senders.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Компания-получатель</label>
                <CompanyAutocomplete
                  value={form.recipient_company_id}
                  companyName={form.recipient_company_name}
                  onSelect={item => setForm(f => {
                    const greeting = item.contact_greeting || f.greeting_name
                    const profile = senders.find(s => String(s.id) === f.sender_profile_id)
                    let intro = f.intro_text
                    if (!intro && profile?.intro_template) {
                      intro = profile.intro_template
                    }
                    if (intro && greeting) {
                      intro = intro.replace(/\{greeting_name\}|\[ИМЯ ОТЧЕСТВО\]/g, greeting)
                    }
                    return {
                      ...f,
                      recipient_company_id: String(item.id),
                      recipient_company_name: item.name,
                      recipient_name: item.name,
                      recipient_address: item.address || f.recipient_address,
                      recipient_contact_name: item.contact_dative_short || '',
                      recipient_contact_position: item.contact_position_dative || '',
                      greeting_name: greeting,
                      intro_text: intro,
                    }
                  })}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 6 }}>
              <div>
                <label style={lbl}>Получатель — наименование (в шапку)</label>
                <input style={inp} value={form.recipient_name} onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))} placeholder="ООО «…»" />
              </div>
              <div>
                <label style={lbl}>Обращение (Имя Отчество)</label>
                <input style={inp} value={form.greeting_name} onChange={e => setForm(f => ({ ...f, greeting_name: e.target.value }))} placeholder="Иван Иванович" />
              </div>
              <div>
                <label style={lbl}>Должность руководителя (дательный)</label>
                <input style={inp} value={form.recipient_contact_position} onChange={e => setForm(f => ({ ...f, recipient_contact_position: e.target.value }))} placeholder="Генеральному директору" />
              </div>
              <div>
                <label style={lbl}>Фамилия + инициалы (дательный)</label>
                <input style={inp} value={form.recipient_contact_name} onChange={e => setForm(f => ({ ...f, recipient_contact_name: e.target.value }))} placeholder="Иванову И.И." />
              </div>
            </div>
            <label style={lbl}>Адрес получателя (для шапки КП)</label>
            <textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={form.recipient_address} onChange={e => setForm(f => ({ ...f, recipient_address: e.target.value }))} placeholder="Индекс, город, улица…" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Вводный текст КП</label>
              {form.sender_profile_id && senders.find(s => String(s.id) === form.sender_profile_id)?.intro_template && (
                <button type="button" onClick={() => {
                  const profile = senders.find(s => String(s.id) === form.sender_profile_id)
                  setForm(f => ({ ...f, intro_text: profile.intro_template || '' }))
                }} style={{ fontSize: 11, padding: '2px 10px', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', borderRadius: 4, cursor: 'pointer' }}>
                  ↺ Вставить шаблон
                </button>
              )}
            </div>
            <textarea style={{ ...inp, minHeight: 100, resize: 'vertical' }} value={form.intro_text} onChange={e => setForm(f => ({ ...f, intro_text: e.target.value }))} placeholder="Вводный текст письма (авто-заполняется из профиля отправителя)" />

            {/* Подписант */}
            {form.sender_profile_id && (() => {
              const profile = senders.find(s => String(s.id) === form.sender_profile_id)
              if (!profile) return null
              return (
                <div style={{ background: 'var(--bg2, #f8fafc)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Подпись в документе (из профиля отправителя)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div><span style={{ color: 'var(--text3)', fontSize: 11 }}>Должность: </span><b style={{ color: 'var(--text)' }}>{profile.signer_position || '—'}</b></div>
                    <div><span style={{ color: 'var(--text3)', fontSize: 11 }}>ФИО: </span><b style={{ color: 'var(--text)' }}>{profile.signer_name || '—'}</b></div>
                  </div>
                  {(!profile.signer_name && !profile.signer_position) && (
                    <div style={{ color: '#d97706', fontSize: 11, marginTop: 4 }}>⚠ Добавьте подписанта в справочнике «Профили отправителей»</div>
                  )}
                </div>
              )
            })()}

            {/* Условия */}
            <div style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px', color: 'var(--text)' }}>Условия в конце документа</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>Срок действия цены</label>
                <ComboInput
                  value={form.terms_price_validity}
                  onChange={v => setForm(f => ({ ...f, terms_price_validity: v }))}
                  options={['Цена действительна в течение 3 дней.', 'Цена действительна в течение 5 дней.', 'Цена действительна в течение 10 дней.']}
                />
              </div>
              <div>
                <label style={lbl}>Срок поставки</label>
                <ComboInput
                  value={form.terms_lead_time}
                  onChange={v => setForm(f => ({ ...f, terms_lead_time: v }))}
                  options={['10 рабочих дней', '20 рабочих дней', '30 рабочих дней', '40 рабочих дней', '50 рабочих дней', '60 рабочих дней']}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Условия поставки</label>
                <ComboInput
                  value={form.terms_delivery}
                  onChange={v => setForm(f => ({ ...f, terms_delivery: v }))}
                  options={['Склад поставщика по адресу: г. Уфа, ул. Маршала Жукова, 2А', 'Доставка до адреса покупателя']}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Условия оплаты</label>
                <ComboInput
                  value={form.terms_payment}
                  onChange={v => setForm(f => ({ ...f, terms_payment: v }))}
                  options={['100% предоплата', '30% предоплата, 70% после отгрузки', '40% предоплата, 60% после отгрузки', '50% предоплата, 50% после отгрузки']}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Формулировка про валюту</label>
                <ComboInput
                  value={form.terms_currency_note}
                  onChange={v => setForm(f => ({ ...f, terms_currency_note: v }))}
                  options={['Цены указаны в российских рублях.', 'Цены указаны в казахстанских тенге.', 'Цены указаны в белорусских рублях.']}
                  placeholder="Пусто — будет «Цены указаны в рублях.»"
                />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ ...lbl, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={form.show_discount_column} onChange={e => setForm(f => ({ ...f, show_discount_column: e.target.checked }))} />
                Показывать колонку скидки
              </label>
            </div>

            {/* Позиции */}
            <div style={{ fontSize: 13, fontWeight: 600, margin: '4px 0 8px', color: 'var(--text)' }}>Позиции КП</div>
            <div style={{ marginBottom: 10 }}>
              <select style={{ ...inp, marginBottom: 0, maxWidth: 400 }} defaultValue="" onChange={e => { addProduct(e.target.value); e.target.value = '' }}>
                <option value="">+ Добавить товар из каталога</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
              </select>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
              <thead><tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500 }}>Наименование</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500 }}>Модель</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500 }}>Цена с НДС</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500 }}>Кол-во</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500 }}>Скидка %</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500 }}>Скидка сумма</th>
                <th></th>
              </tr></thead>
              <tbody>
                {form.items.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border2)' }}>
                    <td style={{ padding: '6px 4px' }}>
                      <input style={{ ...inp, marginBottom: 2 }} value={it.title || ''} onChange={e => updateItem(idx, { title: e.target.value })} />
                      {/* Индикаторы заполненности rich-полей */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {it.intro && <span style={{ fontSize: 10, padding: '1px 5px', background: '#dbeafe', color: '#1d4ed8', borderRadius: 3 }}>описание</span>}
                        {it.features_text && <span style={{ fontSize: 10, padding: '1px 5px', background: '#dcfce7', color: '#15803d', borderRadius: 3 }}>особенности</span>}
                        {it.kit_text && <span style={{ fontSize: 10, padding: '1px 5px', background: '#fef9c3', color: '#854d0e', borderRadius: 3 }}>комплект</span>}
                        {(it.specs || []).length > 0 && <span style={{ fontSize: 10, padding: '1px 5px', background: '#f3e8ff', color: '#7e22ce', borderRadius: 3 }}>{it.specs.length} хар-к</span>}
                        {(it.photo_urls || []).length > 0 && <span style={{ fontSize: 10, padding: '1px 5px', background: '#ffedd5', color: '#9a3412', borderRadius: 3 }}>{it.photo_urls.length} фото</span>}
                      </div>
                    </td>
                    <td style={{ padding: '6px 4px' }}><input style={{ ...inp, marginBottom: 0 }} value={it.model || ''} onChange={e => updateItem(idx, { model: e.target.value })} /></td>
                    <td style={{ padding: '6px 4px' }}><input type="number" style={{ ...inp, marginBottom: 0 }} value={it.price_with_vat} onChange={e => updateItem(idx, { price_with_vat: e.target.value })} /></td>
                    <td style={{ padding: '6px 4px' }}><input type="number" style={{ ...inp, marginBottom: 0 }} value={it.quantity} onChange={e => updateItem(idx, { quantity: e.target.value })} /></td>
                    <td style={{ padding: '6px 4px' }}><input type="number" style={{ ...inp, marginBottom: 0 }} value={it.discount_pct || 0} onChange={e => updateItem(idx, { discount_pct: e.target.value })} /></td>
                    <td style={{ padding: '6px 4px' }}><input type="number" style={{ ...inp, marginBottom: 0 }} value={it.discount_amount || 0} onChange={e => updateItem(idx, { discount_amount: e.target.value })} /></td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => setDetailIdx(idx)}
                        style={{ marginRight: 4, padding: '4px 10px', fontSize: 11, border: '1px solid var(--primary)', borderRadius: 4, background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}
                      >
                        Детали
                      </button>
                      <button type="button" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} style={{ padding: '4px 8px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: 'right', marginBottom: 12, color: 'var(--text2)' }}>
              <div>Сумма: <b>{subtotal.toLocaleString('ru-RU')}</b></div>
              <div>Итого со скидкой: <b>{total.toLocaleString('ru-RU')}</b></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setOpen(false)}
                style={{ padding: '9px 18px', fontSize: 13, fontWeight: 500, border: '1.5px solid #64748b', borderRadius: 6, background: 'transparent', color: '#64748b', cursor: 'pointer' }}>
                Отмена
              </button>
              {form.id ? (
                <>
                  <button type="button" onClick={() => downloadExport('docx', form.id, form.number || `KP-${form.id}`)}
                    style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, border: '1.5px solid var(--primary)', borderRadius: 6, background: 'transparent', color: 'var(--primary)', cursor: 'pointer', letterSpacing: '0.03em' }}>
                    Скачать DOCX
                  </button>
                  <button type="button" onClick={() => downloadExport('pdf', form.id, form.number || `KP-${form.id}`)}
                    style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, border: '1.5px solid var(--primary)', borderRadius: 6, background: 'transparent', color: 'var(--primary)', cursor: 'pointer', letterSpacing: '0.03em' }}>
                    Скачать PDF
                  </button>
                </>
              ) : null}
              <button type="button" onClick={save}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, background: 'var(--primary)', color: '#fff', cursor: 'pointer' }}>
                Сохранить КП
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Панель деталей позиции (поверх формы КП) ────────────────────── */}
      {open && detailIdx !== null && form.items[detailIdx] && (
        <ItemDetailModal
          item={form.items[detailIdx]}
          onUpdate={updated => setForm(f => ({ ...f, items: f.items.map((x, i) => i === detailIdx ? updated : x) }))}
          onClose={() => setDetailIdx(null)}
        />
      )}
    </div>
  )
}
