import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use(c => {
  const t = localStorage.getItem('token')
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

// ── Подсказки полей в зависимости от категории ───────────────────────────
function fieldHints(categoryName = '') {
  if (categoryName === 'Метрологические услуги') {
    return {
      namePlaceholder:  'Пример: Поверка термометра ТЦМ 320',
      descPlaceholder:  'НД на поверку / методика (ГОСТ, МИ…)',
      unitOptions:      ['за прибор', 'за канал', 'за точку', 'за позицию'],
      durationPlaceholder: '3 рабочих дня',
    }
  }
  if (categoryName === 'Обучение') {
    return {
      namePlaceholder:  'Название программы / курса',
      descPlaceholder:  'Тематика, специализация, документ об образовании',
      unitOptions:      ['за человека', 'за группу', 'за курс'],
      durationPlaceholder: '40 часов / 2 недели',
    }
  }
  if (categoryName === 'Ремонт оборудования') {
    return {
      namePlaceholder:  'Вид ремонтных работ',
      descPlaceholder:  'Применимо к модели / типу оборудования',
      unitOptions:      ['за единицу', 'за позицию', 'за норма-час', 'по смете'],
      durationPlaceholder: '5 рабочих дней',
    }
  }
  return {
    namePlaceholder: 'Название позиции',
    descPlaceholder: 'Описание',
    unitOptions: ['за единицу', 'за позицию'],
    durationPlaceholder: 'Срок',
  }
}

const EMPTY_FORM = { name: '', description: '', price_rub: '', unit: '', duration: '', notes: '' }

// ── Форма добавления / редактирования позиции ───────────────────────────
function ItemForm({ categoryName, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const hints = fieldHints(categoryName)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const inp = {
    padding: '6px 9px', border: '1px solid var(--inp-border)', borderRadius: 5,
    background: 'var(--inp-bg)', color: 'var(--text)', fontSize: 13, width: '100%',
    boxSizing: 'border-box',
  }
  const lbl = { fontSize: 11, color: 'var(--text3)', marginBottom: 3, display: 'block', fontWeight: 600 }

  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '14px 16px', marginBottom: 10, border: '1px solid var(--border2)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        {/* Название */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lbl}>Название *</label>
          <input style={inp} value={form.name} onChange={e => set('name', e.target.value)}
            placeholder={hints.namePlaceholder} autoFocus />
        </div>
        {/* Описание / НД */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lbl}>Описание / НД</label>
          <input style={inp} value={form.description || ''} onChange={e => set('description', e.target.value)}
            placeholder={hints.descPlaceholder} />
        </div>
        {/* Цена */}
        <div>
          <label style={lbl}>Цена, руб.</label>
          <input style={inp} type="number" min="0" value={form.price_rub ?? ''}
            onChange={e => set('price_rub', e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="0" />
        </div>
        {/* Ед. изм. */}
        <div>
          <label style={lbl}>Ед. изм.</label>
          <select style={{ ...inp, cursor: 'pointer' }} value={form.unit || ''}
            onChange={e => set('unit', e.target.value)}>
            <option value="">— не указана —</option>
            {hints.unitOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        {/* Срок */}
        <div>
          <label style={lbl}>Срок выполнения</label>
          <input style={inp} value={form.duration || ''} onChange={e => set('duration', e.target.value)}
            placeholder={hints.durationPlaceholder} />
        </div>
        {/* Примечания */}
        <div>
          <label style={lbl}>Примечания</label>
          <input style={inp} value={form.notes || ''} onChange={e => set('notes', e.target.value)}
            placeholder="Доп. условия, комментарий…" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel}
          style={{ padding: '5px 16px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          Отмена
        </button>
        <button type="button" disabled={!form.name.trim()}
          onClick={() => onSave(form)}
          style={{ padding: '5px 18px', borderRadius: 5, border: 'none', background: '#185fa5', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700, opacity: form.name.trim() ? 1 : 0.5 }}>
          Сохранить
        </button>
      </div>
    </div>
  )
}

// ── Таблица позиций подкатегории ────────────────────────────────────────
function ItemsTable({ items, categoryName, onEdit, onDelete }) {
  if (!items.length) return (
    <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
      Позиций пока нет — нажмите «+ Добавить позицию»
    </div>
  )

  const fmtPrice = v => v != null ? Number(v).toLocaleString('ru-RU') + ' ₽' : '—'

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border2)' }}>
            {['Название', 'Описание / НД', 'Цена', 'Ед. изм.', 'Срок', 'Примечания', ''].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id} style={{ borderBottom: '1px solid var(--border2)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text)' }}>{it.name}</td>
              <td style={{ padding: '8px 10px', color: 'var(--text3)', maxWidth: 220 }}>{it.description || '—'}</td>
              <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: it.price_rub != null ? 'var(--text)' : 'var(--text3)' }}>{fmtPrice(it.price_rub)}</td>
              <td style={{ padding: '8px 10px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{it.unit || '—'}</td>
              <td style={{ padding: '8px 10px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{it.duration || '—'}</td>
              <td style={{ padding: '8px 10px', color: 'var(--text3)', maxWidth: 180 }}>{it.notes || '—'}</td>
              <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'inline-flex', gap: 6 }}>
                  <button onClick={() => onEdit(it)}
                    style={{ minWidth: 72, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, border: '1px solid #185fa5', borderRadius: 5, background: '#eff6ff', color: '#0e4889', cursor: 'pointer' }}>
                    Изменить
                  </button>
                  <button onClick={() => onDelete(it)}
                    style={{ minWidth: 72, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, border: '1px solid #fecaca', borderRadius: 5, background: '#fff5f5', color: '#dc2626', cursor: 'pointer' }}>
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Основной компонент ───────────────────────────────────────────────────
export default function ServicesCatalog() {
  const [categories, setCategories] = useState([])
  const [selectedSubcat, setSelectedSubcat] = useState(null) // { id, name, category_id, categoryName }
  const [items, setItems]         = useState([])
  const [openCats, setOpenCats]   = useState({})          // category_id → bool
  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState(null)        // item being edited
  const [loading, setLoading]     = useState(false)
  const [err, setErr]             = useState('')

  // Загрузка категорий
  useEffect(() => {
    api.get('/services-catalog/categories').then(r => {
      setCategories(r.data || [])
      // Раскрываем первую категорию и выбираем первую подкатегорию
      if (r.data && r.data.length > 0) {
        const first = r.data[0]
        setOpenCats({ [first.id]: true })
        if (first.subcategories && first.subcategories.length > 0) {
          const sub = first.subcategories[0]
          setSelectedSubcat({ ...sub, categoryName: first.name })
        }
      }
    }).catch(e => {
      setErr(e.response?.data?.detail || e.message || 'Не удалось загрузить категории услуг')
    })
  }, [])

  // Загрузка позиций выбранной подкатегории
  useEffect(() => {
    if (!selectedSubcat) { setItems([]); return }
    setLoading(true)
    api.get(`/services-catalog/subcategories/${selectedSubcat.id}/items`)
      .then(r => setItems(r.data))
      .finally(() => setLoading(false))
  }, [selectedSubcat])

  const toggleCat = id => setOpenCats(o => ({ ...o, [id]: !o[id] }))

  const selectSubcat = (sub, catName) => {
    setSelectedSubcat({ ...sub, categoryName: catName })
    setShowForm(false)
    setEditItem(null)
  }

  const handleSave = useCallback(async (form) => {
    const payload = { ...form, price_rub: form.price_rub === '' ? null : Number(form.price_rub) }
    if (editItem) {
      const r = await api.put(`/services-catalog/items/${editItem.id}`, payload)
      setItems(prev => prev.map(i => i.id === editItem.id ? r.data : i))
      setEditItem(null)
    } else {
      const r = await api.post(`/services-catalog/subcategories/${selectedSubcat.id}/items`, payload)
      setItems(prev => [...prev, r.data])
      setShowForm(false)
    }
  }, [editItem, selectedSubcat])

  const handleDelete = useCallback(async (it) => {
    if (!window.confirm(`Удалить позицию «${it.name}»?`)) return
    await api.delete(`/services-catalog/items/${it.id}`)
    setItems(prev => prev.filter(i => i.id !== it.id))
  }, [])

  const startEdit = (it) => {
    setEditItem(it)
    setShowForm(false)
  }

  const cancelForm = () => { setShowForm(false); setEditItem(null) }

  // ── Стили ──────────────────────────────────────────────────────────────
  const sidebarCat = (isOpen) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 12px', cursor: 'pointer', borderRadius: 6, marginBottom: 2,
    fontWeight: 700, fontSize: 13, color: 'var(--text)',
    background: isOpen ? 'var(--surface2)' : 'transparent',
    userSelect: 'none',
  })

  const sidebarSub = (isSelected) => ({
    padding: '7px 12px 7px 22px', cursor: 'pointer', borderRadius: 5,
    fontSize: 13, marginBottom: 1, userSelect: 'none',
    background: isSelected ? '#185fa5' : 'transparent',
    color: isSelected ? '#fff' : 'var(--text3)',
    fontWeight: isSelected ? 600 : 400,
  })

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200 }}>
      {/* Заголовок */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Каталог услуг</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Метрологические услуги, обучение, ремонт оборудования
        </p>
        {err && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.12)', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>
            {err}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Сайдбар категорий ───────────────────────────────────────── */}
        <div style={{
          width: 260, flexShrink: 0, background: 'var(--surface)', borderRadius: 10,
          padding: '10px 8px', border: '1px solid var(--border2)', alignSelf: 'flex-start',
        }}>
          {categories.map(cat => (
            <div key={cat.id}>
              <div style={sidebarCat(openCats[cat.id])} onClick={() => toggleCat(cat.id)}>
                <span>{cat.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)', transition: 'transform 0.15s', display: 'inline-block', transform: openCats[cat.id] ? 'rotate(90deg)' : 'none' }}>▶</span>
              </div>
              {openCats[cat.id] && (
                <div style={{ marginBottom: 4 }}>
                  {cat.subcategories.map(sub => (
                    <div key={sub.id}
                      style={sidebarSub(selectedSubcat?.id === sub.id)}
                      onClick={() => selectSubcat(sub, cat.name)}>
                      {sub.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Основная область ─────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selectedSubcat ? (
            <div style={{ color: 'var(--text3)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
              Выберите подкатегорию в меню слева
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '16px 20px', border: '1px solid var(--border2)' }}>
              {/* Заголовок области */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>
                    {selectedSubcat.categoryName}
                  </div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                    {selectedSubcat.name}
                  </h3>
                </div>
                {!showForm && !editItem && (
                  <button
                    onClick={() => setShowForm(true)}
                    style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#185fa5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    + Добавить позицию
                  </button>
                )}
              </div>

              {/* Форма добавления */}
              {showForm && (
                <ItemForm
                  categoryName={selectedSubcat.categoryName}
                  onSave={handleSave}
                  onCancel={cancelForm}
                />
              )}

              {/* Форма редактирования */}
              {editItem && (
                <ItemForm
                  categoryName={selectedSubcat.categoryName}
                  initial={{
                    name:        editItem.name,
                    description: editItem.description || '',
                    price_rub:   editItem.price_rub ?? '',
                    unit:        editItem.unit || '',
                    duration:    editItem.duration || '',
                    notes:       editItem.notes || '',
                  }}
                  onSave={handleSave}
                  onCancel={cancelForm}
                />
              )}

              {/* Таблица */}
              {loading ? (
                <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>Загрузка…</div>
              ) : (
                <ItemsTable
                  items={items}
                  categoryName={selectedSubcat.categoryName}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
