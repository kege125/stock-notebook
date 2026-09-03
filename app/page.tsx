'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, ChevronRight, CircleDollarSign, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Holding = { id: string; code: string; name: string; price: number; quantity: number; fee: number; date: string; time: string; note: string };
type ClosedTrade = Holding & { sellPrice: number; sellFee: number; sellDate: string; sellTime: string; profit: number };
const storageKey = 'stock-notebook-v1';
type WebMcpContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: object; execute: (input: unknown) => unknown }, options: { signal: AbortSignal }) => void | Promise<void> };

function nowFields() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return { date: local.toISOString().slice(0, 10), time: local.toTimeString().slice(0, 5) };
}
function money(value: number) { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(value); }

export default function Home() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [history, setHistory] = useState<ClosedTrade[]>([]);
  const [open, setOpen] = useState<'buy' | 'sell' | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const saved = localStorage.getItem(storageKey); if (saved) try { const data = JSON.parse(saved); setHoldings(data.holdings ?? []); setHistory(data.history ?? []); } catch { localStorage.removeItem(storageKey); } setLoaded(true); }, []);
  useEffect(() => { if (loaded) localStorage.setItem(storageKey, JSON.stringify({ holdings, history })); }, [holdings, history, loaded]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const addBuy = (input: unknown) => {
      const value = input as { code?: string; name?: string; price?: number; quantity?: number; fee?: number };
      if (!value.code || !Number.isFinite(value.price) || !Number.isFinite(value.quantity) || Number(value.price) <= 0 || Number(value.quantity) <= 0) throw new Error('请提供有效的股票代码、买入价格和数量。');
      const current = nowFields(); const record: Holding = { id: crypto.randomUUID(), code: value.code.toUpperCase(), name: value.name || value.code.toUpperCase(), price: Number(value.price), quantity: Number(value.quantity), fee: Number(value.price) * Number(value.quantity) * 0.0001, date: current.date, time: current.time, note: '' };
      setHoldings((items) => [record, ...items]);
      return { id: record.id, status: '已记录买入', date: record.date, time: record.time };
    };
    void Promise.resolve(context.registerTool({ name: 'get_stock_summary', title: '查看股票记录汇总', description: '读取当前持仓数量、已完成交易数和累计已实现盈亏。', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => ({ holdingCount: holdings.length, completedTrades: history.length, realizedProfit: totalProfit }) }, { signal: lifecycle.signal })).catch(() => undefined);
    void Promise.resolve(context.registerTool({ name: 'record_stock_buy', title: '记录股票买入', description: '创建一笔买入记录；日期和时间自动使用当前时间。', inputSchema: { type: 'object', properties: { code: { type: 'string' }, name: { type: 'string' }, price: { type: 'number' }, quantity: { type: 'number' }, fee: { type: 'number' } }, required: ['code', 'price', 'quantity'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: addBuy }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [holdings.length, history.length, totalProfit]);
  const totalProfit = useMemo(() => history.reduce((sum, item) => sum + item.profit, 0), [history]);
  const holdingValue = useMemo(() => holdings.reduce((sum, item) => sum + item.price * item.quantity, 0), [holdings]);
  const selectedHolding = holdings.find((item) => item.id === form.holdingId);
  const setField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  function openForm(kind: 'buy' | 'sell') {
    const dateTime = nowFields();
    setForm(kind === 'buy' ? { code: '', name: '', price: '', quantity: '100', note: '', ...dateTime } : { holdingId: holdings[0]?.id ?? '', price: '', quantity: holdings[0] ? String(holdings[0].quantity) : '', ...dateTime });
    setOpen(kind);
  }
  function saveBuy() {
    const price = Number(form.price), quantity = Number(form.quantity);
    if (!form.code?.trim() || price <= 0 || quantity <= 0) return;
    setHoldings((items) => [{ id: crypto.randomUUID(), code: form.code.trim().toUpperCase(), name: form.name.trim() || form.code.trim().toUpperCase(), price, quantity, fee: price * quantity * 0.0001, date: form.date, time: form.time, note: form.note.trim() }, ...items]);
    setOpen(null);
  }
  function saveSell() {
    const holding = holdings.find((item) => item.id === form.holdingId), sellPrice = Number(form.price), quantity = Number(form.quantity);
    if (!holding || sellPrice <= 0 || quantity <= 0 || quantity > holding.quantity) return;
    const sellFee = sellPrice * quantity * 0.0001, buyFeeShare = holding.fee * quantity / holding.quantity;
    const profit = (sellPrice - holding.price) * quantity - buyFeeShare - sellFee;
    setHistory((items) => [{ ...holding, quantity, fee: buyFeeShare, sellPrice, sellFee, sellDate: form.date, sellTime: form.time, profit }, ...items]);
    setHoldings((items) => items.flatMap((item) => item.id !== holding.id ? [item] : item.quantity === quantity ? [] : [{ ...item, quantity: item.quantity - quantity, fee: item.fee - buyFeeShare }]));
    setOpen(null);
  }

  return <main className="min-h-dvh bg-[#f5f7f5] pb-28 text-[#17211b]">
    <header className="mx-auto flex max-w-xl items-center justify-between px-5 pb-4 pt-6"><div><p className="text-xs font-semibold tracking-[0.16em] text-[#637169]">MY STOCK NOTE</p><h1 className="mt-1 text-2xl font-bold tracking-tight">股票交易记录</h1></div><div className="grid size-11 place-items-center rounded-2xl bg-[#dcebe1] text-[#216144]"><BriefcaseBusiness className="size-5" /></div></header>
    <section className="mx-auto max-w-xl px-5"><div className="rounded-[28px] bg-[#163e2b] p-5 text-white shadow-[0_16px_35px_rgba(22,62,43,.18)]"><p className="text-sm text-[#b9d1c0]">已实现累计盈亏</p><p className={`mt-1 text-3xl font-bold tracking-tight ${totalProfit < 0 ? 'text-[#ffb6a8]' : ''}`}>{totalProfit > 0 ? '+' : ''}{money(totalProfit)}</p><div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4"><div><p className="text-xs text-[#b9d1c0]">已完成交易</p><p className="mt-1 font-semibold">{history.length} 笔</p></div><div><p className="text-xs text-[#b9d1c0]">持仓成本</p><p className="mt-1 font-semibold">{money(holdingValue)}</p></div></div></div><div className="mt-4 grid grid-cols-2 gap-3"><Button onClick={() => openForm('buy')} className="h-14 rounded-2xl bg-[#216144] text-base hover:bg-[#174b34]"><Plus />记录买入</Button><Button onClick={() => openForm('sell')} disabled={!holdings.length} variant="outline" className="h-14 rounded-2xl border-[#bdd1c3] bg-white text-base text-[#216144] hover:bg-[#edf5ef]"><ArrowUpRight />记录卖出</Button></div></section>
    <section className="mx-auto mt-7 max-w-xl px-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">当前持仓</h2><span className="rounded-full bg-[#e1eee4] px-2.5 py-1 text-xs font-semibold text-[#39664b]">{holdings.length} 只</span></div>{holdings.length === 0 ? <div className="rounded-3xl border border-dashed border-[#c9d8cd] bg-white/70 px-5 py-8 text-center"><CircleDollarSign className="mx-auto size-7 text-[#83a18c]" /><p className="mt-3 font-medium">还没有持仓记录</p><p className="mt-1 text-sm text-[#718078]">点击上方“记录买入”开始</p></div> : <div className="space-y-3">{holdings.map((item) => <HoldingCard key={item.id} item={item} />)}</div>}</section>
    <section className="mx-auto mt-7 max-w-xl px-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">最近完成</h2><span className="text-sm text-[#587063]">{history.length ? '单笔自动计算' : ''}</span></div>{history.length === 0 ? <p className="rounded-2xl bg-white px-4 py-4 text-sm text-[#77847c]">卖出后，单笔盈亏会出现在这里。</p> : <div className="space-y-3">{history.slice(0, 5).map((item, index) => <TradeCard key={`${item.id}-${index}`} item={item} />)}</div>}</section>
    <Dialog open={open === 'buy'} onOpenChange={(value) => !value && setOpen(null)}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[24px] p-5 sm:max-w-md"><DialogHeader><DialogTitle>记录买入</DialogTitle><DialogDescription>日期和时间已自动填入当前时间，可随时修改补录。</DialogDescription></DialogHeader><div className="grid gap-3"><div className="grid grid-cols-2 gap-3"><Field label="股票代码"><Input value={form.code ?? ''} onChange={(e) => setField('code', e.target.value)} placeholder="如 600519" inputMode="numeric" /></Field><Field label="股票名称（可选）"><Input value={form.name ?? ''} onChange={(e) => setField('name', e.target.value)} placeholder="如 贵州茅台" /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="买入价格"><Input type="number" step="0.01" value={form.price ?? ''} onChange={(e) => setField('price', e.target.value)} placeholder="0.00" inputMode="decimal" /></Field><Field label="买入数量"><Input type="number" step="1" value={form.quantity ?? ''} onChange={(e) => setField('quantity', e.target.value)} inputMode="numeric" /></Field></div><DateTimeFields form={form} setField={setField} /><FeePreview price={form.price} quantity={form.quantity} /><Field label="备注（可选）"><Textarea value={form.note ?? ''} onChange={(e) => setField('note', e.target.value)} placeholder="例如：买入理由" /></Field></div><DialogFooter><Button onClick={saveBuy} className="h-11 rounded-xl bg-[#216144]">保存买入记录 <ChevronRight /></Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={open === 'sell'} onOpenChange={(value) => !value && setOpen(null)}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[24px] p-5 sm:max-w-md"><DialogHeader><DialogTitle>记录卖出</DialogTitle><DialogDescription>系统会从对应持仓扣除数量，并计算本次已实现盈亏。</DialogDescription></DialogHeader><div className="grid gap-3"><Field label="选择持仓"><select aria-label="选择持仓" className="h-10 w-full rounded-lg border border-[#cbd9cf] bg-white px-2.5 text-base outline-none focus:border-[#317047]" value={form.holdingId ?? ''} onChange={(e) => { const item = holdings.find((holding) => holding.id === e.target.value); setForm((current) => ({ ...current, holdingId: e.target.value, quantity: item ? String(item.quantity) : '' })); }}><option value="">请选择</option>{holdings.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}（{item.quantity} 股）</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="卖出价格"><Input type="number" step="0.01" value={form.price ?? ''} onChange={(e) => setField('price', e.target.value)} placeholder="0.00" inputMode="decimal" /></Field><Field label={`卖出数量${selectedHolding ? `（最多 ${selectedHolding.quantity}）` : ''}`}><Input type="number" step="1" value={form.quantity ?? ''} onChange={(e) => setField('quantity', e.target.value)} inputMode="numeric" /></Field></div><DateTimeFields form={form} setField={setField} /><FeePreview price={form.price} quantity={form.quantity} /></div><DialogFooter><Button onClick={saveSell} className="h-11 rounded-xl bg-[#216144]">保存并计算盈亏 <ArrowDownRight /></Button></DialogFooter></DialogContent></Dialog>
    <footer className="mx-auto mt-8 flex max-w-xl items-center gap-2 px-5 text-xs text-[#7b8880]"><CalendarDays className="size-3.5" />记录仅存于当前 Chrome 浏览器；请定期备份手机。</footer>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium text-[#405249]"><span>{label}</span>{children}</label>; }
function FeePreview({ price, quantity }: { price?: string; quantity?: string }) { const fee = (Number(price) || 0) * (Number(quantity) || 0) * 0.0001; return <div className="flex items-center justify-between rounded-xl bg-[#edf5ef] px-3 py-2.5 text-sm"><span className="text-[#52705e]">手续费（成交金额万分之一）</span><strong className="text-[#216144]">{money(fee)}</strong></div>; }
function DateTimeFields({ form, setField }: { form: Record<string, string>; setField: (key: string, value: string) => void }) { return <div className="grid grid-cols-2 gap-3"><Field label="日期"><Input type="date" value={form.date ?? ''} onChange={(e) => setField('date', e.target.value)} /></Field><Field label="时间"><Input type="time" value={form.time ?? ''} onChange={(e) => setField('time', e.target.value)} /></Field></div>; }
function HoldingCard({ item }: { item: Holding }) { return <div className="rounded-3xl bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="font-bold">{item.name} <span className="ml-1 text-sm font-medium text-[#6c7b72]">{item.code}</span></p><p className="mt-1 text-xs text-[#748178]">买入于 {item.date} {item.time}</p></div><span className="rounded-lg bg-[#e7f2ea] px-2 py-1 text-xs font-semibold text-[#317047]">持有中</span></div><div className="mt-4 grid grid-cols-3 border-t border-[#edf0ed] pt-3 text-sm"><div><p className="text-xs text-[#7c8880]">买入价</p><p className="mt-1 font-semibold">¥ {item.price.toFixed(2)}</p></div><div><p className="text-xs text-[#7c8880]">数量</p><p className="mt-1 font-semibold">{item.quantity} 股</p></div><div><p className="text-xs text-[#7c8880]">成本</p><p className="mt-1 font-semibold">{money(item.price * item.quantity + item.fee)}</p></div></div></div>; }
function TradeCard({ item }: { item: ClosedTrade }) { return <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><div className={`grid size-9 place-items-center rounded-xl ${item.profit >= 0 ? 'bg-[#e4f3e8] text-[#2f7a49]' : 'bg-[#fff0ed] text-[#be5541]'}`}>{item.profit >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}</div><div><p className="font-semibold">{item.name} <span className="text-sm font-normal text-[#718078]">{item.code}</span></p><p className="mt-0.5 text-xs text-[#78847d]">{item.sellDate} · {item.quantity} 股</p></div></div><p className={`font-bold ${item.profit >= 0 ? 'text-[#1f7540]' : 'text-[#bf4f3b]'}`}>{item.profit > 0 ? '+' : ''}{money(item.profit)}</p></div>; }
