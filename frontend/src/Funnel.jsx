import React,{useState,useEffect,useLayoutEffect,useMemo,useRef} from 'react'
import axios from 'axios'
import {useNavigate} from 'react-router-dom'
import Modal from './Modal'
import boardsConfig from './config/boards.config.json'
export const STAGES=(boardsConfig.boards.find(b=>b.id==='sales')?.stages||[]).map(s=>({...s,label:s.name}))

const api=axios.create({baseURL:'/api'})
api.interceptors.request.use(c=>{
  const t=localStorage.getItem('token');if(t)c.headers.Authorization=`Bearer ${t}`
  return c
})

const COLOR_MAP={
  gray:   {color:'#6b7280',bg:'#f3f4f6'},
  indigo: {color:'#6366f1',bg:'#eef2ff'},
  blue:   {color:'#3b82f6',bg:'#eff6ff'},
  cyan:   {color:'#0891b2',bg:'#ecfeff'},
  teal:   {color:'#0d9488',bg:'#f0fdfa'},
  emerald:{color:'#059669',bg:'#ecfdf5'},
  lime:   {color:'#65a30d',bg:'#f7fee7'},
  amber:  {color:'#d97706',bg:'#fffbeb'},
  orange: {color:'#ea580c',bg:'#fff7ed'},
  yellow: {color:'#ca8a04',bg:'#fefce8'},
  violet: {color:'#7c3aed',bg:'#f5f3ff'},
  red:    {color:'#ef4444',bg:'#fef2f2'},
  rose:   {color:'#e11d48',bg:'#fff1f2'},
}

const FIELD_LABELS={
  contact_name:'Имя контакта',company:'Компания',source:'Источник лида',
  budget:'Бюджет (₽)',decision_maker:'ЛПР (лицо принимающее решение)',
  need_confirmed:'Потребность подтверждена',assigned_engineer:'Ответственный инженер',
  equipment_model:'Модель оборудования',quote_amount:'Сумма КП (₽)',
  quote_document:'Документ КП (номер / ссылка)',contract_number:'Номер договора',
  contract_date:'Дата договора',invoice_amount:'Сумма счёта (₽)',
  payment_confirmed_date:'Дата подтверждения оплаты',supplier:'Поставщик',
  expected_production_date:'Ожидаемая дата производства',tracking_number:'Трек-номер / ТТН',
  expected_arrival_date:'Ожидаемая дата прибытия',stock_confirmed:'Приёмка на склад',
  metrology_certificate:'Свидетельство о поверке',delivery_date:'Дата доставки',
  installation_engineer:'Инженер по монтажу',closing_docs_received:'Закрывающие документы',
  linked_deal_id:'ID связанной сделки',claim_description:'Описание рекламации',
  resolution_description:'Описание решения',return_reason:'Причина возврата',
  return_date:'Дата возврата к работе',lost_reason:'Причина',
  lost_comment:'Примечание к отказу',
}
const BOOL_FIELDS=['need_confirmed','stock_confirmed','closing_docs_received']
const DATE_FIELDS=['return_date']

function dfltDue(){
  const t=new Date();t.setDate(t.getDate()+1);t.setHours(12,0,0,0)
  const y=t.getFullYear(),m=String(t.getMonth()+1).padStart(2,'0'),d=String(t.getDate()).padStart(2,'0')
  const hh=String(t.getHours()).padStart(2,'0'),mm=String(t.getMinutes()).padStart(2,'0')
  return `${y}-${m}-${d}T${hh}:${mm}`
}
const TASK_LABELS={call:'Звонок',kp:'Отправка КП',meeting:'Встреча',payment:'Контроль оплаты'}

function parseUTC(s){
  if(!s) return null
  if(typeof s==='number') return new Date(s)
  if(s.endsWith('Z')||s.includes('+')||/[T ]\d\d:\d\d:\d\d-\d\d/.test(s)) return new Date(s)
  return new Date(s.replace(' ','T')+'Z')
}

function getStageCfg(boardId,stageId){
  const b=boardsConfig.boards.find(x=>x.id===boardId)
  return b?b.stages.find(s=>s.id===stageId)||null:null
}

function getSlaStatus(req,boardId){
  const cfg=getStageCfg(boardId,req.stage)
  if(!cfg?.sla_days||!req.stage_entered_at) return 'ok'
  const entered=new Date(req.stage_entered_at)
  const deadline=new Date(entered.getTime()+cfg.sla_days*86400000)
  const now=new Date()
  if(now>deadline) return 'sla_overdue'
  if(now>new Date(deadline.getTime()-86400000)) return 'sla_warn'
  return 'ok'
}

function getFieldVal(req,f){
  const v=req[f]
  if(v!==undefined&&v!==null&&v!==''&&v!==false) return v
  const ef=req.extra_fields||{}
  const ev=ef[f]
  if(ev!==undefined&&ev!==null&&ev!=='') return ev
  return null
}

function getMissingExit(req,boardId,stageId){
  const cfg=getStageCfg(boardId,stageId)
  if(!cfg?.required_fields_on_exit?.length) return []
  return cfg.required_fields_on_exit.filter(f=>!getFieldVal(req,f))
}

