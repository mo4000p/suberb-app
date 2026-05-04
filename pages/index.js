import { useState, useEffect, useRef } from "react";
import Head from "next/head";

const USDC_ADDRESS      = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const EXECUTOR_ADDRESS  = "0xA614bd493884A7f1828B7930E8D87290c79Aaf70";
const RAILWAY_URL       = "https://courageous-imagination-production-378d.up.railway.app";
const BASE_CHAIN_ID     = "0x2105";

function encodeBalanceOf(address) {
  const sig = "0x70a08231";
  const padded = address.replace("0x", "").padStart(64, "0");
  return sig + padded;
}

function encodeAllowance(owner, spender) {
  const sig           = "0xdd62ed3e";
  const paddedOwner   = owner.replace("0x", "").padStart(64, "0");
  const paddedSpender = spender.replace("0x", "").padStart(64, "0");
  return sig + paddedOwner + paddedSpender;
}

export default function Home() {
  const [account,     setAccount]     = useState(null);
  const [usdcBalance, setUsdcBalance] = useState("0.00");
  const [allowance,   setAllowance]   = useState("0.00");
  const [mode,        setMode]        = useState("default");
  const [screen,      setScreen]      = useState("home");
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [approving,   setApproving]   = useState(false);
  const [status,      setStatus]      = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        alert("Please open in Coinbase Wallet or MetaMask");
        return;
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainId  = await window.ethereum.request({ method: "eth_chainId" });
      if (chainId !== BASE_CHAIN_ID) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BASE_CHAIN_ID }],
        });
      }
      setAccount(accounts[0]);
      await fetchBalances(accounts[0]);
      setStatus("Wallet connected ✓");
    } catch (err) {
      setStatus("Connection failed: " + err.message);
    }
  }

  async function fetchBalances(addr) {
    try {
      const balResult = await window.ethereum.request({
        method: "eth_call",
        params: [{ to: USDC_ADDRESS, data: encodeBalanceOf(addr) }, "latest"],
      });
      const bal = parseInt(balResult, 16) / 1e6;
      setUsdcBalance(isNaN(bal) ? "0.00" : bal.toFixed(2));

      const alwResult = await window.ethereum.request({
        method: "eth_call",
        params: [{ to: USDC_ADDRESS, data: encodeAllowance(addr, EXECUTOR_ADDRESS) }, "latest"],
      });
      const alw = parseInt(alwResult, 16) / 1e6;
      setAllowance(isNaN(alw) ? "0.00" : alw.toFixed(2));
    } catch (err) {
      setStatus("Balance fetch failed: " + err.message);
    }
  }

  async function approveUSDC(amount) {
    try {
      setApproving(true);
      setStatus("Waiting for approval...");

      // Encode approve(spender, amount) — no ethers needed
      const spender   = EXECUTOR_ADDRESS.replace("0x", "").padStart(64, "0");
      const amountHex = Math.floor(amount * 1e6).toString(16).padStart(64, "0");
      const data      = "0x095ea7b3" + spender + amountHex;

      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: USDC_ADDRESS, data, gas: "0x186A0" }],
      });

      setStatus("Approval sent — waiting for confirmation...");

      // Register with brain
      await fetch(`${RAILWAY_URL}/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userAddress: account, approvedAmount: amount * 1e6 }),
      });

      await fetchBalances(account);
      setStatus(`Approved $${amount} USDC ✓ — bot is now trading for you`);
    } catch (err) {
      setStatus("Approval failed: " + err.message);
    } finally {
      setApproving(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !account) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res  = await fetch(`${RAILWAY_URL}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userAddress: account, message: userMsg }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "bot", content: data.reply }]);
      if (userMsg.toLowerCase().includes("default mode") || userMsg.toLowerCase().includes("reset")) setMode("default");
      else if (userMsg.toLowerCase().includes("scalp") || userMsg.toLowerCase().includes("watch")) setMode("custom");
    } catch (err) {
      setMessages(prev => [...prev, { role: "bot", content: "Connection error. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function setQuickMode(newMode) {
    if (!account) return;
    setMode(newMode);
    const msgMap = { default: "default mode", scalp: "scalp trending tokens", whale: "whale hunt mode" };
    const msg = msgMap[newMode];
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setScreen("chat");
    setLoading(true);
    try {
      const res  = await fetch(`${RAILWAY_URL}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userAddress: account, message: msg }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "bot", content: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "bot", content: "Mode updated." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>superB — AI Trader</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080c0f; color: #e8eaed; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        .app { max-width: 430px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; }
        .header { display: flex; align-items: center; justify-content: space-between; padding: 20px 20px 12px; border-bottom: 1px solid #1a2228; }
        .logo { font-family: 'Space Mono', monospace; font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -1px; }
        .logo span { color: #00e676; }
        .mode-badge { font-family: 'Space Mono', monospace; font-size: 10px; padding: 4px 10px; border-radius: 20px; border: 1px solid; }
        .mode-badge.default { border-color: #00e676; color: #00e676; }
        .mode-badge.custom  { border-color: #ffb300; color: #ffb300; }
        .nav { display: flex; border-bottom: 1px solid #1a2228; }
        .nav-btn { flex: 1; padding: 14px; background: none; border: none; color: #556068; font-family: 'Space Mono', monospace; font-size: 11px; cursor: pointer; transition: all 0.2s; }
        .nav-btn.active { color: #00e676; border-bottom: 2px solid #00e676; }
        .screen { flex: 1; padding: 20px; overflow-y: auto; }
        .wallet-card { background: #0d1419; border: 1px solid #1a2228; border-radius: 16px; padding: 20px; margin-bottom: 16px; }
        .wallet-label { font-size: 11px; color: #556068; font-family: 'Space Mono', monospace; letter-spacing: 1px; margin-bottom: 8px; }
        .wallet-addr { font-family: 'Space Mono', monospace; font-size: 13px; color: #8a9ba8; margin-bottom: 16px; }
        .balance-row { display: flex; justify-content: space-between; align-items: flex-end; }
        .balance-amount { font-family: 'Space Mono', monospace; font-size: 28px; font-weight: 700; color: #fff; }
        .balance-sub { font-size: 12px; color: #556068; margin-top: 2px; }
        .allowance-tag { font-size: 11px; color: #00e676; font-family: 'Space Mono', monospace; }
        .connect-btn { width: 100%; padding: 16px; background: #00e676; color: #080c0f; border: none; border-radius: 12px; font-family: 'Space Mono', monospace; font-size: 14px; font-weight: 700; cursor: pointer; }
        .section-title { font-family: 'Space Mono', monospace; font-size: 11px; color: #556068; letter-spacing: 1px; margin: 20px 0 12px; }
        .mode-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .mode-card { background: #0d1419; border: 1px solid #1a2228; border-radius: 12px; padding: 14px 10px; text-align: center; cursor: pointer; transition: all 0.2s; }
        .mode-card.active { border-color: #00e676; background: #0a1f14; }
        .mode-icon { font-size: 22px; margin-bottom: 6px; }
        .mode-name { font-family: 'Space Mono', monospace; font-size: 10px; color: #8a9ba8; }
        .mode-card.active .mode-name { color: #00e676; }
        .approve-card { background: #0d1419; border: 1px solid #1a2228; border-radius: 16px; padding: 20px; margin-bottom: 16px; }
        .approve-title { font-family: 'Space Mono', monospace; font-size: 12px; color: #fff; margin-bottom: 8px; }
        .approve-desc { font-size: 13px; color: #556068; margin-bottom: 16px; line-height: 1.5; }
        .approve-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .approve-btn { padding: 12px; background: #0a1f14; border: 1px solid #00e676; border-radius: 10px; color: #00e676; font-family: 'Space Mono', monospace; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .approve-btn:hover:not(:disabled) { background: #00e676; color: #080c0f; }
        .approve-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .status { font-size: 12px; color: #556068; text-align: center; padding: 8px; font-family: 'Space Mono', monospace; }
        .status.ok { color: #00e676; }
        .refresh-btn { background: none; border: 1px solid #1a2228; border-radius: 8px; color: #556068; font-size: 11px; padding: 4px 10px; cursor: pointer; font-family: 'Space Mono', monospace; }
        .chat-messages { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; max-height: calc(100vh - 220px); }
        .msg { max-width: 80%; padding: 12px 14px; border-radius: 12px; font-size: 14px; line-height: 1.5; }
        .msg.user { background: #00e676; color: #080c0f; align-self: flex-end; font-weight: 500; }
        .msg.bot  { background: #0d1419; border: 1px solid #1a2228; color: #e8eaed; align-self: flex-start; font-family: 'Space Mono', monospace; font-size: 12px; }
        .msg.bot.loading { color: #556068; }
        .chat-input-row { display: flex; gap: 8px; padding: 16px; border-top: 1px solid #1a2228; }
        .chat-input { flex: 1; background: #0d1419; border: 1px solid #1a2228; border-radius: 10px; padding: 12px 14px; color: #e8eaed; font-size: 14px; outline: none; }
        .chat-input:focus { border-color: #00e676; }
        .chat-input::placeholder { color: #556068; }
        .send-btn { padding: 12px 16px; background: #00e676; border: none; border-radius: 10px; color: #080c0f; font-family: 'Space Mono', monospace; font-size: 12px; cursor: pointer; font-weight: 700; }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .settings-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid #1a2228; }
        .settings-label { font-size: 14px; color: #e8eaed; }
        .settings-value { font-family: 'Space Mono', monospace; font-size: 12px; color: #556068; }
        .settings-link { font-family: 'Space Mono', monospace; font-size: 11px; color: #00e676; text-decoration: none; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="logo">super<span>B</span></div>
          <div className={`mode-badge ${mode === "default" ? "default" : "custom"}`}>
            {mode === "default" ? "DEFAULT" : "CUSTOM"}
          </div>
        </div>
        <div className="nav">
          {["home","chat","settings"].map(s => (
            <button key={s} className={`nav-btn ${screen === s ? "active" : ""}`} onClick={() => setScreen(s)}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {screen === "home" && (
          <div className="screen">
            {!account ? (
              <>
                <div style={{textAlign:"center", padding:"40px 0 32px"}}>
                  <div style={{fontFamily:"'Space Mono',monospace", fontSize:48, marginBottom:8}}>⚡</div>
                  <div style={{fontFamily:"'Space Mono',monospace", fontSize:16, color:"#fff", marginBottom:8}}>AI Scalper Bot</div>
                  <div style={{fontSize:13, color:"#556068", lineHeight:1.6}}>Trades Base tokens automatically.<br/>Funds stay in your wallet.</div>
                </div>
                <button className="connect-btn" onClick={connectWallet}>CONNECT WALLET</button>
              </>
            ) : (
              <>
                <div className="wallet-card">
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
                    <div className="wallet-label" style={{margin:0}}>YOUR WALLET</div>
                    <button className="refresh-btn" onClick={() => fetchBalances(account)}>↻ REFRESH</button>
                  </div>
                  <div className="wallet-addr">{account.slice(0,6)}...{account.slice(-4)}</div>
                  <div className="balance-row">
                    <div>
                      <div className="balance-amount">${usdcBalance}</div>
                      <div className="balance-sub">USDC on Base</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div className="allowance-tag">✓ ${allowance} approved</div>
                      <div className="balance-sub" style={{marginTop:4}}>trading limit</div>
                    </div>
                  </div>
                </div>

                <div className="section-title">TRADING MODE</div>
                <div className="mode-grid">
                  {[
                    { id:"default", icon:"🔍", name:"DEFAULT" },
                    { id:"scalp",   icon:"⚡", name:"SCALP"   },
                    { id:"whale",   icon:"🐋", name:"WHALE"   },
                  ].map(m => (
                    <div key={m.id} className={`mode-card ${mode === m.id ? "active" : ""}`} onClick={() => setQuickMode(m.id)}>
                      <div className="mode-icon">{m.icon}</div>
                      <div className="mode-name">{m.name}</div>
                    </div>
                  ))}
                </div>

                <div className="approve-card">
                  <div className="approve-title">SET TRADING LIMIT</div>
                  <div className="approve-desc">Approve the bot to pull USDC from your wallet when trading. Revoke anytime to stop.</div>
                  <div className="approve-grid">
                    {[20, 50, 100, 250].map(amt => (
                      <button key={amt} className="approve-btn" disabled={approving} onClick={() => approveUSDC(amt)}>
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>

                {status && <div className={`status ${status.includes("✓") ? "ok" : ""}`}>{status}</div>}

                <div className="wallet-card" style={{marginTop:8}}>
                  <div className="wallet-label">BOT STATUS</div>
                  <div style={{display:"flex", alignItems:"center", gap:8, marginTop:4}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:"#00e676"}} className="pulse"></div>
                    <span style={{fontFamily:"'Space Mono',monospace", fontSize:12, color:"#00e676"}}>SCANNING BASE NETWORK</span>
                  </div>
                  <div style={{fontSize:12, color:"#556068", marginTop:8}}>Scanning trending tokens every 2 minutes</div>
                </div>
              </>
            )}
          </div>
        )}

        {screen === "chat" && (
          <>
            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="msg bot">Hey! I am your superB trading bot. Tell me what to do — scalp a token, go whale hunting, or ask about your trades.</div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.role === "user" ? "user" : "bot"}`}>{m.content}</div>
              ))}
              {loading && <div className="msg bot loading pulse">thinking...</div>}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-input-row">
              <input
                className="chat-input"
                placeholder={account ? "Tell the bot what to do..." : "Connect wallet first"}
                value={input}
                disabled={!account || loading}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
              />
              <button className="send-btn" disabled={!account || loading || !input.trim()} onClick={sendMessage}>SEND</button>
            </div>
          </>
        )}

        {screen === "settings" && (
          <div className="screen">
            <div className="section-title">ACCOUNT</div>
            <div className="settings-row">
              <div className="settings-label">Wallet</div>
              <div className="settings-value">{account ? `${account.slice(0,6)}...${account.slice(-4)}` : "Not connected"}</div>
            </div>
            <div className="settings-row">
              <div className="settings-label">Network</div>
              <div className="settings-value">Base Mainnet</div>
            </div>
            <div className="settings-row">
              <div className="settings-label">Trading Limit</div>
              <div className="settings-value">${allowance} USDC</div>
            </div>
            <div className="settings-row">
              <div className="settings-label">Mode</div>
              <div className="settings-value">{mode.toUpperCase()}</div>
            </div>
            <div className="section-title" style={{marginTop:24}}>REVOKE ACCESS</div>
            <div style={{fontSize:13, color:"#556068", lineHeight:1.6, marginBottom:16}}>
              To stop the bot, revoke its USDC allowance on BaseScan. Set the approval amount to 0 for the executor address.
            </div>
            <a className="settings-link" href={`https://basescan.org/address/${USDC_ADDRESS}#writeContract`} target="_blank" rel="noreferrer">
              REVOKE ON BASESCAN
            </a>
            <div className="section-title" style={{marginTop:24}}>ABOUT</div>
            <div className="settings-row">
              <div className="settings-label">Version</div>
              <div className="settings-value">v2.0.0</div>
            </div>
            <div className="settings-row">
              <div className="settings-label">Fee</div>
              <div className="settings-value">0.5% per trade</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
