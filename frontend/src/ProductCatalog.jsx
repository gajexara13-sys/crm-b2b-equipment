import { useEffect, useState, useCallback } from 'react'
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
  } catch {
    return []
  }
}

function parseTechSpecsToRows(raw) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(r => ({ key: r.key ?? '', value: r.value ?? '' }))
  } catch {}
  // Fallback: парсим текстовый формат
  return raw.split('\n')
    .map(l => l.trim())
    .filter(l => l && !/^(характеристики\s+товара|технические\s+характеристики)/i.test(l))
    .map(l => {
      const clean = l.replace(/^\d+\.\s*/, '').replace(/^[•·\-–]\s*/, '').trim()
      const idx = clean.indexOf(':')
      if (idx > 0) return { key: clean.slice(0, idx).trim(), value: clean.slice(idx + 1).trim() }
      return { key: '', value: clean }
    })
    .filter(r => r.key || r.value)
}

function serializeTechSpecs(rows) {
  const clean = rows.filter(r => r.key || r.value)
  return clean.length ? JSON.stringify(clean, null, 0) : ''
}

function TechSpecsEditor({ rows, onChange }) {
  const addRow = () => onChange([...rows, { key: '', value: '' }])
  const removeRow = i => onChange(rows.filter((_, idx) => idx !== i))
  const updateRow = (i, field, val) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
    onChange(next)
  }

  const cellInp = {
    width: '100%', padding: '6px 8px', border: '1px solid var(--inp-border)',
    borderRadius: 4, background: 'var(--inp-bg)', color: 'var(--text)',
    fontSize: 13, boxSizing: 'border-box',
  }

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '5px 6px', color: 'var(--text3)', fontWeight: 500, fontSize: 11, borderBottom: '1px solid var(--border)', width: '42%' }}>Параметр</th>
            <th style={{ textAlign: 'left', padding: '5px 6px', color: 'var(--text3)', fontWeight: 500, fontSize: 11, borderBottom: '1px solid var(--border)' }}>Значение</th>
            <th style={{ width: 28, borderBottom: '1px solid var(--border)' }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td style={{ padding: '3px 4px 3px 0', verticalAlign: 'middle' }}>
                <input
                  value={row.key}
                  onChange={e => updateRow(i, 'key', e.target.value)}
                  placeholder="Параметр"
                  style={cellInp}
                />
              </td>
              <td style={{ padding: '3px 4px', verticalAlign: 'middle' }}>
                <input
                  value={row.value}
                  onChange={e => updateRow(i, 'value', e.target.value)}
                  placeholder="Значение"
                  style={cellInp}
                />
              </td>
              <td style={{ padding: '3px 0 3px 4px', verticalAlign: 'middle', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  title="Удалить строку"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}
                >×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={addRow}
        style={{ fontSize: 12, padding: '5px 12px', borderRadius: 5, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer' }}
      >+ Добавить строку</button>
    </div>
  )
}

function parseIdsFromText(s) {
  if (!s || !String(s).trim()) return []
  return String(s)
    .split(/[,;\s\n]+/)
    .map(x => parseInt(x.trim(), 10))
    .filter(n => !Number.isNaN(n) && n > 0)
}

function photosFromText(s) {
  if (!s || !String(s).trim()) return []
  return String(s)
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
}

/** Парсинг чисел с запятой / пробелами (типичный ввод из РФ: 100,50 или 1 234,56). */
function parseRuMoney(raw) {
  if (raw === '' || raw == null) return 0
  const cleaned = String(raw)
    .trim()
    .replace(/\s/g, '')
    .replace(/\u00a0/g, '')
    .replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : NaN
}

function parseRuOptionalFloat(raw) {
  if (raw === '' || raw == null || !String(raw).trim()) return null
  const cleaned = String(raw)
    .trim()
    .replace(/\s/g, '')
    .replace(/\u00a0/g, '')
    .replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : NaN
}

function parseRuStock(raw) {
  if (raw === '' || raw == null || !String(raw).trim()) return 0
  const cleaned = String(raw).trim().replace(/\s/g, '').replace(/\u00a0/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? Math.round(n) : NaN
}

function formatAxiosDetail(detail) {
  if (detail == null) return ''
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail))
    return detail.map(x => x.msg ?? JSON.stringify(x)).join('; ')
  if (typeof detail === 'object' && detail.detail) return formatAxiosDetail(detail.detail)
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

const EQUIPMENT_TYPES = [
  { value: 'measuring_equipment', label: 'Средство измерений' },
  { value: 'testing_equipment', label: 'Испытательное оборудование' },
  { value: 'auxiliary_equipment', label: 'Вспомогательное оборудование' },
]

const STATUS_OPTS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'active', label: 'В продаже' },
  { value: 'discontinued', label: 'Снят с производства' },
  { value: 'preorder', label: 'Под заказ' },
]

