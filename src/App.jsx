import React, { useState, useEffect, useCallback } from 'react'
import { Key, Plus, X, ChevronRight, Phone, Building2, User, FileText, JapaneseYen, ArrowRight, Loader2, CheckCircle, RefreshCw, Settings, Search } from 'lucide-react'
import './App.css'

// ============================================================
// CONSTANTS
// ============================================================
const STATUSES = [
  { id: 'order',    label: '受注',       color: '#ff6b35', bg: 'rgba(255,107,53,0.12)',  icon: '📥' },
  { id: 'arranged', label: '手配済み',   color: '#9b59b6', bg: 'rgba(155,89,182,0.12)', icon: '📦' },
  { id: 'arrived',  label: '入荷済み',   color: '#3498db', bg: 'rgba(52,152,219,0.12)', icon: '🏠' },
  { id: 'appt',     label: '作業アポ済み', color: '#27ae60', bg: 'rgba(39,174,96,0.12)', icon: '📅' },
  { id: 'done',     label: '完了',       color: '#95a5a6', bg: 'rgba(149,165,166,0.12)', icon: '✅' },
]

const STATUS_TRANSITIONS = {
  order:    ['arranged'],
  arranged: ['arrived', 'order'],
  arrived:  ['appt', 'arranged'],
  appt:     ['done', 'arrived'],
  done:     ['order'],
}

const EMPTY_FORM = {
  name: '',
  mansion: '',
  room: '',
  phone: '',
  work: '',
  amount: '',
}

const SAMPLE_DATA = [
  { id: '1', status: 'order',    name: '田中 太郎', mansion: 'サンシャイン赤坂', room: '302', phone: '090-1234-5678', work: 'ディンプルキー複製 × 2', amount: '8800', createdAt: new Date().toISOString() },
  { id: '2', status: 'arranged', name: '鈴木 花子', mansion: 'パークコート六本木', room: '1205', phone: '080-9876-5432', work: 'MIWA U9 シリンダー交換', amount: '24800', createdAt: new Date().toISOString() },
  { id: '3', status: 'arrived',  name: '佐藤 一郎', mansion: 'ライオンズ新宿', room: '501', phone: '070-1111-2222', work: 'カードキー追加 × 3枚', amount: '15000', createdAt: new Date().toISOString() },
  { id: '4', status: 'appt',     name: '山田 美咲', mansion: 'ブリリア池袋', room: '804', phone: '090-3333-4444', work: 'スマートロック設置 SwitchBot', amount: '42000', createdAt: new Date().toISOString() },
  { id: '5', status: 'done',     name: '高橋 健太', mansion: 'プラウド渋谷', room: '201', phone: '080-5555-6666', work: 'ディンプルキー複製 × 1', amount: '4400', createdAt: new Date().toISOString() },
]

// ============================================================
// HELPERS
// ============================================================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function formatAmount(val) {
  if (!val) return '—'
  return '¥' + Number(val).toLocaleString('ja-JP')
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ============================================================
// GOOGLE APPS SCRIPT INTEGRATION
// ============================================================
const GAS_CONFIG_KEY = 'gas_url'

async function syncToGAS(gasUrl, orders) {
  if (!gasUrl) return false
  try {
    await fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', orders }),
    })
    return true
  } catch (e) {
    console.error('GAS sync error', e)
    return false
  }
}

async function fetchFromGAS(gasUrl) {
  if (!gasUrl) return null
  try {
    const res = await fetch(gasUrl + '?action=get')
    const data = await res.json()
    return data.orders || null
  } catch (e) {
    console.error('GAS fetch error', e)
    return null
  }
}

// ============================================================
// COMPONENTS
// ============================================================

function Badge({ count, color }) {
  if (count === 0) return null
  return (
    <span style={{
      background: color,
      color: '#fff',
      borderRadius: '50%',
      minWidth: 28,
      height: 28,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      fontWeight: 700,
      fontFamily: 'Space Mono, monospace',
      boxShadow: `0 0 12px ${color}80`,
      padding: '0 6px',
    }}>
      {count}
    </span>
  )
}

