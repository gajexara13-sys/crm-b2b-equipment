import React,{useState,useEffect} from 'react'
import axios from 'axios'
const api=axios.create({baseURL:'/api'})
api.interceptors.request.use(c=>{
  const t=localStorage.getItem('token');if(t)c.headers.Authorization=`Bearer ${t}`
  return c
})

const TASK_LABELS={call:'Звонок',kp:'Отправка КП',meeting:'Встреча',payment:'Контроль оплаты'}
function dfltDue(){const t=new Date();t.setDate(t.getDate()+1);t.setHours(12,0,0,0);const y=t.getFullYear();const m=String(t.getMonth()+1).padStart(2,'0');const d=String(t.getDate()).padStart(2,'0');const hh=String(t.getHours()).padStart(2,'0');const mm=String(t.getMinutes()).padStart(2,'0');return `${y}-${m}-${d}T${hh}:${mm}`}

export const STAGES=[
  {id:'new_request',    label:'Новая заявка',         color:'#6366f1',bg:'#eef2ff', hint:'Квалификация'},
  {id:'negotiation',    label:'Согласование',        color:'#f59e0b',bg:'#fffbeb', hint:'ГОСТы, стоимость, сроки'},
  {id:'contract',       label:'Договор и счёт',      color:'#10b981',bg:'#ecfdf5', hint:'Документы подписаны'},
  {id:'waiting_samples',label:'Ожидание проб',     color:'#3b82f6',bg:'#eff6ff', hint:'Доставка или выезд'},
  {id:'in_work',        label:'В работе',            color:'#8b5cf6',bg:'#f5f3ff', hint:'Испытания в процессе'},
  {id:'waiting_payment',label:'Ожидание оплаты',  color:'#ef4444',bg:'#fef2f2', hint:'Контроль оплаты'},
  {id:'results',        label:'Выдача результатов', color:'#06b6d4',bg:'#ecfeff', hint:'Отправка протокола'},
  {id:'upd',            label:'Подписание УПД',   color:'#22c55e',bg:'#f0fdf4', hint:'Закрытие сделки'}
]

