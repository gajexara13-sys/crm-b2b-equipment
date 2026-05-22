import { useEffect, useState, useCallback, useMemo } from 'react'
import axios from 'axios'
import { useConfirm } from './ConfirmDialog'
import Modal from './Modal'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use(c => {
  const t = localStorage.getItem('token')
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

const REQ_NO_CACHE = { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }

function parseJsonList(raw) {
  if (!raw || typeof raw !== 'string') return []
  try {
    const j = JSON.parse(raw)
    return Array.isArray(j) ? j : []
  } catch { return [] }
}

function parseTechSpecsToRows(raw) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(r => ({ key: r.key ?? '', value: r.value ?? '' }))
  } catch (_) {}
  return raw.split('\n').filter(l => l.trim()).map(line => {
    const idx = line.indexOf(':')
    return idx > 0 ? { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() } : { key: '', value: line.trim() }
  })
}

function serializeTechSpecs(rows) {
  const clean = rows.filter(r => r.key.trim() || r.value.trim())
  return clean.length ? JSON.stringify(clean) : ''
}

function TechSpecsEditor({ rows, onChange }) {
  const update = (i, field, val) => onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
          <input placeholder="Параметр" style={{ flex: 1, padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }} value={r.key} onChange={e => update(i, 'key', e.target.value)} />
          <input placeholder="Значение" style={{ flex: 1, padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }} value={r.value} onChange={e => update(i, 'value', e.target.value)} />
          <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} style={{ padding: '2px 8px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { key: '', value: '' }])} style={{ marginTop: 2, fontSize: 12, padding: '3px 10px', border: '1px solid #94a3b8', borderRadius: 4, background:'var(--surface2)', cursor: 'pointer' }}>+ Добавить строку</button>
    </div>
  )
}

function parseIdsFromText(s) {
  if (!s || !String(s).trim()) return []
  return String(s).split(/[,;\s\n]+/).map(x => parseInt(x.trim(), 10)).filter(n => !Number.isNaN(n) && n > 0)
}
function photosFromText(s) {
  if (!s || !String(s).trim()) return []
  return String(s).split('\n').map(l => l.trim()).filter(Boolean)
}
function parseRuMoney(raw) {
  if (raw === '' || raw == null) return 0
  const cleaned = String(raw).trim().replace(/\s/g, '').replace(/ /g, '').replace(',', '.')
  const n = parseFloat(cleaned); return Number.isFinite(n) ? n : NaN
}
function parseRuOptionalFloat(raw) {
  if (raw === '' || raw == null || !String(raw).trim()) return null
  const cleaned = String(raw).trim().replace(/\s/g, '').replace(/ /g, '').replace(',', '.')
  const n = parseFloat(cleaned); return Number.isFinite(n) ? n : NaN
}
function parseRuStock(raw) {
  if (raw === '' || raw == null || !String(raw).trim()) return 0
  const cleaned = String(raw).trim().replace(/\s/g, '').replace(/ /g, '').replace(',', '.')
  const n = parseFloat(cleaned); return Number.isFinite(n) ? Math.round(n) : NaN
}
function formatAxiosDetail(detail) {
  if (detail == null) return ''
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(x => x.msg ?? JSON.stringify(x)).join('; ')
  if (typeof detail === 'object' && detail.detail) return formatAxiosDetail(detail.detail)
  try { return JSON.stringify(detail) } catch { return String(detail) }
}

const EQUIPMENT_TYPES = [
  { value: 'measuring_equipment', label: 'Средство измерений' },
  { value: 'testing_equipment',   label: 'Испытательное оборудование' },
  { value: 'auxiliary_equipment', label: 'Вспомогательное оборудование' },
]
const STATUS_OPTS = [
  { value: 'draft',         label: 'Черновик' },
  { value: 'active',        label: 'В продаже' },
  { value: 'discontinued',  label: 'Снят с производства' },
  { value: 'preorder',      label: 'Под заказ' },
]

