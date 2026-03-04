import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Key, Plus, X, ChevronRight, Phone, Building2, FileText, JapaneseYen, ArrowRight, Loader2, RefreshCw, Settings, Search, AlertTriangle, LogOut, Trash2, RotateCcw, Lock } from 'lucide-react'
import './App.css'
import Loading from './Loading'

// ============================================================
// 定数
// ============================================================
const STATUSES = [
  { id: 'inquiry',  label: 'お問合せ',    color: '#e67e22', bg: 'rgba(230,126,34,0.12)',  icon: '💬' },
  { id: 'guided',   label: '案内済み',    color: '#d4a017', bg: 'rgba(212,160,23,0.12)',  icon: '📋' },
  { id: 'order',    label: '受注',        color: '#ff6b35', bg: 'rgba(255,107,53,0.12)',  icon: '📥' },
  { id: 'arranged', label: '手配済み',    color: '#9b59b6', bg: 'rgba(155,89,182,0.12)', icon: '🏭' },
  { id: 'arrived',  label: '入荷済み',    color: '#3498db', bg: 'rgba(52,152,219,0.12)', icon: '📦' },
  { id: 'appt',     label: '作業アポ済み', color: '#27ae60', bg: 'rgba(39,174,96,0.12)', icon: '📅' },
  { id: 'done',     label: '完了',        color: '#95a5a6', bg: 'rgba(149,165,166,0.12)', icon: '✅' },
]

const STATUS_TRANSITIONS = {
  inquiry:  ['guided', 'order'],
  guided:   ['order', 'inquiry'],
  order:    ['arranged', 'inquiry'],
  arranged: ['arrived', 'order'],
  arrived:  ['appt', 'arranged'],
  appt:     ['done', 'arrived'],
  done:     ['inquiry', 'order'],
}

const ALERTS = [
  { id: 'alert_order',    status: 'order',    days: 7,  label: '受注後１週間経過',   color: '#27ae60', borderColor: '#27ae60' },
  { id: 'alert_arranged', status: 'arranged', days: 21, label: '手配済み３週間経過', color: '#f1c40f', borderColor: '#f1c40f' },
  { id: 'alert_arrived',  status: 'arrived',  days: 7,  label: '入荷後１週間経過',   color: '#e74c3c', borderColor: '#e74c3c' },
]

const MAKERS = [
  { id: 'miwa',      label: '美和ロック', taxIncluded: false },
  { id: 'shibutani', label: 'シブタニ',   taxIncluded: true  },
  { id: 'goal',      label: 'ゴール',     taxIncluded: false },
]

const MAKER_PRODUCTS = {
  miwa: [
    { group: '商品', items: [
      { name: 'TLRS2-K01D',    price: 10050 },
      { name: 'TLRS2-E01',     price: 15500 },
      { name: 'TLNT-K(T)02A',  price: 3550  },
      { name: 'TLNT-K03 (4)A', price: 4200  },
      { name: 'FKLカード',      price: 3550  },
      { name: '標準キー',        price: 2000  },
    ]},
    { group: '作業費・手数料', items: [
      { name: '出作業費',    price: 12000 },
      { name: '事務手数料',  price: 1100  },
      { name: '美和S手数料', price: 2200  },
    ]},
  ],
  shibutani: [
    { group: '🔑 カギ類', items: [
      { name: 'Tebraキー',              price: 15400 },
      { name: 'Tebra収納キー（新旧あり）', price: 6600  },
      { name: 'F22 TLキー',             price: 7100  },
      { name: 'TFキー',                 price: 7800  },
      { name: 'FTSキー',                price: 13200 },
      { name: 'F22 標準キー',            price: 3900  },
      { name: 'T20 標準キー',            price: 3900  },
    ]},
    { group: '🏷️ タグ類', items: [
      { name: 'Tebraタグ', price: 11500 },
      { name: 'TLタグ',    price: 3200  },
    ]},
    { group: '💳 カード類', items: [
      { name: 'TLカード', price: 3200 },
      { name: 'TFカード', price: 3900 },
    ]},
    { group: '🔧 作業費・手数料類', items: [
      { name: '出張費',                 price: 8000  },
      { name: '交換作業費（シリンダー）',  price: 8000  },
      { name: '交換作業費（収納キー）',    price: 5000  },
      { name: '登録作業費',              price: 5000  },
      { name: 'メーカー手数料',           price: 2500  },
      { name: '送料・事務手数料（弊社）',  price: 1210  },
    ]},
  ],
  goal: [],
}

// ============================================================
// ローカルストレージキー
// ============================================================
const GAS_CONFIG_KEY      = 'gas_url'
const SESSION_KEY         = 'clh_admin_token'
const ORDER_API_KEY_KEY   = 'clh_order_api_key'
const ORDER_GAS_URL_KEY   = 'clh_order_gas_url'
const DBX_TOKEN_KEY       = 'clh_dbx_token'
const DBX_FOLDER_KEY      = 'clh_dbx_folder'
const DEFAULT_GAS_URL     = 'https://script.google.com/macros/s/AKfycby-uBwfzBDk_N5l-tQcq_tb_8ibbT5TczYW7WXqTbQDiu7QmTOeNwxf3-bgYlUYcOo/exec'

// ============================================================
// ユーティリティ
// ============================================================
function getToken()    { try { return sessionStorage.getItem(SESSION_KEY) || '' } catch { return '' } }
function setToken(v)   { try { sessionStorage.setItem(SESSION_KEY, v) } catch {} }
function clearToken()  { try { sessionStorage.removeItem(SESSION_KEY) } catch {} }

async function sha256(message) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getAlertInfo(order) {
  const alert = ALERTS.find(a => a.status === order.status)
  if (!alert || !order.createdAt) return null
  const diffDays = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays >= alert.days) return alert
  return null
}

const EMPTY_FORM = {
  name: '', mansion: '', room: '', phone: '', work: '',
  isInquiry: false, isGuided: false,
  keyNumber: '', clientName: '', clientPhone: '', clientAddress: '',
  maker: '', items: [], priceOverride: '',
}

