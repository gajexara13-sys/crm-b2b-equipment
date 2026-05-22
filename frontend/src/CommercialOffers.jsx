import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import Modal from './Modal'

function IconDocx({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Лист бумаги */}
      <path d="M2 4C2 2.9 2.9 2 4 2H24L34 12V40C34 41.1 33.1 42 32 42H4C2.9 42 2 41.1 2 40V4Z" fill="white" stroke="#d1d5db" strokeWidth="1"/>
      {/* Загнутый уголок */}
      <path d="M24 2L34 12H26C24.9 12 24 11.1 24 10V2Z" fill="#d1d5db"/>
      {/* Цветная полоса снизу */}
      <rect x="2" y="28" width="32" height="14" rx="0" fill="#2B579A"/>
      <path d="M2 28H34V40C34 41.1 33.1 42 32 42H4C2.9 42 2 41.1 2 40V28Z" fill="#2B579A"/>
      {/* Текст */}
      <text x="18" y="39" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="9" fill="white" letterSpacing="0.4">DOCX</text>
    </svg>
  )
}

function IconPdf({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Лист бумаги */}
      <path d="M2 4C2 2.9 2.9 2 4 2H24L34 12V40C34 41.1 33.1 42 32 42H4C2.9 42 2 41.1 2 40V4Z" fill="white" stroke="#d1d5db" strokeWidth="1"/>
      {/* Загнутый уголок */}
      <path d="M24 2L34 12H26C24.9 12 24 11.1 24 10V2Z" fill="#d1d5db"/>
      {/* Цветная полоса снизу */}
      <path d="M2 28H34V40C34 41.1 33.1 42 32 42H4C2.9 42 2 41.1 2 40V28Z" fill="#D93025"/>
      {/* Текст */}
      <text x="18" y="39" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="10" fill="white" letterSpacing="0.5">PDF</text>
    </svg>
  )
}

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
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background:'var(--surface)', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.10)', marginTop: 3, overflow: 'hidden' }}>
          {options.map((opt, i) => (
            <div
              key={i}
              onMouseDown={() => pick(opt)}
              style={{ padding: '9px 14px', fontSize: 14, color: '#1e293b', cursor: 'pointer', borderBottom: i < options.length - 1 ? '1px solid var(--border2)' : 'none', background: value === opt ? 'var(--primary-bg)' : 'var(--surface)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = value === opt ? 'var(--primary-bg)' : 'var(--surface)'}
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
    service_item_id: null,
    item_kind: 'product',
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

// ─── Request autocomplete ─────────────────────────────────────────────────────
function RequestAutocomplete({ value, requestLabel, onSelect, onClear }) {
  const [query, setQuery] = useState(requestLabel || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => { setQuery(requestLabel || '') }, [requestLabel])

  const doSearch = q => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const r = await api.get('/crm/quotes/requests/search', { params: { q } })
        setResults(r.data || [])
        setOpen(true)
      } catch (_) {}
    }, q ? 220 : 0)
  }

  const handleChange = e => {
    const q = e.target.value
    setQuery(q)
    if (!q) { onClear(); setOpen(false); return }
    doSearch(q)
  }

  const handleFocus = () => {
    if (results.length) { setOpen(true); return }
    doSearch(query)
  }

  const pick = item => {
    setQuery(`${item.number}${item.client_name ? ' — ' + item.client_name : ''}`)
    setOpen(false)
    onSelect(item)
  }

  const STAGE_LABELS = {
    new_request: 'Новая', negotiation: 'Согласование', contract: 'Договор',
    waiting_samples: 'Ожидание проб', in_work: 'В работе',
    waiting_payment: 'Ожидание оплаты', results: 'Результаты', upd: 'УПД',
  }

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          style={{ ...inp, flex: 1, marginBottom: 0 }}
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder="Номер или название клиента…"
          autoComplete="off"
        />
        {value && (
          <button type="button" onClick={() => { setQuery(''); onClear() }}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}>
            ✕
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2000,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxHeight: 280, overflowY: 'auto',
        }}>
          {results.map(item => (
            <div
              key={item.id}
              onMouseDown={() => pick(item)}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border2)', fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{item.number}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg2)', padding: '1px 6px', borderRadius: 3 }}>
                  {STAGE_LABELS[item.stage] || item.stage}
                </span>
              </div>
              {item.client_name && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.client_name}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function emptyForm(kind = 'product') {
  return {
    id: null,
    number: '',
    quote_kind: kind,
    quote_date: new Date().toISOString().slice(0, 10),
    request_id: null,
    request_label: '',
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

// ─── Авторастягивающийся textarea — высота по контенту ─────────────────────
function AutoTextarea({ value, onChange, style }) {
  const ref = useRef(null)
  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
  useEffect(() => { resize() }, [value])
  return (
    <textarea
      ref={ref}
      value={value || ''}
      onChange={e => { onChange(e.target.value); resize() }}
      style={{ ...style, overflow: 'hidden', resize: 'none' }}
      rows={1}
    />
  )
}

// ─── Поле ввода цены с форматированием до 2 знаков + разделители тысяч ────
function PriceInput({ value, onChange, style }) {
  const [focused, setFocused] = useState(false)
  const [local, setLocal] = useState('')

  // Парсинг: убираем пробелы (вкл. неразрывный) и приводим запятую к точке
  const parse = v => parseFloat(String(v).replace(/[\s ]/g, '').replace(',', '.'))

  // Формат с разделителями для режима «не в фокусе»: 1 234 567,89
  const fmtDisplay = v => {
    const n = parse(v)
    if (isNaN(n)) return '0,00'
    return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Формат для режима редактирования: без разделителей, точка как разделитель дробной части
  const fmtEdit = v => {
    const n = parse(v)
    return isNaN(n) ? '' : n.toFixed(2)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      style={style}
      value={focused ? local : fmtDisplay(value)}
      onFocus={() => { setFocused(true); setLocal(fmtEdit(value)) }}
      onChange={e => setLocal(e.target.value.replace(/[\s ]/g, '').replace(',', '.'))}
      onBlur={() => {
        const v = parse(local) || 0
        onChange(v)
        setFocused(false)
      }}
    />
  )
}

// ─── Иерархический выбор товаров из каталога (мгновенное добавление) ──────
function CatalogPicker({ catTree, products, pickedIds, onAdd, onRemove }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [openCats, setOpenCats] = useState(new Set())
  const [openSubs, setOpenSubs] = useState(new Set())
  const wrapRef = useRef(null)

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleCat = id => setOpenCats(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSub = id => setOpenSubs(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const q = search.toLowerCase()
  const matchesQuery = p => !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)

  // Мгновенное добавление/удаление товара
  const toggleProd = p => {
    if (pickedIds.has(p.id)) onRemove(p.id)
    else onAdd(p.id)
  }

  // Стиль чекбокса (виден в обеих темах)
  const checkboxStyle = (checked) => ({
    width: 16, height: 16, borderRadius: 3,
    border: '1.5px solid ' + (checked ? '#185fa5' : '#94a3b8'),
    background: checked ? '#185fa5' : 'transparent',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all .12s',
  })
  const checkMark = (checked) => checked ? (
    <span style={{ color: '#fff', fontSize: 12, lineHeight: 1, fontWeight: 700 }}>✓</span>
  ) : null

  return (
    <div ref={wrapRef} style={{ position: 'relative', maxWidth: 520, marginBottom: 10 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--inp-border)', borderRadius: 6, background: 'var(--inp-bg)', color: 'var(--text)', fontSize: 14, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>+ Добавить товар из каталога{pickedIds.size > 0 ? ` (в КП: ${pickedIds.size})` : ''}</span>
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 600, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,.25)', marginTop: 4, maxHeight: 500, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
            <input
              autoFocus
              style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--inp-border)', borderRadius: 5, background: 'var(--inp-bg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
              placeholder="Поиск по названию или артикулу…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {catTree.map(cat => {
              const subcats = cat.subcategories || []
              const allSubIds = new Set(subcats.map(s => s.id))
              const catMatchProds = q
                ? products.filter(p => allSubIds.has(p.category_id) && matchesQuery(p))
                : []
              if (q && catMatchProds.length === 0) return null
              const expanded = q || openCats.has(cat.id)
              return (
                <div key={cat.id}>
                  <div
                    onClick={() => toggleCat(cat.id)}
                    style={{ padding: '7px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', userSelect: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2, #e8edf4)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}
                  >
                    <span style={{ fontSize: 9, color: 'var(--text4)', width: 10, flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
                    {cat.name}
                  </div>
                  {expanded && subcats.map(sub => {
                    const subProds = products.filter(p => p.category_id === sub.id && matchesQuery(p))
                    if (subProds.length === 0) return null
                    const subExpanded = q || openSubs.has(sub.id)
                    return (
                      <div key={sub.id}>
                        <div
                          onClick={() => toggleSub(sub.id)}
                          style={{ padding: '6px 12px 6px 26px', cursor: 'pointer', fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border2)', userSelect: 'none' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2, #e8edf4)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                          <span style={{ fontSize: 9, color: 'var(--text4)', width: 10, flexShrink: 0 }}>{subExpanded ? '▼' : '▶'}</span>
                          {sub.name}
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text4)', background: 'var(--bg2)', padding: '1px 7px', borderRadius: 10, flexShrink: 0 }}>{subProds.length}</span>
                        </div>
                        {subExpanded && subProds.map(p => {
                          const checked = pickedIds.has(p.id)
                          return (
                            <div
                              key={p.id}
                              onClick={() => toggleProd(p)}
                              style={{ padding: '5px 12px 5px 44px', cursor: 'pointer', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--border2)', display: 'flex', gap: 8, alignItems: 'center', background: checked ? 'rgba(24,95,165,0.08)' : 'transparent' }}
                              onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#eff6ff' }}
                              onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                            >
                              <span style={checkboxStyle(checked)}>{checkMark(checked)}</span>
                              <span style={{ flex: 1 }}>{p.name}</span>
                              {p.sku && <span style={{ color: 'var(--text4)', fontSize: 11, flexShrink: 0 }}>{p.sku}</span>}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
          <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border2)', fontSize: 11, color: 'var(--text3)', background: 'var(--bg2)', flexShrink: 0 }}>
            Кликните по товару, чтобы добавить или убрать его из КП
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Иерархический выбор услуг из каталога (мгновенное добавление) ────────
function ServicePicker({ serviceTree, serviceItems, pickedIds, onAdd, onRemove }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [openCats, setOpenCats] = useState(new Set())
  const [openSubs, setOpenSubs] = useState(new Set())
  const wrapRef = useRef(null)

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleCat = id => setOpenCats(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSub = id => setOpenSubs(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const q = search.toLowerCase()
  const matchesQuery = it => !q || (it.name || '').toLowerCase().includes(q) || (it.description || '').toLowerCase().includes(q)

  const toggleItem = it => {
    if (pickedIds.has(it.id)) onRemove(it.id)
    else onAdd(it.id)
  }

  const checkboxStyle = (checked) => ({
    width: 16, height: 16, borderRadius: 3,
    border: '1.5px solid ' + (checked ? '#185fa5' : '#94a3b8'),
    background: checked ? '#185fa5' : 'transparent',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all .12s',
  })
  const checkMark = (checked) => checked ? (
    <span style={{ color: '#fff', fontSize: 12, lineHeight: 1, fontWeight: 700 }}>✓</span>
  ) : null

  return (
    <div ref={wrapRef} style={{ position: 'relative', maxWidth: 520, marginBottom: 10 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--inp-border)', borderRadius: 6, background: 'var(--inp-bg)', color: 'var(--text)', fontSize: 14, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>+ Добавить услугу из каталога{pickedIds.size > 0 ? ` (в КП: ${pickedIds.size})` : ''}</span>
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 600, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,.25)', marginTop: 4, maxHeight: 500, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
            <input
              autoFocus
              style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--inp-border)', borderRadius: 5, background: 'var(--inp-bg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
              placeholder="Поиск по названию или описанию…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {serviceTree.map(cat => {
              const subcats = cat.subcategories || []
              const allSubIds = new Set(subcats.map(s => s.id))
              const catMatchItems = q
                ? serviceItems.filter(it => allSubIds.has(it.subcategory_id) && matchesQuery(it))
                : []
              if (q && catMatchItems.length === 0) return null
              const expanded = q || openCats.has(cat.id)
              return (
                <div key={cat.id}>
                  <div
                    onClick={() => toggleCat(cat.id)}
                    style={{ padding: '7px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', userSelect: 'none' }}
                  >
                    <span style={{ fontSize: 9, color: 'var(--text4)', width: 10, flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
                    {cat.name}
                  </div>
                  {expanded && subcats.map(sub => {
                    const subItems = serviceItems.filter(it => it.subcategory_id === sub.id && matchesQuery(it))
                    if (subItems.length === 0) return null
                    const subExpanded = q || openSubs.has(sub.id)
                    return (
                      <div key={sub.id}>
                        <div
                          onClick={() => toggleSub(sub.id)}
                          style={{ padding: '6px 12px 6px 26px', cursor: 'pointer', fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border2)', userSelect: 'none' }}
                        >
                          <span style={{ fontSize: 9, color: 'var(--text4)', width: 10, flexShrink: 0 }}>{subExpanded ? '▼' : '▶'}</span>
                          {sub.name}
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text4)', background: 'var(--bg2)', padding: '1px 7px', borderRadius: 10, flexShrink: 0 }}>{subItems.length}</span>
                        </div>
                        {subExpanded && subItems.map(it => {
                          const checked = pickedIds.has(it.id)
                          return (
                            <div
                              key={it.id}
                              onClick={() => toggleItem(it)}
                              style={{ padding: '5px 12px 5px 44px', cursor: 'pointer', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--border2)', display: 'flex', gap: 8, alignItems: 'center', background: checked ? 'rgba(24,95,165,0.08)' : 'transparent' }}
                              onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#eff6ff' }}
                              onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                            >
                              <span style={checkboxStyle(checked)}>{checkMark(checked)}</span>
                              <span style={{ flex: 1 }}>{it.name}</span>
                              {it.price_rub != null && <span style={{ color: 'var(--text4)', fontSize: 11, flexShrink: 0 }}>{Number(it.price_rub).toLocaleString('ru-RU')} ₽</span>}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
          <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border2)', fontSize: 11, color: 'var(--text3)', background: 'var(--bg2)', flexShrink: 0 }}>
            Кликните по услуге, чтобы добавить или убрать её из КП
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Основной компонент ──────────────────────────────────────────────────────
export default function CommercialOffers() {
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [catTree, setCatTree] = useState([])
  const [companies, setCompanies] = useState([])
  const [senders, setSenders] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [detailIdx, setDetailIdx] = useState(null)

  // Вкладки: 'all' / 'product' / 'service' / 'mixed'
  const [tab, setTab] = useState('all')

  // Услуги: дерево + плоский список позиций
  const [serviceTree, setServiceTree]   = useState([])
  const [serviceItems, setServiceItems] = useState([])

  const load = useCallback(async () => {
    setErr('')
    setLoading(true)
    try {
      const [q, p, tree, c, s, svcCats] = await Promise.all([
        api.get('/crm/quotes'),
        api.get('/crm/catalog/products'),
        api.get('/crm/catalog/category-tree'),
        api.get('/crm/companies'),
        api.get('/crm/quotes/sender-profiles'),
        api.get('/services-catalog/categories'),
      ])
      setRows(q.data || [])
      setProducts(p.data || [])
      setCatTree(tree.data || [])
      setCompanies(c.data || [])
      setSenders(s.data || [])

      // Грузим позиции каждой подкатегории услуг
      const cats = svcCats.data || []
      setServiceTree(cats)
      const subIds = []
      for (const cat of cats) for (const sub of (cat.subcategories || [])) subIds.push(sub.id)
      const itemsArrays = await Promise.all(
        subIds.map(sid => api.get(`/services-catalog/subcategories/${sid}/items`).then(r => r.data || []).catch(() => []))
      )
      const allItems = []
      itemsArrays.forEach((arr, idx) => {
        const sid = subIds[idx]
        for (const it of arr) allItems.push({ ...it, subcategory_id: sid })
      })
      setServiceItems(allItems)
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
    // На вкладке "Все" по умолчанию — товары; иначе совпадает с вкладкой
    const kind = (tab === 'all') ? 'product' : tab
    setForm(emptyForm(kind))
    setOpen(true)
  }

  const openEdit = q => {
    setForm({
      id: q.id,
      number: q.number || '',
      quote_kind: q.quote_kind || 'product',
      quote_date: q.quote_date || new Date().toISOString().slice(0, 10),
      request_id: q.request_id || null,
      request_label: q.request_id
        ? `${q.request_number || ''}${q.request_client_name ? ' — ' + q.request_client_name : ''}`
        : '',
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

  // Set product_id уже добавленных в КП — для отображения галочек в каталоге
  const pickedProductIds = useMemo(
    () => new Set((form.items || []).map(i => i.product_id).filter(Boolean)),
    [form.items]
  )
  // Set service_item_id уже добавленных в КП
  const pickedServiceIds = useMemo(
    () => new Set((form.items || []).map(i => i.service_item_id).filter(Boolean)),
    [form.items]
  )

  // Добавление услуги в КП
  const addService = id => {
    const s = serviceItems.find(x => Number(x.id) === Number(id))
    if (!s) return
    setForm(f => ({
      ...f,
      items: [
        ...f.items,
        emptyItem({
          title: s.name,
          service_item_id: s.id,
          item_kind: 'service',
          model: s.unit || '',
          intro: s.description || '',
          features_text: s.notes || '',
          kit_text: s.duration ? `Срок выполнения: ${s.duration}` : '',
          price_without_vat: Number(s.price_rub || 0),
          price_with_vat: Number(s.price_rub || 0),
        }),
      ],
    }))
  }

  const removeServiceById = sid => {
    setForm(f => ({ ...f, items: f.items.filter(i => Number(i.service_item_id) !== Number(sid)) }))
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
          item_kind: 'product',
          model: p.sku || '',
          intro: p.description || '',
          specs: (() => { try { const r = JSON.parse(p.tech_specs || ''); if (Array.isArray(r)) return r.map(x => ({ param: x.key || '', value: x.value || '' })) } catch (_) {} return [] })(),
          features_text: (() => { try { JSON.parse(p.tech_specs || ''); return '' } catch (_) { return p.tech_specs || '' } })(),
          photo_urls,
          price_without_vat: Number(p.recommended_price || 0),
          price_with_vat: Number(p.price_end_vat || p.recommended_price || 0),
        }),
      ],
    }))
  }

  // Убрать товар из КП по product_id (вызывается из CatalogPicker при снятии галочки)
  const removeProductById = pid => {
    setForm(f => ({ ...f, items: f.items.filter(i => Number(i.product_id) !== Number(pid)) }))
  }

  const updateItem = useCallback((idx, patch) => {
    setForm(f => ({ ...f, items: f.items.map((x, i) => i === idx ? { ...x, ...patch } : x) }))
  }, [])

  const save = async () => {
    try {
      const payload = {
        number: form.number || null,
        quote_kind: form.quote_kind || 'product',
        quote_date: form.quote_date,
        request_id: form.request_id || null,
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
          service_item_id: i.service_item_id || null,
          item_kind: i.item_kind || (i.service_item_id ? 'service' : 'product'),
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
        <button type="button" onClick={openNew} style={{ padding: '10px 18px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Создать КП{tab !== 'all' ? (tab === 'product' ? ' на товары' : tab === 'service' ? ' на услуги' : ' смешанное') : ''}
        </button>
      </div>

      {/* Вкладки по типам КП */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'all',     label: 'Все' },
          { key: 'product', label: 'Товары' },
          { key: 'service', label: 'Услуги' },
          { key: 'mixed',   label: 'Смешанные' },
        ].map(t => {
          const cnt = t.key === 'all' ? rows.length : rows.filter(r => (r.quote_kind || 'product') === t.key).length
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 16px', border: 'none', background: 'transparent',
                color: active ? 'var(--primary)' : 'var(--text3)',
                fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer',
                borderBottom: '2px solid ' + (active ? 'var(--primary)' : 'transparent'),
                marginBottom: -1,
              }}
            >
              {t.label} <span style={{ fontSize: 11, color: 'var(--text4)', marginLeft: 4 }}>({cnt})</span>
            </button>
          )
        })}
      </div>

      {err && <div style={{ background:'rgba(239,68,68,0.12)', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {loading ? <p style={{ color: 'var(--text3)' }}>Загрузка…</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>№</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Тип</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Заявка</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Дата</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Получатель</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Сумма</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Статус</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid var(--border)' }}></th>
          </tr></thead>
          <tbody>
            {rows.filter(r => tab === 'all' || (r.quote_kind || 'product') === tab).map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                <td style={{ padding: '10px', color: 'var(--text)' }}>{r.number || `КП-${r.id}`}</td>
                <td style={{ padding: '10px' }}>
                  {(() => {
                    const k = r.quote_kind || 'product'
                    const map = {
                      product: { label: 'Товары',     bg: 'rgba(24,95,165,0.12)',  color: '#185fa5' },
                      service: { label: 'Услуги',     bg: 'rgba(22,163,74,0.12)',  color: '#15803d' },
                      mixed:   { label: 'Смешанное',  bg: 'rgba(168,85,247,0.12)', color: '#7e22ce' },
                    }
                    const cfg = map[k] || map.product
                    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  })()}
                </td>
                <td style={{ padding: '10px', color: 'var(--text2)', fontSize: 12 }}>
                  {r.request_number
                    ? <span style={{ background: 'var(--bg2)', padding: '2px 7px', borderRadius: 4, color: 'var(--primary)', fontWeight: 500 }}>{r.request_number}</span>
                    : <span style={{ color: 'var(--text5)' }}>—</span>}
                </td>
                <td style={{ padding: '10px', color: 'var(--text2)' }}>{r.quote_date || '—'}</td>
                <td style={{ padding: '10px', color: 'var(--text2)' }}>{r.recipient_name || '—'}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text2)' }}>{Number(r.total_with_vat || 0).toLocaleString('ru-RU')}</td>
                <td style={{ padding: '10px', color: 'var(--text2)' }}>{r.status}</td>
                <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <button type="button" onClick={() => downloadExport('docx', r.id, r.number || `KP-${r.id}`)} title="Скачать Word (DOCX)"
                      style={{ padding: '2px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 4, lineHeight: 0, opacity: 1, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                      <IconDocx size={34} />
                    </button>
                    <button type="button" onClick={() => openEdit(r)}
                      style={{ minWidth: 78, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, border: '1px solid #185fa5', borderRadius: 5, background: '#eff6ff', color: '#0e4889', cursor: 'pointer' }}>
                      Изменить
                    </button>
                    <button type="button" onClick={() => duplicate(r.id)}
                      style={{ minWidth: 78, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, border: '1px solid #94a3b8', borderRadius: 5, background: '#f8fafc', color: '#64748b', cursor: 'pointer' }}>
                      Дубль
                    </button>
                    <button type="button" onClick={() => remove(r.id)}
                      style={{ minWidth: 78, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, border: '1px solid #fecaca', borderRadius: 5, background: '#fff5f5', color: '#dc2626', cursor: 'pointer' }}>
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

            {/* Привязка к заявке */}
            <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <label style={{ ...lbl, marginBottom: 6 }}>
                Заявка <span style={{ color: 'var(--text4)', fontWeight: 400 }}>(обязательно выберите заявку)</span>
              </label>
              <RequestAutocomplete
                value={form.request_id}
                requestLabel={form.request_label}
                onSelect={req => {
                  setForm(f => ({
                    ...f,
                    request_id: req.id,
                    request_label: `${req.number}${req.client_name ? ' — ' + req.client_name : ''}`,
                    // Авто-заполнение получателя из клиента заявки (если ещё не заполнено)
                    recipient_name: f.recipient_name || req.client_name || '',
                    recipient_address: f.recipient_address || req.client_address || '',
                    recipient_contact_name: f.recipient_contact_name || req.client_contact_name || '',
                    recipient_contact_position: f.recipient_contact_position || req.client_contact_position || '',
                  }))
                }}
                onClear={() => setForm(f => ({ ...f, request_id: null, request_label: '' }))}
              />
              {!form.request_id && (
                <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>
                  ⚠ КП привязывается к заявке для отслеживания воронки продаж
                </div>
              )}
              {form.request_id && (
                <div style={{ fontSize: 11, color: '#15803d', marginTop: 4 }}>
                  ✓ Заявка выбрана
                </div>
              )}
            </div>

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
            {/* Тип КП — переключатель сверху позиций */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '6px 0 10px' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Тип КП:</span>
              {[
                { key: 'product', label: 'Товары' },
                { key: 'service', label: 'Услуги' },
                { key: 'mixed',   label: 'Смешанное' },
              ].map(k => (
                <label key={k.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
                  <input
                    type="radio"
                    name="quote_kind"
                    checked={form.quote_kind === k.key}
                    onChange={() => setForm(f => ({ ...f, quote_kind: k.key }))}
                  />
                  {k.label}
                </label>
              ))}
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, margin: '4px 0 8px', color: 'var(--text)' }}>Позиции КП</div>
            {(form.quote_kind === 'product' || form.quote_kind === 'mixed') && (
              <CatalogPicker
                catTree={catTree}
                products={products}
                pickedIds={pickedProductIds}
                onAdd={addProduct}
                onRemove={removeProductById}
              />
            )}
            {(form.quote_kind === 'service' || form.quote_kind === 'mixed') && (
              <ServicePicker
                serviceTree={serviceTree}
                serviceItems={serviceItems}
                pickedIds={pickedServiceIds}
                onAdd={addService}
                onRemove={removeServiceById}
              />
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
              <colgroup>
                <col style={{ width: '36%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '60px' }} />
                <col style={{ width: '70px' }} />
                <col style={{ width: '95px' }} />
                <col style={{ width: '110px' }} />
              </colgroup>
              <thead><tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500 }}>Наименование</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500 }}>Модель</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--text3)', fontWeight: 500 }}>Цена с НДС</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--text3)', fontWeight: 500 }}>Кол-во</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--text3)', fontWeight: 500 }}>Скидка %</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--text3)', fontWeight: 500 }}>Скидка сумма</th>
                <th></th>
              </tr></thead>
              <tbody>
                {form.items.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border2)' }}>
                    <td style={{ padding: '6px 4px', verticalAlign: 'top' }}>
                      <AutoTextarea
                        value={it.title}
                        onChange={v => updateItem(idx, { title: v })}
                        style={{ ...inp, marginBottom: 0, fontSize: 12, lineHeight: 1.35 }}
                      />
                    </td>
                    <td style={{ padding: '6px 4px', verticalAlign: 'top' }}><input style={{ ...inp, marginBottom: 0, fontSize: 12 }} value={it.model || ''} onChange={e => updateItem(idx, { model: e.target.value })} /></td>
                    <td style={{ padding: '6px 4px', verticalAlign: 'top' }}><PriceInput style={{ ...inp, marginBottom: 0, fontSize: 12, textAlign: 'right' }} value={it.price_with_vat} onChange={v => updateItem(idx, { price_with_vat: v })} /></td>
                    <td style={{ padding: '6px 4px', verticalAlign: 'top' }}><input type="number" style={{ ...inp, marginBottom: 0, fontSize: 12, textAlign: 'right', padding: '8px 4px' }} value={it.quantity} onChange={e => updateItem(idx, { quantity: e.target.value })} /></td>
                    <td style={{ padding: '6px 4px', verticalAlign: 'top' }}><input type="number" style={{ ...inp, marginBottom: 0, fontSize: 12, textAlign: 'right', padding: '8px 4px' }} value={it.discount_pct || 0} onChange={e => updateItem(idx, { discount_pct: e.target.value })} /></td>
                    <td style={{ padding: '6px 4px', verticalAlign: 'top' }}><input type="number" style={{ ...inp, marginBottom: 0, fontSize: 12, textAlign: 'right', padding: '8px 4px' }} value={it.discount_amount || 0} onChange={e => updateItem(idx, { discount_amount: e.target.value })} /></td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
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
              <div>Сумма: <b>{subtotal.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
              <div>Итого со скидкой: <b>{total.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setOpen(false)}
                style={{ padding: '9px 18px', fontSize: 13, fontWeight: 500, border: '1.5px solid #64748b', borderRadius: 6, background: 'transparent', color:'var(--text3)', cursor: 'pointer' }}>
                Отмена
              </button>
              {form.id ? (
                <>
                  <button type="button" onClick={() => downloadExport('docx', form.id, form.number || `KP-${form.id}`)}
                    style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, border: '1.5px solid var(--primary)', borderRadius: 6, background: 'transparent', color: 'var(--primary)', cursor: 'pointer', letterSpacing: '0.03em' }}>
                    Скачать DOCX
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