const emptyForm = (cid = '') => ({
  id: null, category_id: cid, sku: '', name: '', unit: 'шт', description: '',
  tech_spec_rows: [], warranty_terms: '', delivery_terms: '',
  cost_with_vat: 0, price_dealers_vat: 0, price_end_vat: 0,
  weight_net_kg: '', weight_gross_kg: '', volume_m3: '', length_cm: '', width_cm: '', height_cm: '',
  related_ids_text: '', analog_ids_text: '', stock_quantity: 0,
  brand: '', product_status: 'draft', equipment_type: '', website_url: '', photo_urls_text: '',
  recommended_price: 0, min_price: 0, is_active: true,
})

const inp = { width: '100%', padding: '8px 10px', border: '1px solid var(--inp-border)', borderRadius: 6, background: 'var(--inp-bg)', color: 'var(--text)', boxSizing: 'border-box', marginBottom: 8, fontSize: 14 }
const lbl = { display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 4, fontWeight: 500 }
const selStyle = { ...inp, cursor: 'pointer' }

export default function ProductCatalog() {
  const confirm = useConfirm()
  const [tree, setTree]                 = useState([])
  const [products, setProducts]         = useState([])
  const [selectedSubcat, setSelectedSubcat] = useState(null) // { id, name, categoryName }
  const [openCats, setOpenCats]         = useState({})
  const [loading, setLoading]           = useState(true)
  const [err, setErr]                   = useState('')
  const [okMsg, setOkMsg]               = useState('')
  const [modalOpen, setModalOpen]       = useState(false)
  const [form, setForm]                 = useState(emptyForm())
  const [initialSnapshot, setInitialSnapshot] = useState('')
  const [saving, setSaving]             = useState(false)

  const allSubcats = useMemo(() => {
    const arr = []
    for (const t of tree) for (const s of t.subcategories) arr.push({ ...s, categoryName: t.name })
    return arr
  }, [tree])

  const load = useCallback(async () => {
    setErr(''); setLoading(true)
    try {
      const [t, p] = await Promise.all([
        api.get('/crm/catalog/category-tree'),
        api.get('/crm/catalog/products', { ...REQ_NO_CACHE, params: { _t: Date.now() } }),
      ])
      setTree(t.data || [])
      setProducts(p.data || [])
      if ((t.data || []).length > 0 && !selectedSubcat) {
        const first = t.data[0]
        setOpenCats({ [first.id]: true })
        if (first.subcategories.length > 0) {
          const sub = first.subcategories[0]
          setSelectedSubcat({ ...sub, categoryName: first.name })
        }
      }
    } catch (e) {
      const d = e.response?.data?.detail
      setErr(formatAxiosDetail(d) || e.message || 'Ошибка загрузки')
    } finally { setLoading(false) }
  }, [selectedSubcat])

  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  const toggleCat = id => setOpenCats(o => ({ ...o, [id]: !o[id] }))
  const selectSubcat = (sub, catName) => setSelectedSubcat({ ...sub, categoryName: catName })

  // Товары для выбранной подкатегории
  const visibleProducts = useMemo(() => {
    if (!selectedSubcat) return []
    return products.filter(p => Number(p.category_id) === Number(selectedSubcat.id))
  }, [products, selectedSubcat])

  const openNew = () => {
    setOkMsg('')
    const f = emptyForm(selectedSubcat ? String(selectedSubcat.id) : '')
    setForm(f)
    setInitialSnapshot(JSON.stringify(f))
    setModalOpen(true)
  }

  const openEdit = p => {
    const rel = parseJsonList(p.related_product_ids_json)
    const ana = parseJsonList(p.analog_product_ids_json)
    const pics = parseJsonList(p.photo_urls_json)
    const nextForm = {
      id: p.id,
      category_id: p.category_id != null ? String(p.category_id) : '',
      sku: p.sku || '',
      name: p.name || '',
      unit: p.unit || 'шт',
      description: p.description || '',
      tech_spec_rows: parseTechSpecsToRows(p.tech_specs),
      warranty_terms: p.warranty_terms || '',
      delivery_terms: p.delivery_terms || '',
      cost_with_vat: p.cost_with_vat ?? 0,
      price_dealers_vat: p.price_dealers_vat ?? 0,
      price_end_vat: p.price_end_vat ?? 0,
      weight_net_kg: p.weight_net_kg ?? '',
      weight_gross_kg: p.weight_gross_kg ?? '',
      volume_m3: p.volume_m3 ?? '',
      length_cm: p.length_cm ?? '',
      width_cm: p.width_cm ?? '',
      height_cm: p.height_cm ?? '',
      related_ids_text: rel.join(', '),
      analog_ids_text: ana.join(', '),
      stock_quantity: p.stock_quantity ?? 0,
      brand: p.brand || '',
      product_status: p.product_status || 'draft',
      equipment_type: p.equipment_type || '',
      website_url: p.website_url || '',
      photo_urls_text: pics.join('\n'),
      recommended_price: p.recommended_price ?? 0,
      min_price: p.min_price ?? 0,
      is_active: p.is_active !== false,
    }
    setOkMsg('')
    setForm(nextForm)
    setInitialSnapshot(JSON.stringify(nextForm))
    setModalOpen(true)
  }

  const hasUnsavedChanges = () => JSON.stringify(form) !== initialSnapshot
  const closeWithGuard = async () => {
    if (!hasUnsavedChanges()) { setModalOpen(false); return }
    const ok = await confirm({
      title: 'Несохраненные изменения',
      message: 'Если выйти сейчас, изменения в карточке не сохранятся.',
      danger: true, confirmText: 'Выйти', cancelText: 'Отмена',
    })
    if (ok) setModalOpen(false)
  }

  const buildPayload = () => {
    const cost_with_vat = parseRuMoney(form.cost_with_vat)
    const price_dealers_vat = parseRuMoney(form.price_dealers_vat)
    const price_end_vat = parseRuMoney(form.price_end_vat)
    const recommended_price = parseRuMoney(form.recommended_price)
    const min_price = parseRuMoney(form.min_price)
    const stock_quantity = parseRuStock(form.stock_quantity)
    const weight_net_kg = parseRuOptionalFloat(form.weight_net_kg)
    const weight_gross_kg = parseRuOptionalFloat(form.weight_gross_kg)
    const volume_m3 = parseRuOptionalFloat(form.volume_m3)
    const length_cm = parseRuOptionalFloat(form.length_cm)
    const width_cm = parseRuOptionalFloat(form.width_cm)
    const height_cm = parseRuOptionalFloat(form.height_cm)

    const bad = []
    if (Number.isNaN(cost_with_vat)) bad.push('себестоимость')
    if (Number.isNaN(price_dealers_vat)) bad.push('цена дилерам')
    if (Number.isNaN(price_end_vat)) bad.push('цена конечным')
    if (Number.isNaN(recommended_price)) bad.push('рекоменд. цена')
    if (Number.isNaN(min_price)) bad.push('мин. цена')
    if (Number.isNaN(stock_quantity)) bad.push('остаток')
    if (Number.isNaN(weight_net_kg)) bad.push('вес нетто')
    if (Number.isNaN(weight_gross_kg)) bad.push('вес брутто')
    if (Number.isNaN(volume_m3)) bad.push('объём')
    if (Number.isNaN(length_cm)) bad.push('длина')
    if (Number.isNaN(width_cm)) bad.push('ширина')
    if (Number.isNaN(height_cm)) bad.push('высота')
    if (bad.length) return { error: `Некорректное число в полях: ${bad.join(', ')}.` }

    return {
      payload: {
        category_id: form.category_id ? Number(form.category_id) : null,
        sku: form.sku.trim() || null,
        name: form.name.trim(),
        unit: form.unit || 'шт',
        description: form.description.trim() || null,
        tech_specs: serializeTechSpecs(form.tech_spec_rows) || null,
        warranty_terms: form.warranty_terms.trim() || null,
        delivery_terms: form.delivery_terms.trim() || null,
        cost_with_vat, price_dealers_vat, price_end_vat,
        weight_net_kg, weight_gross_kg, volume_m3, length_cm, width_cm, height_cm,
        related_product_ids: parseIdsFromText(form.related_ids_text),
        analog_product_ids: parseIdsFromText(form.analog_ids_text),
        stock_quantity,
        brand: form.brand.trim() || null,
        product_status: form.product_status,
        equipment_type: form.equipment_type || null,
        website_url: form.website_url.trim() || null,
        photo_urls: photosFromText(form.photo_urls_text),
        recommended_price, min_price,
        purchase_cost: 0, logistics_cost: 0, extra_cost: 0, target_margin_pct: 30,
        is_active: form.is_active,
      },
    }
  }

  const save = async () => {
    if (!form.name.trim()) { alert('Укажите наименование товара'); return }
    if (!form.category_id) { alert('Выберите подкатегорию каталога'); return }
    const built = buildPayload()
    if (built.error) { alert(built.error); return }
    setSaving(true)
    try {
      const res = form.id
        ? await api.put(`/crm/catalog/products/${form.id}`, built.payload)
        : await api.post('/crm/catalog/products', built.payload)
      const saved = res.data
      if (saved?.id != null) {
        setProducts(prev => {
          const i = prev.findIndex(x => Number(x.id) === Number(saved.id))
          if (i >= 0) { const next = [...prev]; next[i] = { ...next[i], ...saved }; return next }
          return [saved, ...prev]
        })
      }
      setModalOpen(false)
      setOkMsg('Товар успешно сохранён')
      await load()
    } catch (e) {
      const d = e.response?.data?.detail
      alert(formatAxiosDetail(d) || e.message || 'Ошибка сохранения')
    } finally { setSaving(false) }
  }

  const remove = async p => {
    const ok = await confirm({
      title: 'Удалить товар',
      message: `Удалить «${p.name}»? Это действие нельзя отменить.`,
      danger: true, confirmText: 'Удалить',
    })
    if (!ok) return
    try {
      await api.delete(`/crm/catalog/products/${p.id}`)
      await load()
    } catch (e) {
      const d = e.response?.data?.detail
      alert(formatAxiosDetail(d) || e.message || 'Ошибка удаления')
    }
  }

  const statusLabel = v => STATUS_OPTS.find(o => o.value === v)?.label || v
  const equipLabel  = v => EQUIPMENT_TYPES.find(o => o.value === v)?.label || v || '—'
  const fmtMoney    = v => (v != null && !Number.isNaN(Number(v))
    ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(v)) : '—')

  // ── Стили сайдбара ────────────────────────────────────────────────
  const sideCat = isOpen => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 12px', cursor: 'pointer', borderRadius: 6, marginBottom: 2,
    fontWeight: 700, fontSize: 13, color: 'var(--text)',
    background: isOpen ? 'var(--surface2)' : 'transparent', userSelect: 'none',
  })
  const sideSub = isSel => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 12px 6px 22px', cursor: 'pointer', borderRadius: 5,
    fontSize: 13, marginBottom: 1, userSelect: 'none',
    background: isSel ? '#185fa5' : 'transparent',
    color: isSel ? '#fff' : 'var(--text3)',
    fontWeight: isSel ? 600 : 400,
  })

  // Количество товаров в подкатегории
  const subCount = sub => products.filter(p => Number(p.category_id) === Number(sub.id)).length

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Каталог товаров</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          10 категорий, разбитых по типам оборудования
        </p>
      </div>

      {err && <div style={{ background:'rgba(239,68,68,0.12)', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {okMsg && <div style={{ background: '#ecfdf5', color: '#166534', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{okMsg}</div>}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Сайдбар */}
        <div style={{
          width: 280, flexShrink: 0, background: 'var(--surface)', borderRadius: 10,
          padding: '10px 8px', border: '1px solid var(--border2)', alignSelf: 'flex-start',
        }}>
          {tree.map(cat => (
            <div key={cat.id}>
              <div style={sideCat(openCats[cat.id])} onClick={() => toggleCat(cat.id)}>
                <span>{cat.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)', display: 'inline-block', transform: openCats[cat.id] ? 'rotate(90deg)' : 'none' }}>▶</span>
              </div>
              {openCats[cat.id] && (
                <div style={{ marginBottom: 4 }}>
                  {cat.subcategories.map(sub => {
                    const cnt = subCount(sub)
                    return (
                      <div key={sub.id}
                        style={sideSub(selectedSubcat?.id === sub.id)}
                        onClick={() => selectSubcat(sub, cat.name)}>
                        <span>{sub.name}</span>
                        {cnt > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10, background: selectedSubcat?.id === sub.id ? 'rgba(255,255,255,0.25)' : 'var(--surface2)', color: selectedSubcat?.id === sub.id ? '#fff' : 'var(--text3)' }}>{cnt}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Основная область */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selectedSubcat ? (
            <div style={{ color: 'var(--text3)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
              Выберите подкатегорию в меню слева
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '16px 20px', border: '1px solid var(--border2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{selectedSubcat.categoryName}</div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                    {selectedSubcat.name}
                    <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 8 }}>· {visibleProducts.length}</span>
                  </h3>
                </div>
                <button type="button" onClick={openNew}
                  style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#185fa5', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  + Добавить товар
                </button>
              </div>

              {loading ? (
                <p style={{ color: 'var(--text3)' }}>Загрузка…</p>
              ) : visibleProducts.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)', fontSize: 13 }}>В этой подкатегории пока нет товаров</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)', fontWeight: 600 }}>Наименование</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)', fontWeight: 600 }}>Бренд</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)', fontWeight: 600 }}>Себест., ₽</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)', fontWeight: 600 }}>Цена конеч., ₽</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)', fontWeight: 600 }}>Остаток</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)', fontWeight: 600 }}>Статус</th>
                        <th style={{ padding: '8px 10px', borderBottom: '2px solid var(--border)' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProducts.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                          <td style={{ padding: '10px', color: 'var(--text)', fontWeight: 500 }}>{p.name}</td>
                          <td style={{ padding: '10px', color: 'var(--text2)' }}>{p.brand || '—'}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(p.cost_with_vat)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(p.price_end_vat)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text2)' }}>{p.stock_quantity ?? 0}</td>
                          <td style={{ padding: '10px', color: 'var(--text2)', fontSize: 12 }}>{statusLabel(p.product_status)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button type="button" onClick={() => openEdit(p)}
                                style={{ minWidth: 78, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, border: '1px solid #185fa5', borderRadius: 5, background: '#eff6ff', color: '#0e4889', cursor: 'pointer' }}>
                                Изменить
                              </button>
                              <button type="button" onClick={() => remove(p)}
                                style={{ minWidth: 78, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, border: '1px solid #fecaca', borderRadius: 5, background: '#fff5f5', color: '#dc2626', cursor: 'pointer' }}>
                                Удалить
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal noConfirm onClose={() => void closeWithGuard()} zIndex={1000} maxWidth={720}>
          <div role="dialog" style={{ background: 'var(--surface)', borderRadius: 12, boxShadow: '0 24px 48px rgba(0,0,0,0.2)', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{form.id ? 'Карточка товара' : 'Новый товар'}</h3>

            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185fa5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Основное</div>
              <label style={lbl}>Подкатегория каталога *</label>
              <select style={selStyle} value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">— Выберите —</option>
                {tree.map(cat => (
                  <optgroup key={cat.id} label={cat.name}>
                    {cat.subcategories.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <label style={lbl}>Заголовок (наименование) *</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <label style={lbl}>Описание</label>
              <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <label style={lbl}>Технические характеристики</label>
              <TechSpecsEditor rows={form.tech_spec_rows} onChange={rows => setForm(f => ({ ...f, tech_spec_rows: rows }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Артикул</label>
                  <input style={inp} value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Гарантийный срок</label>
                  <input style={inp} placeholder="Например: 24 мес." value={form.warranty_terms} onChange={e => setForm(f => ({ ...f, warranty_terms: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185fa5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Цены с НДС, ₽</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div><label style={lbl}>Себестоимость</label><input type="text" inputMode="decimal" style={inp} value={form.cost_with_vat} onChange={e => setForm(f => ({ ...f, cost_with_vat: e.target.value }))} placeholder="12500 или 12500,50" /></div>
                <div><label style={lbl}>Цена конечным</label><input type="text" inputMode="decimal" style={inp} value={form.price_end_vat} onChange={e => setForm(f => ({ ...f, price_end_vat: e.target.value }))} /></div>
                <div><label style={lbl}>Цена дилерам</label><input type="text" inputMode="decimal" style={inp} value={form.price_dealers_vat} onChange={e => setForm(f => ({ ...f, price_dealers_vat: e.target.value }))} /></div>
              </div>
            </div>

            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185fa5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Габариты и логистика</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div><label style={lbl}>Вес нетто, кг</label><input type="text" inputMode="decimal" style={inp} value={form.weight_net_kg} onChange={e => setForm(f => ({ ...f, weight_net_kg: e.target.value }))} /></div>
                <div><label style={lbl}>Вес брутто, кг</label><input type="text" inputMode="decimal" style={inp} value={form.weight_gross_kg} onChange={e => setForm(f => ({ ...f, weight_gross_kg: e.target.value }))} /></div>
                <div><label style={lbl}>Объём, м³</label><input type="text" inputMode="decimal" style={inp} value={form.volume_m3} onChange={e => setForm(f => ({ ...f, volume_m3: e.target.value }))} /></div>
                <div><label style={lbl}>Длина, см</label><input type="text" inputMode="decimal" style={inp} value={form.length_cm} onChange={e => setForm(f => ({ ...f, length_cm: e.target.value }))} /></div>
                <div><label style={lbl}>Ширина, см</label><input type="text" inputMode="decimal" style={inp} value={form.width_cm} onChange={e => setForm(f => ({ ...f, width_cm: e.target.value }))} /></div>
                <div><label style={lbl}>Высота, см</label><input type="text" inputMode="decimal" style={inp} value={form.height_cm} onChange={e => setForm(f => ({ ...f, height_cm: e.target.value }))} /></div>
              </div>
              <label style={lbl}>Срок поставки</label>
              <input style={inp} placeholder="Например: 14–21 раб. дней" value={form.delivery_terms} onChange={e => setForm(f => ({ ...f, delivery_terms: e.target.value }))} />
            </div>

            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185fa5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Связи и склад</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Связанные товары (ID)</label><input style={inp} placeholder="1, 2, 3" value={form.related_ids_text} onChange={e => setForm(f => ({ ...f, related_ids_text: e.target.value }))} /></div>
                <div><label style={lbl}>Аналоги (ID)</label><input style={inp} placeholder="4, 5" value={form.analog_ids_text} onChange={e => setForm(f => ({ ...f, analog_ids_text: e.target.value }))} /></div>
              </div>
              <label style={lbl}>Количество на складе</label>
              <input type="text" inputMode="numeric" style={{ ...inp, maxWidth: 200 }} value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} />
            </div>

            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185fa5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Бренд, классификация</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Бренд / производитель</label><input style={inp} value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></div>
                <div>
                  <label style={lbl}>Статус товара</label>
                  <select style={selStyle} value={form.product_status} onChange={e => setForm(f => ({ ...f, product_status: e.target.value }))}>
                    {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <label style={lbl}>Тип оборудования</label>
              <select style={selStyle} value={form.equipment_type} onChange={e => setForm(f => ({ ...f, equipment_type: e.target.value }))}>
                <option value="">— Не указано —</option>
                {EQUIPMENT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <label style={lbl}>Ссылка на сайте</label>
              <input style={inp} type="url" placeholder="https://..." value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Фото (URL, по одному в строке)</label>
              <textarea style={{ ...inp, minHeight: 88, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} placeholder="https://example.com/img1.jpg" value={form.photo_urls_text} onChange={e => setForm(f => ({ ...f, photo_urls_text: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => void closeWithGuard()} style={{ padding: '10px 16px', borderRadius: 6, border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer' }}>Отмена</button>
              <button type="button" disabled={saving} onClick={save} style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: saving ? 'var(--text4)' : 'var(--primary)', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
