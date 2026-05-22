import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import TestABS from './TestABS'
import PageFunnel from './Funnel'
import ProductCatalog from './ProductCatalog'
import CommercialOffers from './CommercialOffers'
import SenderProfiles from './SenderProfiles'
import ServicesCatalog from './ServicesCatalog'

class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(e){return{error:e}}
  render(){
    if(this.state.error) return(
      <div style={{padding:'2rem',background:'#fff1f2',borderRadius:8,color:'#991b1b',fontFamily:'monospace',fontSize:13}}>
        <b>Ошибка рендеринга:</b><br/>{String(this.state.error)}<br/>
        <button onClick={()=>this.setState({error:null})} style={{marginTop:12,padding:'6px 14px',background:'#185fa5',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontFamily:'sans-serif'}}>← Назад</button>
      </div>
    )
    return this.props.children
  }
}
import PageToday from './Today'
import { ConfirmProvider, useConfirm } from './ConfirmDialog'

const ThemeContext = createContext({dark:false, toggle:()=>{}})
function ThemeProvider({children}){
  const [dark,setDark]=useState(()=>localStorage.getItem('theme')==='dark')
  useEffect(()=>{
    document.documentElement.setAttribute('data-theme',dark?'dark':'light')
    localStorage.setItem('theme',dark?'dark':'light')
  },[dark])
  return <ThemeContext.Provider value={{dark,toggle:()=>setDark(d=>!d)}}>{children}</ThemeContext.Provider>
}
const useTheme=()=>useContext(ThemeContext)
const AuthCtx = createContext(null)
const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use(c => {
  const t = localStorage.getItem('token')
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

function Login({ onLogin }) {
  const [email, setEmail] = useState(''); const [pwd, setPwd] = useState(''); const [err, setErr] = useState('')
  useEffect(() => { document.documentElement.setAttribute('data-theme', 'light') }, [])
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
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#eef2f7'}}>
      <div style={{background:'var(--surface)',borderRadius:12,padding:'2rem',width:360,boxShadow:'0 4px 24px rgba(0,0,0,0.15)'}}>
        <h2 style={{marginBottom:'0.25rem',color:'#1a1a2e'}}>CRM RUTEST</h2>
        <p style={{color:'#666',fontSize:13,marginBottom:'1.5rem'}}>B2B продажи лабораторного оборудования</p>
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

const inp = {width:'100%',padding:'10px 12px',border:'1px solid var(--inp-border)',borderRadius:6,marginBottom:10,fontSize:14,outline:'none',boxSizing:'border-box',background:'var(--inp-bg)',color:'var(--text)'}
const sel = {...inp,cursor:'pointer'}
const lbl = {display:'block',fontSize:12,color:'var(--text3)',marginBottom:4,fontWeight:500}

// ── кнопки в таблицах (простые outline / заливка) ───────────────────────────
const btnT = { fontSize:12, padding:'4px 10px', borderRadius:5, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' }
const btnBlue   = { ...btnT, border:'1px solid #185fa5', background:'#eff6ff', color:'#0e4889' }
const btnRed    = { ...btnT, border:'1px solid #fecaca', background:'#fff5f5', color:'#dc2626' }
const btnPurple = { ...btnT, border:'1px solid #c4b5fd', background:'#f5f3ff', color:'#7c3aed' }
const btnGreen  = { ...btnT, border:'1px solid #86efac', background:'#f0fdf4', color:'#166534' }
const btnGray   = { ...btnT, border:'1px solid #d1d5db', background:'#fff', color:'#6b7280', fontWeight:500 }
const btnPrimary= { padding:'8px 16px', borderRadius:6, fontSize:13, cursor:'pointer', border:'none', background:'var(--primary)', color:'#fff', fontWeight:500 }
const btnSecond = { padding:'8px 16px', borderRadius:6, fontSize:13, cursor:'pointer', border:'1px solid var(--primary)', background:'transparent', color:'var(--primary)', fontWeight:500 }

const NAV_ALL = [
  {section:'CRM'},
  {to:'/funnel',label:'Доска'},
  {to:'/today',label:'Задачи'},
  {to:'/quotes',label:'Коммерческие предложения'},
  {section:'БАЗА'},
  {to:'/catalog-products',label:'Каталог товаров'},
  {to:'/contractors',label:'Контрагенты'},
  {to:'/sender-profiles',label:'Профили отправителей'},
  {to:'/contacts',label:'Контакты'},
  {to:'/objects',label:'Объекты'},
  {to:'/services',label:'Каталог услуг'},
  {to:'/dev-reference',label:'Справочник разработчика'},
  {to:'/equipment',label:'Оборудование'},
  {to:'/standards',label:'Стандарты'},
]
const NAV_SALES = [
  {section:'CRM'},
  {to:'/funnel',label:'Доска'},
  {to:'/today',label:'Задачи'},
  {to:'/quotes',label:'Коммерческие предложения'},
  {section:'БАЗА'},
  {to:'/catalog-products',label:'Каталог товаров'},
  {to:'/services',label:'Каталог услуг'},
  {to:'/contractors',label:'Контрагенты'},
  {to:'/sender-profiles',label:'Профили отправителей'},
  {to:'/contacts',label:'Контакты'},
]

function Layout({ user, onLogout }) {
  const isSales = user?.role === 'manager' || user?.role === 'sales'
  const nav = isSales ? NAV_SALES : NAV_ALL
  const navigate = useNavigate()
  const {dark,toggle} = useTheme()
  const confirm = useConfirm()
  const guardedNav=(e,to)=>{
    e.preventDefault()
    if(window.__formIsDirty){
      void confirm({
        title: 'Несохранённые изменения',
        message: 'Перейти без сохранения?',
        confirmText: 'Перейти',
      }).then(ok=>{
        if(ok){
          window.__formIsDirty=false
          navigate(to)
        }
      })
    } else {
      navigate(to)
    }
  }
  return (
    <div style={{display:'flex',minHeight:'100vh'}}>
      <aside style={{width:210,background:'var(--aside-bg)',color:'#fff',padding:'1.5rem 0',flexShrink:0,display:'flex',flexDirection:'column',transition:'background .25s'}}>
        <div style={{padding:'0 1.25rem 1.25rem',borderBottom:'1px solid var(--aside-border)'}}>
          <div style={{fontSize:13,fontWeight:600,color:'var(--aside-head)'}}>CRM RUTEST</div>
          <div style={{fontSize:11,color:'var(--aside-text)',marginTop:2}}>{user?.name}</div>
          <div style={{fontSize:10,color:'var(--aside-text)',opacity:0.6,marginTop:1}}>{user?.role}</div>
        </div>
        <nav style={{marginTop:'1rem',flex:1}}>
          {nav.map((n,i)=>{
            if(n.section) return (
              <div key={i} style={{padding:'14px 1.25rem 4px',fontSize:10,fontWeight:700,letterSpacing:'0.08em',color:'var(--aside-section)',textTransform:'uppercase'}}>{n.section}</div>
            )
            return (
              <NavLink key={n.to} to={n.to}
                onClick={e=>guardedNav(e,n.to)}
                style={({isActive})=>({display:'block',padding:'10px 1.25rem',fontSize:14,color:isActive?'var(--aside-active-text)':'var(--aside-text)',background:isActive?'var(--aside-active-bg)':'transparent',textDecoration:'none',borderLeft:isActive?'3px solid var(--aside-head)':'3px solid transparent'})}>
                {n.label}
              </NavLink>
            )
          })}
        </nav>
        <div style={{padding:'0 1.25rem',marginBottom:10}}>
          <button onClick={toggle}
            title={dark?'Светлая тема':'Тёмная тема'}
            style={{width:'100%',padding:'6px 12px',background:'transparent',border:'1px solid var(--aside-border)',color:'var(--aside-text)',borderRadius:4,fontSize:11,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:8,transition:'all .2s'}}>
            <span style={{fontSize:15}}>{dark?'☀️':'🌙'}</span>
            <span>{dark?'Светлая тема':'Тёмная тема'}</span>
          </button>
        </div>
        <button onClick={onLogout} style={{margin:'0 1.25rem 1.5rem',background:'transparent',border:'1px solid var(--aside-border)',color:'var(--aside-text)',padding:'6px 12px',borderRadius:4,fontSize:11,fontWeight:500,cursor:'pointer'}}>Выйти</button>
      </aside>
      <main style={{flex:1,padding:'1.5rem',overflowY:'auto',background:'var(--bg)',transition:'background .25s'}}>
        <Routes>
          <Route path="/catalog-products" element={<ProductCatalog />} />
          <Route path="/quotes" element={<CommercialOffers />} />
          <Route path="/sender-profiles" element={<SenderProfiles />} />
          <Route path="/today" element={<PageToday user={user} />} />          <Route path="/requests"  element={<PageRequests />} />
          <Route path="/clients"   element={<PageContractors />} />
          <Route path="/contractors" element={<PageContractors />} />
          <Route path="/contacts"  element={<PageContacts />} />
          <Route path="/objects"   element={<PageObjects />} />
          <Route path="/services"  element={<ServicesCatalog />} />
          <Route path="/dev-reference" element={<PageDeveloperReference />} />
          <Route path="/equipment" element={<PageEquipment />} />
          <Route path="/standards" element={<PageStandards />} />
          <Route path="/funnel" element={<PageFunnel user={user} />} />
          <Route path="*" element={<Navigate to={isSales ? '/today' : '/funnel'} replace />} />
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
    <div style={{background:'var(--surface)',borderRadius:10,padding:'1.25rem',marginBottom:'1rem',boxShadow:'var(--shadow)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <h2 style={{fontSize:16,fontWeight:600,color:'var(--text)'}}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}
function Btn({onClick,children,variant='primary',type='button',disabled}) {
  const st = variant==='primary'?btnPrimary:btnSecond
  return <button type={type} onClick={onClick} disabled={disabled} style={{...st,opacity:disabled?0.55:1,cursor:disabled?'not-allowed':'pointer'}}>{children}</button>
}
function Th({children}) { return <th style={{textAlign:'left',padding:'8px 10px',color:'var(--text4)',fontWeight:500,fontSize:12,borderBottom:'2px solid var(--border)',whiteSpace:'nowrap'}}>{children}</th> }
function Td({children,bold}) { return <td style={{padding:'8px 10px',fontSize:13,color:bold?'var(--primary)':'var(--text2)',fontWeight:bold?500:400,borderBottom:'1px solid var(--border2)'}}>{children||'—'}</td> }

const SOURCES = [
  {v:'',              l:'— не указан —'},
  {v:'inbound_call',  l:'📞 Входящий звонок'},
  {v:'outbound_call', l:'📲 Исходящий (холодный) звонок'},
  {v:'email',         l:'📧 Email / сайт'},
  {v:'referral',      l:'🤝 Рекомендация'},
  {v:'exhibition',    l:'🏛 Выставка / конференция'},
  {v:'tender',        l:'📋 Тендер / запрос'},
  {v:'repeat',        l:'🔄 Повторный клиент'},
  {v:'other',         l:'Другое'},
]
const sourceLabel = v => SOURCES.find(s=>s.v===v)?.l || v || '—'

function parseSampleJsonArr(s){
  if(s==null||s==='') return []
  if(Array.isArray(s)) return s
  try{ const j=JSON.parse(s); return Array.isArray(j)?j:[] }catch{ return [] }
}
function parseSampleJsonIntArr(s){
  if(s==null||s==='') return []
  if(Array.isArray(s)) return s.map(Number).filter(n=>!Number.isNaN(n))
  try{ const j=JSON.parse(s); return Array.isArray(j)?j.map(Number).filter(n=>!Number.isNaN(n)):[] }catch{ return [] }
}

function parseVariantOptions(variantsJson){
  if(!variantsJson||typeof variantsJson!=='string') return []
  try{
    const j=JSON.parse(variantsJson)
    if(Array.isArray(j)) return j.filter(x=>typeof x==='string'&&x.trim())
    return []
  }catch{ return [] }
}

function emptySample(){
  return {
    request_id:'', material_type:'abs_58401', material_name:'',
    material_grade:'', manufacturer:'', sampling_date:'',
    registration_date: new Date().toISOString().slice(0,10),
    sampling_location:'', sampled_by:'', sampling_conditions:'', act_type:'intake',
    material_norm_id:'',
    material_category:'',
    primary_nd_selected:[],
    additional_nd_selected:[],
    methodology_catalog_ids:[],
    material_category_id:'',
    material_test_object_id:'',
    material_variant:'',
    selected_indicator_ids:[],
  }
}

function SampleForm({ requests, onSave, onCancel, initial }) {
  const confirm = useConfirm()
  const normsCsvInputRef = useRef(null)
  const [f, setF] = useState(()=>emptySample())
  const [materialNorms,setMaterialNorms]=useState([])
  const [normBusy,setNormBusy]=useState(false)
  const [catItems,setCatItems]=useState([])
  const [additionalModalOpen,setAdditionalModalOpen]=useState(false)
  const [refCats,setRefCats]=useState([])
  const [refObjects,setRefObjects]=useState([])
  const [refIndicators,setRefIndicators]=useState([])

  useEffect(()=>{
    if(!initial){
      setF(emptySample())
      return
    }
    setF({
      ...emptySample(),
      ...initial,
      request_id: initial.request_id!=null?String(initial.request_id):'',
      material_norm_id: initial.material_norm_id!=null?String(initial.material_norm_id):'',
      primary_nd_selected: (() => {
        const a = parseSampleJsonArr(initial.primary_nd_json)
        return a.length ? [a[0]] : []
      })(),
      additional_nd_selected: parseSampleJsonArr(initial.additional_nd_json),
      methodology_catalog_ids: parseSampleJsonIntArr(initial.methodology_catalog_json),
      selected_indicator_ids: parseSampleJsonIntArr(initial.selected_indicator_ids_json),
      material_category_id: initial.material_category_id!=null?String(initial.material_category_id):'',
      material_test_object_id: initial.material_test_object_id!=null?String(initial.material_test_object_id):'',
      material_variant: initial.material_variant||'',
      sampling_date: initial.sampling_date||'',
      registration_date: initial.registration_date||'',
      material_type: initial.material_type||'abs_58401',
      act_type: initial.act_type||'intake',
      material_category: '',
    })
  }, [initial?.id])

  useEffect(()=>{api.get('/reference/categories').then(r=>setRefCats(r.data)).catch(()=>setRefCats([]))},[])
  useEffect(()=>{
    if(!f.material_category_id){ setRefObjects([]); return }
    api.get('/reference/test-objects',{params:{category_id:f.material_category_id}}).then(r=>setRefObjects(r.data)).catch(()=>setRefObjects([]))
  },[f.material_category_id])
  useEffect(()=>{
    if(!f.material_test_object_id){ setRefIndicators([]); return }
    api.get('/reference/indicators',{params:{test_object_id:f.material_test_object_id}}).then(r=>setRefIndicators(r.data)).catch(()=>setRefIndicators([]))
  },[f.material_test_object_id])

  useEffect(()=>{
    api.get('/material-norms').then(r=>setMaterialNorms(r.data)).catch(()=>setMaterialNorms([]))
  },[])

  useEffect(()=>{
    const id=f.material_norm_id
    if(!id){ setCatItems([]); return }
    api.get('/catalog/items',{params:{material_norm_id:id}}).then(r=>setCatItems(r.data)).catch(()=>setCatItems([]))
  },[f.material_norm_id])

  useEffect(()=>{
    if(!materialNorms.length||!f.material_norm_id) return
    const mn=materialNorms.find(x=>String(x.id)===String(f.material_norm_id))
    if(!mn) return
    const cat=mn.category_label||''
    setF(p=>(p.material_category===cat?p:{...p,material_category:cat}))
  },[materialNorms,f.material_norm_id])

  const set = (k,v) => setF(p=>({...p,[k]:v}))
  const toggleStr=(field,s)=>{
    setF(p=>{
      const arr=[...(p[field]||[])]
      const i=arr.indexOf(s)
      if(i>=0) arr.splice(i,1)
      else arr.push(s)
      return {...p,[field]:arr}
    })
  }
  const toggleMethodId=id=>{
    setF(p=>{
      const arr=[...(p.methodology_catalog_ids||[])]
      const i=arr.indexOf(id)
      if(i>=0) arr.splice(i,1)
      else arr.push(id)
      return {...p,methodology_catalog_ids:arr}
    })
  }

  const toggleRefIndicator=id=>{
    setF(p=>{
      const arr=[...(p.selected_indicator_ids||[])]
      const i=arr.indexOf(id)
      if(i>=0) arr.splice(i,1)
      else arr.push(id)
      return {...p,selected_indicator_ids:arr}
    })
  }

  const onPickRequest=async e=>{
    const v=e.target.value
    setF(p=>({...p,request_id:v}))
    if(!v) return
    try{
      const {data:d}=await api.get(`/requests/${v}`)
      setF(p=>({
        ...p,
        request_id:v,
        material_category_id: d.material_category_id!=null?String(d.material_category_id):'',
        material_test_object_id: d.material_test_object_id!=null?String(d.material_test_object_id):'',
        material_variant: d.material_variant||'',
        selected_indicator_ids: Array.isArray(d.selected_indicator_ids)?[...d.selected_indicator_ids]:[],
      }))
    }catch(_){ /* ignore */ }
  }

  const importNorms=async(force)=>{
    setNormBusy(true)
    try{
      await api.post('/material-norms/import-default',null,{params:force?{force:true}:undefined})
      const r=await api.get('/material-norms')
      setMaterialNorms(r.data)
    }catch(e){
      const st=e.response?.status
      if(st===409){
        const ok=await confirm({
          title:'Перезагрузить справочник НД',
          message:'Справочник уже загружен. Заменить данными из CSV? Ссылки проб на старые id справочника будут сброшены.',
          danger:true,
          confirmText:'Заменить',
        })
        if(ok) return importNorms(true)
      }
      else alert(e.response?.data?.detail||e.message)
    }finally{setNormBusy(false)}
  }

  const onUploadNormsCsv=async e=>{
    const file=e.target.files?.[0]
    e.target.value=''
    if(!file) return
    if(materialNorms.length>0){
      const ok=await confirm({
        title:'Заменить справочник НД',
        message:'Текущий справочник будет удалён и заменён данными из выбранного файла. Ссылки проб на старые id будут сброшены.',
        danger:true,
        confirmText:'Заменить',
      })
      if(!ok) return
    }
    setNormBusy(true)
    try{
      const fd=new FormData()
      fd.append('file',file)
      const {data}=await api.post('/material-norms/import-upload',fd,{params:{force:materialNorms.length>0}})
      const r=await api.get('/material-norms')
      setMaterialNorms(r.data)
      alert(`Импортировано строк: ${data.imported} (${data.file})`)
    }catch(err){
      const d=err.response?.data
      const msg=typeof d==='string'?d:(d?.detail||(Array.isArray(d)?d.map(x=>x.msg).join('; '):null))||err.message
      alert(msg)
    }finally{setNormBusy(false)}
  }

  const onPickCategory=e=>{
    const v=e.target.value
    setF(p=>({
      ...p,
      material_category:v,
      material_norm_id:'',
      primary_nd_selected:[],
      additional_nd_selected:[],
      methodology_catalog_ids:[],
    }))
    setAdditionalModalOpen(false)
  }

  const onPickNorm=e=>{
    const v=e.target.value
    if(!v){
      setF(p=>({...p,material_norm_id:'',primary_nd_selected:[],additional_nd_selected:[],methodology_catalog_ids:[]}))
      setAdditionalModalOpen(false)
      return
    }
    const mn=materialNorms.find(x=>String(x.id)===v)
    const prim = mn?.primary_standards
    const onePrimary = prim?.length===1 ? [prim[0]] : []
    setF(p=>({
      ...p,
      material_norm_id:v,
      material_category: mn?.category_label||'',
      material_name: mn?mn.material_label.replace(/\s*\n\s*/g,' ').trim():p.material_name,
      primary_nd_selected: onePrimary,
      additional_nd_selected:[],
      methodology_catalog_ids:[],
    }))
    setAdditionalModalOpen(false)
  }

  const setPrimaryNd=s=>{
    setF(p=>({...p,primary_nd_selected:s?[s]:[]}))
  }

  const selectedNorm = materialNorms.find(x=>String(x.id)===String(f.material_norm_id))
  const selectedRefObj = refObjects.find(o=>String(o.id)===String(f.material_test_object_id))
  const refVariantOpts = parseVariantOptions(selectedRefObj?.variants_json)
  const refPriceSum = (refIndicators||[]).reduce((s,it)=>{
    if(!(f.selected_indicator_ids||[]).includes(it.id)) return s
    return s+(Number(it.price_rub)||0)
  },0)
  const categories=[...new Set(materialNorms.map(m=>m.category_label||''))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'ru'))
  const materialsInCat=f.material_category
    ? materialNorms.filter(m=>(m.category_label||'')===f.material_category)
    : []
  const chk = { fontSize:12, display:'flex', alignItems:'flex-start', gap:6, marginBottom:6, color:'var(--text2)', cursor:'pointer' }

  const submit = async e => {
    e.preventDefault()
    if (f.material_norm_id && selectedNorm?.primary_standards?.length > 0) {
      if (!(f.primary_nd_selected && f.primary_nd_selected.length === 1)) {
        alert('Выберите один основной нормативный документ по материалу.')
        return
      }
    }
    const payload = {
      request_id: f.request_id||null,
      material_type: f.material_type,
      material_name: f.material_name||null,
      material_grade: f.material_grade||null,
      manufacturer: f.manufacturer||null,
      sampling_date: f.sampling_date||null,
      registration_date: f.registration_date,
      sampling_location: f.sampling_location||null,
      sampled_by: f.sampled_by||null,
      sampling_conditions: f.sampling_conditions||null,
      act_type: f.act_type||'intake',
      material_norm_id: f.material_norm_id ? Number(f.material_norm_id) : null,
      primary_nd_selected: (f.primary_nd_selected && f.primary_nd_selected[0]) ? [f.primary_nd_selected[0]] : [],
      additional_nd_selected: f.additional_nd_selected || [],
      methodology_catalog_ids: f.methodology_catalog_ids || [],
      material_category_id: f.material_category_id ? Number(f.material_category_id) : null,
      material_test_object_id: f.material_test_object_id ? Number(f.material_test_object_id) : null,
      material_variant: f.material_variant || null,
      selected_indicator_ids: f.selected_indicator_ids || [],
    }
    if (initial?.id) await api.put(`/samples/${initial.id}`, payload)
    else await api.post('/samples', payload)
    onSave()
  }
  const row2 = {display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}
  const row3 = {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}
  return (
    <form onSubmit={submit} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'1.25rem',marginBottom:'1rem'}}>
      <h3 style={{fontSize:14,fontWeight:600,color:'#1a1a2e',marginBottom:'1rem',paddingBottom:8,borderBottom:'1px solid #e8ecf5'}}>
        {initial?.id ? 'Редактировать пробу' : 'Регистрация новой пробы'}
      </h3>

      <div style={{background:'var(--surface)',borderRadius:8,padding:'1rem',marginBottom:12,border:'1px solid var(--border)'}}>
        <div style={{fontSize:11,fontWeight:600,color:'var(--primary)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>Связь с заявкой</div>
        <div style={row2}>
          <div>
            <label style={lbl}>Заявка</label>
            <select value={f.request_id} onChange={onPickRequest} style={sel}>
              <option value="">— Без заявки —</option>
              {requests.map(r=><option key={r.id} value={r.id}>{r.number}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Вид акта при приёме</label>
            <select value={f.act_type} onChange={e=>set('act_type',e.target.value)} style={sel}>
              <option value="intake">Акт приёма-передачи проб</option>
              <option value="sampling">Акт отбора проб</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{background:'var(--surface)',borderRadius:8,padding:'1rem',marginBottom:12,border:'1px solid var(--border)'}}>
        <div style={{fontSize:11,fontWeight:600,color:'var(--primary)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>Справочник заявки (категория, материал, прайс)</div>
        <p style={{fontSize:12,color:'var(--text3)',margin:'0 0 10px',lineHeight:1.45}}>Совпадает с заполнением заявки: выберите категорию и объект испытаний — список показателей подставится из справочника. При выборе заявки выше поля можно подтянуть из неё.</p>
        <div style={row2}>
          <div>
            <label style={lbl}>Категория объекта испытаний</label>
            <select
              value={f.material_category_id}
              onChange={e=>setF(p=>({...p,material_category_id:e.target.value,material_test_object_id:'',material_variant:'',selected_indicator_ids:[]}))}
              style={sel}
            >
              <option value="">— Не из справочника —</option>
              {refCats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Объект испытаний (материал)</label>
            <select
              value={f.material_test_object_id}
              onChange={e=>setF(p=>({...p,material_test_object_id:e.target.value,material_variant:'',selected_indicator_ids:[]}))}
              disabled={!f.material_category_id}
              style={sel}
            >
              <option value="">{f.material_category_id?'— Выберите объект —':'Сначала категорию'}</option>
              {refObjects.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </div>
        <div style={row2}>
          <div>
            <label style={lbl}>Марка / класс / фракция</label>
            {refVariantOpts.length>0 ? (
              <select value={f.material_variant} onChange={e=>set('material_variant',e.target.value)} style={sel}>
                <option value="">— Укажите вариант —</option>
                {refVariantOpts.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            ) : (
              <input value={f.material_variant} onChange={e=>set('material_variant',e.target.value)} placeholder="Марка II, фракция 5–20 и т.п." style={inp}/>
            )}
          </div>
          <div>
            <label style={lbl}>Сумма по выбранным показателям (справочно)</label>
            <div style={{...inp,display:'flex',alignItems:'center',marginBottom:10,background:'var(--surface2,#f8fafc)'}}>
              {refPriceSum>0 ? `${refPriceSum.toLocaleString('ru')} ₽` : '—'}
            </div>
          </div>
        </div>
        {f.material_test_object_id ? (
          refIndicators.length===0 ? (
            <p style={{fontSize:12,color:'#b45309',margin:0}}>Для этого объекта нет показателей в справочнике. Выполните синхронизацию справочника или добавьте показатели в базе.</p>
          ) : (
            <div style={{maxHeight:260,overflowY:'auto',border:'1px solid var(--border2)',borderRadius:8,padding:8,marginTop:8}}>
              {refIndicators.map(it=>(
                <label key={it.id} style={{...chk,marginBottom:8,alignItems:'flex-start'}}>
                  <input type="checkbox" checked={(f.selected_indicator_ids||[]).includes(it.id)} onChange={()=>toggleRefIndicator(it.id)}/>
                  <span>
                    <b>{it.characteristic}</b>
                    {it.standard_ref?` — ${it.standard_ref}`:''}
                    <span style={{color:'var(--text3)',fontSize:11}}>
                      {it.price_code?` · прайс: ${it.price_code}`:''}
                      {it.price_rub!=null?` · ${Number(it.price_rub).toLocaleString('ru')} ₽`:''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )
        ):null}
      </div>

      <div style={{background:'var(--surface)',borderRadius:8,padding:'1rem',marginBottom:12,border:'1px solid var(--border)'}}>
        <div style={{fontSize:11,fontWeight:600,color:'var(--primary)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>Материал</div>
        <div style={row2}>
          <div>
            <label style={lbl}>Вид материала *</label>
            <select value={f.material_type} onChange={e=>set('material_type',e.target.value)} style={sel} required>
              {MATERIAL_TYPES.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Наименование материала *</label>
            <input value={f.material_name} onChange={e=>set('material_name',e.target.value)} placeholder="Асфальтобетонная смесь горячая мелкозернистая" style={inp}/>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={lbl}>Справочник материалов и НД</label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:10}}>
            <div>
              <label style={{...lbl,fontSize:11}}>Категория материала</label>
              <select value={f.material_category} onChange={onPickCategory} style={{...sel,marginBottom:0}}>
                <option value="">— Выберите категорию —</option>
                {categories.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{...lbl,fontSize:11}}>Объект испытаний (материал)</label>
              <select value={f.material_norm_id} onChange={onPickNorm} disabled={!f.material_category} style={{...sel,marginBottom:0}}>
                <option value="">{f.material_category?'— Выберите материал —':'Сначала категорию'}</option>
                {materialsInCat.map(m=><option key={m.id} value={m.id}>{m.material_label.replace(/\s*\n\s*/g,' · ').slice(0,140)}{m.material_label.length>140?'…':''}</option>)}
              </select>
            </div>
          </div>
          <input ref={normsCsvInputRef} type="file" accept=".csv,text/csv" style={{display:'none'}} onChange={e=>void onUploadNormsCsv(e)}/>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            {materialNorms.length===0&&(
              <Btn type="button" onClick={()=>void importNorms(false)} disabled={normBusy}>{normBusy?'Загрузка…':'Импорт из поставки (сервер)'}</Btn>
            )}
            {materialNorms.length>0&&(
              <Btn type="button" variant="secondary" onClick={()=>void importNorms(false)} disabled={normBusy}>Обновить с сервера</Btn>
            )}
            <Btn type="button" variant="secondary" onClick={()=>normsCsvInputRef.current?.click()} disabled={normBusy}>
              {normBusy?'…':'Загрузить CSV с диска'}
            </Btn>
          </div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>
            Формат: разделитель «;» — (1) категория; (2) объект испытаний; (3) НД к материалу; (4) доп. НД. Дефолтный файл на сервере: <code style={{fontSize:10}}>backend/data/material_objects_categories.csv</code>. При выборе материала подставляется наименование.
          </div>
        </div>
        <div style={row3}>
          <div>
            <label style={lbl}>Тип / Марка</label>
            <input value={f.material_grade} onChange={e=>set('material_grade',e.target.value)} placeholder="Тип Б, Марка II" style={inp}/>
          </div>
          <div>
            <label style={lbl}>Изготовитель</label>
            <input value={f.manufacturer} onChange={e=>set('manufacturer',e.target.value)} placeholder="АО «АсфальтЗавод №1»" style={inp}/>
          </div>
          <div/>
        </div>
      </div>

      {selectedNorm&&(
        <div style={{background:'var(--surface)',borderRadius:8,padding:'1rem',marginBottom:12,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,fontWeight:600,color:'var(--primary)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>Нормативные документы по материалу</div>
          {selectedNorm.primary_standards?.length>0?(
            <>
              <div style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:8}}>НД по материалу — один обязательный (столбец 3 файла)</div>
              <p style={{fontSize:11,color:'var(--text3)',margin:'0 0 8px'}}>Документ, определяющий требования к материалу / изготовлению продукции.</p>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
                {selectedNorm.primary_standards.map(s=>(
                  <label key={s} style={{...chk,marginBottom:0}}>
                    <input type="radio" name="sample_primary_nd" checked={(f.primary_nd_selected||[])[0]===s} onChange={()=>setPrimaryNd(s)}/>
                    <span style={{whiteSpace:'pre-line'}}>{s}</span>
                  </label>
                ))}
              </div>
            </>
          ):<p style={{fontSize:12,color:'var(--text3)'}}>Нет перечня основных НД для этой строки справочника.</p>}
          {selectedNorm.additional_standards?.length>0?(
            <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--border2)'}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:8}}>Дополнительные требования (4-й столбец справочника)</div>
              <p style={{fontSize:11,color:'var(--text3)',margin:'0 0 8px'}}>НД с дополнительными требованиями — при необходимости отметьте на отдельной панели (кнопка ниже).</p>
              <Btn type="button" variant="secondary" onClick={()=>setAdditionalModalOpen(true)}>
                Выбрать дополнительные НД
                {(f.additional_nd_selected||[]).length>0 ? ` (${(f.additional_nd_selected||[]).length})` : ''}
              </Btn>
              {(f.additional_nd_selected||[]).length>0&&(
                <div style={{fontSize:11,color:'var(--text3)',marginTop:8,whiteSpace:'pre-line'}}>
                  Выбрано: {(f.additional_nd_selected||[]).join('; ')}
                </div>
              )}
            </div>
          ):null}
        </div>
      )}

      {additionalModalOpen && selectedNorm?.additional_standards?.length>0 && (
        <div
          role="presentation"
          style={{
            position:'fixed',inset:0,zIndex:99990,
            background:'rgba(15, 23, 42, 0.55)',display:'flex',alignItems:'center',justifyContent:'center',
            padding:'1.5rem',backdropFilter:'blur(2px)',
          }}
          onClick={()=>setAdditionalModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sample-additional-nd-title"
            onClick={e=>e.stopPropagation()}
            style={{
              background:'var(--surface, #fff)',color:'var(--text, #1a1a2e)',borderRadius:12,
              padding:'1.25rem 1.5rem',maxWidth:520,width:'100%',
              maxHeight:'85vh',overflow:'auto',
              boxShadow:'0 20px 50px rgba(0,0,0,0.18), 0 0 0 1px var(--border, #e2e8f0)',
            }}
          >
            <h3 id="sample-additional-nd-title" style={{margin:'0 0 10px',fontSize:16,fontWeight:700}}>Дополнительные нормативные документы</h3>
            <p style={{margin:'0 0 12px',fontSize:13,color:'var(--text3)',lineHeight:1.5}}>Отметьте применимые документы. Это не заменяет обязательный основной НД выше.</p>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
              {selectedNorm.additional_standards.map(s=>(
                <label key={s} style={chk}>
                  <input type="checkbox" checked={(f.additional_nd_selected||[]).includes(s)} onChange={()=>toggleStr('additional_nd_selected',s)}/>
                  <span style={{whiteSpace:'pre-line'}}>{s}</span>
                </label>
              ))}
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <Btn type="button" variant="secondary" onClick={()=>setAdditionalModalOpen(false)}>Закрыть</Btn>
              <Btn type="button" onClick={()=>setAdditionalModalOpen(false)}>Готово</Btn>
            </div>
          </div>
        </div>
      )}

      {f.material_norm_id?(
        <div style={{background:'var(--surface)',borderRadius:8,padding:'1rem',marginBottom:12,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,fontWeight:600,color:'var(--primary)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>Показатели и методики (область аккредитации)</div>
          <p style={{fontSize:12,color:'var(--text3)',margin:'0 0 8px'}}>Отфильтровано по материалу из каталога услуг. Отметьте нужные строки.</p>
          {catItems.length===0?(
            <p style={{fontSize:12,color:'#b45309'}}>Нет позиций каталога для этого материала. Импортируйте каталог услуг или проверьте совпадение названия с блоком «Объект испытаний» в CSV области аккредитации.</p>
          ):(
            <div style={{maxHeight:280,overflowY:'auto',border:'1px solid var(--border2)',borderRadius:8,padding:8}}>
              {catItems.map(it=>(
                <label key={it.id} style={{...chk,marginBottom:8,alignItems:'center'}}>
                  <input type="checkbox" checked={(f.methodology_catalog_ids||[]).includes(it.id)} onChange={()=>toggleMethodId(it.id)}/>
                  <span><b>{it.characteristic}</b>{it.standard_ref?` — ${it.standard_ref}`:''}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ):null}

      <div style={{background:'var(--surface)',borderRadius:8,padding:'1rem',marginBottom:12,border:'1px solid var(--border)'}}>
        <div style={{fontSize:11,fontWeight:600,color:'var(--primary)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>Даты</div>
        <div style={row3}>
          <div>
            <label style={lbl}>Дата отбора пробы</label>
            <input type="date" value={f.sampling_date} onChange={e=>set('sampling_date',e.target.value)} style={inp}/>
          </div>
          <div>
            <label style={lbl}>Дата регистрации *</label>
            <input type="date" value={f.registration_date} onChange={e=>set('registration_date',e.target.value)} style={inp} required/>
          </div>
          <div/>
        </div>
      </div>

      <div style={{background:'var(--surface)',borderRadius:8,padding:'1rem',marginBottom:12,border:'1px solid var(--border)'}}>
        <div style={{fontSize:11,fontWeight:600,color:'var(--primary)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>Место и условия отбора</div>
        <div style={{marginBottom:12}}>
          <label style={lbl}>Место отбора пробы *</label>
          <input value={f.sampling_location} onChange={e=>set('sampling_location',e.target.value)} placeholder="г. Уфа, ул. Кирова, д. 10, км 3+400" style={inp}/>
        </div>
        <div style={row2}>
          <div>
            <label style={lbl}>Кем отобрана проба</label>
            <input value={f.sampled_by} onChange={e=>set('sampled_by',e.target.value)} placeholder="Инженер Петров А.В." style={inp}/>
          </div>
          <div>
            <label style={lbl}>Условия при отборе</label>
            <input value={f.sampling_conditions} onChange={e=>set('sampling_conditions',e.target.value)} placeholder="t воздуха +12°C, без осадков" style={inp}/>
          </div>
        </div>
      </div>

      <div style={{display:'flex',gap:8}}>
        <Btn type="submit">Сохранить пробу</Btn>
        <Btn variant="secondary" type="button" onClick={onCancel}>Отмена</Btn>
      </div>
    </form>
  )
}

function PageSamples() {
  const [rows,setRows] = useState([])
  const [requests,setRequests] = useState([])
  const [showForm,setShowForm] = useState(false)
  const [editing,setEditing] = useState(null)
  const [filter,setFilter] = useState('')

  const load = () => { api.get('/samples').then(r=>setRows(r.data)) }
  useEffect(()=>{ load(); api.get('/requests').then(r=>setRequests(r.data)) },[])

  const onSave = () => { setShowForm(false); setEditing(null); load() }
  const onEdit = s => { setEditing(s); setShowForm(true); window.scrollTo(0,0) }

  const filtered = rows.filter(r =>
    !filter || r.lab_number?.includes(filter) ||
    r.material_name?.toLowerCase().includes(filter.toLowerCase()) ||
    r.sampling_location?.toLowerCase().includes(filter.toLowerCase())
  )

  const matLabel = v => MATERIAL_TYPES.find(m=>m.v===v)?.l || v

  return (
    <>
      {showForm && (
        <SampleForm requests={requests} onSave={onSave} onCancel={()=>{setShowForm(false);setEditing(null)}} initial={editing}/>
      )}
      <Card
        title={`Пробы (${rows.length})`}
        action={!showForm && <Btn onClick={()=>{setEditing(null);setShowForm(true)}}>+ Новая проба</Btn>}
      >
        <div style={{marginBottom:12}}>
          <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Поиск по номеру, материалу, месту отбора..." style={{...inp,marginBottom:0,maxWidth:400}}/>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr>
              <Th>Лаб. №</Th><Th>Материал</Th><Th>Тип/Марка</Th>
              <Th>Место отбора</Th><Th>Дата отбора</Th><Th>Дата рег.</Th>
              <Th>Статус</Th><Th>Действия</Th>
            </tr></thead>
            <tbody>
              {filtered.map(r=>(
                <tr key={r.id} style={{borderBottom:'1px solid var(--border2)'}}>
                  <Td bold>{r.lab_number}</Td>
                  <Td>{r.material_name || matLabel(r.material_type)}</Td>
                  <Td>{r.material_grade}</Td>
                  <Td>{r.sampling_location}</Td>
                  <Td>{r.sampling_date}</Td>
                  <Td>{r.registration_date}</Td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border2)'}}>
{(()=>{const st=STAGE_LABELS[r.stage||'new_request']||STAGE_LABELS['new_request'];return <span style={{fontSize:11,padding:'3px 8px',borderRadius:4,background:st.bg,color:st.color,whiteSpace:'nowrap',fontWeight:500}}>{st.label}</span>})()}
</td>
                  <td style={{padding:'6px 10px',borderBottom:'1px solid var(--border2)'}}>
                    <button type="button" onClick={()=>onEdit(r)} style={btnBlue}>Изменить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length===0 && <p style={{color:'var(--text4)',textAlign:'center',padding:'2rem',fontSize:13}}>{filter?'Ничего не найдено':'Проб пока нет — нажмите «+ Новая проба»'}</p>}
      </Card>
    </>
  )
}


const STAGE_LABELS={
  new_request:{label:'Новая заявка',color:'#6366f1',bg:'#eef2ff'},
  negotiation:{label:'Согласование',color:'#f59e0b',bg:'#fffbeb'},
  contract:{label:'Договор и счёт',color:'#10b981',bg:'#ecfdf5'},
  waiting_samples:{label:'Ожидание проб',color:'#3b82f6',bg:'#eff6ff'},
  in_work:{label:'В работе',color:'#8b5cf6',bg:'#f5f3ff'},
  waiting_payment:{label:'Ожидание оплаты',color:'#ef4444',bg:'#fef2f2'},
  results:{label:'Выдача результатов',color:'#06b6d4',bg:'#ecfeff'},
  upd:{label:'Подписание УПД',color:'#22c55e',bg:'#f0fdf4'},
}
const EMPTY_REQ = {
  client_id: '',
  contact_name: '',
  description: '',
  source: '',
  quantity: 1,
  price: '',
  urgency: 'normal',
  assigned_to: '',
  notes: '',
}

const NOTE_TYPES=[
  {v:'call',    l:'📞 Звонок',        color:'#0ea5e9', bg:'#e0f2fe'},
  {v:'meeting', l:'🤝 Встреча',       color:'#8b5cf6', bg:'#ede9fe'},
  {v:'note',    l:'📝 Заметка',       color:'var(--text3)', bg:'#f1f5f9'},
  {v:'agreement',l:'✅ Договорились', color:'#16a34a', bg:'#dcfce7'},
  {v:'email',   l:'📧 Email',         color:'#f59e0b', bg:'#fef3c7'},
  {v:'file',    l:'📎 Файл/ссылка',   color:'#ec4899', bg:'#fce7f3'},
]
const ntLabel=v=>NOTE_TYPES.find(t=>t.v===v)||NOTE_TYPES[2]

function RequestTimeline({req, clients, onClose}){
  const [notes,setNotes]=useState([])
  const [loading,setLoading]=useState(true)
  const [nType,setNType]=useState('note')
  const [nText,setNText]=useState('')
  const [saving,setSaving]=useState(false)
  const client=clients.find(c=>c.id===req.client_id)
  const confirm = useConfirm()

  const load=()=>{
    setLoading(true)
    api.get(`/requests/${req.id}/notes`).then(r=>{setNotes(r.data)}).catch(()=>{}).finally(()=>setLoading(false))
  }
  useEffect(()=>{load()},[req.id])

  const addNote=async()=>{
    if(!nText.trim()) return
    setSaving(true)
    try{
      await api.post(`/requests/${req.id}/notes`,{note_type:nType,content:nText.trim()})
      setNText('')
      load()
    }catch(e){alert(e.response?.data?.detail||'Ошибка сохранения')}
    finally{setSaving(false)}
  }
  const delNote=async(noteId)=>{
    const ok=await confirm({title:'Удаление записи',message:'Удалить запись?',danger:true,confirmText:'Удалить'})
    if(!ok)return
    await api.delete(`/requests/${req.id}/notes/${noteId}`)
    load()
  }

  const st=STAGE_LABELS[req.stage||'new_request']||STAGE_LABELS['new_request']
  const fmtDt=s=>{if(!s)return'';const d=new Date(s);return d.toLocaleDateString('ru',{day:'2-digit',month:'short',year:'numeric'})+' '+d.toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}

  return(
    <div style={{background:'var(--surface)',borderRadius:10,padding:'1.5rem',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
      {/* Шапка */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,paddingBottom:12,borderBottom:'2px solid #e8ecf5'}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <h2 style={{margin:0,fontSize:16,fontWeight:700}}>История: {req.number}</h2>
            <span style={{fontSize:11,padding:'3px 8px',borderRadius:4,background:st.bg,color:st.color,fontWeight:500}}>{st.label}</span>
          </div>
          <div style={{fontSize:12,color:'var(--text3)'}}>
            {client?.name||'Клиент не указан'}
            {req.contact_name&&<> · {req.contact_name}</>}
            {req.material_type&&<> · {req.material_type}</>}
            {req.price&&<> · {Number(req.price).toLocaleString('ru')} ₽</>}
          </div>
        </div>
        <button onClick={onClose} style={{padding:'6px 14px',background:'transparent',color:'var(--text3)',border:'1px solid var(--border)',borderRadius:6,fontSize:13,cursor:'pointer'}}>← Назад</button>
      </div>

      {/* Форма добавления */}
      <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'14px 16px',marginBottom:20}}>
        <div style={{fontSize:12,fontWeight:600,color:'var(--text2)',marginBottom:8}}>Добавить запись</div>
        <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap'}}>
          {NOTE_TYPES.map(t=>(
            <button key={t.v} onClick={()=>setNType(t.v)}
              style={{fontSize:11,padding:'5px 10px',borderRadius:6,cursor:'pointer',fontWeight:nType===t.v?700:400,
                border:nType===t.v?`2px solid ${t.color}`:'1px solid #e2e8f0',
                background:nType===t.v?t.bg:'#fff',color:nType===t.v?t.color:'var(--text3)'}}>
              {t.l}
            </button>
          ))}
        </div>
        <textarea value={nText} onChange={e=>setNText(e.target.value)}
          onKeyDown={e=>{if(e.ctrlKey&&e.key==='Enter')addNote()}}
          placeholder="О чём договорились, суть звонка, ссылка на файл... (Ctrl+Enter для отправки)"
          rows={3} style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',border:'1px solid var(--inp-border)',borderRadius:6,fontSize:13,resize:'vertical',fontFamily:'inherit'}}/>
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:6}}>
          <button onClick={addNote} disabled={saving||!nText.trim()}
            style={{...btnPrimary,padding:'5px 14px',opacity:saving||!nText.trim()?0.5:1,cursor:saving||!nText.trim()?'default':'pointer'}}>
            {saving?'Сохраняю...':'Добавить'}
          </button>
        </div>
      </div>

      {/* Лента */}
      {loading
        ? <div style={{textAlign:'center',color:'#94a3b8',padding:'2rem',fontSize:13}}>Загрузка...</div>
        : notes.length===0
          ? <div style={{textAlign:'center',color:'#94a3b8',padding:'2rem',fontSize:13}}>Записей пока нет — добавьте первую заметку</div>
          : <div style={{position:'relative'}}>
              {/* вертикальная линия */}
              <div style={{position:'absolute',left:15,top:0,bottom:0,width:2,background:'#e2e8f0'}}/>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {notes.map(n=>{
                  const nt=ntLabel(n.note_type)
                  return(
                    <div key={n.id} style={{display:'flex',gap:12,position:'relative'}}>
                      {/* иконка-точка */}
                      <div style={{width:30,height:30,borderRadius:'50%',background:nt.bg,border:`2px solid ${nt.color}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0,zIndex:1}}>
                        {nt.l.slice(0,2)}
                      </div>
                      <div style={{flex:1,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px',boxShadow:'0 1px 2px rgba(0,0,0,0.04)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                          <div style={{display:'flex',gap:8,alignItems:'center'}}>
                            <span style={{fontSize:11,padding:'2px 7px',borderRadius:4,background:nt.bg,color:nt.color,fontWeight:600}}>{nt.l}</span>
                            <span style={{fontSize:11,color:'var(--text3)',fontWeight:500}}>{n.author_name}</span>
                          </div>
                          <div style={{display:'flex',gap:8,alignItems:'center'}}>
                            <span style={{fontSize:11,color:'#94a3b8'}}>{fmtDt(n.created_at)}</span>
                            <button onClick={()=>delNote(n.id)} title="Удалить" style={{fontSize:12,padding:'2px 6px',border:'none',background:'transparent',color:'#cbd5e1',cursor:'pointer',lineHeight:1}}>✕</button>
                          </div>
                        </div>
                        <div style={{fontSize:13,color:'#1a1a2e',whiteSpace:'pre-wrap',lineHeight:1.5}}>{n.content}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
      }
    </div>
  )
}

function PageRequests() {
  const navigate=useNavigate()
  const location=useLocation()
  const [rows,setRows]=useState([])
  const [clients,setClients]=useState([])
  const [users,setUsers]=useState([])
  const [editing,setEditing]=useState(null)
  const [form,setForm]=useState(EMPTY_REQ)
  const [timelineReq,setTimelineReq]=useState(null)
  const confirm=useConfirm()

  const load=()=>api.get('/requests').then(r=>setRows(r.data))
  useEffect(()=>{
    load()
    api.get('/clients').then(r=>setClients(r.data))
    api.get('/auth/users').then(r=>setUsers(r.data)).catch(()=>setUsers([]))
  },[])
  useEffect(()=>{
    if(location.state?.openNew){setForm({...EMPTY_REQ});setEditing({})}
  },[location.state])

  const openNew=()=>{setForm({...EMPTY_REQ});setEditing({})}
  const openEdit=r=>{
    setForm({
      client_id: r.client_id||'',
      contact_name: r.contact_name||'',
      description: r.material_type||'',
      source: r.source||r.test_types||'',
      quantity: r.quantity||1,
      price: r.price||'',
      urgency: r.urgency||'normal',
      assigned_to: r.assigned_to||'',
      notes: r.notes||'',
    })
    setEditing(r)
  }
  const cancel=()=>setEditing(null)

  const save=async()=>{
    if(!form.client_id){alert('Выберите клиента');return}
    const payload={
      client_id: +form.client_id,
      contact_name: form.contact_name||null,
      material_type: form.description||null,
      source: form.source||null,
      test_types: form.source||null,
      quantity: +form.quantity||1,
      price: form.price?+form.price:null,
      urgency: form.urgency,
      assigned_to: form.assigned_to?+form.assigned_to:null,
      notes: form.notes||null,
    }
    try{
      if(editing?.id) await api.put(`/requests/${editing.id}`,payload)
      else await api.post('/requests',payload)
      setEditing(null); load()
    }catch(e){alert(e.response?.data?.detail||e.message||'Ошибка сохранения')}
  }

  const del=async r=>{
    const ok=await confirm({
      title:'Удаление заявки',
      message:`Удалить заявку ${r.number}? Связанные задачи также будут удалены.`,
      danger:true,
      confirmText:'Удалить',
    })
    if(!ok) return
    await api.delete(`/requests/${r.id}`); load()
  }

  if(timelineReq) return <RequestTimeline req={timelineReq} clients={clients} onClose={()=>setTimelineReq(null)}/>

  const f=form, sf=v=>setForm(p=>({...p,...v}))

  return (
    <Card title={`Заявки (${rows.length})`} action={
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <Btn variant="secondary" onClick={()=>navigate('/funnel')}>← Назад</Btn>
        {!editing&&<Btn onClick={openNew}>+ Новая заявка</Btn>}
      </div>
    }>
      {editing!==null && (
        <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'1.5rem',marginBottom:'1rem'}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--primary)',marginBottom:16}}>
            {editing?.id?`Редактировать заявку ${editing.number}`:'Новая заявка'}
          </div>

          {/* Блок 1: Клиент */}
          <div style={{marginBottom:16,padding:'12px 14px',background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)'}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Клиент</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <label style={lbl}>Организация <span style={{color:'#ef4444'}}>*</span></label>
                <select value={f.client_id} onChange={e=>sf({client_id:e.target.value})} style={sel}>
                  <option value="">— выберите клиента —</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Контактное лицо</label>
                <input value={f.contact_name} onChange={e=>sf({contact_name:e.target.value})}
                  placeholder={f.client_id?clients.find(c=>String(c.id)===String(f.client_id))?.contact_name||'Иван Иванович':'Иван Иванович'}
                  style={inp}/>
              </div>
            </div>
          </div>

          {/* Блок 2: Запрос */}
          <div style={{marginBottom:16,padding:'12px 14px',background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)'}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Запрос</div>
            <div>
              <label style={lbl}>Что интересует / Описание запроса</label>
              <textarea value={f.description} onChange={e=>sf({description:e.target.value})}
                placeholder="Например: анализатор влажности, спектрофотометр UV-Vis, рефрактометр Аббе, весы аналитические…"
                rows={3} style={{...inp,resize:'vertical',marginBottom:0}}/>
            </div>
          </div>

          {/* Блок 3: Параметры сделки */}
          <div style={{marginBottom:16,padding:'12px 14px',background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)'}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Параметры сделки</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              <div>
                <label style={lbl}>Количество единиц</label>
                <input value={f.quantity} onChange={e=>sf({quantity:e.target.value})} type="number" min="1" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Предполагаемый бюджет, ₽</label>
                <input value={f.price} onChange={e=>sf({price:e.target.value})} type="number" min="0" placeholder="0" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Срочность</label>
                <select value={f.urgency} onChange={e=>sf({urgency:e.target.value})} style={sel}>
                  <option value="normal">🟢 Обычная</option>
                  <option value="high">🟡 Высокая</option>
                  <option value="urgent">🔴 Срочно</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Источник заявки</label>
                <select value={f.source} onChange={e=>sf({source:e.target.value})} style={sel}>
                  {SOURCES.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Ответственный менеджер</label>
                <select value={f.assigned_to} onChange={e=>sf({assigned_to:e.target.value})} style={sel}>
                  <option value="">— не назначен —</option>
                  {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Примечания */}
          <div style={{marginBottom:12}}>
            <label style={lbl}>Примечания</label>
            <textarea value={f.notes} onChange={e=>sf({notes:e.target.value})}
              placeholder="Любые дополнительные сведения, особые требования клиента…"
              rows={2} style={{...inp,resize:'vertical',marginBottom:0}}/>
          </div>

          <div style={{display:'flex',gap:8}}>
            <Btn onClick={save}>Сохранить</Btn>
            <Btn variant="secondary" onClick={cancel}>Отмена</Btn>
          </div>
        </div>
      )}

      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr>
          <Th>№</Th>
          <Th>Клиент / Контакт</Th>
          <Th>Что интересует</Th>
          <Th>Источник</Th>
          <Th>Бюджет</Th>
          <Th>Этап</Th>
          <Th>Дата</Th>
          <Th>Действия</Th>
        </tr></thead>
        <tbody>{rows.map(r=>{
          const client=clients.find(c=>c.id===r.client_id)
          const stg=STAGE_LABELS[r.stage||'new_request']||STAGE_LABELS['new_request']
          const urgColors={normal:'#10b981',high:'#f59e0b',urgent:'#ef4444'}
          return(
            <tr key={r.id} style={{borderBottom:'1px solid var(--border2)'}}>
              <Td bold>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:urgColors[r.urgency||'normal'],display:'inline-block',flexShrink:0}}/>
                  {r.number}
                </div>
              </Td>
              <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border2)'}}>
                <div style={{fontWeight:500,color:'var(--text)'}}>{client?.name||'—'}</div>
                {r.contact_name&&<div style={{fontSize:11,color:'var(--text3)',marginTop:1}}>{r.contact_name}</div>}
              </td>
              <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border2)',color:'var(--text2)',maxWidth:200}}>
                <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.material_type||'—'}</div>
              </td>
              <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border2)',color:'var(--text3)',fontSize:12}}>
                {sourceLabel(r.source||r.test_types)}
              </td>
              <Td>{r.price?Number(r.price).toLocaleString('ru')+' ₽':'—'}</Td>
              <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border2)'}}>
                <span style={{fontSize:11,padding:'3px 8px',borderRadius:4,background:stg.bg,color:stg.color,whiteSpace:'nowrap',fontWeight:500}}>{stg.label}</span>
              </td>
              <Td>{r.created_at?.slice(0,10)}</Td>
              <td style={{padding:'6px 10px',whiteSpace:'nowrap'}}>
                <button type="button" onClick={()=>setTimelineReq(r)} style={{...btnPurple,marginRight:6,minWidth:88,height:26,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'0 8px',lineHeight:1}}>📋 История</button>
                <button type="button" onClick={()=>openEdit(r)} style={{...btnBlue,marginRight:6,minWidth:88,height:26,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'0 8px',lineHeight:1}}>Изменить</button>
                <button type="button" onClick={()=>del(r)} style={{...btnRed,minWidth:88,height:26,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'0 8px',lineHeight:1}}>Удалить</button>
              </td>
            </tr>
          )
        })}</tbody>
      </table>
      {rows.length===0&&<p style={{color:'var(--text4)',textAlign:'center',padding:'2rem',fontSize:13}}>Заявок пока нет</p>}
    </Card>
  )
}

const EMPTY_CLIENT = {name:'',inn:'',kpp:'',contact_name:'',contact_position:'',contact_phone:'',contact_email:'',address:''}
const CLIENT_FIELDS = [['name','Название организации *',true],['inn','ИНН'],['kpp','КПП'],['contact_name','ФИО руководителя (Фам. Имя Отч.)'],['contact_position','Должность руководителя'],['contact_phone','Телефон'],['contact_email','Email'],['address','Юридический адрес']]

function PageContractors() {
  const [rows,setRows]=useState([])
  const [editing,setEditing]=useState(null)
  const [form,setForm]=useState(EMPTY_CLIENT)
  const confirm = useConfirm()
  const load=()=>api.get('/clients').then(r=>setRows(r.data))
  useEffect(()=>{load()},[])

  const openNew=()=>{setForm(EMPTY_CLIENT);setEditing({})}
  const openEdit=r=>{setForm({name:r.name||'',inn:r.inn||'',kpp:r.kpp||'',contact_name:r.contact_name||'',contact_position:r.contact_position||'',contact_phone:r.contact_phone||'',contact_email:r.contact_email||'',address:r.address||''});setEditing(r)}
  const cancel=()=>setEditing(null)

  const save=async()=>{
    if(editing?.id) await api.put(`/clients/${editing.id}`,form)
    else await api.post('/clients',form)
    setEditing(null); load()
  }
  const del=async r=>{
    const ok=await confirm({title:'Удаление',message:`Удалить контрагента «${r.name}»?`,danger:true,confirmText:'Удалить'})
    if(!ok) return
    await api.delete(`/clients/${r.id}`); load()
  }

  return (
    <Card title={`Контрагенты (${rows.length})`} action={!editing&&<Btn onClick={openNew}>+ Новый контрагент</Btn>}>
      {editing!==null && (
        <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'1.25rem',marginBottom:'1rem'}}>
          <div style={{fontSize:13,fontWeight:600,color:'var(--primary)',marginBottom:12}}>{editing?.id?'Редактировать контрагента':'Новый контрагент'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            {CLIENT_FIELDS.map(([k,p,req])=>(
              <div key={k}><label style={lbl}>{p}</label>
                <input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={p} style={inp} required={!!req}/>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}><Btn onClick={save}>Сохранить</Btn><Btn variant="secondary" onClick={cancel}>Отмена</Btn></div>
        </div>
      )}
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr><Th>Организация</Th><Th>ИНН</Th><Th>Руководитель</Th><Th>Должность</Th><Th>Телефон</Th><Th>Email</Th><Th>Адрес</Th><Th>Действия</Th></tr></thead>
        <tbody>{rows.map(r=>(
          <tr key={r.id} style={{borderBottom:'1px solid var(--border2)'}}>
            <Td bold>{r.name}</Td><Td>{r.inn}</Td><Td>{r.contact_name}</Td><Td>{r.contact_position}</Td><Td>{r.contact_phone}</Td><Td>{r.contact_email}</Td><Td>{r.address}</Td>
            <td style={{padding:'6px 10px',whiteSpace:'nowrap'}}>
              <button type="button" onClick={()=>openEdit(r)} style={{...btnBlue,marginRight:6}}>Изменить</button>
              <button type="button" onClick={()=>del(r)} style={btnRed}>Удалить</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
      {rows.length===0 && <p style={{color:'var(--text4)',textAlign:'center',padding:'2rem',fontSize:13}}>Контрагентов пока нет</p>}
    </Card>
  )
}

function PageContacts() {
  const [rows,setRows]=useState([])
  const [q,setQ]=useState('')
  useEffect(()=>{api.get('/clients').then(r=>setRows(r.data))},[])
  const filt=rows.filter(r=>{
    if(!q) return true
    const s=q.toLowerCase()
    return (r.contact_name||'').toLowerCase().includes(s)||(r.contact_phone||'').toLowerCase().includes(s)||(r.contact_email||'').toLowerCase().includes(s)||(r.name||'').toLowerCase().includes(s)
  })
  return(
    <Card title={`Контакты (${filt.length})`}>
      <div style={{marginBottom:12}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Поиск по имени, телефону, email..."
          style={{padding:'7px 10px',border:'1px solid var(--inp-border)',borderRadius:6,fontSize:13,width:320}}/>
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr><Th>ФИО контакта</Th><Th>Телефон</Th><Th>Email</Th><Th>Организация</Th></tr></thead>
        <tbody>{filt.filter(r=>r.contact_name||r.contact_phone||r.contact_email).map(r=>(
          <tr key={r.id} style={{borderBottom:'1px solid var(--border2)'}}>
            <Td bold>{r.contact_name||'—'}</Td>
            <Td>{r.contact_phone}</Td>
            <Td>{r.contact_email}</Td>
            <Td>{r.name}</Td>
          </tr>
        ))}</tbody>
      </table>
      {filt.filter(r=>r.contact_name||r.contact_phone||r.contact_email).length===0&&
        <p style={{color:'var(--text4)',textAlign:'center',padding:'2rem',fontSize:13}}>Контактные данные не заполнены. Добавьте контакты в карточках контрагентов.</p>}
    </Card>
  )
}

function StubPage({title,icon,desc,items}){
  return(
    <div>
      <div style={{background:'var(--surface)',borderRadius:10,padding:'2rem',marginBottom:'1rem',boxShadow:'0 1px 4px rgba(0,0,0,0.06)',textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:12}}>{icon}</div>
        <h2 style={{fontSize:20,fontWeight:700,color:'#1a1a2e',marginBottom:8}}>{title}</h2>
        <p style={{fontSize:13,color:'var(--text3)',maxWidth:480,margin:'0 auto 20px'}}>{desc}</p>
        <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'#fef9c3',border:'1px solid #fde68a',borderRadius:8,padding:'8px 16px',fontSize:12,color:'#92400e',fontWeight:500}}>
          🚧 Раздел в разработке
        </div>
      </div>
      {items&&items.length>0&&(
        <div style={{background:'var(--surface)',borderRadius:10,padding:'1.25rem',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:13,fontWeight:600,color:'var(--text2)',marginBottom:12}}>Что будет в этом разделе:</div>
          <ul style={{margin:0,padding:'0 0 0 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 24px'}}>
            {items.map((it,i)=><li key={i} style={{fontSize:13,color:'var(--text3)',padding:'3px 0'}}>{it}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function PageObjects(){
  return <StubPage
    title="Объекты"
    icon="🏗️"
    desc="Справочник строительных объектов и площадок. Привязка проб и испытаний к конкретному объекту заказчика."
    items={['Список объектов с адресом и заказчиком','Привязка заявок и проб к объекту','История испытаний по объекту','Статус строительства','Ответственный от заказчика','Импорт из Excel']}
  />
}

function PageServices(){
  const confirm = useConfirm()
  const catalogCsvInputRef = useRef(null)
  const [rows,setRows]=useState([])
  const [q,setQ]=useState('')
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const load=()=>{
    setLoading(true)
    api.get('/catalog/items').then(r=>setRows(r.data)).catch(()=>setRows([])).finally(()=>setLoading(false))
  }
  useEffect(()=>{load()},[])

  const doImport=async force=>{
    setBusy(true)
    try{
      await api.post('/catalog/import-default', null, { params: force?{force:true}:undefined })
      await load()
    }catch(e){
      const st=e.response?.status
      const d=e.response?.data
      const msg=typeof d==='string'?d:(d?.detail||(Array.isArray(d)?d.map(x=>x.msg).join('; '):null))||e.message
      if(st===409) alert('Каталог уже заполнен. Чтобы заменить данные с сервера, нажмите «Перезагрузить с сервера» или загрузите свой CSV с диска с подтверждением — введённые цены будут сброшены.')
      else alert(msg)
    }finally{setBusy(false)}
  }

  const reimport=async()=>{
    const ok=await confirm({
      title:'Перезагрузка каталога',
      message:'Все строки и цены будут удалены и снова загружены из backend/data/accreditation_scope.csv. Продолжить?',
      danger:true,
      confirmText:'Перезагрузить',
    })
    if(!ok) return
    await doImport(true)
  }

  const onUploadCatalogCsv=async e=>{
    const file=e.target.files?.[0]
    e.target.value=''
    if(!file) return
    if(rows.length>0){
      const ok=await confirm({
        title:'Заменить каталог из файла',
        message:'Текущие строки каталога и введённые цены будут удалены и заменены данными из выбранного CSV.',
        danger:true,
        confirmText:'Заменить',
      })
      if(!ok) return
    }
    setBusy(true)
    try{
      const fd=new FormData()
      fd.append('file',file)
      const {data}=await api.post('/catalog/import-upload',fd,{params:{force:rows.length>0}})
      alert(`Импортировано строк: ${data.imported} (${data.file})`)
      await load()
    }catch(err){
      const st=err.response?.status
      const d=err.response?.data
      const msg=typeof d==='string'?d:(d?.detail||(Array.isArray(d)?d.map(x=>x.msg).join('; '):null))||err.message
      if(st===409) alert('Каталог уже заполнен. Используйте замену: выберите файл ещё раз и подтвердите перезапись.')
      else alert(msg)
    }finally{setBusy(false)}
  }

  const savePrice=async(id, raw)=>{
    let v=null
    if(raw!==''&&raw!=null&&String(raw).trim()!==''){
      v=parseFloat(String(raw).replace(',','.'))
      if(Number.isNaN(v)||v<0){ alert('Введите неотрицательное число или оставьте пустым'); return }
    }
    try{
      await api.patch(`/catalog/items/${id}`,{price_rub:v})
      setRows(rs=>rs.map(r=>r.id===id?{...r,price_rub:v}:r))
    }catch(e){ alert(e.response?.data?.detail||e.message) }
  }

  const ql=q.trim().toLowerCase()
  const filt=ql?rows.filter(r=>
    (r.material_object||'').toLowerCase().includes(ql)||
    (r.characteristic||'').toLowerCase().includes(ql)||
    (r.range_text||'').toLowerCase().includes(ql)||
    (r.standard_ref||'').toLowerCase().includes(ql)
  ):rows

  const fmtPrice=p=>{
    if(p==null||p==='') return ''
    return String(p)
  }

  return(
    <Card title={`Каталог услуг / область аккредитации (${filt.length}${ql?` из ${rows.length}`:''})`}
      action={(
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end',alignItems:'center'}}>
          <input ref={catalogCsvInputRef} type="file" accept=".csv,text/csv" style={{display:'none'}} onChange={e=>void onUploadCatalogCsv(e)}/>
          <Btn variant="secondary" onClick={()=>catalogCsvInputRef.current?.click()} disabled={busy||loading}>
            {busy?'Загрузка…':'Загрузить CSV с диска'}
          </Btn>
          {rows.length===0&&(
            <Btn onClick={()=>void doImport(false)} disabled={busy||loading}>Из поставки (сервер)</Btn>
          )}
          {rows.length>0&&(
            <Btn variant="secondary" onClick={()=>void reimport()} disabled={busy||loading}>Перезагрузить с сервера</Btn>
          )}
        </div>
      )}>
      <p style={{fontSize:13,color:'var(--text3)',margin:'0 0 12px'}}>
        Колонки файла: (1) виды материалов — при выгрузке из Excel объединённые ячейки могут идти одним текстом с переносами строк; далее пустой 1-й столбец = те же материалы; (2) показатель; (3) диапазон измерений; (4) НД по методике. Цен в файле нет — укажите стоимость вручную (сохраняется при выходе из поля).
        Можно загрузить свой CSV с диска или взять дефолтный файл из репозитория: <code style={{fontSize:12}}>backend/data/accreditation_scope.csv</code>.
      </p>
      <div style={{marginBottom:12}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск по объекту, показателю, диапазону, ГОСТ…"
          style={{padding:'7px 10px',border:'1px solid var(--inp-border)',borderRadius:6,fontSize:13,width:420,maxWidth:'100%',boxSizing:'border-box',background:'var(--inp-bg)',color:'var(--text)'}}/>
      </div>
      {loading?(
        <p style={{color:'var(--text3)',fontSize:13}}>Загрузка…</p>
      ):rows.length===0?(
        <p style={{color:'var(--text3)',fontSize:13,textAlign:'center',padding:'2rem'}}>Каталог пуст. Загрузите CSV с диска или нажмите «Из поставки (сервер)».</p>
      ):(
        <div style={{overflowX:'auto',margin:'0 -4px'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:720}}>
            <thead>
              <tr>
                <Th>Объект испытаний</Th>
                <Th>Показатель</Th>
                <Th>Диапазон</Th>
                <Th>НД / метод</Th>
                <Th>Цена, ₽</Th>
              </tr>
            </thead>
            <tbody>
              {filt.map(r=>(
                <tr key={r.id}>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border2)',verticalAlign:'top',whiteSpace:'pre-line',maxWidth:260,color:'var(--text2)',fontSize:12}}>{r.material_object}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border2)',verticalAlign:'top',whiteSpace:'pre-line',maxWidth:220,color:'var(--text2)',fontSize:12}}>{r.characteristic}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border2)',verticalAlign:'top',whiteSpace:'pre-line',maxWidth:140,color:'var(--text2)',fontSize:12}}>{r.range_text||'—'}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border2)',verticalAlign:'top',whiteSpace:'pre-line',maxWidth:200,color:'var(--text2)',fontSize:12}}>{r.standard_ref||'—'}</td>
                  <td style={{padding:'8px 10px',borderBottom:'1px solid var(--border2)',verticalAlign:'top'}}>
                    <input type="text" inputMode="decimal" placeholder="—"
                      defaultValue={fmtPrice(r.price_rub)}
                      key={r.id+'-'+(r.price_rub??'n')}
                      onBlur={e=>{
                        const raw=e.target.value.trim()
                        let v=null
                        if(raw!==''){
                          v=parseFloat(raw.replace(',','.'))
                          if(Number.isNaN(v)||v<0){ alert('Введите неотрицательное число или оставьте пустым'); e.target.value=fmtPrice(r.price_rub); return }
                        }
                        const prev=r.price_rub
                        const same=(v===null&&(prev==null||prev===''))||(v!==null&&prev!=null&&Math.abs(Number(prev)-v)<1e-6)
                        if(same) return
                        void savePrice(r.id,raw)
                      }}
                      style={{width:88,padding:'4px 6px',border:'1px solid var(--inp-border)',borderRadius:5,fontSize:12,background:'var(--inp-bg)',color:'var(--text)'}}/>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function PageDeveloperReference(){
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [q,setQ]=useState('')

  useEffect(()=>{
    setLoading(true)
    api.get('/catalog/items')
      .then(r=>setRows(r.data||[]))
      .catch(()=>setRows([]))
      .finally(()=>setLoading(false))
  },[])

  const query=q.trim().toLowerCase()
  const grouped=(rows||[]).reduce((acc,row)=>{
    const material=(row.material_object||'').trim()||'Без материала'
    if(!acc[material]) acc[material]=[]
    acc[material].push(row)
    return acc
  },{})
  let sections=Object.entries(grouped).map(([material,items])=>({
    material,
    items,
    charCount:new Set(items.map(x=>(x.characteristic||'').trim()).filter(Boolean)).size,
  }))
  sections.sort((a,b)=>a.material.localeCompare(b.material,'ru'))
  if(query){
    sections=sections.filter(sec=>{
      if(sec.material.toLowerCase().includes(query)) return true
      return sec.items.some(it=>
        (it.characteristic||'').toLowerCase().includes(query)||
        (it.standard_ref||'').toLowerCase().includes(query)||
        (it.range_text||'').toLowerCase().includes(query)
      )
    })
  }

  return (
    <Card title={`Справочник разработчика (${sections.length} разделов)`}>
      <p style={{fontSize:13,color:'var(--text3)',margin:'0 0 10px'}}>
        Разделы формируются автоматически из каталога услуг: материал/объект испытаний и все определяемые характеристики (показатели) с диапазоном и методикой.
      </p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="Поиск по материалу, показателю, ГОСТ..."
          style={{padding:'7px 10px',border:'1px solid var(--inp-border)',borderRadius:6,fontSize:13,width:420,maxWidth:'100%',boxSizing:'border-box',background:'var(--inp-bg)',color:'var(--text)'}}
        />
      </div>
      {loading && <p style={{fontSize:13,color:'var(--text3)'}}>Загрузка...</p>}
      {!loading && rows.length===0 && (
        <p style={{fontSize:13,color:'var(--text3)'}}>
          Каталог пуст. Сначала загрузите `backend/data/accreditation_scope.csv` в разделе `Каталог услуг`.
        </p>
      )}
      {!loading && rows.length>0 && sections.length===0 && (
        <p style={{fontSize:13,color:'var(--text3)'}}>По вашему фильтру ничего не найдено.</p>
      )}
      {!loading && sections.map(sec=>(
        <details key={sec.material} style={{border:'1px solid var(--border2)',borderRadius:8,marginBottom:10,background:'var(--surface)'}}>
          <summary style={{cursor:'pointer',padding:'10px 12px',fontSize:13,fontWeight:600,color:'var(--text)'}}>
            {sec.material} — {sec.charCount} показ.
          </summary>
          <div style={{padding:'0 12px 12px'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr>
                  <Th>Показатель</Th>
                  <Th>Диапазон</Th>
                  <Th>Методика (НД)</Th>
                </tr>
              </thead>
              <tbody>
                {sec.items.map(it=>(
                  <tr key={it.id}>
                    <td style={{padding:'6px 8px',borderBottom:'1px solid var(--border2)',whiteSpace:'pre-line',color:'var(--text2)'}}>{it.characteristic||'—'}</td>
                    <td style={{padding:'6px 8px',borderBottom:'1px solid var(--border2)',whiteSpace:'pre-line',color:'var(--text2)'}}>{it.range_text||'—'}</td>
                    <td style={{padding:'6px 8px',borderBottom:'1px solid var(--border2)',whiteSpace:'pre-line',color:'var(--text2)'}}>{it.standard_ref||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </Card>
  )
}

function PageEquipment(){
  return <StubPage
    title="Оборудование"
    icon="⚙️"
    desc="Реестр лабораторного оборудования. Учёт поверок, технического обслуживания и статуса готовности."
    items={['Карточка оборудования (наименование, зав. №)','Дата последней и следующей поверки','Статус (в работе / на ТО / на поверке)','Уведомления об истечении поверки','Привязка к методу испытания','История обслуживания']}
  />
}

function PageStandards(){
  return <StubPage
    title="Стандарты"
    icon="📐"
    desc="Справочник нормативных документов. Актуальные ГОСТы, ГОСТ Р, СП и другие НД с датами введения и статусом."
    items={['Библиотека ГОСТ / ГОСТ Р / СП / ТУ','Номер, наименование, дата введения','Статус (действует / отменён / заменён)','Привязка к видам испытаний','Быстрый поиск по номеру и названию','Уведомление об обновлении НД']}
  />
}

function PageTests(){
  const confirm = useConfirm()
  const [rows,setRows]=useState([])
  const [protocols,setProtocols]=useState([])
  const [showForm,setShowForm]=useState(false)
  const [selSampleId,setSelSampleId]=useState(null)
  const [selTestId,setSelTestId]=useState(null)
  const [samples,setSamples]=useState([])
  const [fSearch,setFSearch]=useState('')
  const [fGost,setFGost]=useState('')
  const [fProto,setFProto]=useState('')
  const [fDateFrom,setFDateFrom]=useState('')
  const [fDateTo,setFDateTo]=useState('')
  const load=()=>{
    api.get('/tests').then(r=>setRows(r.data))
    api.get('/protocols').then(r=>setProtocols(r.data)).catch(()=>{})
    api.get('/samples').then(r=>setSamples(r.data))
  }
  useEffect(()=>{load()},[])

  const filtered=rows.filter(r=>{
    const smp=samples.find(s=>s.id===r.sample_id)
    const q=fSearch.trim().toLowerCase()
    if(q){
      const match=String(r.id).includes(q)||(smp?.lab_number||'').toLowerCase().includes(q)||(smp?.material_name||'').toLowerCase().includes(q)
      if(!match) return false
    }
    if(fGost&&!r.test_type?.includes(fGost)) return false
    if(fDateFrom&&r.tested_at<fDateFrom) return false
    if(fDateTo&&r.tested_at>fDateTo) return false
    if(fProto==='yes'&&!protocols.find(p=>p.test_id===r.id)) return false
    if(fProto==='no'&&protocols.find(p=>p.test_id===r.id)) return false
    return true
  })
  const hasFilter=fSearch||fGost||fProto||fDateFrom||fDateTo
  const clearF=()=>{setFSearch('');setFGost('');setFProto('');setFDateFrom('');setFDateTo('')}
  const fi={padding:'6px 10px',border:'1px solid var(--inp-border)',borderRadius:6,fontSize:12,background:'#fff'}
  const downloadProtocol=async(protId)=>{
    const token=localStorage.getItem('token')
    try{
      const res=await fetch(`/api/protocols/${protId}/generate`,{headers:{Authorization:`Bearer ${token}`}})
      if(!res.ok){
        let msg='Ошибка генерации протокола'
        try{const j=await res.json();msg=j.detail||msg}catch{try{msg=await res.text()||msg}catch{}}
        alert(msg);return
      }
      const blob=await res.blob()
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a');a.href=url
      a.download=`protocol_${protId}.xlsx`
      a.click();URL.revokeObjectURL(url)
    }catch(e){alert('Сетевая ошибка: '+e.message)}
  }

  const delTest=async(id)=>{
    const ok=await confirm({
      title:'Удаление карточки',
      message:'Удалить карточку испытания и связанный протокол?',
      danger:true,
      confirmText:'Удалить',
    })
    if(!ok)return
    await api.delete(`/tests/${id}`);load()
  }

  const recreateProtocol=async(testId)=>{
    const ok=await confirm({
      title:'Пересоздать протокол',
      message:'Текущий протокол будет удалён и создан новый с новым номером (заключение сохранится).',
      confirmText:'Пересоздать',
    })
    if(!ok)return
    try{
      await api.post(`/protocols/for-test/${testId}`)
      load()
    }catch(e){alert('Ошибка пересоздания протокола: '+(e.response?.data?.detail||e.message))}
  }

  const tLabel=t=>t==="gost_58401"?"ГОСТ Р 58401":t==="gost_58406"?"ГОСТ Р 58406":t
  if(showForm)return(
    <div style={{background:"#fff",borderRadius:10,padding:"1.5rem",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
      <ErrorBoundary>
        <TestABS sampleId={selSampleId} testId={selTestId} takenSampleIds={rows.map(r=>r.sample_id)} onClose={()=>{setShowForm(false);setSelTestId(null);setSelSampleId(null);load()}}/>
      </ErrorBoundary>
    </div>
  )
  return(
    <Card title={`Карточки испытаний (${filtered.length}${hasFilter?` из ${rows.length}`:''})`} action={
      <Btn onClick={()=>{setSelTestId(null);setSelSampleId(null);setShowForm(true)}}>+ Новая карточка</Btn>
    }>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:12,padding:'10px 12px',background:'var(--surface2)',borderRadius:8,border:'1px solid var(--border)'}}>
        <input value={fSearch} onChange={e=>setFSearch(e.target.value)} placeholder="🔍 ID, проба, материал..." style={{...fi,minWidth:200,flex:1}}/>
        <select value={fGost} onChange={e=>setFGost(e.target.value)} style={fi}>
          <option value="">Все ГОСТы</option>
          <option value="58401">ГОСТ Р 58401</option>
          <option value="58406">ГОСТ Р 58406</option>
        </select>
        <select value={fProto} onChange={e=>setFProto(e.target.value)} style={fi}>
          <option value="">Любой протокол</option>
          <option value="yes">Есть протокол</option>
          <option value="no">Нет протокола</option>
        </select>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          <span style={{fontSize:11,color:'var(--text3)'}}>Дата:</span>
          <input type="date" value={fDateFrom} onChange={e=>setFDateFrom(e.target.value)} style={{...fi,width:130}}/>
          <span style={{fontSize:11,color:'#94a3b8'}}>—</span>
          <input type="date" value={fDateTo} onChange={e=>setFDateTo(e.target.value)} style={{...fi,width:130}}/>
        </div>
        {hasFilter&&<button type="button" onClick={clearF} style={btnRed}>✕ Сбросить</button>}
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr><Th>ID</Th><Th>Проба</Th><Th>ГОСТ</Th><Th>Дата</Th><Th>Статус</Th><Th>Протокол</Th><Th></Th></tr></thead>
        <tbody>{filtered.map(r=>{
          const prot=protocols.find(p=>p.test_id===r.id)
          return(
            <tr key={r.id}>
              <Td bold>#{r.id}</Td>
              <Td>{samples.find(s=>s.id===r.sample_id)?.lab_number||`#${r.sample_id}`}</Td>
              <Td>{tLabel(r.test_type)}</Td>
              <Td>{r.tested_at}</Td>
              <td style={{padding:"6px 10px",borderBottom:"1px solid #f5f5f5"}}><Badge s={r.status}/></td>
              <td style={{padding:"6px 10px",borderBottom:"1px solid #f5f5f5",whiteSpace:"nowrap"}}>
                {prot ? (
                  <div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap'}}>
                    <button type="button" onClick={()=>downloadProtocol(prot.id)} style={btnBlue}>↓ №{prot.number}</button>
                    <button type="button" onClick={()=>recreateProtocol(r.id)} title="Пересоздать протокол с новым номером" style={btnGray}>↻</button>
                  </div>
                ) : (
                  <div style={{display:'flex',gap:4,alignItems:'center'}}>
                    <span style={{fontSize:12,color:"#94a3b8"}}>нет</span>
                    <button type="button" onClick={()=>recreateProtocol(r.id)} title="Создать протокол" style={btnGreen}>+ Создать</button>
                  </div>
                )}
              </td>
              <td style={{padding:"6px 10px",borderBottom:"1px solid #f5f5f5",whiteSpace:"nowrap"}}>
                <button type="button" onClick={()=>{setSelTestId(r.id);setSelSampleId(r.sample_id);setShowForm(true)}}
                  title="Редактировать"
                  style={{...btnBlue,marginRight:4,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{display:"inline-block",transform:"rotate(-45deg) scaleX(-1)",lineHeight:1}}>✏</span>
                </button>
                <button type="button" onClick={()=>delTest(r.id)} title="Удалить карточку" style={{...btnRed,lineHeight:1}}>🗑</button>
              </td>
            </tr>
          )
        })}</tbody>
      </table>
      {filtered.length===0&&<p style={{color:"#999",textAlign:"center",padding:"2rem",fontSize:13}}>
        {hasFilter?'Ничего не найдено — попробуйте изменить фильтры':'Карточек пока нет'}
      </p>}
    </Card>
  )
}
function PageProtocols() {
  const user = React.useContext(AuthCtx)
  const canSign = user?.role === 'lab_head' || user?.role === 'admin'
  const [rows,setRows]=useState([])
  const [tplStatus,setTplStatus]=useState(null)
  const [uploadErr,setUploadErr]=useState('')
  const [uploading,setUploading]=useState(false)
  const [signErr,setSignErr]=useState('')
  const [fSearch,setFSearch]=useState('')
  const [fStatus,setFStatus]=useState('')
  const [fDateFrom,setFDateFrom]=useState('')
  const [fDateTo,setFDateTo]=useState('')
  const load=()=>{
    api.get('/protocols').then(r=>setRows(r.data)).catch(()=>{})
    api.get('/protocols/templates/status').then(r=>setTplStatus(r.data)).catch(()=>{})
  }
  useEffect(()=>{ load() },[])

  const filtered=rows.filter(r=>{
    const q=fSearch.trim().toLowerCase()
    if(q){
      const match=String(r.number).includes(q)||(r.conclusion||'').toLowerCase().includes(q)||(r.notes||'').toLowerCase().includes(q)
      if(!match) return false
    }
    if(fStatus&&r.status!==fStatus) return false
    const d=r.created_at?.slice(0,10)||''
    if(fDateFrom&&d<fDateFrom) return false
    if(fDateTo&&d>fDateTo) return false
    return true
  })
  const hasFilter=fSearch||fStatus||fDateFrom||fDateTo
  const clearF=()=>{setFSearch('');setFStatus('');setFDateFrom('');setFDateTo('')}
  const fi={padding:'6px 10px',border:'1px solid var(--inp-border)',borderRadius:6,fontSize:12,background:'#fff'}
  const onUpload=async e=>{
    e.preventDefault()
    const input=document.getElementById('protocol-template-file')
    const f=input?.files?.[0]
    if(!f){setUploadErr('Выберите файл .xlsx');return}
    setUploadErr('');setUploading(true)
    try{
      const fd=new FormData()
      fd.append('file',f)
      await api.post('/protocols/templates/upload/gost_58401',fd)
      input.value=''
      load()
    }catch(err){
      const d=err.response?.data
      const msg=typeof d?.detail==='string'?d.detail:Array.isArray(d?.detail)?d.detail.map(x=>x.msg).join('; '):(err.message||'Ошибка загрузки')
      setUploadErr(msg)
    }finally{setUploading(false)}
  }
  const onSign=async(id)=>{
    setSignErr('')
    try{ await api.put(`/protocols/${id}/sign`); load() }
    catch(err){ setSignErr(err.response?.data?.detail||'Ошибка подписи') }
  }
  const onDownload=(id)=>{
    const token=localStorage.getItem('token')
    // Открываем через fetch чтобы передать Authorization header
    fetch(`/api/protocols/${id}/generate`,{headers:{Authorization:`Bearer ${token}`}})
      .then(async res=>{
        if(!res.ok){ const t=await res.json().catch(()=>({})); alert(t.detail||'Ошибка генерации'); return }
        const blob=await res.blob()
        const url=URL.createObjectURL(blob)
        const a=document.createElement('a'); a.href=url
        const cd=res.headers.get('Content-Disposition')||''
        const m=cd.match(/filename[^;=\n]*=([^;\n"]*)/)
        a.download=(m?m[1].trim():'')||`protocol_${id}.xlsx`
        a.click(); URL.revokeObjectURL(url)
      })
  }
  const STATUS_LABEL={draft:'Черновик',review:'На проверке',signed:'Подписан',sent:'Отправлен'}
  return (
    <Card title={`Протоколы (${filtered.length}${hasFilter?` из ${rows.length}`:''})`}>
      <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'1rem',marginBottom:'1rem'}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Шаблон протокола (.xlsx)</div>
        {tplStatus && (
          <p style={{fontSize:12,color:'#555',margin:'0 0 10px'}}>
            Каталог на сервере: <code style={{fontSize:11}}>{tplStatus.templates_dir}</code>
            {' · '}
            ГОСТ Р 58401: {tplStatus.templates?.gost_58401?.available
              ? <span style={{color:'#15803d',fontWeight:600}}>✓ шаблон загружен</span>
              : <span style={{color:'#b45309',fontWeight:600}}>⚠ нет файла — загрузите шаблон</span>}
          </p>
        )}
        <form onSubmit={onUpload} style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
          <input id="protocol-template-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{fontSize:13}}/>
          <Btn type="submit">{uploading?'Загрузка…':'Загрузить шаблон'}</Btn>
        </form>
        {uploadErr && <p style={{color:'#c00',fontSize:12,margin:'10px 0 0'}}>{uploadErr}</p>}
      </div>
      {signErr && <div style={{background:'#fef2f2',color:'#b91c1c',padding:'8px 12px',borderRadius:6,fontSize:13,marginBottom:10}}>{signErr}</div>}

      {/* Панель фильтров */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:12,padding:'10px 12px',background:'var(--surface2)',borderRadius:8,border:'1px solid var(--border)'}}>
        <input value={fSearch} onChange={e=>setFSearch(e.target.value)} placeholder="🔍 Номер протокола, заключение..." style={{...fi,minWidth:220,flex:1}}/>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={fi}>
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="review">На проверке</option>
          <option value="signed">Подписан</option>
          <option value="sent">Отправлен</option>
        </select>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          <span style={{fontSize:11,color:'var(--text3)'}}>Дата:</span>
          <input type="date" value={fDateFrom} onChange={e=>setFDateFrom(e.target.value)} style={{...fi,width:130}}/>
          <span style={{fontSize:11,color:'#94a3b8'}}>—</span>
          <input type="date" value={fDateTo} onChange={e=>setFDateTo(e.target.value)} style={{...fi,width:130}}/>
        </div>
        {hasFilter&&<button type="button" onClick={clearF} style={btnRed}>✕ Сбросить</button>}
      </div>

      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr>
          <Th>№</Th><Th>Дата</Th><Th>Проба (ID)</Th><Th>Статус</Th><Th>Заключение</Th><Th>Действия</Th>
        </tr></thead>
        <tbody>{filtered.map(r=>(
          <tr key={r.id}>
            <Td bold>{r.number}</Td>
            <Td>{r.created_at?.slice(0,10)}</Td>
            <Td>{r.sample_id ? `#${r.sample_id}` : '—'}</Td>
            <td style={{padding:'6px 10px',borderBottom:'1px solid var(--border2)'}}>
              <span style={{
                fontSize:11,padding:'3px 8px',borderRadius:4,fontWeight:500,
                background: r.status==='signed'?'#dcfce7':r.status==='sent'?'#dbeafe':r.status==='review'?'#fef9c3':'#f1f5f9',
                color: r.status==='signed'?'#166534':r.status==='sent'?'#1e40af':r.status==='review'?'#854d0e':'#475569',
              }}>
                {STATUS_LABEL[r.status]||r.status}
              </span>
            </td>
            <Td>{r.conclusion||'—'}</Td>
            <td style={{padding:'6px 10px',borderBottom:'1px solid var(--border2)',whiteSpace:'nowrap'}}>
              <button type="button" onClick={()=>onDownload(r.id)} style={{...btnBlue,marginRight:6}}>↓ .xlsx</button>
              {canSign && r.status==='draft' && (
                <button type="button" onClick={()=>onSign(r.id)} style={btnGreen}>Подписать</button>
              )}
              {r.status==='signed' && <span style={{fontSize:11,color:'#15803d',fontWeight:500,marginLeft:8}}>✓ Подписан</span>}
            </td>
          </tr>
        ))}</tbody>
      </table>
      {filtered.length===0 && <p style={{color:'var(--text4)',textAlign:'center',padding:'2rem',fontSize:13}}>
        {hasFilter?'Ничего не найдено — попробуйте изменить фильтры':'Протоколов пока нет. Сохраните карточку испытания — протокол создастся автоматически.'}
      </p>}
    </Card>
  )
}

export default function App() {
  const [user,setUser] = useState(()=>{ const t=localStorage.getItem('token'); return t?JSON.parse(localStorage.getItem('user')||'null'):null })
  const login = u => { setUser(u); localStorage.setItem('user',JSON.stringify(u)) }
  const logout = () => { setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user') }
  if (!user) return (
    <ThemeProvider>
      <ConfirmProvider>
        <Login onLogin={login}/>
      </ConfirmProvider>
    </ThemeProvider>
  )
  return (
    <ThemeProvider>
      <ConfirmProvider>
        <AuthCtx.Provider value={user}>
          <BrowserRouter><ErrorBoundary><Layout user={user} onLogout={logout}/></ErrorBoundary></BrowserRouter>
        </AuthCtx.Provider>
      </ConfirmProvider>
    </ThemeProvider>
  )
}