const emptyForm = () => ({
  id: null,
  category_id: '',
  sku: '',
  name: '',
  unit: 'шт',
  description: '',
  tech_spec_rows: [],
  warranty_terms: '',
  delivery_terms: '',
  cost_with_vat: 0,
  price_dealers_vat: 0,
  price_end_vat: 0,
  weight_net_kg: '',
  weight_gross_kg: '',
  volume_m3: '',
  length_cm: '',
  width_cm: '',
  height_cm: '',
  related_ids_text: '',
  analog_ids_text: '',
  stock_quantity: 0,
  brand: '',
  product_status: 'draft',
  equipment_type: '',
  website_url: '',
  photo_urls_text: '',
  recommended_price: 0,
  min_price: 0,
  is_active: true,
})

const inp = { width: '100%', padding: '8px 10px', border: '1px solid var(--inp-border)', borderRadius: 6, background: 'var(--inp-bg)', color: 'var(--text)', boxSizing: 'border-box', marginBottom: 8, fontSize: 14 }
const lbl = { display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 4, fontWeight: 500 }
const selStyle = { ...inp, cursor: 'pointer' }

export default function ProductCatalog() {
  const confirm = useConfirm()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [initialSnapshot, setInitialSnapshot] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setErr('')
    setLoading(true)
    try {
      const [c, p] = await Promise.all([
        api.get('/crm/catalog/categories'),
        api.get('/crm/catalog/products', { ...REQ_NO_CACHE, params: { _t: Date.now() } }),
      ])
      setCategories(c.data || [])
      setProducts(p.data || [])
    } catch (e) {
      const d = e.response?.data?.detail
      setErr(formatAxiosDetail(d) || e.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => {
    setOkMsg('')
    const f = emptyForm()
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
    if (!hasUnsavedChanges()) {
      setModalOpen(false)
      return
    }
    const ok = await confirm({
      title: 'Несохраненные изменения',
      message: 'Если выйти сейчас, изменения в карточке не сохранятся.',
      danger: true,
      confirmText: 'Выйти',
      cancelText: 'Отмена',
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

    const badLabels = []
    if (Number.isNaN(cost_with_vat)) badLabels.push('себестоимость')
    if (Number.isNaN(price_dealers_vat)) badLabels.push('цена дилерам')
    if (Number.isNaN(price_end_vat)) badLabels.push('цена конечным')
    if (Number.isNaN(recommended_price)) badLabels.push('рекоменд. цена')
    if (Number.isNaN(min_price)) badLabels.push('мин. цена')
    if (Number.isNaN(stock_quantity)) badLabels.push('остаток на складе')
    if (Number.isNaN(weight_net_kg)) badLabels.push('вес нетто')
    if (Number.isNaN(weight_gross_kg)) badLabels.push('вес брутто')
    if (Number.isNaN(volume_m3)) badLabels.push('объём')
    if (Number.isNaN(length_cm)) badLabels.push('длина')
    if (Number.isNaN(width_cm)) badLabels.push('ширина')
    if (Number.isNaN(height_cm)) badLabels.push('высота')

    if (badLabels.length)
      return { error: `Некорректное число в полях: ${badLabels.join(', ')}. Разрешены цифры, пробел и запятая или точка.` }

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
        cost_with_vat,
        price_dealers_vat,
        price_end_vat,
        weight_net_kg,
        weight_gross_kg,
        volume_m3,
        length_cm,
        width_cm,
        height_cm,
        related_product_ids: parseIdsFromText(form.related_ids_text),
        analog_product_ids: parseIdsFromText(form.analog_ids_text),
        stock_quantity,
        brand: form.brand.trim() || null,
        product_status: form.product_status,
        equipment_type: form.equipment_type || null,
        website_url: form.website_url.trim() || null,
        photo_urls: photosFromText(form.photo_urls_text),
        recommended_price,
        min_price,
        purchase_cost: 0,
        logistics_cost: 0,
        extra_cost: 0,
        target_margin_pct: 30,
        is_active: form.is_active,
      },
    }
  }

  const save = async () => {
    if (!form.name.trim()) {
      alert('Укажите заголовок (наименование) товара')
      return
    }
    if (!form.category_id) {
      alert('Выберите категорию каталога')
      return
    }
    const built = buildPayload()
    if (built.error) {
      alert(built.error)
      return
    }
    setSaving(true)
    try {
      const res = form.id
        ? await api.put(`/crm/catalog/products/${form.id}`, built.payload)
        : await api.post('/crm/catalog/products', built.payload)
      const saved = res.data
      if (saved?.id != null) {
        setProducts(prev => {
          const i = prev.findIndex(x => Number(x.id) === Number(saved.id))
          if (i >= 0) {
            const next = [...prev]
            next[i] = { ...next[i], ...saved }
            return next
          }
          return [saved, ...prev]
        })
      }
      setModalOpen(false)
      setOkMsg('Товар успешно сохранен')
      await load()
    } catch (e) {
      const d = e.response?.data?.detail
      alert(formatAxiosDetail(d) || e.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const remove = async p => {
    const ok = await confirm({
      title: 'Удалить товар',
      message: `Удалить «${p.name}»? Это действие нельзя отменить.`,
      danger: true,
      confirmText: 'Удалить',
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
  const equipLabel = v => EQUIPMENT_TYPES.find(o => o.value === v)?.label || v || '—'
  const fmtMoney = v => (v != null && !Number.isNaN(Number(v))
    ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(v))
    : '—')

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '1.25rem', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>Каталог товаров</h2>
        <button type="button" onClick={openNew} style={{ padding: '10px 18px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: '#fff', fontWeight: 500, cursor: 'pointer' }}>
          Добавить товар
        </button>
      </div>

      {err && <div style={{ background: '#fff1f2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {okMsg && <div style={{ background: '#ecfdf5', color: '#166534', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{okMsg}</div>}

      {loading ? (
        <p style={{ color: 'var(--text3)' }}>Загрузка…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Наименование</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Артикул</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Себест., ₽</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Цена конеч., ₽</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Бренд</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Тип</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Остаток</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}>Статус</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text4)' }}></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                  <td style={{ padding: '10px', color: 'var(--text)', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '10px', color: 'var(--text2)' }}>{p.sku || '—'}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(p.cost_with_vat)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(p.price_end_vat)}</td>
                  <td style={{ padding: '10px', color: 'var(--text2)' }}>{p.brand || '—'}</td>
                  <td style={{ padding: '10px', color: 'var(--text2)', fontSize: 12 }}>{equipLabel(p.equipment_type)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text2)' }}>{p.stock_quantity ?? 0}</td>
                  <td style={{ padding: '10px', color: 'var(--text2)', fontSize: 12 }}>{statusLabel(p.product_status)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => openEdit(p)} style={{ marginRight: 8, padding: '6px 12px', borderRadius: 5, border: '1px solid #185fa5', background: '#eff6ff', color: '#185fa5', cursor: 'pointer', fontSize: 12 }}>
                      Изменить
                    </button>
                    <button type="button" onClick={() => remove(p)} style={{ padding: '6px 12px', borderRadius: 5, border: '1px solid #fecaca', background: '#fff5f5', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)', fontSize: 13 }}>Товаров пока нет — нажмите «Добавить товар»</p>}
        </div>
      )}

      {modalOpen && (
        <Modal noConfirm onClose={() => void closeWithGuard()} zIndex={1000} maxWidth={720}>
          <div
            role="dialog"
            style={{ background: 'var(--surface)', borderRadius: 12, boxShadow: '0 24px 48px rgba(0,0,0,0.2)', padding: '1.5rem' }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{form.id ? 'Карточка товара' : 'Новый товар'}</h3>

            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185fa5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Основное</div>
              <label style={lbl}>Категория каталога *</label>
              <select style={selStyle} value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">— Выберите —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <label style={lbl}>Заголовок (наименование) *</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <label style={lbl}>Описание</label>
              <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <label style={lbl}>Технические характеристики</label>
              <TechSpecsEditor
                rows={form.tech_spec_rows}
                onChange={rows => setForm(f => ({ ...f, tech_spec_rows: rows }))}
              />
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
                <div>
                  <label style={lbl}>Себестоимость (с НДС)</label>
                  <input type="text" inputMode="decimal" style={inp} value={form.cost_with_vat} onChange={e => setForm(f => ({ ...f, cost_with_vat: e.target.value }))} placeholder="Например: 12500 или 12500,50" />
                </div>
                <div>
                  <label style={lbl}>Цена конечным покупателям</label>
                  <input type="text" inputMode="decimal" style={inp} value={form.price_end_vat} onChange={e => setForm(f => ({ ...f, price_end_vat: e.target.value }))} placeholder="Например: 15000" />
                </div>
                <div>
                  <label style={lbl}>Цена дилерам</label>
                  <input type="text" inputMode="decimal" style={inp} value={form.price_dealers_vat} onChange={e => setForm(f => ({ ...f, price_dealers_vat: e.target.value }))} />
                </div>
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
                <div>
                  <label style={lbl}>Связанные товары (ID через запятую)</label>
                  <input style={inp} placeholder="1, 2, 3" value={form.related_ids_text} onChange={e => setForm(f => ({ ...f, related_ids_text: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Аналоги (ID через запятую)</label>
                  <input style={inp} placeholder="4, 5" value={form.analog_ids_text} onChange={e => setForm(f => ({ ...f, analog_ids_text: e.target.value }))} />
                </div>
              </div>
              <label style={lbl}>Количество на складе</label>
              <input type="text" inputMode="numeric" style={{ ...inp, maxWidth: 200 }} value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} />
            </div>

            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185fa5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Бренд, классификация</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Бренд / производитель</label>
                  <input style={inp} value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
                </div>
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
              <button type="button" onClick={() => void closeWithGuard()} style={{ padding: '10px 16px', borderRadius: 6, border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer' }}>
                Отмена
              </button>
              <button type="button" disabled={saving} onClick={save} style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: saving ? 'var(--text4)' : 'var(--primary)', color: '#fff', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