export default function PageFunnel({user}){
  const [reqs,setReqs]=useState([])
  const [clients,setClients]=useState([])
  const [drag,setDrag]=useState(null)
  const [over,setOver]=useState(null)
  const [sel,setSel]=useState(null)
  const [selTasks,setSelTasks]=useState([])
  const [newTask,setNewTask]=useState({task_type:'call',due_at:dfltDue(),note:''})
  const [taskErr,setTaskErr]=useState('')

  const load=()=>{
    api.get('/requests').then(r=>setReqs(r.data)).catch(()=>{})
    api.get('/clients').then(r=>setClients(r.data)).catch(()=>{})
  }
  useEffect(()=>{load()},[])

  const cName=id=>{const c=clients.find(x=>x.id===id);return c?c.name:('ID '+id)}

  const moveCard=async(reqId,newStage)=>{
    try{
      const {data}=await api.patch('/requests/'+reqId+'/stage',{stage:newStage})
      if(data&&data.id){
        setReqs(p=>p.map(r=>r.id===reqId?{...r,...data}:r))
        setSel(s=>s&&s.id===reqId?{...s,...data}:s)
      }
    }catch(e){
      const d=e.response?.data?.detail
      if(typeof d==='string') alert(d)
      load()
    }
  }

  const stageOf=r=>r.stage||'new_request'
  const urgColor=u=>u==='urgent'?'#ef4444':u==='high'?'#f59e0b':'#10b981'

  // Статус задачи для карточки
  const taskStatus=r=>{
    const now=new Date()
    if(!r.has_active_task) return 'none'
    if(!r.next_task_due_at) return 'ok'
    const due=new Date(r.next_task_due_at)
    if(due<now) return 'overdue'
    const todayEnd=new Date(now); todayEnd.setHours(23,59,59,999)
    if(due<=todayEnd) return 'today'
    return 'ok'
  }
  const cardStyle=status=>{
    if(status==='none')    return {background:'#fff5f5',boxShadow:'0 0 0 2px #ef4444',border:'1px solid #fecaca'}
    if(status==='overdue') return {background:'#fff8f0',boxShadow:'0 0 0 2px #f97316',border:'1px solid #fed7aa'}
    if(status==='today')   return {background:'#fefce8',boxShadow:'0 0 0 1.5px #eab308',border:'1px solid #fde68a'}
    return {background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.08)',border:'1px solid #e8ecf5'}
  }

  const openSel=r=>{
    setSel(r); setTaskErr(''); setNewTask({task_type:'call',due_at:dfltDue(),note:''})
    api.get('/tasks/by-request/'+r.id).then(res=>setSelTasks(res.data||[])).catch(()=>setSelTasks([]))
  }
  const closeSel=()=>{setSel(null);setSelTasks([]);setTaskErr('')}

  const completeTask=async id=>{
    await api.patch('/tasks/'+id,{completed:true})
    setSelTasks(p=>p.map(t=>t.id===id?{...t,completed_at:new Date().toISOString()}:t))
    load()
  }

  const submitTask=async e=>{
    e.preventDefault(); if(!sel||!newTask.due_at)return; setTaskErr('')
    try{
      await api.post('/tasks',{request_id:sel.id,task_type:newTask.task_type,
        due_at:newTask.due_at,note:newTask.note||null,assigned_to:user?.id||undefined})
      const res=await api.get('/tasks/by-request/'+sel.id)
      setSelTasks(res.data||[])
      setNewTask({task_type:'call',due_at:dfltDue(),note:''})
      load()
    }catch(ex){
      const d=ex.response?.data?.detail
      setTaskErr(typeof d==='string'?d:'Не удалось сохранить задачу')
    }
  }

  return(
    <div style={{fontFamily:'-apple-system,sans-serif'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <h2 style={{margin:0,fontSize:18,fontWeight:700}}>Воронка продаж</h2>
          <div style={{fontSize:12,color:'#888',marginTop:2}}>Заявок: {reqs.length} | Перетащивайте карточки между этапами</div>
        </div>
      </div>
      <div style={{display:'flex',gap:10,overflowX:'auto',paddingBottom:12,alignItems:'flex-start'}}>
        {STAGES.map(stage=>{
          const cards=reqs.filter(r=>stageOf(r)===stage.id).sort((a,b)=>{
            const sa=a.has_active_task?1:0
            const sb=b.has_active_task?1:0
            if(sa!==sb) return sa-sb
            const ta=a.next_task_due_at?new Date(a.next_task_due_at).getTime():0
            const tb=b.next_task_due_at?new Date(b.next_task_due_at).getTime():0
            return ta-tb
          })
          const overdueCount=cards.filter(r=>taskStatus(r)==='overdue').length
          const noTaskCount=cards.filter(r=>taskStatus(r)==='none').length
          const isOver=over===stage.id
          return(
            <div key={stage.id}
              onDragOver={e=>{e.preventDefault();setOver(stage.id)}}
              onDrop={e=>{e.preventDefault();if(drag&&stageOf(drag)!==stage.id)moveCard(drag.id,stage.id);setDrag(null);setOver(null)}}
              style={{minWidth:200,maxWidth:220,flexShrink:0,background:isOver?stage.bg:'#f8fafc',
                border:'2px solid '+(isOver?stage.color:'#e8ecf5'),borderRadius:10,
                transition:'all 0.15s',display:'flex',flexDirection:'column'}}
            >
              <div style={{padding:'10px 12px',borderBottom:'1px solid #e8ecf5',background:stage.bg,borderRadius:'8px 8px 0 0'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontWeight:700,fontSize:12,color:stage.color}}>{stage.label}</span>
                  <div style={{display:'flex',gap:4,alignItems:'center'}}>
                    {overdueCount>0&&<span style={{background:'#f97316',color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:10,fontWeight:700}} title="Просрочено">⏰{overdueCount}</span>}
                    {noTaskCount>0&&<span style={{background:'#ef4444',color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:10,fontWeight:700}} title="Нет задачи">!{noTaskCount}</span>}
                    <span style={{background:stage.color,color:'#fff',borderRadius:10,padding:'1px 8px',fontSize:11,fontWeight:600}}>{cards.length}</span>
                  </div>
                </div>
                <div style={{fontSize:10,color:'#888',marginTop:2}}>{stage.hint}</div>
              </div>
              <div style={{padding:'8px',display:'flex',flexDirection:'column',gap:6,minHeight:80,flex:1}}>
                {cards.map(r=>{
                  const status=taskStatus(r)
                  const cs=cardStyle(status)
                  const dueDate=r.next_task_due_at?new Date(r.next_task_due_at):null
                  return(
                  <div key={r.id}
                    draggable
                    onDragStart={e=>{setDrag(r);e.dataTransfer.effectAllowed='move'}}
                    onDragEnd={()=>{setDrag(null);setOver(null)}}
                    onClick={()=>openSel(r)}
                    style={{...cs,borderRadius:7,padding:'8px 10px',cursor:'grab',
                      opacity:drag?.id===r.id?0.5:1,transition:'box-shadow 0.1s'}}
                  >
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:3}}>
                      <div style={{fontWeight:600,fontSize:12,color:'#1a1a2e',lineHeight:1.3}}>{r.number||('№'+r.id)}</div>
                      {status==='none'&&<span style={{fontSize:9,fontWeight:700,color:'#ef4444',background:'#fee2e2',borderRadius:4,padding:'1px 5px',whiteSpace:'nowrap',marginLeft:4}}>НЕТ ЗАДАЧИ</span>}
                      {status==='overdue'&&<span style={{fontSize:9,fontWeight:700,color:'#c2410c',background:'#ffedd5',borderRadius:4,padding:'1px 5px',whiteSpace:'nowrap',marginLeft:4}}>ПРОСРОЧЕНА</span>}
                      {status==='today'&&<span style={{fontSize:9,fontWeight:700,color:'#854d0e',background:'#fef9c3',borderRadius:4,padding:'1px 5px',whiteSpace:'nowrap',marginLeft:4}}>СЕГОДНЯ</span>}
                    </div>
                    <div style={{fontSize:11,color:'#555',marginBottom:4}}>{cName(r.client_id)}</div>
                    {r.material_type&&<div style={{fontSize:10,color:'#888',background:'#f0f4ff',borderRadius:4,padding:'1px 6px',display:'inline-block',marginBottom:3}}>{r.material_type}</div>}
                    {r.price&&<div style={{fontSize:11,fontWeight:600,color:'#185fa5'}}>{Number(r.price).toLocaleString('ru')} ₽</div>}
                    {dueDate&&status!=='ok'&&(
                      <div style={{fontSize:10,marginTop:3,color:status==='overdue'?'#c2410c':status==='today'?'#854d0e':'#64748b'}}>
                        {status==='overdue'
                          ? '⏰ '+dueDate.toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
                          : '⏳ '+dueDate.toLocaleString('ru-RU',{hour:'2-digit',minute:'2-digit'})}
                      </div>
                    )}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
                      {r.urgency&&<span style={{width:8,height:8,borderRadius:'50%',background:urgColor(r.urgency),display:'inline-block'}} title={r.urgency}/>}
                      <span style={{fontSize:10,color:'#aaa',marginLeft:'auto'}}>{r.created_at?.slice(0,10)||''}</span>
                    </div>
                  </div>
                  )
                })}
                {cards.length===0&&<div style={{textAlign:'center',color:'#ccc',fontSize:11,padding:'16px 0'}}>Пусто</div>}
              </div>
            </div>
          )
        })}
      </div>
      {sel&&(
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:12}} onClick={closeSel}>
          <div style={{background:'#fff',borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 25px 60px rgba(0,0,0,0.2)'}} onClick={e=>e.stopPropagation()}>
            {/* Шапка */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <h3 style={{margin:0,fontSize:16,fontWeight:700}}>{sel.number||('Заявка #'+sel.id)}</h3>
              <button onClick={closeSel} style={{border:'none',background:'none',fontSize:22,cursor:'pointer',color:'#94a3b8'}}>×</button>
            </div>

            {/* Детали сделки */}
            <div style={{fontSize:13,color:'#334155',lineHeight:1.8,marginBottom:14,background:'#f8fafc',borderRadius:8,padding:'10px 12px'}}>
              <div><b>Клиент:</b> {cName(sel.client_id)}</div>
              <div><b>Материал:</b> {sel.material_type||'—'}</div>
              {sel.price&&<div><b>Стоимость:</b> {Number(sel.price).toLocaleString('ru')} ₽</div>}
              {sel.notes&&<div><b>Примечание:</b> {sel.notes}</div>}
            </div>

            {/* Смена этапа */}
            <div style={{fontSize:11,fontWeight:600,color:'#64748b',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Этап</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:16}}>
              {STAGES.map(st=>(
                <button key={st.id} onClick={()=>moveCard(sel.id,st.id)}
                  style={{padding:'5px 10px',borderRadius:7,border:'2px solid '+(stageOf(sel)===st.id?st.color:'#e2e8f0'),
                    background:stageOf(sel)===st.id?st.bg:'#fff',color:stageOf(sel)===st.id?st.color:'#64748b',
                    fontSize:11,fontWeight:stageOf(sel)===st.id?700:500,cursor:'pointer',transition:'all 0.1s'}}>
                  {st.label}
                </button>
              ))}
            </div>

            {/* Задачи */}
            <div style={{borderTop:'1px solid #e2e8f0',paddingTop:14}}>
              <div style={{fontSize:11,fontWeight:600,color:'#64748b',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                Задачи по сделке
              </div>
              {selTasks.filter(t=>!t.completed_at).length===0&&(
                <p style={{fontSize:13,color:'#f97316',margin:'0 0 10px',padding:'8px 10px',background:'#fff7ed',borderRadius:7,border:'1px solid #fed7aa'}}>
                  ⚠ Нет открытой задачи — сделку нельзя перевести на следующий этап
                </p>
              )}
              <ul style={{margin:'0 0 12px',paddingLeft:0,listStyle:'none'}}>
                {selTasks.filter(t=>!t.completed_at).map(t=>(
                  <li key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13,padding:'7px 10px',borderRadius:7,background:'#f0fdf4',border:'1px solid #bbf7d0',marginBottom:5}}>
                    <span>
                      <b>{TASK_LABELS[t.task_type]||t.task_type}</b>
                      {t.due_at&&<span style={{color:'#64748b',marginLeft:6}}>{new Date(t.due_at).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>}
                      {t.note&&<span style={{color:'#94a3b8',marginLeft:6,fontSize:12}}>— {t.note}</span>}
                    </span>
                    <button onClick={()=>completeTask(t.id)} style={{fontSize:11,padding:'3px 10px',borderRadius:5,border:'none',background:'#16a34a',color:'#fff',cursor:'pointer',flexShrink:0,marginLeft:8}}>Выполнено</button>
                  </li>
                ))}
                {selTasks.filter(t=>t.completed_at).slice(-3).map(t=>(
                  <li key={t.id} style={{fontSize:12,color:'#94a3b8',padding:'4px 10px',textDecoration:'line-through'}}>
                    {TASK_LABELS[t.task_type]||t.task_type} — выполнено {new Date(t.completed_at).toLocaleDateString('ru-RU')}
                  </li>
                ))}
              </ul>

              {/* Форма новой задачи */}
              {taskErr&&<div style={{background:'#fef2f2',color:'#b91c1c',padding:'8px 10px',borderRadius:7,fontSize:13,marginBottom:10}}>{taskErr}</div>}
              <form onSubmit={submitTask} style={{background:'#f8fafc',borderRadius:10,padding:'12px'}}>
                <div style={{fontSize:12,fontWeight:600,color:'#334155',marginBottom:8}}>Новая задача</div>
                <div style={{display:'grid',gap:8}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <select value={newTask.task_type} onChange={e=>setNewTask({...newTask,task_type:e.target.value})}
                      style={{padding:'8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:13}}>
                      {Object.entries(TASK_LABELS).map(([k,l])=><option key={k} value={k}>{l}</option>)}
                    </select>
                    <input type="datetime-local" value={newTask.due_at} required
                      onChange={e=>setNewTask({...newTask,due_at:e.target.value})}
                      style={{padding:'8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:13}}/>
                  </div>
                  <input placeholder="Комментарий (необязательно)" value={newTask.note}
                    onChange={e=>setNewTask({...newTask,note:e.target.value})}
                    style={{padding:'8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:13}}/>
                  <button type="submit" style={{padding:'9px',borderRadius:8,border:'none',background:'#185fa5',color:'#fff',fontWeight:600,fontSize:13,cursor:'pointer'}}>
                    Добавить задачу
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