const OPS_NOTIF_STAGES=['in-production','importing','stock-entry','metrology','ready-to-ship','delivering-install','docs-waiting','complete']
const OPS_NOTIF_TITLES={
  'in-production':'Принят в производство',
  'importing':'В пути',
  'stock-entry':'Прибыл на склад',
  'metrology':'На поверке/аттестации',
  'ready-to-ship':'Готов к отгрузке',
  'delivering-install':'Передан в доставку',
  'docs-waiting':'Доставлен — ожидаем документы',
  'complete':'Заказ выполнен',
}
function buildClientMsg(req,stageId,client){
  const num=req.number||('#'+req.id)
  const ex=req.extra_fields||{}
  const cName=client?.contact2_name||client?.contact_name||client?.name||'клиент'
  const bodies={
    'in-production':`Ваш заказ ${num} принят в производство у поставщика.`+(ex.expected_production_date?`
Ожидаемая дата готовности: ${ex.expected_production_date}.`:''),
    'importing':`Ваш заказ ${num} отгружен поставщиком и находится в пути.`+(ex.tracking_number?`
Трек-номер отслеживания: ${ex.tracking_number}.`:'')+(ex.expected_arrival_date?`
Ожидаемая дата прибытия: ${ex.expected_arrival_date}.`:''),
    'stock-entry':`Ваш заказ ${num} прибыл на наш склад и проходит входной контроль качества.
О результатах сообщим в ближайшее время.`,
    'metrology':`Ваш заказ ${num} передан на поверку и аттестацию оборудования.
Данный этап необходим для подтверждения метрологических характеристик.`,
    'ready-to-ship':`Ваш заказ ${num} прошёл все необходимые проверки и готов к отгрузке.
Наш менеджер свяжется с Вами в ближайшее время для согласования даты и условий доставки.`,
    'delivering-install':`Ваш заказ ${num} передан в службу доставки.`+(ex.delivery_date?`
Плановая дата доставки: ${ex.delivery_date}.`:'')+`
Пожалуйста, убедитесь в готовности к приёмке оборудования.`,
    'docs-waiting':`Ваш заказ ${num} успешно доставлен`+(ex.installation_engineer?` и принят к монтажу инженером ${ex.installation_engineer}`:'')+`.
Просим подписать и направить нам закрывающие документы.`,
    'complete':`Ваш заказ ${num} полностью выполнен. Все необходимые документы оформлены.

Благодарим Вас за сотрудничество! Будем рады видеть Вас снова.`,
  }
  const body=bodies[stageId]
  if(!body) return null
  return `Уважаемый(ая) ${cName},

${body}

С уважением,
Команда RUTEST`
}

async function sendNotifEmailFn(api,notifModal,setEmailSending,setEmailSent,setNotifModal){
  const cl=notifModal.client
  const clientEmail=cl?.contact2_email||cl?.contact_email
  if(!clientEmail){alert('У клиента не указан email. Добавьте его в карточке контрагента.');return}
  setEmailSending(true)
  try{
    const num=notifModal.req.number||('#'+notifModal.req.id)
    const subj=`Статус заказа ${num} — ${OPS_NOTIF_TITLES[notifModal.stageId]||notifModal.stageId}`
    await api.post('/email/send',{
      to_emails:[clientEmail],
      subject:subj,
      body_text:notifModal.message,
      linked_request_id:notifModal.req.id||undefined,
      linked_client_id:notifModal.req.client_id||undefined,
    })
    setEmailSent(true)
    setTimeout(()=>{setNotifModal(null);setEmailSent(false)},2000)
  }catch(e){
    const d=e.response?.data?.detail
    alert(typeof d==='string'?d:'Ошибка отправки. Проверьте настройки SMTP в разделе Справочник.')
  }finally{setEmailSending(false)}
}