const now2 = new Date()
const daysAgo = (d) => new Date(now2 - d * 24 * 60 * 60 * 1000).toISOString()
const SAMPLE_DATA = [
  { id: '1', status: 'order',    name: '田中 太郎', mansion: 'サンシャイン赤坂',  room: '302',  phone: '090-1234-5678', work: 'ディンプルキー複製 × 2', amount: '8800',  createdAt: daysAgo(8)  },
  { id: '2', status: 'arranged', name: '鈴木 花子', mansion: 'パークコート六本木', room: '1205', phone: '080-9876-5432', work: 'MIWA U9 シリンダー交換',  amount: '24800', createdAt: daysAgo(22) },
  { id: '3', status: 'arrived',  name: '佐藤 一郎', mansion: 'ライオンズ新宿',   room: '501',  phone: '070-1111-2222', work: 'カードキー追加 × 3枚',   amount: '15000', createdAt: daysAgo(9)  },
  { id: '4', status: 'appt',     name: '山田 美咲', mansion: 'ブリリア池袋',     room: '804',  phone: '090-3333-4444', work: 'スマートロック設置',      amount: '42000', createdAt: daysAgo(2)  },
  { id: '5', status: 'done',     name: '高橋 健太', mansion: 'プラウド渋谷',     room: '201',  phone: '080-5555-6666', work: 'ディンプルキー複製 × 1', amount: '4400',  createdAt: daysAgo(1)  },
]

function generateId()    { return Date.now().toString(36) + Math.random().toString(36).slice(2) }
function formatAmount(v) { if (!v) return '—'; return '¥' + Number(v).toLocaleString('ja-JP') }
function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ============================================================
// GAS通信（URLパラメータGETでCORSを回避）
// ============================================================
async function callGAS(gasUrl, payload) {
  const token = getToken()
  if (token) payload.token = token
  const params = new URLSearchParams({ data: JSON.stringify(payload) })
  const res = await fetch(gasUrl + '?' + params.toString())
  return await res.json()
}

