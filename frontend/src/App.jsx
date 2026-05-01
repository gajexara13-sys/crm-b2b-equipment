import React, { useState, useEffect, createContext } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import axios from 'axios'
import TestABS from './TestABS'
import PageFunnel from './Funnel'

const AuthCtx = createContext(null)
const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use(c => {
  const t = localStorage.getItem('token')
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

// Иконки
const IconEdit = () => <span>✏️</span>
const IconDel = () => <span>🗑️</span>

function Login({ onLogin }) {
  const [email, setEmail] = useState(''); const [pwd, setPwd] = useState(''); const [err, setErr] = useState('')
  const submit = async e => {
    e.preventDefault(); setErr('')
    try {
      const f = new FormData(); f.append('username', email); f.append('password', pwd)
      const r = await api.post('/auth/login', f)
      localStorage.setItem('token', r.data.access_token)
      onLogin(r.data.user)
    } catch { setErr('Неверный email или пароль') }
  }
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#1a1a2e'}}>
      <div style={{background:'#fff',borderRadius:12,padding:'2rem',width:360,boxShadow:'0 4px 24px rgba(0,0,0,0.15)'}}>
        <h2 style={{marginBottom:'0.25rem',color:'#1a1a2e'}}>Lab CRM</h2>
        <p style={{color:'#666',fontSize:13,marginBottom:'1.5rem'}}>ДСИЛ Башстройинвест</p>
        {err && <div style={{background:'#fee',color:'#c00',padding:'8px 12px',borderRadius:6,marginBottom:12,fontSize:13}}>{err}</div>}
        <form onSubmit={submit}>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" required style={inp}/>
          <input value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Пароль" type="password" required style={{...inp,marginBottom:16}}/>
          <button type="submit" style={{width:'100%',padding:'10px',background:'#185fa5',color:'#fff',border:'none',borderRadius:6,fontSize:14,cursor:'pointer'}}>Войти</button>
        </form>
      </div>
    </div>
  )
}

const inp = {width:'100%',padding:'10px 12px',border:'1px solid #ddd',borderRadius:6,marginBottom:10,fontSize:14,outline:'none',boxSizing:'border-box'}
const sel = {...inp,background:'#fff',cursor:'pointer'}
const lbl = {display:'block',fontSize:12,color:'#555',marginBottom:4,fontWeight:500}

const NAV = [{to:'/funnel',label:'Воронка'},{to:'/requests',label:'Заявки'},{to:'/clients',label:'Клиенты'},{to:'/samples',label:'Пробы'},{to:'/tests',label:'Испытания'},{to:'/protocols',label:'Протоколы'}]

function Layout({ user, onLogout }) {
  return (
    <div style={{display:'flex',minHeight:'100vh'}}>
      <aside style={{width:210,background:'#1a1a2e',color:'#fff',padding:'1.5rem 0',flexShrink:0,display:'flex',flexDirection:'column'}}>
        <div style={{padding:'0 1.25rem 1.25rem',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
          <div style={{fontSize:13,fontWeight:600,color:'#7eb3e8'}}>Lab CRM</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:2}}>{user?.name}</div>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:1}}>{user?.role}</div>
        </div>
        <nav style={{marginTop:'1rem',flex:1}}>
          {NAV.map(n=>(
            <NavLink key={n.to} to={n.to} style={({isActive})=>({display:'block',padding:'10px 1.25rem',fontSize:14,color:isActive?'#fff':'rgba(255,255,255,0.6)',background:isActive?'rgba(255,255,255,0.1)':'transparent',textDecoration:'none',borderLeft:isActive?'3px solid #7eb3e8':'3px solid transparent'})}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={onLogout} style={{margin:'0 1.25rem 1.5rem',background:'transparent',border:'1px solid rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.5)',padding:'8px 12px',borderRadius:6,fontSize:12,cursor:'pointer'}}>Выйти</button>
      </aside>
      <main style={{flex:1,padding:'1.5rem',overflowY:'auto',background:'#f5f6fa'}}>
        <Routes>
          <Route path="/requests"  element={<PageRequests />} />
          <Route path="/clients"   element={<PageClients />} />
          <Route path="/samples"   element={<PageSamples />} />
          <Route path="/tests"     element={<PageTests />} />
          <Route path="/protocols" element={<PageProtocols />} />
          <Route path="/funnel" element={<PageFunnel />} />
          <Route path="*" element={<Navigate to="/requests" />} />
        </Routes>
      </main>
    </div>
  )
}

const STATUS_LABELS = {new:'Новая',kp:'КП отправлено',contract:'Договор',in_progress:'В работе',done:'Завершена',cancelled:'Отменена',draft:'Черновик',review:'На проверке',signed:'Подписан',sent:'Отправлен',registered:'Зарегистрирована'}
const STATUS_BG = {new:'#e8f0fe',kp:'#fff3e0',contract:'#e8f5e9',in_progress:'#e3f2fd',done:'#e8f5e9',cancelled:'#fce4ec',draft:'#f5f5f5',review:'#fff3e0',signed:'#e8f5e9',sent:'#e3f2fd',registered:'#e3f2fd'}

function Badge({s}) { return <span style={{fontSize:11,padding:'3px 8px',borderRadius:4,background:STATUS_BG[s]||'#f5f5f5',color:'#333',whiteSpace:'nowrap'}}>{STATUS_LABELS[s]||s}</span> }
function Card({title,children,action}) {
  return (
    <div style={{background:'#fff',borderRadius:10,padding:'1.25rem',marginBottom:'1rem',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <h2 style={{fontSize:16,fontWeight:600,color:'#1a1a2e'}}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}
function Btn({onClick,children,variant='primary',type='button'}) {
  return <button type={type} onClick={onClick} style={{padding:'8px 16px',borderRadius:6,fontSize:13,cursor:'pointer',border:variant==='primary'?'none':'1px solid #185fa5',background:variant==='primary'?'#185fa5':'transparent',color:variant==='primary'?'#fff':'#185fa5',fontWeight:500}}>{children}</button>
}
function Th({children}) { return <th style={{textAlign:'left',padding:'8px 10px',color:'#666',fontWeight:500,fontSize:12,borderBottom:'2px solid #f0f0f0',whiteSpace:'nowrap'}}>{children}</th> }
function Td({children,bold}) { return <td style={{padding:'8px 10px',fontSize:13,color:bold?'#185fa5':'#333',fontWeight:bold?500:400,borderBottom:'1px solid #f5f5f5'}}>{children||'—'}</td> }

const MATERIAL_TYPES = [
  {v:'abs_58401',l:'АБС / ЩМАС по ГОСТ Р 58401'},
  {v:'abs_58406',l:'АБС / ЩМАС по ГОСТ Р 58406'},
  {v:'pbv',l:'ПБВ по ГОСТ Р 58400.2'},
  {v:'crushed_stone',l:'Щебень / гравий ГОСТ 32703'},
  {v:'sand',l:'Песок ГОСТ 32730 / 32824'},
]

const EMPTY_SAMPLE = {
  request_id:'', material_type:'abs_58401', material_name:'',
  material_grade:'', manufacturer:'', sampling_date:'',
  registration_date: new Date().toISOString().slice(0,10),
  sampling_location:'', sampled_by:'', sampling_conditions:'', act_type:'intake'
}

function SampleForm({ requests, onSave, onCancel, initial }) {
  const [f, setF] = useState(initial || EMPTY_SAMPLE)
  const set = (k,v) => setF(p=>({...p,[k]:v}))
  const submit = async e => {
    e.preventDefault()
    const payload = {...f, request_id: f.request_id||null}
    if (initial?.id) await api.put(`/samples/${initial.id}`, payload)
    else await api.post('/samples', payload)
    onSave()
  }
  const row2 = {display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}
  const row3 = {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}
  return (
    <form onSubmit={submit} style={{background:'#f8f9ff',border:'1px solid #dde3f5',borderRadius:10,padding:'1.25rem',marginBottom:'1rem'}}>
      <h3 style={{fontSize:14,fontWeight:600,color:'#1a1a2e',marginBottom:'1rem',paddingBottom:8,borderBottom:'1px solid #e8ecf5'}}>
        {initial?.id ? 'Редактировать пробу' : 'Регистрация новой пробы'}
      </h3>
      <div style={{background:'#fff',borderRadius:8,padding:'1rem',marginBottom:12,border:'1px solid #e8ecf5'}}>
        <div style={row2}>
          <div>
            <label style={lbl}>Заявка</label>
            <select value={f.request_id} onChange={e=>set('request_id',e.target.value)} style={sel}>
              <option value="">— Без заявки —</option>
              {requests.map(r=><option key={r.id} value={r.id}>{r.number}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Вид акта</label>
            <select value={f.act_type} onChange={e=>set('act_type',e.target.value)} style={sel}>
              <option value="intake">Акт приёма-передачи</option>
              <option value="sampling">Акт отбора</option>
            </select>
          </div>
        </div>
      </div>
      <div style={{background:'#fff',borderRadius:8,padding:'1rem',marginBottom:12,border:'1px solid #e8ecf5'}}>
        <div style={row2}>
          <div>
            <label style={lbl}>Вид материала *</label>
            <select value={f.material_type} onChange={e=>set('material_type',e.target.value)} style={sel} required>
              {MATERIAL_TYPES.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Наименование *</label>
            <input value={f.material_name} onChange={e=>set('material_name',e.target.value)} style={inp}/>
          </div>
        </div>
      </div>
      <div style={{display:'flex',gap:8}}><Btn type="submit">Сохранить</Btn><Btn variant="secondary" onClick={onCancel}>Отмена</Btn></div>
    </form>
  )
}

function PageSamples() {
  const [rows,setRows] = useState([]); const [requests,setRequests] = useState([])
  const [showForm,setShowForm] = useState(false); const [editing,setEditing] = useState(null)
  const [filter,setFilter] = useState('')
  const load = () => { api.get('/samples').then(r=>setRows(r.data)) }
  useEffect(()=>{ load(); api.get('/requests').then(r=>setRequests(r.data)) },[])
  const onSave = () => { setShowForm(false); setEditing(null); load() }
  const del = async (id) => { if(window.confirm('Удалить пробу?')) { await api.delete(`/samples/${id}`); load() } }

  return (
    <>
      {showForm && <SampleForm requests={requests} onSave={onSave} onCancel={()=>{setShowForm(false);setEditing(null)}} initial={editing}/>}
      <Card title={`Пробы (${rows.length})`} action={!showForm && <Btn onClick={()=>{setEditing(null);setShowForm(true)}}>+ Новая проба</Btn>}>
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Поиск..." style={{...inp,maxWidth:300}}/>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr><Th>Лаб. №</Th><Th>Материал</Th><Th>Дата рег.</Th><Th>Статус</Th><Th>Действия</Th></tr></thead>
          <tbody>{rows.filter(r=>!filter || r.lab_number?.includes(filter)).map(r=>(
            <tr key={r.id} style={{borderBottom:'1px solid #f5f5f5'}}>
              <Td bold>{r.lab_number}</Td><Td>{r.material_name}</Td><Td>{r.registration_date}</Td>
              <Td><Badge s={r.stage || 'new_request'}/></Td>
              <Td>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>{setEditing(r);setShowForm(true)}} title="Изменить" style={btnAct}><IconEdit/></button>
                  <button onClick={()=>del(r.id)} title="Удалить" style={{...btnAct,color:'#c62828'}}><IconDel/></button>
                </div>
              </Td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </>
  )
}

function PageRequests() {
  const [rows,setRows]=useState([]); const [clients,setClients]=useState([])
  const [show,setShow]=useState(false); const [editing,setEditing]=useState(null)
  const [form,setForm]=useState({client_id:'',material_type:'abs_58401',test_types:'',quantity:1})
  
  const load = () => { api.get('/requests').then(r=>setRows(r.data)); api.get('/clients').then(r=>setClients(r.data)) }
  useEffect(load, [])

  const save = async () => {
    if (editing) await api.put(`/requests/${editing.id}`, form)
    else await api.post('/requests', form)
    setShow(false); setEditing(null); load()
  }
  const del = async (id) => { if(window.confirm('Удалить заявку?')) { await api.delete(`/requests/${id}`); load() } }

  return (
    <Card title={`Заявки (${rows.length})`} action={<Btn onClick={()=>{setEditing(null);setForm({client_id:'',material_type:'abs_58401',test_types:'',quantity:1});setShow(true)}}>+ Новая заявка</Btn>}>
      {show && (
        <div style={{background:'#f8f9ff',padding:'1rem',borderRadius:10,marginBottom:10}}>
          <select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})} style={sel}>
            <option value="">Выберите клиента</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{display:'flex',gap:8,marginTop:10}}><Btn onClick={save}>Сохранить</Btn><Btn variant="secondary" onClick={()=>setShow(false)}>Отмена</Btn></div>
        </div>
      )}
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><Th>№</Th><Th>Клиент</Th><Th>Статус</Th><Th>Действия</Th></tr></thead>
        <tbody>{rows.map(r=>(
          <tr key={r.id}>
            <Td bold>{r.number}</Td><Td>{clients.find(c=>c.id===r.client_id)?.name}</Td>
            <Td><Badge s={r.status}/></Td>
            <Td>
              <div style={{display:'flex',gap:4}}>
                <button onClick={()=>{setEditing(r);setForm(r);setShow(true)}} title="Изменить" style={btnAct}><IconEdit/></button>
                <button onClick={()=>del(r.id)} title="Удалить" style={{...btnAct,color:'#c62828'}}><IconDel/></button>
              </div>
            </Td>
          </tr>
        ))}</tbody>
      </table>
    </Card>
  )
}

function PageClients() {
  const [rows,setRows]=useState([]); const [show,setShow]=useState(false); const [editing,setEditing]=useState(null)
  const [form,setForm]=useState({name:'',inn:'',contact_name:''})
  const load = () => api.get('/clients').then(r=>setRows(r.data))
  useEffect(load, [])
  const save = async () => {
    if (editing) await api.put(`/clients/${editing.id}`, form)
    else await api.post('/clients', form)
    setShow(false); setEditing(null); load()
  }
  const del = async (id) => { if(window.confirm('Удалить клиента?')) { await api.delete(`/clients/${id}`); load() } }

  return (
    <Card title={`Клиенты (${rows.length})`} action={<Btn onClick={()=>{setEditing(null);setForm({name:'',inn:'',contact_name:''});setShow(true)}}>+ Новый клиент</Btn>}>
      {show && (
        <div style={{background:'#f8f9ff',padding:'1rem',borderRadius:10,marginBottom:10}}>
          <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Название" style={inp}/>
          <div style={{display:'flex',gap:8}}><Btn onClick={save}>Сохранить</Btn><Btn variant="secondary" onClick={()=>setShow(false)}>Отмена</Btn></div>
        </div>
      )}
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><Th>Организация</Th><Th>ИНН</Th><Th>Действия</Th></tr></thead>
        <tbody>{rows.map(r=>(
          <tr key={r.id}>
            <Td bold>{r.name}</Td><Td>{r.inn}</Td>
            <Td>
              <div style={{display:'flex',gap:4}}>
                <button onClick={()=>{setEditing(r);setForm(r);setShow(true)}} title="Изменить" style={btnAct}><IconEdit/></button>
                <button onClick={()=>del(r.id)} title="Удалить" style={{...btnAct,color:'#c62828'}}><IconDel/></button>
              </div>
            </Td>
          </tr>
        ))}</tbody>
      </table>
    </Card>
  )
}

const btnAct = {background:'none',border:'none',cursor:'pointer',fontSize:16,padding:4,color:'#185fa5',display:'flex',alignItems:'center'}

function PageTests(){
  const [rows,setRows]=useState([]); const [showForm,setShowForm]=useState(false)
  const [selSampleId,setSelSampleId]=useState(null); const [samples,setSamples]=useState([])
  const load=()=>api.get('/tests').then(r=>setRows(r.data))
  useEffect(()=>{load();api.get('/samples').then(r=>setSamples(r.data))},[])
  if(showForm) return <div style={{background:"#fff",padding:"1.5rem"}}><TestABS sampleId={selSampleId} onClose={()=>{setShowForm(false);load()}}/></div>
  return(
    <Card title={`Испытания (${rows.length})`} action={
      <div style={{display:"flex",gap:8}} middle>
        <select onChange={e=>setSelSampleId(+e.target.value)} style={sel}><option value="">Проба...</option>{samples.map(s=><option key={s.id} value={s.id}>{s.lab_number}</option>)}</select>
        <Btn onClick={()=>setShowForm(true)}>+ Добавить</Btn>
      </div>
    }>
      <table style={{width:"100%"}}>
        <thead><tr><Th>ID</Th><Th>Проба</Th><Th>Статус</Th><Th>Действия</Th></tr></thead>
        <tbody>{rows.map(r=>(
          <tr key={r.id}><Td>#{r.id}</Td><Td>{samples.find(s=>s.id===r.sample_id)?.lab_number}</Td><Td><Badge s={r.status}/></Td>
            <Td><button onClick={()=>{setSelSampleId(r.sample_id);setShowForm(true)}} style={btnAct}><IconEdit/></button></Td>
          </tr>
        ))}</tbody>
      </table>
    </Card>
  )
}

function PageProtocols() {
  const [rows,setRows]=useState([])
  useEffect(()=>{ api.get('/protocols').then(r=>setRows(r.data)) },[])
  return (
    <Card title={`Протоколы (${rows.length})`}>
      <table style={{width:'100%'}}>
        <thead><tr><Th>№</Th><Th>Дата</Th><Th>Статус</Th></tr></thead>
        <tbody>{rows.map(r=>(<tr key={r.id}><Td bold>{r.number}</Td><Td>{r.created_at?.slice(0,10)}</Td><Td><Badge s={r.status}/></Td></tr>))}</tbody>
      </table>
    </Card>
  )
}

export default function App() {
  const [user,setUser] = useState(()=>{ const t=localStorage.getItem('token'); return t?JSON.parse(localStorage.getItem('user')||'null'):null })
  const login = u => { setUser(u); localStorage.setItem('user',JSON.stringify(u)) }
  const logout = () => { setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user') }
  if (!user) return <Login onLogin={login}/>
  return (
    <AuthCtx.Provider value={user}>
      <BrowserRouter><Layout user={user} onLogout={logout}/></BrowserRouter>
    </AuthCtx.Provider>
  )
}