export default function PageFunnel({user}){
  const navigate=useNavigate()
  const [boardId,setBoardId]=useState('sales')
  const [reqs,setReqs]=useState([])
  const [clients,setClients]=useState([])
  const [drag,setDrag]=useState(null)
  const [over,setOver]=useState(null)
  const botScrollRef=useRef(null)
  const stickyScrollRef=useRef(null)
  const [sel,setSel]=useState(null)
  const [selTasks,setSelTasks]=useState([])
  const [selQuotes,setSelQuotes]=useState([])
  const [allQuotes,setAllQuotes]=useState([])
  const [newTask,setNewTask]=useState({task_type:'call',due_at:dfltDue(),note:''})
  const [taskErr,setTaskErr]=useState('')
  const [stageModal,setStageModal]=useState(null)
  const [notifModal,setNotifModal]=useState(null)
  const [emailSending,setEmailSending]=useState(false)
  const [emailSent,setEmailSent]=useState(false)
  const [showClaim,setShowClaim]=useState(false)
  const [claimData,setClaimData]=useState({linked_deal_id:'',claim_description:'',client_id:''})

  const activeBoard=boardsConfig.boards.find(b=>b.id===boardId)

  const load=()=>{
    api.get('/requests').then(r=>setReqs(r.data)).catch(()=>{})
    api.get('/clients').then(r=>setClients(r.data)).catch(()=>{})
    api.get('/crm/quotes').then(r=>setAllQuotes(r.data||[])).catch(()=>{})
  }
  useEffect(()=>{load()},[])

  useLayoutEffect(()=>{
    const bot=botScrollRef.current
    const sticky=stickyScrollRef.current
    if(!bot||!sticky) return
    const w=bot.scrollWidth+'px'
    const sp=sticky.firstElementChild
    if(sp) sp.style.width=w
  })

  // Автообновление доски каждые 60 секунд (новые заявки из почты)
  useEffect(()=>{
    const t=setInterval(()=>load(),60000)
    return ()=>clearInterval(t)
  },[])

  const cName=id=>{const c=clients.find(x=>x.id===id);return c?c.name:('ID '+id)}

  const cardAmount=r=>{
    const quotes=allQuotes.filter(q=>q.request_id===r.id&&(q.total_with_vat||q.total))
    if(quotes.length>0){
      const last=quotes[quotes.length-1]
      return {amount:Number(last.total_with_vat||last.total),isQuote:true}
    }
    if(r.price) return {amount:Number(r.price),isQuote:false}
    return null
  }

  const boardCards=useMemo(()=>reqs.filter(r=>(r.board_id||'sales')===boardId),[reqs,boardId])

  const stageCards=sid=>{
    let cards
    if(boardId==='sales'&&sid==='transferred'){
      // «Передан в производство» — зеркало сделок, которые СЕЙЧАС в работе на
      // «Исполнении» (board_id=operations). Когда сделка доходит до «Выполнено»,
      // она уходит в «Эксплуатацию» (board_id=aftersales) и исчезает отсюда.
      cards=reqs.filter(r=>(r.board_id||'sales')==='operations')
    } else if(boardId==='operations'&&sid==='complete'){
      // «Выполнено» — зеркало доставленных заказов, ушедших в «Эксплуатацию»
      // (Постпродажное). Карточка остаётся видна и здесь как результат производства.
      const real=boardCards.filter(r=>r.stage==='complete')
      const done=reqs.filter(r=>(r.board_id||'sales')==='aftersales'&&r.stage==='operation')
      cards=[...real,...done]
    } else {
      cards=boardCards.filter(r=>r.stage===sid)
    }
    return [...cards].sort((a,b)=>{
      const sa=a.has_active_task?1:0,sb=b.has_active_task?1:0
      if(sa!==sb) return sa-sb
      const ta=a.next_task_due_at?new Date(a.next_task_due_at).getTime():0
      const tb=b.next_task_due_at?new Date(b.next_task_due_at).getTime():0
      return ta-tb
    })
  }

  const unknownCards=useMemo(()=>{
    if(!activeBoard) return []
    const known=new Set(activeBoard.stages.map(s=>s.id))
    // transferred-карточки теперь зеркалятся из «Исполнения», поэтому свои
    // (board_id=sales) с этим этапом уже не должны оставаться — не считаем их «устаревшими».
    return boardCards.filter(r=>!known.has(r.stage))
  },[boardCards,activeBoard])

  const boardCounts=useMemo(()=>{
    const m={}
    boardsConfig.boards.forEach(b=>{
      const parking=new Set(b.stages.filter(s=>s.pipeline===false).map(s=>s.id))
      m[b.id]=reqs.filter(r=>(r.board_id||'sales')===b.id&&!parking.has(r.stage)).length
    })
    return m
  },[reqs])

  const taskStatus=r=>{
    const now=new Date()
    if(!r.has_active_task) return 'none'
    if(!r.next_task_due_at) return 'ok'
    const due=new Date(r.next_task_due_at)
    if(due<now) return 'overdue'
    const todayEnd=new Date(now);todayEnd.setHours(23,59,59,999)
    if(due<=todayEnd) return 'today'
    return 'ok'
  }
  const urgColor=u=>u==='urgent'?'#ef4444':u==='high'?'#f59e0b':'#10b981'

  const cardStyle=(req,stageCfg)=>{
    const ts=taskStatus(req),sla=getSlaStatus(req,boardId)
    // handoff/terminal stages don't require tasks — no red border
    if(ts==='none'&&stageCfg?.type&&['handoff','terminal_won','terminal_lost','holding'].includes(stageCfg.type))
      return {border:'1px solid var(--border)',background:'var(--card-bg)',boxShadow:'0 1px 4px rgba(0,0,0,0.1)'}
    if(ts==='none')    return {border:'2px solid #ef4444',background:'var(--card-bg-none)'}
    if(ts==='overdue') return {border:'2px solid #f97316',background:'var(--card-bg-overdue)'}
    if(ts==='today')   return {border:'1.5px solid #eab308',background:'var(--card-bg-today)'}
    if(sla==='sla_overdue') return {border:'2px solid #dc2626',background:'#fff1f2'}
    if(sla==='sla_warn')    return {border:'1.5px solid #f59e0b',background:'#fefce8'}
    return {border:'1px solid var(--border)',background:'var(--card-bg)',boxShadow:'0 1px 4px rgba(0,0,0,0.1)'}
  }

  const initiateStage=(req,targetId)=>{
    if(req.stage===targetId) return
    const cfg=getStageCfg(boardId,targetId)
    const isLost=targetId==='lost'
    const isTransferred=targetId==='transferred'
    const isNurturing=targetId==='nurturing'
    if(isLost||isTransferred||isNurturing){
      const fv={}
      if(isLost) fv.lost_reason=req.lost_reason||''
      if(isNurturing) fv.return_date=getFieldVal(req,'return_date')||''
      setStageModal({req,targetId,missing:isNurturing?['return_date']:[],fv,
        lostOpts:isLost?(cfg?.lost_reason_options||[]):[],
        isTransferred,isNurturing})
    } else {
      doStage(req,targetId,null,{})
    }
  }

  const doStage=async(req,targetId,lostReason,extraFields)=>{
    try{
      const body={stage:targetId}
      if(lostReason) body.lost_reason=lostReason
      if(Object.keys(extraFields).length) body.extra_fields=extraFields
      const {data}=await api.patch('/requests/'+req.id+'/stage',body)
      if(data?.id){
        setReqs(p=>p.map(r=>r.id===req.id?{...r,...data}:r))
        setSel(s=>s&&s.id===req.id?{...s,...data}:s)
      }
      setStageModal(null)
      // Уведомление клиента при смене этапа на доске Исполнение.
      // Берём доску-источник: этап «Выполнен» переносит карточку в «Постпродажное»,
      // но уведомление «Заказ выполнен» всё равно нужно показать.
      const srcBoard=(req.board_id||'sales')
      if(srcBoard==='operations'&&OPS_NOTIF_STAGES.includes(targetId)){
        const cl=clients.find(c=>c.id===(data?.client_id||req.client_id))
        const msg=buildClientMsg(data||req,targetId,cl)
        if(msg) setNotifModal({req:data||req,stageId:targetId,client:cl,message:msg})
      }
      load()
    }catch(e){
      const d=e.response?.data?.detail
      if(typeof d==='string') alert(d)
      load()
    }
  }

  const submitModal=async()=>{
    const {req,targetId,missing,fv,lostOpts,isTransferred}=stageModal
    for(const f of missing){
      if(!fv[f]&&!BOOL_FIELDS.includes(f)){alert('Заполните: '+(FIELD_LABELS[f]||f));return}
    }
    if(lostOpts.length>0&&!fv.lost_reason){alert('Укажите причину отказа');return}
    if(isTransferred){
      if(!window.confirm('Передать сделку в производство?\nБудет создана карточка на доске «Исполнение».')) return
    }
    const {lost_reason,...rest}=fv
    await doStage(req,targetId,lost_reason,rest)
  }

  const openSel=r=>{
    setSel(r);setTaskErr('');setNewTask({task_type:'call',due_at:dfltDue(),note:''})
    api.get('/tasks/by-request/'+r.id).then(res=>setSelTasks(res.data||[])).catch(()=>setSelTasks([]))
    api.get('/crm/quotes',{params:{request_id:r.id}}).then(res=>setSelQuotes(res.data||[])).catch(()=>setSelQuotes([]))
  }
  const closeSel=()=>{setSel(null);setSelTasks([]);setSelQuotes([]);setTaskErr('')}

  const completeTask=async id=>{
    await api.patch('/tasks/'+id,{completed:true})
    setSelTasks(p=>p.map(t=>t.id===id?{...t,completed_at:new Date().toISOString()}:t))
    load()
  }

  const submitTask=async e=>{
    e.preventDefault();if(!sel||!newTask.due_at)return;setTaskErr('')
    try{
      await api.post('/tasks',{request_id:sel.id,task_type:newTask.task_type,
        due_at:newTask.due_at,note:newTask.note||null,assigned_to:user?.id||undefined})
      const res=await api.get('/tasks/by-request/'+sel.id)
      setSelTasks(res.data||[]);setNewTask({task_type:'call',due_at:dfltDue(),note:''});load()
    }catch(ex){
      const d=ex.response?.data?.detail
      setTaskErr(typeof d==='string'?d:'Не удалось сохранить задачу')
    }
  }

  const submitClaim=async e=>{
    e.preventDefault()
    try{
      await api.post('/requests',{
        client_id:parseInt(claimData.client_id),board_id:'aftersales',
        stage:'claim-new',request_kind:'service',
        notes:claimData.claim_description,
        extra_fields:{linked_deal_id:claimData.linked_deal_id,claim_description:claimData.claim_description},
      })
      setShowClaim(false);setClaimData({linked_deal_id:'',claim_description:'',client_id:''});load()
    }catch(ex){alert('Не удалось создать рекламацию')}
  }

  const btn=(extra={})=>({fontSize:13,padding:'7px 16px',borderRadius:8,cursor:'pointer',fontWeight:600,whiteSpace:'nowrap',border:'none',...extra})
  const inp=(extra={})=>({width:'100%',padding:'8px 10px',borderRadius:7,border:'1px solid var(--border)',fontSize:13,boxSizing:'border-box',...extra})
  const overlayStyle={position:'fixed',inset:0,background:'rgba(15,23,42,0.5)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}
  const panelStyle=(w=480)=>({background:'var(--surface)',borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:w,boxShadow:'0 25px 60px rgba(0,0,0,0.2)'})

  if(!activeBoard) return <div>Доска не найдена</div>

  // Основной пайплайн vs «отстойники» вне воронки (pipeline:false)
  const pipelineStages=activeBoard.stages.filter(s=>s.pipeline!==false)
  const parkingStages=activeBoard.stages.filter(s=>s.pipeline===false)

  const renderColumn=stage=>{
    const ci=COLOR_MAP[stage.color]||COLOR_MAP.blue
    const cards=stageCards(stage.id)
    const isOver=over===stage.id
    const overdueN=cards.filter(r=>taskStatus(r)==='overdue').length
    const noTaskN=cards.filter(r=>taskStatus(r)==='none').length
    const slaOvN=cards.filter(r=>getSlaStatus(r,boardId)==='sla_overdue').length
    const isTermWon=stage.type==='terminal_won'
    const isTermLost=stage.type==='terminal_lost'
    const isHandoff=stage.type==='handoff'
    const isHolding=stage.type==='holding'
    const isParking=stage.pipeline===false
    return(
      <div key={stage.id}
        onDragOver={e=>{e.preventDefault();setOver(stage.id)}}
        onDrop={e=>{
          e.preventDefault()
          if(drag&&drag.stage!==stage.id) initiateStage(drag,stage.id)
          setDrag(null);setOver(null)
        }}
        style={{minWidth:200,maxWidth:220,flexShrink:0,
          background:isOver?ci.bg:'var(--surface2)',
          border:(isParking?'2px dashed ':'2px solid ')+(isOver?ci.color:'var(--border)'),
          borderRadius:10,transition:'all 0.15s',display:'flex',flexDirection:'column'}}
      >
        <div style={{padding:'10px 12px',borderBottom:'1px solid #e8ecf5',background:ci.bg,borderRadius:'8px 8px 0 0'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:700,fontSize:12,color:ci.color}}>
              {isTermWon&&'✓ '}{isTermLost&&'✗ '}{isHandoff&&'→ '}{isHolding&&'⏸ '}{stage.name}
            </span>
            <div style={{display:'flex',gap:3,alignItems:'center'}}>
              {slaOvN>0&&<span style={{background:'#dc2626',color:'#fff',borderRadius:10,padding:'1px 5px',fontSize:9,fontWeight:700}} title="SLA просрочен">⏱{slaOvN}</span>}
              {overdueN>0&&<span style={{background:'#f97316',color:'#fff',borderRadius:10,padding:'1px 5px',fontSize:10,fontWeight:700}} title="Задача просрочена">⏰{overdueN}</span>}
              {noTaskN>0&&<span style={{background:'#ef4444',color:'#fff',borderRadius:10,padding:'1px 5px',fontSize:10,fontWeight:700}} title="Нет задачи">!{noTaskN}</span>}
              <span style={{background:ci.color,color:'#fff',borderRadius:10,padding:'1px 8px',fontSize:11,fontWeight:600}}>{cards.length}</span>
            </div>
          </div>
          {isParking
            ?<div style={{fontSize:9,color:'var(--text5)',marginTop:1,textTransform:'uppercase',letterSpacing:'0.04em'}}>Вне воронки</div>
            :stage.sla_days&&<div style={{fontSize:9,color:'var(--text5)',marginTop:1}}>Срок: {stage.sla_days} дн.</div>}
        </div>
        <div style={{padding:'8px',display:'flex',flexDirection:'column',gap:6,minHeight:80,flex:1}}>
          {cards.map(r=>{
            // Зеркальная карточка с другой доски — только для чтения, клик ведёт туда,
            // где сделка находится на самом деле.
            const mirror=(r.board_id||'sales')!==boardId
            const ts=taskStatus(r),sla=getSlaStatus(r,boardId)
            const cs=cardStyle(r,stage)
            const dueDate=r.next_task_due_at?new Date(r.next_task_due_at):null
            if(mirror){
              const realBoardId=(r.board_id||'sales')
              const realStage=getStageCfg(realBoardId,r.stage)
              const realBoardName=boardsConfig.boards.find(b=>b.id===realBoardId)?.name||realBoardId
              const ca=cardAmount(r)
              return(
                <div key={r.id} onClick={()=>setBoardId(realBoardId)}
                  style={{...cs,borderRadius:7,padding:'8px 10px',cursor:'pointer',opacity:0.92}}
                  title={`Находится на доске «${realBoardName}» — открыть`}>
                  <div style={{fontWeight:600,fontSize:12,color:'var(--text)',lineHeight:1.3,marginBottom:3}}>{r.number||('№'+r.id)}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginBottom:3}}>{cName(r.client_id)}</div>
                  <div style={{fontSize:9,fontWeight:700,color:'#0d9488',background:'#f0fdfa',borderRadius:4,padding:'1px 6px',display:'inline-block',marginBottom:3}}>📍 {realBoardName}: {realStage?.name||r.stage}</div>
                  {ca&&<div style={{fontSize:11,fontWeight:600,color:'var(--primary)'}}>{ca.amount.toLocaleString('ru')} ₽{ca.isQuote&&<span style={{fontSize:9,color:'var(--text4)',fontWeight:400,marginLeft:3}}>КП</span>}</div>}
                </div>
              )
            }
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
                  <div style={{fontWeight:600,fontSize:12,color:'var(--text)',lineHeight:1.3}}>{r.number||('№'+r.id)}</div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
                    {ts==='none'&&<span style={{fontSize:9,fontWeight:700,color:'#ef4444',background:'#fee2e2',borderRadius:4,padding:'1px 5px'}}>НЕТ ЗАДАЧИ</span>}
                    {ts==='overdue'&&<span style={{fontSize:9,fontWeight:700,color:'#c2410c',background:'#ffedd5',borderRadius:4,padding:'1px 5px'}}>ПРОСРОЧЕНА</span>}
                    {ts==='today'&&<span style={{fontSize:9,fontWeight:700,color:'#854d0e',background:'#fef9c3',borderRadius:4,padding:'1px 5px'}}>СЕГОДНЯ</span>}
                    {sla==='sla_overdue'&&<span style={{fontSize:9,fontWeight:700,color:'#dc2626',background:'#fee2e2',borderRadius:4,padding:'1px 5px'}}>SLA!</span>}
                    {sla==='sla_warn'&&<span style={{fontSize:9,fontWeight:700,color:'#92400e',background:'#fef3c7',borderRadius:4,padding:'1px 5px'}}>SLA~</span>}
                  </div>
                </div>
                <div style={{fontSize:11,color:'var(--text3)',marginBottom:3}}>{cName(r.client_id)}</div>
                {r.material_type&&<div style={{fontSize:10,color:'var(--text4)',background:'var(--surface2)',borderRadius:4,padding:'1px 6px',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.material_type}</div>}
                {(()=>{const ca=cardAmount(r);return ca
                  ?<div style={{fontSize:11,fontWeight:600,color:'var(--primary)'}}>{ca.amount.toLocaleString('ru')} ₽{ca.isQuote&&<span style={{fontSize:9,color:'var(--text4)',fontWeight:400,marginLeft:3}}>КП</span>}</div>
                  :<div style={{fontSize:11,fontWeight:600,color:'var(--text5)'}}>—</div>
                })()}
                {r.lost_reason&&<div style={{fontSize:9,color:'#dc2626',marginTop:2}}>✗ {r.lost_reason}</div>}
                {r.extra_fields?.return_date&&<div style={{fontSize:9,color:'#a16207',marginTop:2}}>↩ Возврат: {r.extra_fields.return_date}</div>}
                {dueDate&&(
                  <div style={{fontSize:10,marginTop:3,
                    color:ts==='overdue'?'#c2410c':ts==='today'?'#854d0e':'var(--text3)'}}>
                    {ts==='overdue'?'⏰ ':ts==='today'?'⏳ ':'🔔 '}
                    {dueDate.toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                )}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
                  {r.urgency&&<span style={{width:8,height:8,borderRadius:'50%',background:urgColor(r.urgency),display:'inline-block'}} title={r.urgency}/>}
                  <span style={{fontSize:10,color:'var(--text5)',marginLeft:'auto'}}>{r.created_at?.slice(0,10)||''}</span>
                </div>
              </div>
            )
          })}
          {cards.length===0&&<div style={{textAlign:'center',color:'var(--text5)',fontSize:11,padding:'16px 0'}}>Пусто</div>}
        </div>
      </div>
    )
  }

  return(
    <div style={{fontFamily:'-apple-system,sans-serif'}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div>
          <h2 style={{margin:0,fontSize:18,fontWeight:700}}>Доска</h2>
          <div style={{fontSize:12,color:'var(--text4)',marginTop:2}}>{activeBoard.description}</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>navigate('/requests')}
            style={btn({background:'var(--surface2)',color:'var(--text2)',border:'1px solid var(--border)'})}>
            Заявки
          </button>
          {boardId==='sales'&&(
            <button onClick={()=>navigate('/requests',{state:{openNew:true}})}
              style={btn({background:'#0f172a',color:'#fff'})}>
              + Создать заявку
            </button>
          )}
          {boardId==='aftersales'&&(
            <button onClick={()=>setShowClaim(true)}
              style={btn({background:'#dc2626',color:'#fff'})}>
              + Рекламация
            </button>
          )}
        </div>
      </div>

      {/* Board tabs */}
      <div style={{display:'flex',gap:0,marginBottom:14,borderBottom:'2px solid var(--border)'}}>
        {boardsConfig.boards.map(b=>{
          const active=boardId===b.id
          return(
            <button key={b.id} onClick={()=>setBoardId(b.id)}
              style={{padding:'8px 18px',border:'none',background:'transparent',cursor:'pointer',
                fontSize:13,fontWeight:active?700:500,
                color:active?'var(--primary)':'var(--text3)',
                borderBottom:active?'2px solid var(--primary)':'2px solid transparent',
                marginBottom:-2,transition:'all 0.15s'}}>
              {b.name}
              <span style={{marginLeft:6,background:active?'var(--primary)':'#e5e7eb',
                color:active?'#fff':'var(--text3)',borderRadius:10,padding:'1px 7px',fontSize:11,fontWeight:600}}>
                {boardCounts[b.id]||0}
              </span>
            </button>
          )
        })}
      </div>

      {/* Kanban — native scrollbar hidden, sticky scrollbar below */}
      <div ref={botScrollRef}
        onScroll={()=>{if(stickyScrollRef.current)stickyScrollRef.current.scrollLeft=botScrollRef.current.scrollLeft}}
        className="kanban-no-scrollbar"
        style={{display:'flex',gap:10,overflowX:'auto',paddingBottom:4,alignItems:'flex-start'}}>
        {pipelineStages.map(renderColumn)}

        {parkingStages.length>0&&(
          <div style={{alignSelf:'stretch',width:0,borderLeft:'2px dashed var(--border)',margin:'0 2px',flexShrink:0}}/>
        )}
        {parkingStages.map(renderColumn)}

        {unknownCards.length>0&&(
          <div style={{minWidth:200,maxWidth:220,flexShrink:0,background:'var(--surface2)',border:'2px dashed #d1d5db',borderRadius:10}}>
            <div style={{padding:'10px 12px',background:'#f9fafb',borderRadius:'8px 8px 0 0',borderBottom:'1px solid #e8ecf5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:12,color:'#9ca3af'}}>Устаревшие этапы</span>
              <span style={{background:'#9ca3af',color:'#fff',borderRadius:10,padding:'1px 7px',fontSize:11}}>{unknownCards.length}</span>
            </div>
            <div style={{padding:'8px',display:'flex',flexDirection:'column',gap:6}}>
              {unknownCards.map(r=>(
                <div key={r.id} onClick={()=>openSel(r)}
                  style={{border:'1px solid #d1d5db',borderRadius:7,padding:'8px 10px',cursor:'pointer',background:'#fff'}}>
                  <div style={{fontWeight:600,fontSize:12}}>{r.number||('№'+r.id)}</div>
                  <div style={{fontSize:11,color:'#9ca3af'}}>{r.stage} · {cName(r.client_id)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom scrollbar */}
      <div ref={stickyScrollRef}
        onScroll={()=>{if(botScrollRef.current)botScrollRef.current.scrollLeft=stickyScrollRef.current.scrollLeft}}
        className="kanban-top-scroll"
        style={{position:'fixed',bottom:0,left:210,right:0,zIndex:10,padding:'0 1.5rem'}}>
        <div style={{height:1,width:'100%'}}/>
      </div>
      {/* space so content isn't hidden behind fixed bar */}
      <div style={{height:20}}/>

      {/* Stage change modal */}
      {stageModal&&(
        <div style={overlayStyle} onClick={()=>setStageModal(null)}>
          <div style={panelStyle()} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{margin:0,fontSize:15,fontWeight:700}}>
                {stageModal.isTransferred?'📦 Передача в производство':
                 stageModal.isNurturing?'⏸ Отложить (прогрев)':
                 stageModal.lostOpts.length?'Причина отказа':'Требуются данные'}
              </h3>
              <button onClick={()=>setStageModal(null)} style={{background:'transparent',border:'none',fontSize:20,cursor:'pointer',color:'var(--text3)'}}>×</button>
            </div>

            {stageModal.isTransferred&&(
              <div style={{background:'#f0fdfa',border:'1px solid #99f6e4',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#0f766e'}}>
                ℹ При переводе в «Передан в производство» автоматически создаётся карточка на доске <b>«Исполнение»</b>.
              </div>
            )}

            {stageModal.isNurturing&&(
              <div style={{background:'#fefce8',border:'1px solid #fde68a',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#854d0e'}}>
                ℹ Сделка уходит <b>вне основной воронки</b> в «Отложенные (прогрев)» и не учитывается в счётчике активных. Укажите дату, когда вернуться к работе.
              </div>
            )}

            {stageModal.missing.length>0&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:600,color:'#b45309',marginBottom:8,background:'#fffbeb',padding:'8px 10px',borderRadius:7,border:'1px solid #fde68a'}}>
                  ⚠ Заполните обязательные поля для перехода:
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {stageModal.missing.map(f=>(
                    <div key={f}>
                      <label style={{fontSize:12,fontWeight:600,color:'var(--text3)',display:'block',marginBottom:3}}>{FIELD_LABELS[f]||f} *</label>
                      {BOOL_FIELDS.includes(f)?(
                        <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
                          <input type="checkbox" checked={!!stageModal.fv[f]}
                            onChange={e=>setStageModal(m=>({...m,fv:{...m.fv,[f]:e.target.checked}}))}/>
                          Подтвердить
                        </label>
                      ):DATE_FIELDS.includes(f)?(
                        <input type="date" value={stageModal.fv[f]||''}
                          onChange={e=>setStageModal(m=>({...m,fv:{...m.fv,[f]:e.target.value}}))}
                          style={inp()}/>
                      ):(
                        <input value={stageModal.fv[f]||''}
                          onChange={e=>setStageModal(m=>({...m,fv:{...m.fv,[f]:e.target.value}}))}
                          placeholder={FIELD_LABELS[f]||f}
                          style={inp()}/>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stageModal.lostOpts.length>0&&(
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text3)',display:'block',marginBottom:4}}>Причина отказа *</label>
                <select value={stageModal.fv.lost_reason||''}
                  onChange={e=>setStageModal(m=>({...m,fv:{...m.fv,lost_reason:e.target.value}}))}
                  style={inp()}>
                  <option value="">— выберите причину —</option>
                  {stageModal.lostOpts.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text3)',display:'block',margin:'10px 0 4px'}}>Примечание (необязательно)</label>
                <textarea value={stageModal.fv.lost_comment||''} rows={2}
                  onChange={e=>setStageModal(m=>({...m,fv:{...m.fv,lost_comment:e.target.value}}))}
                  placeholder="Детали отказа, комментарий…"
                  style={{...inp(),resize:'vertical'}}/>
              </div>
            )}

            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
              <button onClick={()=>setStageModal(null)}
                style={btn({background:'var(--surface2)',color:'var(--text3)',border:'1px solid var(--border)'})}>Отмена</button>
              <button onClick={submitModal}
                style={btn({background:stageModal.isTransferred?'#0d9488':stageModal.isNurturing?'#ca8a04':stageModal.lostOpts.length?'#dc2626':'#0f172a',color:'#fff'})}>
                {stageModal.isTransferred?'📦 Передать в производство':
                 stageModal.isNurturing?'⏸ Отложить':
                 stageModal.lostOpts.length?'Зафиксировать отказ':'Сохранить и перейти'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim modal */}
      {showClaim&&(
        <div style={overlayStyle} onClick={()=>setShowClaim(false)}>
          <div style={panelStyle(460)} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{margin:0,fontSize:15,fontWeight:700}}>Новая рекламация</h3>
              <button onClick={()=>setShowClaim(false)} style={{background:'transparent',border:'none',fontSize:20,cursor:'pointer',color:'var(--text3)'}}>×</button>
            </div>
            <form onSubmit={submitClaim} style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text3)',display:'block',marginBottom:3}}>Клиент *</label>
                <select value={claimData.client_id} required onChange={e=>setClaimData(d=>({...d,client_id:e.target.value}))} style={inp()}>
                  <option value="">— выберите клиента —</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text3)',display:'block',marginBottom:3}}>ID / номер связанной сделки *</label>
                <input value={claimData.linked_deal_id} required placeholder="Номер завершённой сделки"
                  onChange={e=>setClaimData(d=>({...d,linked_deal_id:e.target.value}))} style={inp()}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text3)',display:'block',marginBottom:3}}>Описание рекламации *</label>
                <textarea value={claimData.claim_description} required rows={3}
                  onChange={e=>setClaimData(d=>({...d,claim_description:e.target.value}))}
                  placeholder="Опишите проблему..."
                  style={{...inp(),resize:'vertical'}}/>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                <button type="button" onClick={()=>setShowClaim(false)}
                  style={btn({background:'var(--surface2)',color:'var(--text3)',border:'1px solid var(--border)'})}>Отмена</button>
                <button type="submit" style={btn({background:'#dc2626',color:'#fff'})}>Создать рекламацию</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Card detail panel */}
      {/* Модал уведомления клиента об этапе Исполнения */}
      {notifModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.45)',zIndex:1200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
          onClick={()=>setNotifModal(null)}>
          <div style={{background:'var(--surface)',borderRadius:12,padding:'1.1rem 1.25rem',width:'100%',maxWidth:480,boxShadow:'0 20px 50px rgba(0,0,0,0.18)'}}
            onClick={e=>e.stopPropagation()}>
            {/* заголовок */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:'#0d9488',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:1}}>Исполнение · уведомление</div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text1)',lineHeight:1.2}}>{OPS_NOTIF_TITLES[notifModal.stageId]||notifModal.stageId}</div>
              </div>
              <button onClick={()=>setNotifModal(null)} style={{background:'transparent',border:'none',fontSize:20,cursor:'pointer',color:'var(--text4)',marginTop:-2,marginRight:-4,lineHeight:1}}>×</button>
            </div>
            {/* клиент */}
            {notifModal.client&&(
              <div style={{background:'var(--surface2)',borderRadius:7,padding:'6px 10px',marginBottom:8,fontSize:12,display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontWeight:600}}>👤 {notifModal.client.name}</span>
                {(notifModal.client.contact2_phone||notifModal.client.contact_phone)&&<span style={{color:'var(--text3)'}}>📞 {notifModal.client.contact2_phone||notifModal.client.contact_phone}</span>}
                {(notifModal.client.contact2_email||notifModal.client.contact_email)&&<span style={{color:'var(--text3)'}}>✉️ {notifModal.client.contact2_email||notifModal.client.contact_email}</span>}
              </div>
            )}
            {/* текст */}
            <textarea
              value={notifModal.message}
              onChange={e=>setNotifModal(m=>({...m,message:e.target.value}))}
              rows={7}
              style={{width:'100%',padding:'8px 10px',borderRadius:7,border:'1px solid var(--border)',fontSize:12.5,lineHeight:1.55,resize:'vertical',boxSizing:'border-box',fontFamily:'inherit',background:'var(--surface2)',marginBottom:8}}
            />
            {/* статус */}
            {emailSent&&(
              <div style={{background:'#ecfdf5',border:'1px solid #6ee7b7',borderRadius:7,padding:'6px 12px',marginBottom:8,fontSize:12.5,color:'#065f46',fontWeight:600}}>
                ✓ Отправлено на {notifModal.client?.contact2_email||notifModal.client?.contact_email}
              </div>
            )}
            {/* футер */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6}}>
              <span style={{fontSize:11,color:(notifModal.client?.contact2_email||notifModal.client?.contact_email)?'var(--text4)':'#ef4444',flexShrink:0}}>
                {(notifModal.client?.contact2_email||notifModal.client?.contact_email)
                  ?<>✉️ {notifModal.client?.contact2_email||notifModal.client?.contact_email}</>
                  :'⚠ Email не указан'}
              </span>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button onClick={()=>{setNotifModal(null);setEmailSent(false)}}
                  style={{fontSize:12,padding:'5px 13px',borderRadius:7,cursor:'pointer',fontWeight:600,border:'1px solid var(--border)',background:'var(--surface2)',color:'var(--text2)'}}>
                  Закрыть
                </button>
                <button onClick={()=>{navigator.clipboard.writeText(notifModal.message).then(()=>alert('Скопировано'))}}
                  style={{fontSize:12,padding:'5px 13px',borderRadius:7,cursor:'pointer',fontWeight:600,border:'1px solid #0d9488',background:'transparent',color:'#0d9488'}}>
                  📋 Копировать
                </button>
                <button
                  disabled={emailSending||emailSent||!(notifModal.client?.contact2_email||notifModal.client?.contact_email)}
                  onClick={()=>sendNotifEmailFn(api,notifModal,setEmailSending,setEmailSent,setNotifModal)}
                  style={{fontSize:12,padding:'5px 13px',borderRadius:7,cursor:(emailSending||emailSent)?'not-allowed':'pointer',fontWeight:600,border:'none',
                    background:emailSent?'#059669':emailSending?'#9ca3af':'#2563eb',color:'#fff',opacity:!(notifModal.client?.contact2_email||notifModal.client?.contact_email)?0.4:1}}>
                  {emailSent?'✓ Отправлено':emailSending?'Отправка...':'✉️ Письмо'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {sel&&(
        <div style={{...overlayStyle,zIndex:1000}} onClick={closeSel}>
          <div style={{background:'var(--surface)',borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 25px 60px rgba(0,0,0,0.2)'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div>
                <h3 style={{margin:0,fontSize:16,fontWeight:700}}>{sel.number||('Заявка #'+sel.id)}</h3>
                <div style={{fontSize:11,color:'var(--text4)',marginTop:2}}>
                  {activeBoard.name} · {getStageCfg(boardId,sel.stage)?.name||sel.stage}
                </div>
              </div>
              <button onClick={closeSel} style={{border:'none',background:'transparent',fontSize:22,cursor:'pointer',color:'var(--text4)'}}>×</button>
            </div>

            {sel.lost_reason&&(
              <div style={{background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:13,color:'#dc2626'}}>
                <b>Причина отказа:</b> {sel.lost_reason}
              </div>
            )}
            {sel.parent_request_id&&(
              <div style={{background:'#f0fdfa',border:'1px solid #99f6e4',borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:12,color:'#0f766e'}}>
                🔗 Связана со сделкой ID {sel.parent_request_id}
              </div>
            )}

            <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.8,marginBottom:14,background:'var(--surface2)',borderRadius:8,padding:'10px 12px'}}>
              <div><b>Клиент:</b> {cName(sel.client_id)}</div>
              {sel.contact_name&&<div><b>Контакт:</b> {sel.contact_name}</div>}
              {sel.material_type&&<div><b>Запрос:</b> {sel.material_type}</div>}
              {sel.price&&<div><b>Бюджет:</b> {Number(sel.price).toLocaleString('ru')} ₽</div>}
              {sel.urgency&&sel.urgency!=='normal'&&<div><b>Срочность:</b> {sel.urgency==='urgent'?'🔴 Срочно':'🟡 Высокая'}</div>}
              {sel.notes&&<div><b>Примечание:</b> {sel.notes}</div>}
              {sel.stage_entered_at&&<div><b>В этапе с:</b> {parseUTC(sel.stage_entered_at).toLocaleDateString('ru-RU')}</div>}
              {sel.extra_fields&&Object.entries(sel.extra_fields).filter(([,v])=>v).map(([k,v])=>(
                <div key={k}><b>{FIELD_LABELS[k]||k}:</b> {String(v)}</div>
              ))}
            </div>

            {boardId==='sales'&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                  Коммерческие предложения
                </div>
                {selQuotes.length===0
                  ?<div style={{fontSize:12,color:'var(--text4)',fontStyle:'italic'}}>КП не создавались</div>
                  :selQuotes.map(q=>(
                    <div key={q.id} style={{fontSize:12,padding:'6px 10px',background:'var(--bg2)',borderRadius:6,border:'1px solid var(--border)',marginBottom:4,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <span style={{fontWeight:600,color:'var(--primary)'}}>{q.number||`КП-${q.id}`}</span>
                        <span style={{color:'var(--text3)',marginLeft:8}}>{q.quote_date||''}</span>
                      </div>
                      <span style={{color:'var(--text2)',fontWeight:500}}>{Number(q.total_with_vat||0).toLocaleString('ru-RU')} ₽</span>
                    </div>
                  ))
                }
              </div>
            )}

            <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Этап</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:16}}>
              {activeBoard.stages.map(st=>{
                const ci=COLOR_MAP[st.color]||COLOR_MAP.blue
                const cur=sel.stage===st.id
                return(
                  <button key={st.id} onClick={()=>initiateStage(sel,st.id)}
                    style={{padding:'5px 10px',borderRadius:7,
                      border:'2px solid '+(cur?ci.color:'var(--border)'),
                      background:cur?ci.bg:'#fff',color:cur?ci.color:'var(--text3)',
                      fontSize:11,fontWeight:cur?700:500,cursor:'pointer',transition:'all 0.1s'}}>
                    {st.name}
                  </button>
                )
              })}
            </div>

            <div style={{borderTop:'1px solid #e2e8f0',paddingTop:14}}>
              <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                Задачи по сделке
              </div>
              {selTasks.filter(t=>!t.completed_at).length===0&&(
                <p style={{fontSize:13,color:'#f97316',margin:'0 0 10px',padding:'8px 10px',background:'#fff7ed',borderRadius:7,border:'1px solid #fed7aa'}}>
                  ⚠ Нет открытой задачи — сделку нельзя перевести на следующий этап
                </p>
              )}
              <ul style={{margin:'0 0 12px',paddingLeft:0,listStyle:'none'}}>
                {selTasks.filter(t=>!t.completed_at).map(t=>(
                  <li key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13,padding:'7px 10px',borderRadius:7,background:'#f0fdf4',border:'1px solid #16a34a',marginBottom:5}}>
                    <span>
                      <b>{TASK_LABELS[t.task_type]||t.task_type}</b>
                      {t.due_at&&<span style={{color:'var(--text3)',marginLeft:6}}>{parseUTC(t.due_at).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>}
                      {t.note&&<span style={{color:'var(--text4)',marginLeft:6,fontSize:12}}>— {t.note}</span>}
                    </span>
                    <button onClick={()=>completeTask(t.id)} style={{fontSize:11,padding:'3px 10px',borderRadius:5,border:'none',background:'#16a34a',color:'#fff',cursor:'pointer',flexShrink:0,marginLeft:8}}>Выполнено</button>
                  </li>
                ))}
                {selTasks.filter(t=>t.completed_at).slice(-3).map(t=>(
                  <li key={t.id} style={{fontSize:12,color:'var(--text4)',padding:'4px 10px',textDecoration:'line-through'}}>
                    {TASK_LABELS[t.task_type]||t.task_type} — выполнено {parseUTC(t.completed_at).toLocaleDateString('ru-RU')}
                  </li>
                ))}
              </ul>
              {taskErr&&<div style={{background:'rgba(239,68,68,0.12)',color:'#b91c1c',padding:'8px 10px',borderRadius:7,fontSize:13,marginBottom:10}}>{taskErr}</div>}
              <form onSubmit={submitTask} style={{background:'var(--surface2)',borderRadius:10,padding:'12px'}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text2)',marginBottom:8}}>Новая задача</div>
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