async function syncToGAS(gasUrl, orders) {
  if (!gasUrl) return false
  try {
    const token = getToken()
    await fetch(gasUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync', orders, token }) })
    return true
  } catch { return false }
}

async function fetchFromGAS(gasUrl) {
  if (!gasUrl) return null
  try {
    const res = await fetch(gasUrl + '?action=get')
    const data = await res.json()
    return data.orders || null
  } catch { return null }
}

function calcAmounts(items, priceOverride, taxIncluded) {
  if (priceOverride && priceOverride.startsWith('@')) {
    const val = Number(priceOverride.slice(1).replace(/,/g, ''))
    return { subtotal: val, tax: 0, total: val, isOverride: true }
  }
  const itemTotal = items.reduce((sum, it) => sum + (it.price * (it.qty || 1)), 0)
  const manualSubtotal = priceOverride !== '' ? Number(priceOverride.replace(/,/g, '')) : itemTotal
  const subtotal = isNaN(manualSubtotal) ? itemTotal : manualSubtotal
  if (taxIncluded) return { subtotal, tax: null, total: subtotal, isOverride: false, taxIncluded: true }
  const tax = Math.floor(subtotal * 0.1)
  return { subtotal, tax, total: subtotal + tax, isOverride: false, taxIncluded: false }
}

// ============================================================
// ログイン画面
// ============================================================
function LoginScreen({ gasUrl, onLogin, onSetGasUrl }) {
  const [preUrl, setPreUrl]       = useState(gasUrl || DEFAULT_GAS_URL)
  const [showGasInput, setShowGasInput] = useState(!gasUrl)
  const [email, setEmail]         = useState('')
  const [pass, setPass]           = useState('')
  const [err, setErr]             = useState('')
  const [loading, setLoading]     = useState(false)
  const [urlSaved, setUrlSaved]   = useState(false)

  function saveUrl() {
    if (!preUrl.trim()) { setErr('URLを入力してください'); return }
    onSetGasUrl(preUrl.trim())
    setUrlSaved(true)
    setErr('')
  }

  async function doLogin() {
    setErr('')
    if (!email || !pass) { setErr('メールアドレスとパスワードを入力してください'); return }
    if (!gasUrl) { setErr('先にGAS URLを保存してください'); return }
    setLoading(true)
    try {
      const passHash = await sha256(pass)
      const json = await callGAS(gasUrl, { action: 'admin_login', email, passHash })
      if (json.status === 'ok' && json.token) {
        setToken(json.token)
        onLogin()
      } else {
        setErr(json.message || 'メールアドレスまたはパスワードが違います')
      }
    } catch (e) {
      setErr('GASに接続できません: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e) { if (e.key === 'Enter') doLogin() }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo"><Key size={28} color="var(--accent)" /><span>一般受注管理</span></div>
        <div className="login-sub">CARLOCK HOMES ADMIN</div>

        {showGasInput ? (
          <div className="login-gas-section">
            <div className="login-gas-label">GAS URLを設定</div>
            <div className="login-gas-row">
              <input
                className="login-input"
                type="url"
                placeholder="https://script.google.com/macros/s/..."
                value={preUrl}
                onChange={e => setPreUrl(e.target.value)}
                autoComplete="off"
                style={{fontSize:11}}
              />
              <button className="login-gas-btn" onClick={saveUrl}>保存</button>
            </div>
            {urlSaved && <div className="login-gas-ok">✅ 保存しました</div>}
          </div>
        ) : (
          <button className="login-gas-toggle" onClick={() => { setPreUrl(gasUrl || DEFAULT_GAS_URL); setShowGasInput(true) }}>
            ⚙️ GAS URL設定
          </button>
        )}

        <input className="login-input" type="email"    placeholder="メールアドレス" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKeyDown} autoComplete="username" />
        <input className="login-input" type="password" placeholder="パスワード"     value={pass}  onChange={e => setPass(e.target.value)}  onKeyDown={onKeyDown} autoComplete="current-password" />
        <button className="login-btn" onClick={doLogin} disabled={loading}>
          {loading ? <Loader2 size={16} style={{animation:'spin 1s linear infinite'}} /> : <><Lock size={15} /> ログイン</>}
        </button>
        {err && <div className="login-err">{err}</div>}
      </div>
    </div>
  )
}

// ============================================================
// COMPONENTS
// ============================================================
function Badge({ count, color }) {
  if (count === 0) return null
  return <span style={{ background: color, color: '#fff', borderRadius: '50%', minWidth: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'Space Mono, monospace', boxShadow: `0 0 12px ${color}80`, padding: '0 6px' }}>{count}</span>
}

function StatusCard({ status, count, onClick, active }) {
  return (
    <button onClick={onClick} className="status-card" style={{ '--card-color': status.color, '--card-bg': status.bg, outline: active ? `2px solid ${status.color}` : 'none' }}>
      <div className="status-card-icon">{status.icon}</div>
      <div className="status-card-label">{status.label}</div>
      <div className="status-card-badge"><Badge count={count} color={status.color} /></div>
    </button>
  )
}

function AlertCard({ alert, count, onClick, active }) {
  return (
    <button onClick={onClick} className="alert-card" style={{ '--alert-color': alert.color, outline: active ? `2px solid ${alert.color}` : 'none', opacity: count === 0 ? 0.4 : 1 }}>
      <AlertTriangle size={14} color={alert.color} />
      <span className="alert-label">{alert.label}</span>
      {count > 0 && <Badge count={count} color={alert.color} />}
    </button>
  )
}

function OrderCard({ order, onStatusChange, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const st = STATUSES.find(s => s.id === order.status) || STATUSES[1]
  const transitions = STATUS_TRANSITIONS[order.status] || []
  const alertInfo = getAlertInfo(order)
  const cardStyle = { '--card-color': st.color, '--card-bg': st.bg }
  const borderStyle = alertInfo ? { border: `2px solid ${alertInfo.borderColor}`, boxShadow: `0 0 10px ${alertInfo.borderColor}40` } : {}

  return (
    <div className="order-card" style={{ ...cardStyle, ...borderStyle }}>
      {alertInfo && (
        <div className="alert-banner" style={{ background: alertInfo.color }}>
          <AlertTriangle size={12} /> {alertInfo.label}
        </div>
      )}
      <div className="order-card-header" onClick={() => setExpanded(e => !e)}>
        <div className="order-card-left">
          <span className="order-status-dot" style={{ background: st.color }} />
          <div>
            <div className="order-name">
              {order.status === 'inquiry' && <span className="inquiry-tag">問合せ</span>}
              {order.maker && <span className="maker-tag">{MAKERS.find(m=>m.id===order.maker)?.label || order.maker}</span>}
              {order.name}
            </div>
            <div className="order-sub">{order.mansion} {order.room ? order.room+'号室' : ''}</div>
            {order.items && order.items.length > 0 && (
              <div className="order-items-preview">
                {order.items.slice(0,2).map(it => (
                  <span key={it.name} className="preview-chip">{it.name}{it.qty > 1 ? ` x${it.qty}` : ''}</span>
                ))}
                {order.items.length > 2 && <span className="preview-chip preview-chip-more">+{order.items.length - 2}件</span>}
              </div>
            )}
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
            <div className="detail-row"><Phone size={13} /><span>{order.phone || '—'}</span></div>
            <div className="detail-row"><Building2 size={13} /><span>{order.mansion} {order.room ? order.room+'号室' : ''}</span></div>
            <div className="detail-row"><FileText size={13} /><span>{order.work || '—'}</span></div>
            {order.items && order.items.length > 0 ? (
              <div className="detail-row detail-row-items">
                <JapaneseYen size={13} />
                <div className="items-detail">
                  <div className="items-detail-title">
                    {order.maker && <span className="maker-tag">{MAKERS.find(m=>m.id===order.maker)?.label}</span>}
                    商品明細
                  </div>
                  {order.items.map(item => (
                    <div key={item.name} className="items-detail-row">
                      <span className="items-detail-name">{item.name}</span>
                      <span className="items-detail-qty">x{item.qty || 1}</span>
                      <span className="items-detail-price">¥{(item.price * (item.qty || 1)).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="items-detail-total">合計: <strong>¥{Number(order.amount).toLocaleString()}</strong></div>
                </div>
              </div>
            ) : (
              <div className="detail-row"><JapaneseYen size={13} /><span>{formatAmount(order.amount)}</span></div>
            )}
          </div>
          {(order.keyNumber || order.clientName || order.clientPhone || order.clientAddress) && (
            <div className="extra-info">
              <div className="extra-info-title">その他管理会社</div>
              <div className="order-detail-grid">
                {order.keyNumber    && <div className="detail-row"><span className="extra-label">キーナンバー:</span><span>{order.keyNumber}</span></div>}
                {order.clientName   && <div className="detail-row"><span className="extra-label">ご依頼主様:</span><span>{order.clientName}</span></div>}
                {order.clientPhone  && <div className="detail-row"><span className="extra-label">電話番号:</span><span>{order.clientPhone}</span></div>}
                {order.clientAddress && <div className="detail-row"><span className="extra-label">ご住所:</span><span>{order.clientAddress}</span></div>}
              </div>
            </div>
          )}
          <div className="order-date">登録: {formatDate(order.createdAt)}</div>
          <div className="order-actions">
            <div className="transition-buttons">
              {transitions.map(toId => {
                const to = STATUSES.find(s => s.id === toId)
                return (
                  <button key={toId} className="transition-btn" style={{ '--t-color': to.color }} onClick={() => onStatusChange(order.id, toId)}>
                    <ArrowRight size={12} />{to.label}へ
                  </button>
                )
              })}
            </div>
            <div className="card-controls">
              <button className="ctrl-btn edit" onClick={() => onEdit(order)}>編集</button>
              <button className="ctrl-btn del"  onClick={() => onDelete(order.id)}>削除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 商品セレクター
function ItemSelector({ maker, items, onChange }) {
  const [selectedKey, setSelectedKey] = useState('')
  const [customName, setCustomName]   = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const groups   = MAKER_PRODUCTS[maker] || []
  const allItems = groups.flatMap(g => g.items.map(i => ({ ...i, group: g.group })))

  function addFromSelect() {
    if (!selectedKey) return
    const product = allItems.find(i => i.name === selectedKey)
    if (!product) return
    const existing = items.find(i => i.name === product.name)
    if (existing) onChange(items.map(i => i.name === product.name ? { ...i, qty: i.qty + 1 } : i))
    else          onChange([...items, { name: product.name, price: product.price, qty: 1 }])
    setSelectedKey('')
  }

  function addCustom() {
    if (!customName.trim() || !customPrice) return
    const price = Number(customPrice)
    if (isNaN(price)) return
    const existing = items.find(i => i.name === customName.trim())
    if (existing) onChange(items.map(i => i.name === customName.trim() ? { ...i, qty: i.qty + 1 } : i))
    else          onChange([...items, { name: customName.trim(), price, qty: 1 }])
    setCustomName(''); setCustomPrice('')
  }

  function updateQty(name, qty) {
    if (qty <= 0) { onChange(items.filter(i => i.name !== name)); return }
    onChange(items.map(i => i.name === name ? { ...i, qty } : i))
  }

  return (
    <div className="item-selector">
      {groups.length > 0 && (
        <div className="item-add-row">
          <select name="product-select" value={selectedKey} onChange={e => setSelectedKey(e.target.value)} className="product-select">
            <option value="">商品を選択...</option>
            {groups.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map(p => <option key={p.name} value={p.name}>{p.name}（¥{p.price.toLocaleString()}）</option>)}
              </optgroup>
            ))}
          </select>
          <button type="button" className="btn-add-item" onClick={addFromSelect} disabled={!selectedKey}><Plus size={14} /> 追加</button>
        </div>
      )}
      <div className="custom-item-row">
        <input name="custom-name" className="custom-name-input" placeholder="商品名を手入力..." value={customName} onChange={e => setCustomName(e.target.value)} autoComplete="off" />
        <input name="custom-price" className="custom-price-input" placeholder="価格" type="number" min="0" value={customPrice} onChange={e => setCustomPrice(e.target.value)} autoComplete="off" />
        <button type="button" className="btn-add-item" onClick={addCustom} disabled={!customName.trim() || !customPrice}><Plus size={14} /> 追加</button>
      </div>
      {items.length > 0 && (
        <div className="item-list">
          {items.map(item => (
            <div key={item.name} className="item-row">
              <span className="item-name">{item.name}</span>
              <span className="item-unit-price">¥{item.price.toLocaleString()}</span>
              <div className="item-qty-ctrl">
                <button type="button" onClick={() => updateQty(item.name, item.qty - 1)}>－</button>
                <span>{item.qty}</span>
                <button type="button" onClick={() => updateQty(item.name, item.qty + 1)}>＋</button>
              </div>
              <span className="item-subtotal">¥{(item.price * item.qty).toLocaleString()}</span>
              <button type="button" className="item-remove" onClick={() => onChange(items.filter(i => i.name !== item.name))}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OrderForm({ initial, onSave, onCancel }) {
  const [form, setForm]       = useState({ ...(initial || EMPTY_FORM), items: initial?.items || [], priceOverride: initial?.priceOverride || '', maker: initial?.maker || '' })
  const [showExtra, setShowExtra] = useState(!!(initial?.keyNumber || initial?.clientName || initial?.clientPhone || initial?.clientAddress))
  const makerObj   = MAKERS.find(m => m.id === form.maker)
  const taxIncluded = makerObj?.taxIncluded || false
  const { subtotal, tax, total, isOverride, taxIncluded: isTaxIncluded } = calcAmounts(form.items, form.priceOverride, taxIncluded)

  function handle(e) {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    if (e.target.name === 'maker') { setForm(f => ({ ...f, maker: val, items: [], priceOverride: '' })); return }
    setForm(f => ({ ...f, [e.target.name]: val }))
  }

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return alert('氏名を入力してください')
    onSave({ ...form, amount: String(total) })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{initial ? '受注編集' : '新規受注'}</h2>
          <button className="modal-close" onClick={onCancel}><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="order-form">
          <div className="inquiry-toggle">
            <label className="toggle-label">
              <input type="checkbox" name="isInquiry" checked={form.isInquiry || false} onChange={e => { handle(e); if (e.target.checked) setForm(f => ({ ...f, isGuided: false })) }} />
              <span>💬 お問合せセクションとして登録</span>
            </label>
            <label className="toggle-label" style={{marginTop:6}}>
              <input type="checkbox" name="isGuided" checked={form.isGuided || false} onChange={e => { handle(e); if (e.target.checked) setForm(f => ({ ...f, isInquiry: false })) }} />
              <span>📋 案内済みとして登録</span>
            </label>
            <p className="toggle-note">チェックなしの場合は受注セクションで処理されます</p>
          </div>
          <label>氏名 <span className="req">*</span><input name="name" value={form.name} onChange={handle} placeholder="田中 太郎" required /></label>
          <div className="form-row">
            <label>マンション名<input name="mansion" value={form.mansion} onChange={handle} placeholder="○○マンション" /></label>
            <label style={{flex:'0 0 120px'}}>部屋番号<input name="room" value={form.room} onChange={handle} placeholder="101" /></label>
          </div>
          <label>電話番号<input name="phone" value={form.phone} onChange={handle} placeholder="090-0000-0000" type="tel" /></label>
          <label>作業内容<textarea name="work" value={form.work} onChange={handle} placeholder="作業内容を入力..." rows={2} /></label>
          <div className="form-section-title">メーカー・商品選択</div>
          <div className="maker-tabs">
            {MAKERS.map(m => (
              <button key={m.id} type="button" className={`maker-tab ${form.maker === m.id ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, maker: m.id, items: [], priceOverride: '' }))}>
                {m.label}{m.taxIncluded && <span className="tax-badge">税込</span>}
              </button>
            ))}
          </div>
          {form.maker ? <ItemSelector maker={form.maker} items={form.items} onChange={items => setForm(f => ({ ...f, items }))} /> : <div className="maker-hint">↑ メーカーを選択すると商品を追加できます</div>}
          <div className="price-summary">
            {isTaxIncluded && <div className="tax-included-notice">💡 シブタニは税込み価格のため消費税計算をスキップします</div>}
            <div className="price-row">
              <label className="price-label">
                {isTaxIncluded ? '税込み合計（直接入力可・@で固定）' : '税抜き合計（直接入力可・@で固定）'}
                <input name="priceOverride" value={form.priceOverride} onChange={handle} placeholder={`¥${subtotal.toLocaleString()}（自動計算）`} className="price-input" />
              </label>
              <label className="price-label">
                {isTaxIncluded ? '請求金額（税込）' : '税込み金額（自動計算）'}
                <div className="price-display" style={{ color: isOverride ? '#e67e22' : 'var(--accent)' }}>
                  ¥{total.toLocaleString()}
                  {isOverride && <span className="override-badge">固定</span>}
                  {isTaxIncluded && !isOverride && <span className="override-badge" style={{background:'#3498db'}}>税込</span>}
                </div>
              </label>
            </div>
            {!isOverride && !isTaxIncluded && subtotal > 0 && <div className="tax-detail">税抜き ¥{subtotal.toLocaleString()} ＋ 消費税10% ¥{tax.toLocaleString()} ＝ 税込み ¥{total.toLocaleString()}</div>}
          </div>
          <div className="extra-section">
            <button type="button" className="extra-toggle-btn" onClick={() => setShowExtra(v => !v)}>
              <ChevronRight size={14} style={{ transform: showExtra ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
              その他管理会社（任意）
            </button>
            {showExtra && (
              <div className="extra-fields">
                <label>キーナンバー<input name="keyNumber"     value={form.keyNumber}     onChange={handle} placeholder="例: KY-1234" /></label>
                <label>ご依頼主様<input  name="clientName"    value={form.clientName}    onChange={handle} placeholder="管理会社名など" /></label>
                <label>電話番号<input    name="clientPhone"   value={form.clientPhone}   onChange={handle} placeholder="03-0000-0000" /></label>
                <label>ご住所<input      name="clientAddress" value={form.clientAddress} onChange={handle} placeholder="東京都○○区..." /></label>
              </div>
            )}
          </div>
          <div className="form-buttons">
            <button type="button" className="btn-cancel" onClick={onCancel}>キャンセル</button>
            <button type="submit" className="btn-save">{initial ? '更新する' : '受注登録'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// SalesTab コンポーネント（App.jsxに挿入する）
// SettingsModal の直前に配置

function SalesTab({ allOrders, salesFrom, salesTo, setSalesFrom, setSalesTo }) {
  // 期間内の完了受注を抽出
  const filtered = allOrders.filter(o => {
    if (o.status !== 'done') return false
    if (!o.createdAt) return false
    const d = o.createdAt.slice(0,10)
    return d >= salesFrom && d <= salesTo
  })

  // 売上集計
  const salesData = filtered.map(o => {
    const amount = Number(o.amount) || 0
    const maker = o.maker || ''
    // シブタニは税込み価格なので逆算、それ以外は税抜き×1.1が税込み
    const taxIncluded = maker === 'shibutani'
    const taxIncAmt   = amount  // amountは常に税込み請求金額
    const taxExAmt    = taxIncluded
      ? Math.round(amount / 1.1)   // 税込み→税抜き逆算
      : Math.round(amount / 1.1)   // 通常も同様
    const tax = taxIncAmt - taxExAmt
    // 仕入れ（商品のみ、作業費・手数料類を除く）
    const purchaseItems = (o.items || []).filter(it => {
      const n = it.name || ''
      return !n.includes('作業費') && !n.includes('手数料') && !n.includes('出張費') && !n.includes('事務') && !n.includes('送料')
    })
    const purchaseTotal = purchaseItems.reduce((s, it) => s + (it.price * (it.qty || 1)), 0)
    return { ...o, taxIncAmt, taxExAmt, tax, purchaseItems, purchaseTotal }
  })

  const totalTaxInc  = salesData.reduce((s, o) => s + o.taxIncAmt, 0)
  const totalTaxEx   = salesData.reduce((s, o) => s + o.taxExAmt, 0)
  const totalTax     = salesData.reduce((s, o) => s + o.tax, 0)
  const totalPurchase = salesData.reduce((s, o) => s + o.purchaseTotal, 0)

  // 商品別集計
  const itemMap = {}
  salesData.forEach(o => {
    (o.items || []).forEach(it => {
      if (!it.name) return
      if (!itemMap[it.name]) itemMap[it.name] = { name: it.name, price: it.price, qty: 0, total: 0 }
      itemMap[it.name].qty   += (it.qty || 1)
      itemMap[it.name].total += it.price * (it.qty || 1)
    })
  })
  const itemList = Object.values(itemMap).sort((a,b) => b.total - a.total)

  // Excel出力
  async function exportExcel() {
    // SheetJSを使ってExcel生成
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')

    const wb = XLSX.utils.book_new()

    // ── サマリーシート ──
    const summaryData = [
      ['カーロックホームズ 売上レポート'],
      ['期間', `${salesFrom} ～ ${salesTo}`],
      ['対象件数', filtered.length + '件'],
      [],
      ['項目', '金額'],
      ['税込み売上', totalTaxInc],
      ['税抜き売上', totalTaxEx],
      ['消費税合計', totalTax],
      ['仕入れ合計（商品のみ）', totalPurchase],
      ['粗利（税抜き－仕入れ）', totalTaxEx - totalPurchase],
    ]
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    wsSummary['!cols'] = [{wch:30},{wch:20}]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'サマリー')

    // ── 受注明細シート（月別） ──
    const months = {}
    salesData.forEach(o => {
      const m = (o.createdAt || '').slice(0,7)
      if (!months[m]) months[m] = []
      months[m].push(o)
    })

    Object.entries(months).sort().forEach(([month, rows]) => {
      const header = ['受注ID','氏名','マンション','部屋','メーカー','作業内容','税込金額','税抜金額','消費税','仕入れ合計','登録日']
      const data = [header, ...rows.map(o => [
        o.id, o.name, o.mansion, o.room ? o.room+'号室' : '',
        MAKERS.find(m=>m.id===o.maker)?.label || o.maker || '',
        o.work,
        o.taxIncAmt, o.taxExAmt, o.tax, o.purchaseTotal,
        (o.createdAt || '').slice(0,10)
      ])]
      const ws = XLSX.utils.aoa_to_sheet(data)
      ws['!cols'] = [{wch:20},{wch:12},{wch:20},{wch:8},{wch:12},{wch:30},{wch:12},{wch:12},{wch:10},{wch:12},{wch:12}]
      XLSX.utils.book_append_sheet(wb, ws, month)
    })

    // ── 商品別仕入れシート ──
    const itemHeader = ['商品名','単価','数量','合計金額']
    const itemData = [itemHeader, ...itemList.map(it => [it.name, it.price, it.qty, it.total])]
    const wsItems = XLSX.utils.aoa_to_sheet(itemData)
    wsItems['!cols'] = [{wch:35},{wch:12},{wch:8},{wch:12}]
    XLSX.utils.book_append_sheet(wb, wsItems, '商品別仕入れ')

    // ダウンロード
    XLSX.writeFile(wb, `売上レポート_${salesFrom}_${salesTo}.xlsx`)
  }

  return (
    <div className="settings-section">
      <div className="settings-title">売上集計（完了分）</div>

      {/* 期間選択 */}
      <div className="sales-period-row">
        <div className="sales-period-item">
          <span className="sales-period-label">開始日</span>
          <input type="date" className="settings-input" value={salesFrom} onChange={e => setSalesFrom(e.target.value)} />
        </div>
        <span className="sales-period-sep">〜</span>
        <div className="sales-period-item">
          <span className="sales-period-label">終了日</span>
          <input type="date" className="settings-input" value={salesTo} onChange={e => setSalesTo(e.target.value)} />
        </div>
      </div>

      {/* クイック選択 */}
      <div className="sales-quick-btns">
        {[
          { label: '今月', fn: () => { const d = new Date(); const f = new Date(d.getFullYear(), d.getMonth(), 1); setSalesFrom(f.toISOString().slice(0,10)); setSalesTo(d.toISOString().slice(0,10)) }},
          { label: '先月', fn: () => { const d = new Date(); const f = new Date(d.getFullYear(), d.getMonth()-1, 1); const t = new Date(d.getFullYear(), d.getMonth(), 0); setSalesFrom(f.toISOString().slice(0,10)); setSalesTo(t.toISOString().slice(0,10)) }},
          { label: '今年', fn: () => { const d = new Date(); setSalesFrom(`${d.getFullYear()}-01-01`); setSalesTo(d.toISOString().slice(0,10)) }},
          { label: '全期間', fn: () => { setSalesFrom('2020-01-01'); setSalesTo(new Date().toISOString().slice(0,10)) }},
        ].map(b => <button key={b.label} className="sales-quick-btn" onClick={b.fn}>{b.label}</button>)}
      </div>

      {/* 集計カード */}
      {filtered.length === 0 ? (
        <div className="deleted-empty">期間内に完了した受注がありません</div>
      ) : (
        <>
          <div className="sales-summary-grid">
            <div className="sales-card">
              <div className="sales-card-label">対象件数</div>
              <div className="sales-card-value">{filtered.length}<span className="sales-card-unit">件</span></div>
            </div>
            <div className="sales-card">
              <div className="sales-card-label">税込み売上</div>
              <div className="sales-card-value sales-card-accent">¥{totalTaxInc.toLocaleString()}</div>
            </div>
            <div className="sales-card">
              <div className="sales-card-label">税抜き売上</div>
              <div className="sales-card-value">¥{totalTaxEx.toLocaleString()}</div>
            </div>
            <div className="sales-card">
              <div className="sales-card-label">消費税</div>
              <div className="sales-card-value sales-card-dim">¥{totalTax.toLocaleString()}</div>
            </div>
            <div className="sales-card">
              <div className="sales-card-label">仕入れ合計</div>
              <div className="sales-card-value sales-card-warn">¥{totalPurchase.toLocaleString()}</div>
            </div>
            <div className="sales-card">
              <div className="sales-card-label">粗利（税抜き－仕入れ）</div>
              <div className="sales-card-value sales-card-profit">¥{(totalTaxEx - totalPurchase).toLocaleString()}</div>
            </div>
          </div>

          {/* 商品別TOP */}
          {itemList.length > 0 && (
            <div style={{marginTop:12}}>
              <div className="settings-title" style={{marginBottom:8}}>商品別仕入れ</div>
              <div className="item-summary-list">
                {itemList.slice(0,8).map(it => (
                  <div key={it.name} className="item-summary-row">
                    <span className="item-summary-name">{it.name}</span>
                    <span className="item-summary-qty">×{it.qty}</span>
                    <span className="item-summary-total">¥{it.total.toLocaleString()}</span>
                  </div>
                ))}
                {itemList.length > 8 && <div className="item-summary-more">他 {itemList.length - 8} 商品</div>}
              </div>
            </div>
          )}

          {/* Excel出力ボタン */}
          <button className="btn-save" style={{marginTop:16,width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8}} onClick={exportExcel}>
            📥 Excelで出力（{salesFrom}〜{salesTo}）
          </button>
        </>
      )}
    </div>
  )
}


// ============================================================
// 設定モーダル（タブ付き）
// ============================================================
function SettingsModal({ gasUrl, onSaveGasUrl, onClose, onLogout, deletedOrders, onRestore, allOrders }) {
  const [tab, setTab]             = useState('gas')
  const [salesFrom, setSalesFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10) })
  const [salesTo, setSalesTo]     = useState(() => new Date().toISOString().slice(0,10))
  const [url, setUrl]             = useState(gasUrl || DEFAULT_GAS_URL)
  const [testStatus, setTestStatus] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [orderApiKey, setOrderApiKey] = useState(() => { try { return localStorage.getItem(ORDER_API_KEY_KEY) || '' } catch { return '' } })
  const [orderGasUrl, setOrderGasUrl] = useState(() => { try { return localStorage.getItem(ORDER_GAS_URL_KEY) || '' } catch { return '' } })
  const [dbxToken, setDbxToken]   = useState(() => { try { return localStorage.getItem(DBX_TOKEN_KEY) || '' } catch { return '' } })
  const [dbxFolder, setDbxFolder] = useState(() => { try { return localStorage.getItem(DBX_FOLDER_KEY) || '/合鍵注文' } catch { return '/合鍵注文' } })
  const [saveMsg, setSaveMsg]     = useState('')

  function showMsg(msg) { setSaveMsg(msg); setTimeout(() => setSaveMsg(''), 3000) }

  async function testGas() {
    setTestLoading(true); setTestStatus('')
    try { await fetch(url + '?action=get'); setTestStatus('success') }
    catch { setTestStatus('error') }
    finally { setTestLoading(false) }
  }

  function saveGas()      { onSaveGasUrl(url); showMsg('✅ GAS URLを保存しました') }
  function saveApiKey()   { try { localStorage.setItem(ORDER_API_KEY_KEY, orderApiKey) } catch {} showMsg('✅ APIキーを保存しました') }
  function saveOrderUrl() { try { localStorage.setItem(ORDER_GAS_URL_KEY, orderGasUrl) } catch {} showMsg('✅ 注文GAS URLを保存しました') }
  function saveDbx()      { try { localStorage.setItem(DBX_TOKEN_KEY, dbxToken); localStorage.setItem(DBX_FOLDER_KEY, dbxFolder || '/合鍵注文') } catch {} showMsg('✅ Dropbox設定を保存しました') }

  const tabs = [
    { id: 'gas',     label: '⚙️ GAS' },
    { id: 'api',     label: '🔑 APIキー' },
    { id: 'dropbox', label: '📦 Dropbox' },
    { id: 'deleted', label: `🗑️ 削除済み${deletedOrders.length > 0 ? ` (${deletedOrders.length})` : ''}` },
    { id: 'sales',   label: '📊 売上' },
  ]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{maxWidth:560}}>
        <div className="modal-header">
          <h2>設定</h2>
          <div style={{display:'flex',gap:8}}>
            <button className="logout-btn" onClick={onLogout}><LogOut size={14} /> ログアウト</button>
            <button className="modal-close" onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        <div className="settings-tabs">
          {tabs.map(t => <button key={t.id} className={`settings-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>

        <div style={{padding:'20px 24px 24px'}}>
          {saveMsg && <div className="settings-save-msg">{saveMsg}</div>}

          {tab === 'gas' && (
            <div className="settings-section">
              <div className="settings-title">受注管理 GAS URL</div>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..." className="settings-input" autoComplete="off" />
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button className="btn-cancel" style={{flex:1}} onClick={testGas} disabled={testLoading}>
                  {testLoading ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}} /> : '接続テスト'}
                </button>
                <button className="btn-save" style={{flex:1}} onClick={saveGas}>保存</button>
              </div>
              {testStatus === 'success' && <p style={{color:'#27ae60',fontSize:13,marginTop:8}}>✓ 接続成功</p>}
              {testStatus === 'error'   && <p style={{color:'#e74c3c',fontSize:13,marginTop:8}}>✗ 接続失敗</p>}
            </div>
          )}

          {tab === 'api' && (
            <div className="settings-section">
              <div className="settings-title">注文受信 APIキー</div>
              <p className="settings-desc">顧客注文フォーム（index.html）からの受信時に使用するAPIキーです。</p>
              <input value={orderApiKey} onChange={e => setOrderApiKey(e.target.value)} placeholder="例: clh-api-xxxxxxxx" className="settings-input" autoComplete="off" />
              <div className="settings-title" style={{marginTop:16}}>注文フォーム GAS URL</div>
              <p className="settings-desc">index.htmlが送信先とするGASのURLです（管理GASとは別のエンドポイント）。</p>
              <input value={orderGasUrl} onChange={e => setOrderGasUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..." className="settings-input" autoComplete="off" />
              <button className="btn-save" style={{marginTop:12,width:'100%'}} onClick={() => { saveApiKey(); saveOrderUrl() }}>保存</button>
            </div>
          )}

          {tab === 'dropbox' && (
            <div className="settings-section">
              <div className="settings-title">Dropbox アクセストークン</div>
              <p className="settings-desc">顧客が送付した写真の保存先です。Dropbox Developersで取得してください。</p>
              <input value={dbxToken} onChange={e => setDbxToken(e.target.value)} placeholder="Dropboxアクセストークン" className="settings-input" autoComplete="off" />
              <div className="settings-title" style={{marginTop:16}}>保存フォルダ</div>
              <input value={dbxFolder} onChange={e => setDbxFolder(e.target.value)} placeholder="/合鍵注文" className="settings-input" />
              <button className="btn-save" style={{marginTop:12,width:'100%'}} onClick={saveDbx}>保存</button>
            </div>
          )}

          {tab === 'deleted' && (
            <div className="settings-section">
              <div className="settings-title">削除済み受注</div>
              {deletedOrders.length === 0 ? (
                <div className="deleted-empty">削除済みの受注はありません</div>
              ) : (
                <div className="deleted-list">
                  {deletedOrders.map(o => (
                    <div key={o.id} className="deleted-row">
                      <div className="deleted-info">
                        <div className="deleted-name">{o.name}</div>
                        <div className="deleted-sub">{o.mansion} {o.room ? o.room+'号室' : ''} · {formatDate(o.deletedAt || o.createdAt)}</div>
                      </div>
                      <button className="restore-btn" onClick={() => onRestore(o.id)}>
                        <RotateCcw size={13} /> 復元
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'sales' && (
            <SalesTab allOrders={allOrders} salesFrom={salesFrom} salesTo={salesTo} setSalesFrom={setSalesFrom} setSalesTo={setSalesTo} />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [authed, setAuthed]   = useState(() => !!getToken())
  const [orders, setOrders]   = useState(() => { try { const s = localStorage.getItem('key_orders'); return s ? JSON.parse(s) : SAMPLE_DATA } catch { return SAMPLE_DATA } })
  const [deletedOrders, setDeletedOrders] = useState(() => { try { const s = localStorage.getItem('key_orders_deleted'); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [activeStatus, setActiveStatus]   = useState(null)
  const [activeAlert,  setActiveAlert]    = useState(null)
  const [showForm,     setShowForm]       = useState(false)
  const [editingOrder, setEditingOrder]   = useState(null)
  const [showSettings, setShowSettings]   = useState(false)
  const [gasUrl,       setGasUrl]         = useState(() => localStorage.getItem(GAS_CONFIG_KEY) || DEFAULT_GAS_URL)
  const [syncing,      setSyncing]        = useState(false)
  const [lastSync,     setLastSync]       = useState(null)
  const [search,       setSearch]         = useState('')
  const [loading,      setLoading]        = useState(true)

  useEffect(() => { localStorage.setItem('key_orders', JSON.stringify(orders)) }, [orders])
  useEffect(() => { localStorage.setItem('key_orders_deleted', JSON.stringify(deletedOrders)) }, [deletedOrders])

  useEffect(() => {
    if (!authed) { setLoading(false); return }
    const startTime = Date.now()
    const finishLoading = () => {
      const remain = Math.max(0, 3000 - (Date.now() - startTime))
      setTimeout(() => setLoading(false), remain)
    }
    if (!gasUrl) { finishLoading(); return }
    fetchFromGAS(gasUrl).then(remote => {
      if (remote && remote.length > 0) { setOrders(remote); setLastSync(new Date()) }
      finishLoading()
    }).catch(finishLoading)
    const timer = setInterval(() => {
      fetchFromGAS(gasUrl).then(remote => {
        if (remote && remote.length > 0) { setOrders(remote); setLastSync(new Date()) }
      })
    }, 60000)
    return () => clearInterval(timer)
  }, [gasUrl, authed])

  const syncGAS = useCallback(async (o) => {
    if (!gasUrl) return
    setSyncing(true)
    await syncToGAS(gasUrl, o)
    setLastSync(new Date())
    setSyncing(false)
  }, [gasUrl])

  async function pullFromGAS() {
    if (!gasUrl) { setShowSettings(true); return }
    setSyncing(true)
    const remote = await fetchFromGAS(gasUrl)
    if (remote) { setOrders(remote); setLastSync(new Date()) }
    setSyncing(false)
  }

  function saveGasUrl(url) {
    setGasUrl(url)
    try { localStorage.setItem(GAS_CONFIG_KEY, url) } catch {}
  }

  function handleLogin() { setAuthed(true) }

  function handleLogout() {
    clearToken()
    setAuthed(false)
    setShowSettings(false)
  }

  function addOrder(form) {
    const status = form.isGuided ? 'guided' : form.isInquiry ? 'inquiry' : 'order'
    const newOrder = { ...form, id: generateId(), status, createdAt: new Date().toISOString() }
    const next = [newOrder, ...orders]
    setOrders(next); setShowForm(false); syncGAS(next)
  }

  function updateOrder(form) {
    const next = orders.map(o => o.id === editingOrder.id ? { ...o, ...form } : o)
    setOrders(next); setEditingOrder(null); syncGAS(next)
  }

  // 論理削除：削除済みシートに移動
  function deleteOrder(id) {
    if (!confirm('この受注を削除しますか？\n\n「設定 > 削除済み」から復元できます。')) return
    const target = orders.find(o => o.id === id)
    if (!target) return
    const deletedEntry = { ...target, deletedAt: new Date().toISOString() }
    const nextDeleted = [deletedEntry, ...deletedOrders]
    const next = orders.filter(o => o.id !== id)
    setOrders(next)
    setDeletedOrders(nextDeleted)
    syncGAS(next)
  }

  // 復元
  function restoreOrder(id) {
    const target = deletedOrders.find(o => o.id === id)
    if (!target) return
    const { deletedAt, ...restored } = target
    const next = [restored, ...orders]
    const nextDeleted = deletedOrders.filter(o => o.id !== id)
    setOrders(next)
    setDeletedOrders(nextDeleted)
    syncGAS(next)
  }

  function changeStatus(id, newStatus) {
    const next = orders.map(o => o.id === id ? { ...o, status: newStatus } : o)
    setOrders(next); syncGAS(next)
  }

  function toggleAlert(alertId)   { setActiveAlert(prev => prev === alertId ? null : alertId); setActiveStatus(null) }
  function toggleStatus(statusId) { setActiveStatus(prev => prev === statusId ? null : statusId); setActiveAlert(null) }

  const alertCounts = {}
  ALERTS.forEach(a => { alertCounts[a.id] = orders.filter(o => getAlertInfo(o)?.id === a.id).length })
  const counts = {}
  STATUSES.forEach(s => { counts[s.id] = orders.filter(o => o.status === s.id).length })

  const q = search.trim().toLowerCase()
  const filtered = orders.filter(o => {
    if (activeStatus && o.status !== activeStatus) return false
    if (activeAlert) { const info = getAlertInfo(o); if (!info || info.id !== activeAlert) return false }
    if (!q) return true
    return (o.name+o.mansion+o.phone+o.work).toLowerCase().includes(q)
  })

  const totalAlerts = ALERTS.reduce((sum, a) => sum + alertCounts[a.id], 0)

  // 未ログイン
  if (!authed) {
    return <LoginScreen gasUrl={gasUrl} onLogin={handleLogin} onSetGasUrl={saveGasUrl} />
  }

  return (
    <>
      {loading && <Loading />}
      <div className="app">
        <header className="header">
          <div className="header-left">
            <Key size={22} color="var(--accent)" />
            <span className="header-title">一般受注管理</span>
            {totalAlerts > 0 && <span className="header-alert-badge">{totalAlerts}件要対応</span>}
          </div>
          <div className="header-right">
            <button className="icon-btn" onClick={pullFromGAS} disabled={syncing} title="今すぐ取得">
              {syncing ? <Loader2 size={16} style={{animation:'spin 1s linear infinite'}} /> : <RefreshCw size={16} />}
            </button>
            <button className="icon-btn" onClick={() => setShowSettings(true)} title="設定"><Settings size={16} /></button>
            <div className="new-order-wrap">
              <button className="btn-primary btn-primary-lg" onClick={() => setShowForm(true)}><Plus size={18} /> 新規受注</button>
              <div className="sync-info-below">
                {lastSync ? <>最終同期: {formatDate(lastSync.toISOString())}</> : <span style={{color:'#e67e22'}}>未同期</span>}
              </div>
            </div>
          </div>
        </header>

        <div className="status-grid">
          <div className="status-card-group">
            {['inquiry','guided'].map(id => {
              const s = STATUSES.find(x => x.id === id)
              return (
                <button key={id} onClick={() => toggleStatus(id)} className="status-card status-card-sub" style={{ '--card-color': s.color, '--card-bg': s.bg, outline: activeStatus === id ? `2px solid ${s.color}` : 'none' }}>
                  <span className="status-card-icon-sm">{s.icon}</span>
                  <span className="status-card-label-sm">{s.label}</span>
                  <span className="status-card-badge-sm"><Badge count={counts[id]} color={s.color} /></span>
                </button>
              )
            })}
          </div>
          {STATUSES.filter(s => s.id !== 'inquiry' && s.id !== 'guided').map(s => (
            <StatusCard key={s.id} status={s} count={counts[s.id]} active={activeStatus === s.id} onClick={() => toggleStatus(s.id)} />
          ))}
        </div>

        <div className="alert-grid">
          {ALERTS.map(a => <AlertCard key={a.id} alert={a} count={alertCounts[a.id]} active={activeAlert === a.id} onClick={() => toggleAlert(a.id)} />)}
        </div>

        <div className="list-toolbar">
          <div className="search-wrap">
            <Search size={14} color="var(--text-dim)" />
            <input name="search" className="search-input" placeholder="氏名・マンション・電話番号で検索..." value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
            {search && <button onClick={() => setSearch('')} style={{background:'none',border:'none',color:'var(--text-dim)',cursor:'pointer'}}><X size={14}/></button>}
          </div>
          {(activeStatus || activeAlert) && (
            <button className="filter-chip" onClick={() => { setActiveStatus(null); setActiveAlert(null) }}>
              {activeStatus ? STATUSES.find(s=>s.id===activeStatus)?.label : ALERTS.find(a=>a.id===activeAlert)?.label}
              <X size={12} />
            </button>
          )}
          <span className="count-label">{filtered.length}件</span>
        </div>

        <div className="order-list">
          {filtered.length === 0 && (
            <div className="empty-state">
              <Key size={40} color="var(--border)" />
              <p>データがありません</p>
              {!activeStatus && !activeAlert && <button className="btn-primary" style={{marginTop:16}} onClick={() => setShowForm(true)}><Plus size={14}/> 最初の受注を登録</button>}
            </div>
          )}
          {filtered.map(o => <OrderCard key={o.id} order={o} onStatusChange={changeStatus} onDelete={deleteOrder} onEdit={o => setEditingOrder(o)} />)}
        </div>

        {showForm      && <OrderForm onSave={addOrder}  onCancel={() => setShowForm(false)} />}
        {editingOrder  && <OrderForm initial={editingOrder} onSave={updateOrder} onCancel={() => setEditingOrder(null)} />}
        {showSettings  && <SettingsModal gasUrl={gasUrl} onSaveGasUrl={saveGasUrl} onClose={() => setShowSettings(false)} onLogout={handleLogout} deletedOrders={deletedOrders} onRestore={restoreOrder} allOrders={orders} />}
      </div>

      <button className="fab-new-order" onClick={() => setShowForm(true)}>
        <Plus size={20} /> 新規受注
      </button>
    </>
  )
}
