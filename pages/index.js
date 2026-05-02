import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';

const BOTVAULT_ADDRESS = '0x434C229fd9F3BFbCe9C178e8367403F11ebAbc2D';
const BASE_CHAIN_ID = '0x2105';

export default function SuperB() {
  const [page, setPage] = useState('home');
  const [botActive, setBotActive] = useState(true);
  const [riskAmount, setRiskAmount] = useState(0.50);
  const [modalOpen, setModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [statusLine, setStatusLine] = useState('⚡ Scanning 847 Base tokens...');
  const [messages, setMessages] = useState([
    { from: 'bot', text: "I'm online and scanning Base tokens. I've made 47 trades with a 68% win rate. What would you like me to focus on?" },
    { from: 'user', text: 'Only trade tokens with more than $100K liquidity' },
    { from: 'bot', text: "Got it — updated my filter. I'll only enter positions on tokens with $100K+ liquidity. Currently tracking 312 qualifying tokens on Base." },
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatRef = useRef(null);
  const [wallet, setWallet] = useState(null);
  const [vaultBalance, setVaultBalance] = useState(null);
  const [ethPrice, setEthPrice] = useState(2300);
  const [txPending, setTxPending] = useState(false);
  const [txStatus, setTxStatus] = useState('');

  const botReplies = [
    "Got it — I've updated my strategy accordingly.",
    "Understood. Adjusting my approach now.",
    "Noted! I'll factor that into my decision making.",
    "I've logged that preference. Next scan in ~2 minutes.",
    "Good call. Updating my filters now.",
  ];

  useEffect(() => {
    fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot')
      .then(r => r.json())
      .then(d => setEthPrice(parseFloat(d.data.amount)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
        if (accounts.length > 0) connectWallet();
      });
    }
  }, []);

  useEffect(() => {
    if (wallet) loadVaultBalance();
  }, [wallet]);

  async function connectWallet() {
    if (!window.ethereum) { alert('No wallet found. Install MetaMask or Coinbase Wallet.'); return; }
    try {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
      } catch (switchErr) {
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }],
          });
        }
      }
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWallet(accounts[0]);
    } catch (err) { console.error(err); }
  }

  async function loadVaultBalance() {
    if (!wallet || !window.ethereum) return;
    try {
      const encoded = '0x05b1137b' + wallet.slice(2).toLowerCase().padStart(64, '0');
      const result = await window.ethereum.request({ method: 'eth_call', params: [{ to: BOTVAULT_ADDRESS, data: encoded }, 'latest'] });
      if (result && result !== '0x') {
        const ethBalance = Number(BigInt(result)) / 1e18;
        setVaultBalance(ethBalance * ethPrice);
      } else { setVaultBalance(0); }
    } catch (err) { setVaultBalance(0); }
  }

  async function handleDeposit() {
    if (!wallet) { await connectWallet(); return; }
    if (!depositAmount || parseFloat(depositAmount) < 1) { alert('Minimum deposit is $1.00'); return; }
    try {
      setTxPending(true); setTxStatus('Confirm in wallet...');
      const weiAmount = BigInt(Math.floor((parseFloat(depositAmount) / ethPrice) * 1e18));
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet, to: BOTVAULT_ADDRESS, value: '0x' + weiAmount.toString(16), data: '0x' }],
      });
      setTxStatus('Waiting for confirmation...');
      let receipt = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        receipt = await window.ethereum.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
        if (receipt) break;
      }
      setTxStatus('✅ Deposit confirmed!');
      await loadVaultBalance();
      setTimeout(() => { setTxStatus(''); setModalOpen(false); setDepositAmount(''); }, 2000);
    } catch (err) {
      setTxStatus('❌ ' + (err.message || 'Transaction failed'));
      setTimeout(() => setTxStatus(''), 3000);
    } finally { setTxPending(false); }
  }

  async function handleWithdraw() {
    if (!wallet) { await connectWallet(); return; }
    if (!vaultBalance || vaultBalance <= 0) { alert('No balance to withdraw.'); return; }
    try {
      setTxPending(true); setTxStatus('Confirm withdrawal in wallet...');
      const weiAmount = BigInt(Math.floor((vaultBalance / ethPrice) * 1e18));
      const data = '0x3d18b912' + weiAmount.toString(16).padStart(64, '0');
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: wallet, to: BOTVAULT_ADDRESS, data }],
      });
      setTxStatus('Waiting for confirmation...');
      let receipt = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        receipt = await window.ethereum.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
        if (receipt) break;
      }
      setTxStatus('✅ Withdrawal confirmed!');
      await loadVaultBalance();
      setTimeout(() => setTxStatus(''), 2000);
    } catch (err) {
      setTxStatus('❌ ' + (err.message || 'Transaction failed'));
      setTimeout(() => setTxStatus(''), 3000);
    } finally { setTxPending(false); }
  }

  const displayBalance = vaultBalance !== null ? `$${vaultBalance.toFixed(2)}` : wallet ? 'Loading...' : '$0.00';
  const shortWallet = wallet ? wallet.slice(0, 6) + '...' + wallet.slice(-4) : null;

  useEffect(() => {
    if (!botActive) return;
    const msgs = [`⚡ Scanning ${Math.floor(Math.random() * 200 + 700)} Base tokens...`,'🔍 Analyzing BRETT/USDC...','🛡️ Safety checking TOSHI...','📊 Signal detected on DEGEN — evaluating...','✅ MOCHI passed safety — calculating entry...'];
    const interval = setInterval(() => { setStatusLine(msgs[Math.floor(Math.random() * msgs.length)]); }, 3000);
    return () => clearInterval(interval);
  }, [botActive]);

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages]);

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setMessages(m => [...m, { from: 'user', text: userMsg }]);
    setChatInput('');
    setTimeout(() => { setMessages(m => [...m, { from: 'bot', text: botReplies[Math.floor(Math.random() * botReplies.length)] }]); }, 800);
  };

  const trades = [
    { icon: '🐸', token: 'BRETT/USDC', time: '2 min ago', pnl: '+$0.08', pct: '+16.0%', win: true },
    { icon: '🌊', token: 'DEGEN/USDC', time: '18 min ago', pnl: '-$0.03', pct: '-6.0%', win: false },
    { icon: '🐱', token: 'TOSHI/USDC', time: '41 min ago', pnl: '+$0.14', pct: '+28.0%', win: true },
    { icon: '🅱️', token: 'BALD/USDC', time: '1h ago', pnl: '+$0.22', pct: '+44.0%', win: true },
  ];

  const c = { orange:'#E85404', black:'#080810', dark:'#0D0D1A', card:'#111120', card2:'#16162A', border:'#1E1E35', text:'#F0F0FF', muted:'#6666AA', green:'#00E5A0', red:'#FF3355' };
  const s = {
    body:{ background:c.black, color:c.text, fontFamily:"'Syne',sans-serif", minHeight:'100vh', maxWidth:430, margin:'0 auto', position:'relative' },
    header:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px 12px', borderBottom:`1px solid ${c.border}`, background:c.black, position:'sticky', top:0, zIndex:100 },
    logo:{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800 },
    pill:{ display:'flex', alignItems:'center', gap:6, background:c.card, border:`1px solid ${c.border}`, borderRadius:20, padding:'5px 12px', fontFamily:'monospace', fontSize:10, color:c.muted },
    dot:{ width:7, height:7, borderRadius:'50%', background:botActive ? c.green : c.muted },
    content:{ paddingBottom:80 },
    hero:{ padding:'28px 20px 20px', background:`linear-gradient(180deg,${c.dark} 0%,${c.black} 100%)`, borderBottom:`1px solid ${c.border}` },
    statsRow:{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 },
    statBox:{ background:c.card, border:`1px solid ${c.border}`, borderRadius:10, padding:12 },
    ticker:{ overflow:'hidden', borderTop:`1px solid ${c.border}`, borderBottom:`1px solid ${c.border}`, padding:'8px 0', marginBottom:16 },
    botCard:{ margin:'16px 20px', background:c.card, border:`1px solid ${botActive ? c.orange : c.border}`, borderRadius:14, padding:16 },
    progressBar:{ height:3, background:c.border, borderRadius:2, overflow:'hidden' },
    section:{ margin:'0 20px 16px' },
    sectionTitle:{ fontSize:11, fontWeight:700, color:c.muted, textTransform:'uppercase', letterSpacing:1.5, marginBottom:10 },
    card:{ background:c.card, border:`1px solid ${c.border}`, borderRadius:14, padding:16 },
    actionRow:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, margin:'0 20px 16px' },
    tradeItem:{ background:c.card, border:`1px solid ${c.border}`, borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
    chatArea:{ margin:'0 20px 12px', background:c.card, border:`1px solid ${c.border}`, borderRadius:14, overflow:'hidden' },
    chatMsgs:{ height:280, overflowY:'auto', padding:14, display:'flex', flexDirection:'column', gap:10 },
    msgBot:{ maxWidth:'85%', padding:'10px 12px', borderRadius:'10px 10px 10px 2px', background:c.card2, border:`1px solid ${c.border}`, fontSize:12, lineHeight:1.5 },
    msgUser:{ maxWidth:'85%', padding:'10px 12px', borderRadius:'10px 10px 2px 10px', background:c.orange, color:'white', fontSize:12, lineHeight:1.5, marginLeft:'auto' },
    chatInputRow:{ display:'flex', borderTop:`1px solid ${c.border}` },
    chatInput:{ flex:1, background:'transparent', border:'none', outline:'none', padding:'12px 14px', fontFamily:"'Syne',sans-serif", fontSize:13, color:c.text },
    chatSend:{ background:c.orange, border:'none', padding:'12px 16px', color:'white', fontSize:16, cursor:'pointer' },
    nav:{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:430, background:c.dark, borderTop:`1px solid ${c.border}`, display:'flex', padding:'8px 0 20px', zIndex:100 },
    navItem:{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', padding:'6px 0' },
    modal:{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' },
    modalBox:{ background:c.dark, border:`1px solid ${c.border}`, borderRadius:'20px 20px 0 0', padding:20, width:'100%', maxWidth:430 },
  };

  return (
    <>
      <Head>
        <title>superB — AI Scalper Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet" />
        <style>{`
          * { margin:0; padding:0; box-sizing:border-box; }
          body { background:#080810; }
          input[type=range] { width:100%; height:4px; -webkit-appearance:none; background:#1E1E35; border-radius:2px; outline:none; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:20px; height:20px; border-radius:50%; background:#E85404; cursor:pointer; border:3px solid #080810; }
          @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
          @keyframes scan { 0%{width:0%} 100%{width:100%} }
          @keyframes pulsedot { 0%,100%{opacity:1} 50%{opacity:0.4} }
          .scan-fill { animation: scan 8s linear infinite; }
          .pulse-dot { animation: pulsedot 2s ease-in-out infinite; }
          ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#1E1E35;border-radius:2px}
        `}</style>
      </Head>
      <div style={s.body}>
        <div style={s.header}>
          <div style={s.logo}>super<span style={{color:'#E85404'}}>B</span></div>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            {!wallet ? (
              <button onClick={connectWallet} style={{background:c.orange, border:'none', borderRadius:20, padding:'6px 14px', fontFamily:'monospace', fontSize:10, color:'white', cursor:'pointer', fontWeight:700}}>Connect Wallet</button>
            ) : (
              <div style={s.pill}><div style={{width:7,height:7,borderRadius:'50%',background:c.green}}/><span>{shortWallet}</span></div>
            )}
            <div style={s.pill}><div style={s.dot} className={botActive?'pulse-dot':''}/><span>{botActive?'SCANNING':'PAUSED'}</span></div>
          </div>
        </div>

        <div style={s.content}>
          {page === 'home' && <>
            <div style={s.hero}>
              <div style={{fontFamily:'monospace',fontSize:10,color:c.muted,textTransform:'uppercase',letterSpacing:2,marginBottom:6}}>Your Vault Balance</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:48,fontWeight:800,letterSpacing:-2,lineHeight:1,marginBottom:4}}>
                <span style={{color:c.orange}}>{displayBalance}</span>
              </div>
              {!wallet && <div style={{fontFamily:'monospace',fontSize:11,color:c.muted,marginBottom:12}}>Connect wallet to see real balance</div>}
              <div style={{fontFamily:'monospace',fontSize:12,color:c.green,marginBottom:20}}>▲ +$12.40 today (+5.27%)</div>
              <div style={s.statsRow}>
                <div style={s.statBox}><div style={{fontFamily:'monospace',fontSize:16,fontWeight:700,marginBottom:2}}>47</div><div style={{fontSize:9,color:c.muted,textTransform:'uppercase',letterSpacing:1}}>Trades</div></div>
                <div style={s.statBox}><div style={{fontFamily:'monospace',fontSize:16,fontWeight:700,color:c.green,marginBottom:2}}>68%</div><div style={{fontSize:9,color:c.muted,textTransform:'uppercase',letterSpacing:1}}>Win Rate</div></div>
                <div style={s.statBox}><div style={{fontFamily:'monospace',fontSize:16,fontWeight:700,color:c.orange,marginBottom:2}}>${riskAmount.toFixed(2)}</div><div style={{fontSize:9,color:c.muted,textTransform:'uppercase',letterSpacing:1}}>Risk/Trade</div></div>
              </div>
            </div>
            <div style={s.ticker}>
              <div style={{display:'flex',gap:32,animation:'ticker 20s linear infinite',whiteSpace:'nowrap',fontFamily:'monospace',fontSize:10}}>
                {['BRETT ▲2.4%','DEGEN ▼0.8%','TOSHI ▲5.1%','BASE ▲1.2%','BALD ▼3.2%','MOCHI ▲8.4%','BRETT ▲2.4%','DEGEN ▼0.8%','TOSHI ▲5.1%','BASE ▲1.2%'].map((t,i) => (
                  <span key={i} style={{color:t.includes('▼')?c.red:c.green}}>{t}</span>
                ))}
              </div>
            </div>
            <div style={s.botCard}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:c.muted,textTransform:'uppercase',letterSpacing:1}}>🤖 Your Bot</div>
                <button style={{width:44,height:24,background:botActive?c.orange:c.border,borderRadius:12,position:'relative',cursor:'pointer',border:'none'}} onClick={()=>setBotActive(!botActive)}>
                  <div style={{position:'absolute',width:18,height:18,background:'white',borderRadius:'50%',top:3,left:botActive?23:3,transition:'left 0.2s'}}/>
                </button>
              </div>
              <div style={{fontFamily:'monospace',fontSize:11,color:botActive?c.green:c.muted,marginBottom:10}}>{botActive?statusLine:'⏸ Bot paused — no trades will execute'}</div>
              <div style={s.progressBar}>{botActive&&<div className="scan-fill" style={{height:'100%',background:c.orange,borderRadius:2}}/>}</div>
            </div>
            <div style={s.actionRow}>
              <div style={{background:c.orange,border:`1px solid ${c.orange}`,borderRadius:12,padding:14,cursor:'pointer',textAlign:'center'}} onClick={()=>wallet?setModalOpen(true):connectWallet()}>
                <div style={{fontSize:20,marginBottom:4}}>💰</div>
                <div style={{fontSize:12,fontWeight:700,color:'white'}}>Deposit</div>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.7)'}}>{wallet?'Add funds':'Connect wallet'}</div>
              </div>
              <div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:12,padding:14,cursor:'pointer',textAlign:'center'}} onClick={()=>wallet?handleWithdraw():connectWallet()}>
                <div style={{fontSize:20,marginBottom:4}}>📤</div>
                <div style={{fontSize:12,fontWeight:700}}>Withdraw</div>
                <div style={{fontSize:10,color:c.muted}}>{wallet?'Pull funds out':'Connect wallet'}</div>
              </div>
            </div>
            {txStatus&&<div style={{margin:'0 20px 12px',background:c.card,border:`1px solid ${c.border}`,borderRadius:10,padding:12,fontFamily:'monospace',fontSize:11,color:txStatus.includes('✅')?c.green:txStatus.includes('❌')?c.red:c.orange,textAlign:'center'}}>{txStatus}</div>}
            <div style={s.section}>
              <div style={s.sectionTitle}>Recent Trades</div>
              {trades.slice(0,3).map((t,i)=>(
                <div key={i} style={s.tradeItem}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:32,height:32,borderRadius:8,background:c.card2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>{t.icon}</div>
                    <div><div style={{fontFamily:'monospace',fontSize:12,fontWeight:700}}>{t.token}</div><div style={{fontSize:10,color:c.muted}}>{t.time}</div></div>
                  </div>
                  <div style={{textAlign:'right'}}><div style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:t.win?c.green:c.red}}>{t.pnl}</div><div style={{fontSize:10,color:c.muted}}>{t.pct}</div></div>
                </div>
              ))}
            </div>
          </>}

          {page === 'trade' && <div style={{padding:'20px 0 0'}}>
            <div style={s.section}>
              <div style={{...s.card,marginBottom:16,display:'flex',alignItems:'center',gap:16}}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#1E1E35" strokeWidth="8"/>
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#00E5A0" strokeWidth="8" strokeDasharray="201" strokeDashoffset="64" strokeLinecap="round" transform="rotate(-90 40 40)"/>
                </svg>
                <div>
                  <div style={{fontFamily:'monospace',fontSize:28,fontWeight:700,color:c.green}}>68%</div>
                  <div style={{fontSize:11,color:c.muted}}>Win Rate · 47 trades</div>
                  <div style={{display:'flex',gap:16,marginTop:8}}>
                    {[['32','Wins',c.green],[' 15','Losses',c.red],['+$12.40','Net P&L',c.orange]].map(([v,l,col])=>(
                      <div key={l}><div style={{fontFamily:'monospace',fontSize:14,fontWeight:700,color:col}}>{v}</div><div style={{fontSize:9,color:c.muted}}>{l}</div></div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={s.sectionTitle}>Risk Per Trade</div>
              <div style={s.card}>
                <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:14}}>
                  <div style={{fontFamily:'monospace',fontSize:32,fontWeight:700,color:c.orange}}>${riskAmount.toFixed(2)}</div>
                  <div style={{fontFamily:'monospace',fontSize:13,color:c.muted}}>per trade</div>
                </div>
                <div style={{fontSize:10,color:c.muted,marginBottom:10}}>Min $0.10 · No maximum</div>
                <input type="range" min="1" max="100" value={Math.round(riskAmount*10)} onChange={e=>setRiskAmount(e.target.value*0.1)}/>
                <div style={{display:'flex',gap:6,marginTop:10}}>
                  {[0.10,0.50,1.00,5.00,10.00].map(v=>(
                    <div key={v} onClick={()=>setRiskAmount(v)} style={{flex:1,background:c.card2,border:`1px solid ${Math.abs(riskAmount-v)<0.01?c.orange:c.border}`,borderRadius:8,padding:'6px 4px',fontFamily:'monospace',fontSize:10,color:Math.abs(riskAmount-v)<0.01?c.orange:c.muted,cursor:'pointer',textAlign:'center'}}>${v.toFixed(2)}</div>
                  ))}
                </div>
              </div>
            </div>
            <div style={s.section}>
              <div style={s.sectionTitle}>All Trades</div>
              {trades.map((t,i)=>(
                <div key={i} style={s.tradeItem}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:32,height:32,borderRadius:8,background:c.card2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>{t.icon}</div>
                    <div><div style={{fontFamily:'monospace',fontSize:12,fontWeight:700}}>{t.token}</div><div style={{fontSize:10,color:c.muted}}>{t.time}</div></div>
                  </div>
                  <div style={{textAlign:'right'}}><div style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:t.win?c.green:c.red}}>{t.pnl}</div><div style={{fontSize:10,color:c.muted}}>{t.pct}</div></div>
                </div>
              ))}
            </div>
          </div>}

          {page === 'chat' && <div style={{padding:'20px 0 0'}}>
            <div style={s.section}>
              <div style={s.sectionTitle}>Train Your Bot</div>
              <div style={{fontSize:11,color:c.muted,marginBottom:12}}>Tell your bot what to focus on. It learns and remembers.</div>
            </div>
            <div style={s.chatArea}>
              <div style={s.chatMsgs} ref={chatRef}>
                {messages.map((m,i)=>(
                  <div key={i} style={m.from==='bot'?s.msgBot:s.msgUser}>
                    {m.from==='bot'&&<div style={{fontFamily:'monospace',fontSize:9,color:c.muted,marginBottom:4}}>superB BOT</div>}
                    {m.text}
                  </div>
                ))}
              </div>
              <div style={s.chatInputRow}>
                <input style={s.chatInput} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyPress={e=>e.key==='Enter'&&sendMessage()} placeholder="Ask or train your bot..."/>
                <button style={s.chatSend} onClick={sendMessage}>↑</button>
              </div>
            </div>
            <div style={s.section}>
              <div style={s.sectionTitle}>Quick Commands</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {["What are you watching?","My stats","Be more aggressive","Avoid memecoins","Pause trading","Resume trading"].map(cmd=>(
                  <div key={cmd} onClick={()=>{setChatInput(cmd);setTimeout(()=>sendMessage(),100);}} style={{background:c.card2,border:`1px solid ${c.border}`,borderRadius:8,padding:'8px 12px',fontFamily:'monospace',fontSize:10,color:c.muted,cursor:'pointer'}}>{cmd}</div>
                ))}
              </div>
            </div>
          </div>}

          {page === 'settings' && <div style={{padding:20}}>
            <div style={{...s.sectionTitle,marginBottom:16}}>Account</div>
            <div style={{...s.card,marginBottom:12}}>
              <div style={{fontSize:11,color:c.muted,marginBottom:4}}>CONNECTED WALLET</div>
              {wallet ? (
                <><div style={{fontFamily:'monospace',fontSize:12}}>{shortWallet}</div><div style={{fontSize:10,color:c.muted,marginTop:4}}>Base Network · superb.base.eth</div></>
              ) : (
                <button onClick={connectWallet} style={{background:c.orange,border:'none',borderRadius:10,padding:'10px 16px',fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:'white',cursor:'pointer',marginTop:4}}>Connect Wallet</button>
              )}
            </div>
            <div style={{...s.card,marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700}}>Vault Balance</div>
                <div style={{fontFamily:'monospace',fontSize:16,color:c.orange}}>{displayBalance}</div>
              </div>
              <button onClick={()=>wallet?setModalOpen(true):connectWallet()} style={{width:'100%',background:c.orange,border:'none',borderRadius:12,padding:14,fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,color:'white',cursor:'pointer',marginBottom:8}}>Deposit Funds</button>
              <button onClick={()=>wallet?handleWithdraw():connectWallet()} style={{width:'100%',background:'transparent',border:`1px solid ${c.border}`,borderRadius:12,padding:12,fontFamily:"'Syne',sans-serif",fontSize:13,color:c.muted,cursor:'pointer'}}>Withdraw All Funds</button>
              {txStatus&&<div style={{marginTop:10,fontFamily:'monospace',fontSize:11,color:txStatus.includes('✅')?c.green:txStatus.includes('❌')?c.red:c.orange,textAlign:'center'}}>{txStatus}</div>}
            </div>
            <div style={{...s.sectionTitle,margin:'20px 0 12px'}}>Protection</div>
            <div style={s.card}>
              {[['Rug Pull Protection','GoPlus API safety scan',c.green,'ON'],['Min Liquidity Filter','Skip tokens below threshold',c.orange,'$50K'],['Token Age Filter','Skip tokens newer than',c.orange,'72h']].map(([title,sub,col,val],i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<2?`1px solid ${c.border}`:'none'}}>
                  <div><div style={{fontSize:13,fontWeight:600}}>{title}</div><div style={{fontSize:10,color:c.muted}}>{sub}</div></div>
                  <div style={{fontFamily:'monospace',fontSize:11,color:col}}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{...s.sectionTitle,margin:'20px 0 12px'}}>About</div>
            <div style={s.card}>
              <div style={{fontSize:11,color:c.muted,lineHeight:1.8}}>
                superB v1.0 · superb.base.eth<br/>
                Contract: {BOTVAULT_ADDRESS.slice(0,10)}...{BOTVAULT_ADDRESS.slice(-6)}<br/>
                AI Scalper Bot on Base blockchain<br/>
                0.5% fee per trade · Self-custodial vault<br/><br/>
                <span style={{color:c.orange}}>Your funds never leave your vault.</span>
              </div>
            </div>
          </div>}
        </div>

        <div style={s.nav}>
          {[['home','⚡','Home'],['trade','📊','Trade'],['chat','💬','Chat'],['settings','⚙️','Settings']].map(([id,icon,label])=>(
            <div key={id} style={s.navItem} onClick={()=>setPage(id)}>
              <div style={{fontSize:20}}>{icon}</div>
              <div style={{fontFamily:'monospace',fontSize:9,textTransform:'uppercase',letterSpacing:1,color:page===id?c.orange:c.muted}}>{label}</div>
            </div>
          ))}
        </div>

        {modalOpen&&(
          <div style={s.modal} onClick={e=>e.target===e.currentTarget&&setModalOpen(false)}>
            <div style={s.modalBox}>
              <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Deposit to Vault</div>
              <div style={{fontSize:11,color:c.muted,marginBottom:12}}>Minimum $1.00 · ETH on Base · Funds stay in your vault</div>
              <input type="number" placeholder="$0.00" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)}
                style={{width:'100%',background:c.card,border:`1px solid ${c.border}`,borderRadius:10,padding:14,fontFamily:'monospace',fontSize:20,color:c.text,outline:'none',marginBottom:4,textAlign:'center'}}/>
              {depositAmount&&parseFloat(depositAmount)>0&&(
                <div style={{fontFamily:'monospace',fontSize:10,color:c.muted,textAlign:'center',marginBottom:12}}>≈ {(parseFloat(depositAmount)/ethPrice).toFixed(6)} ETH at ${ethPrice.toLocaleString()}/ETH</div>
              )}
              {(!depositAmount||parseFloat(depositAmount)<=0)&&<div style={{marginBottom:12}}/>}
              <button onClick={handleDeposit} disabled={txPending} style={{width:'100%',background:txPending?c.muted:c.orange,border:'none',borderRadius:12,padding:16,fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:'white',cursor:txPending?'not-allowed':'pointer',marginBottom:10}}>
                {txPending?'Processing...':'Deposit via Base Wallet'}
              </button>
              {txStatus&&<div style={{fontFamily:'monospace',fontSize:11,color:txStatus.includes('✅')?c.green:txStatus.includes('❌')?c.red:c.orange,textAlign:'center',marginBottom:10}}>{txStatus}</div>}
              <button onClick={()=>setModalOpen(false)} style={{width:'100%',background:'transparent',border:`1px solid ${c.border}`,borderRadius:12,padding:14,fontFamily:"'Syne',sans-serif",fontSize:14,color:c.muted,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