function StatusCard({ status, count, onClick, active }) {
  const total = STATUSES.reduce(() => 0) // unused
  return (
    <button
      onClick={onClick}
      className="status-card"
      style={{
        '--card-color': status.color,
        '--card-bg': status.bg,
        outline: active ? `2px solid ${status.color}` : 'none',
      }}
    >
      <div className="status-card-icon">{status.icon}</div>
      <div className="status-card-label">{status.label}</div>
      <div className="status-card-badge">
        <Badge count={count} color={status.color} />
      </div>
    </button>
  )
}

function OrderCard({ order, onStatusChange, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const st = STATUSES.find(s => s.id === order.status)
  const transitions = STATUS_TRANSITIONS[order.status] || []

  return (
    <div className="order-card" style={{ '--card-color': st.color, '--card-bg': st.bg }}>
      <div className="order-card-header" onClick={() => setExpanded(e => !e)}>
        <div className="order-card-left">
          <span className="order-status-dot" style={{ background: st.color }} />
          <div>
            <div className="order-name">{order.name}</div>
            <div className="order-sub">{order.mansion} {order.room}号室</div>
          </div>
        </div>
        <div className="order-card-right">
          <span className="order-amount">{formatAmount(order.amount)}</span>
          <ChevronRight size={16} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-dim)' }} />
        </div>
      </div>

      {expanded && (
        <div className="order-card-body">
          <div className="order-detail-grid">
            <div className="detail-row">
              <Phone size={13} /><span>{order.phone || '—'}</span>
            </div>
            <div className="detail-row">
              <Building2 size={13} /><span>{order.mansion} {order.room}号室</span>
            </div>
            <div className="detail-row">
              <FileText size={13} /><span>{order.work || '—'}</span>
            </div>
            <div className="detail-row">
              <JapaneseYen size={13} /><span>{formatAmount(order.amount)}</span>
            </div>
          </div>
          <div className="order-date">登録: {formatDate(order.createdAt)}</div>

          <div className="order-actions">
            <div className="transition-buttons">
              {transitions.map(toId => {
                const to = STATUSES.find(s => s.id === toId)
                return (
                  <button key={toId} className="transition-btn"
                    style={{ '--t-color': to.color }}
                    onClick={() => onStatusChange(order.id, toId)}>
                    <ArrowRight size={12} />
                    {to.label}へ
                  </button>
                )
              })}
            </div>
            <div className="card-controls">
              <button className="ctrl-btn edit" onClick={() => onEdit(order)}>編集</button>
              <button className="ctrl-btn del" onClick={() => onDelete(order.id)}>削除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OrderForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)

  function handle(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return alert('氏名を入力してください')
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{initial ? '受注編集' : '新規受注'}</h2>
          <button className="modal-close" onClick={onCancel}><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="order-form">
          <label>氏名 <span className="req">*</span>
            <input name="name" value={form.name} onChange={handle} placeholder="田中 太郎" required />
          </label>
          <div className="form-row">
            <label>マンション名
              <input name="mansion" value={form.mansion} onChange={handle} placeholder="○○マンション" />
            </label>
            <label style={{flex:'0 0 120px'}}>部屋番号
              <input name="room" value={form.room} onChange={handle} placeholder="101" />
            </label>
          </div>
          <label>電話番号
            <input name="phone" value={form.phone} onChange={handle} placeholder="090-0000-0000" type="tel" />
          </label>
          <label>作業内容（注文商品）
            <textarea name="work" value={form.work} onChange={handle} placeholder="ディンプルキー複製 × 2枚" rows={3} />
          </label>
          <label>合計金額（円）
            <input name="amount" value={form.amount} onChange={handle} placeholder="8800" type="number" min="0" />
          </label>
          <div className="form-buttons">
            <button type="button" className="btn-cancel" onClick={onCancel}>キャンセル</button>
            <button type="submit" className="btn-save">
              {initial ? '更新する' : '受注登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function GASSettings({ gasUrl, onSave, onClose }) {
  const [url, setUrl] = useState(gasUrl || '')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  async function test() {
    if (!url.trim()) return
    setLoading(true)
    setStatus('')
    try {
      await fetch(url + '?action=get')
      setStatus('success')
    } catch {
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{maxWidth:540}}>
        <div className="modal-header">
          <h2>Google Sheets 連携設定</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{padding:'20px 24px 24px'}}>
          <p style={{color:'var(--text-dim)',fontSize:13,lineHeight:1.8,marginBottom:20}}>
            Google Apps Script のウェブアプリURLを入力してください。<br/>
            設定方法は付属の <code style={{background:'var(--surface2)',padding:'2px 6px',borderRadius:4}}>GAS_SETUP.md</code> を参照してください。
          </p>
          <label style={{display:'block',marginBottom:12}}>
            <span style={{fontSize:12,color:'var(--text-dim)',display:'block',marginBottom:6}}>GAS ウェブアプリURL</span>
            <input
              value={url}
              onChange={e=>setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              style={{width:'100%'}}
            />
          </label>
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            <button className="btn-cancel" style={{flex:1}} onClick={test} disabled={loading}>
              {loading ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}} /> : '接続テスト'}
            </button>
            <button className="btn-save" style={{flex:1}} onClick={()=>onSave(url)}>
              保存
            </button>
          </div>
          {status === 'success' && <p style={{color:'#27ae60',fontSize:13}}>✓ 接続成功</p>}
          {status === 'error' && <p style={{color:'#e74c3c',fontSize:13}}>✗ 接続失敗。URLを確認してください</p>}
          
          <div style={{marginTop:20,background:'var(--surface2)',borderRadius:8,padding:16}}>
            <p style={{fontSize:12,fontWeight:700,marginBottom:8,color:'var(--accent)'}}>GAS スクリプト（コピーして使用）</p>
            <pre style={{fontSize:10,color:'var(--text-dim)',whiteSpace:'pre-wrap',lineHeight:1.6}}>{`const SHEET_ID = 'YOUR_SPREADSHEET_ID';
const SHEET_NAME = '受注データ';

function doGet(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME);
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const orders = rows.slice(1).map(r => {
    const o = {};
    headers.forEach((h,i) => o[h] = r[i]);
    return o;
  });
  return ContentService
    .createTextOutput(JSON.stringify({orders}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (data.action !== 'sync') return ok();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  sh.clearContents();
  const headers = ['id','status','name','mansion','room',
    'phone','work','amount','createdAt'];
  sh.appendRow(headers);
  data.orders.forEach(o => sh.appendRow(headers.map(h=>o[h]||'')));
  return ok();
}
function ok() {
  return ContentService.createTextOutput('OK');
}`}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [orders, setOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('key_orders')
      return saved ? JSON.parse(saved) : SAMPLE_DATA
    } catch { return SAMPLE_DATA }
  })
  const [activeStatus, setActiveStatus] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [showGAS, setShowGAS] = useState(false)
  const [gasUrl, setGasUrl] = useState(() => localStorage.getItem(GAS_CONFIG_KEY) || '')
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [search, setSearch] = useState('')

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('key_orders', JSON.stringify(orders))
  }, [orders])

  // Sync to GAS
  const syncGAS = useCallback(async (o = orders) => {
    if (!gasUrl) return
    setSyncing(true)
    await syncToGAS(gasUrl, o)
    setLastSync(new Date())
    setSyncing(false)
  }, [gasUrl, orders])

  async function pullFromGAS() {
    if (!gasUrl) { setShowGAS(true); return }
    setSyncing(true)
    const remote = await fetchFromGAS(gasUrl)
    if (remote) setOrders(remote)
    setSyncing(false)
    setLastSync(new Date())
  }

  function addOrder(form) {
    const newOrder = { ...form, id: generateId(), status: 'order', createdAt: new Date().toISOString() }
    const next = [newOrder, ...orders]
    setOrders(next)
    setShowForm(false)
    syncGAS(next)
  }

  function updateOrder(form) {
    const next = orders.map(o => o.id === editingOrder.id ? { ...o, ...form } : o)
    setOrders(next)
    setEditingOrder(null)
    syncGAS(next)
  }

  function deleteOrder(id) {
    if (!confirm('この受注を削除しますか？')) return
    const next = orders.filter(o => o.id !== id)
    setOrders(next)
    syncGAS(next)
  }

  function changeStatus(id, newStatus) {
    const next = orders.map(o => o.id === id ? { ...o, status: newStatus } : o)
    setOrders(next)
    syncGAS(next)
  }

  function saveGasUrl(url) {
    setGasUrl(url)
    localStorage.setItem(GAS_CONFIG_KEY, url)
    setShowGAS(false)
  }

  // Filter
  const q = search.trim().toLowerCase()
  const filtered = orders.filter(o => {
    if (activeStatus && o.status !== activeStatus) return false
    if (!q) return true
    return (o.name+o.mansion+o.phone+o.work).toLowerCase().includes(q)
  })

  const counts = {}
  STATUSES.forEach(s => { counts[s.id] = orders.filter(o => o.status === s.id).length })

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <Key size={22} color="var(--accent)" />
          <span className="header-title">鍵受注管理</span>
        </div>
        <div className="header-right">
          {lastSync && (
            <span className="sync-info">
              最終同期: {formatDate(lastSync.toISOString())}
            </span>
          )}
          <button className="icon-btn" onClick={pullFromGAS} disabled={syncing} title="スプレッドシートから取得">
            {syncing ? <Loader2 size={16} style={{animation:'spin 1s linear infinite'}} /> : <RefreshCw size={16} />}
          </button>
          <button className="icon-btn" onClick={() => setShowGAS(true)} title="GAS設定">
            <Settings size={16} />
          </button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> 新規受注
          </button>
        </div>
      </header>

      {/* STATUS CARDS */}
      <div className="status-grid">
        {STATUSES.map(s => (
          <StatusCard
            key={s.id}
            status={s}
            count={counts[s.id]}
            active={activeStatus === s.id}
            onClick={() => setActiveStatus(prev => prev === s.id ? null : s.id)}
          />
        ))}
      </div>

      {/* SEARCH & FILTER INFO */}
      <div className="list-toolbar">
        <div className="search-wrap">
          <Search size={14} color="var(--text-dim)" />
          <input
            className="search-input"
            placeholder="氏名・マンション・電話番号で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} style={{background:'none',border:'none',color:'var(--text-dim)',cursor:'pointer'}}><X size={14}/></button>}
        </div>
        {activeStatus && (
          <button className="filter-chip" onClick={() => setActiveStatus(null)}>
            {STATUSES.find(s=>s.id===activeStatus)?.label} <X size={12} />
          </button>
        )}
        <span className="count-label">{filtered.length}件</span>
      </div>

      {/* ORDER LIST */}
      <div className="order-list">
        {filtered.length === 0 && (
          <div className="empty-state">
            <Key size={40} color="var(--border)" />
            <p>受注データがありません</p>
            {!activeStatus && <button className="btn-primary" style={{marginTop:16}} onClick={() => setShowForm(true)}><Plus size={14}/> 最初の受注を登録</button>}
          </div>
        )}
        {filtered.map(o => (
          <OrderCard
            key={o.id}
            order={o}
            onStatusChange={changeStatus}
            onDelete={deleteOrder}
            onEdit={o => setEditingOrder(o)}
          />
        ))}
      </div>

      {/* MODALS */}
      {showForm && <OrderForm onSave={addOrder} onCancel={() => setShowForm(false)} />}
      {editingOrder && <OrderForm initial={editingOrder} onSave={updateOrder} onCancel={() => setEditingOrder(null)} />}
      {showGAS && <GASSettings gasUrl={gasUrl} onSave={saveGasUrl} onClose={() => setShowGAS(false)} />}
    </div>
  )
}
