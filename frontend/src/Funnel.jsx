import React,{useState,useEffect} from 'react'
import axios from 'axios'
const api=axios.create({baseURL:'/api'})
api.interceptors.request.use(c=>{const t=localStorage.getItem('token');if(t)c.headers.Authorization=`Bearer ${t}`;return c})
const STAGES=[
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

  const load=()=>{
    api.get('/requests').then(r=>setReqs(r.data)).catch(()=>{})
    api.get('/clients').then(r=>setClients(r.data)).catch(()=>{})
  }
  useEffect(()=>{load()},[])

  const cName=id=>{const c=clients.find(x=>x.id===id);return c?c.name:('ID '+id)}

  const moveCard=async(reqId,newStage)=>{
    setReqs(p=>p.map(r=>r.id===reqId?{...r,stage:newStage}:r))
    try{await api.patch('/requests/'+reqId+'/stage',{stage:newStage})}catch(e){load()}
  }

  const stageOf=r=>r.stage||'new_request'

  const urgColor=u=>u==='urgent'?'#ef4444':u==='high'?'#f59e0b':'#10b981'

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
          const cards=reqs.filter(r=>stageOf(r)===stage.id)
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
                  <span style={{background:stage.color,color:'#fff',borderRadius:10,padding:'1px 8px',fontSize:11,fontWeight:600}}>{cards.length}</span>
                </div>
                <div style={{fontSize:10,color:'#888',marginTop:2}}>{stage.hint}</div>
              </div>
              <div style={{padding:'8px',display:'flex',flexDirection:'column',gap:6,minHeight:80,flex:1}}>
                {cards.map(r=>(
                  <div key={r.id}
                    draggable
                    onDragStart={e=>{setDrag(r);e.dataTransfer.effectAllowed='move'}}
                    onDragEnd={()=>{setDrag(null);setOver(null)}}
                    onClick={()=>setSel(r)}
                    style={{background:'#fff',borderRadius:7,padding:'8px 10px',
                      boxShadow:'0 1px 3px rgba(0,0,0,0.08)',cursor:'grab',
                      border:'1px solid #e8ecf5',opacity:drag?.id===r.id?0.5:1,
                      transition:'box-shadow 0.1s'}}
                  >
                    <div style={{fontWeight:600,fontSize:12,color:'#1a1a2e',marginBottom:3,lineHeight:1.3}}>{r.number||('№'+r.id)}</div>
                    <div style={{fontSize:11,color:'#555',marginBottom:4}}>{cName(r.client_id)}</div>
                    {r.material_type&&<div style={{fontSize:10,color:'#888',background:'#f0f4ff',borderRadius:4,padding:'1px 6px',display:'inline-block',marginBottom:3}}>{r.material_type}</div>}
                    {r.price&&<div style={{fontSize:11,fontWeight:600,color:'#185fa5'}}>{Number(r.price).toLocaleString('ru')} ₽</div>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
                      {r.urgency&&<span style={{width:8,height:8,borderRadius:'50%',background:urgColor(r.urgency),display:'inline-block'}} title={r.urgency}/>}
                      <span style={{fontSize:10,color:'#aaa',marginLeft:'auto'}}>{r.created_at?.slice(0,10)||''}</span>
                    </div>
                  </div>
                ))}
                {cards.length===0&&<div style={{textAlign:'center',color:'#ccc',fontSize:11,padding:'16px 0'}}>Пусто</div>}
              </div>
            </div>
          )
        })}
      </div>
      {sel&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setSel(null)}>
          <div style={{background:'#fff',borderRadius:12,padding:'1.5rem',minWidth:360,maxWidth:500,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{margin:0,fontSize:15,fontWeight:700}}>{sel.number||('Заявка #'+sel.id)}</h3>
              <button onClick={()=>setSel(null)} style={{border:'none',background:'none',fontSize:20,cursor:'pointer',color:'#888'}}>×</button>
            </div>
            <div style={{fontSize:13,color:'#444',lineHeight:1.8}}>
              <div><b>Клиент:</b> {cName(sel.client_id)}</div>
              <div><b>Материал:</b> {sel.material_type||'—'}</div>
              <div><b>Стоимость:</b> {sel.price?Number(sel.price).toLocaleString('ru')+' ₽':'—'}</div>
              <div><b>Срочность:</b> {sel.urgency||'—'}</div>
              <div><b>Примечание:</b> {sel.notes||'—'}</div>
            </div>
            <div style={{marginTop:16}}>
              <div style={{fontSize:12,color:'#888',marginBottom:8}}>Перевести на этап:</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {STAGES.map(st=>(
                  <button key={st.id} onClick={()=>{moveCard(sel.id,st.id);setSel({...sel,stage:st.id})}}
                    style={{padding:'4px 10px',borderRadius:6,border:'2px solid '+(stageOf(sel)===st.id?st.color:'#ddd'),
                      background:stageOf(sel)===st.id?st.bg:'#fff',color:stageOf(sel)===st.id?st.color:'#666',
                      fontSize:11,fontWeight:stageOf(sel)===st.id?700:400,cursor:'pointer'}}>
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
